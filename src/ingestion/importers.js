/**
 * ingestion/importers.js
 * Parsers for JSON and CSV imports with validation.
 *
 * Returns normalized bundle ready for writeCourseBundle().
 * Throws descriptive errors on invalid format.
 */

import { autoGroup } from './autoGroup.js';
import { thumbnailUrl } from './youtube.js';

// ─── JSON Import ─────────────────────────────────────────────────────────────

/**
 * Parse JSON import — supports two formats:
 *   1. Array of flat objects: [{ title, url, week?, description? }, ...]
 *   2. Full bundle: { course: {...}, modules: [{mod, lessons}, ...] }
 */
export function parseJSONImport(text, courseMeta) {
  if (!text?.trim()) throw new Error('No JSON provided.');

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }

  // Format 1: Array of lessons
  if (Array.isArray(data)) {
    return parseJSONLessonArray(data, courseMeta);
  }

  // Format 2: Full bundle object
  if (data && typeof data === 'object' && data.course && data.modules) {
    validateBundle(data);
    return data;
  }

  throw new Error('JSON must be an array of lessons or a full bundle {course, modules}.');
}

function parseJSONLessonArray(lessons, courseMeta) {
  if (!Array.isArray(lessons) || !lessons.length) {
    throw new Error('Lessons array is empty.');
  }

  const validated = lessons.map((lesson, i) => {
    if (!lesson.title || typeof lesson.title !== 'string') {
      throw new Error(`Lesson ${i}: missing or invalid "title" field.`);
    }
    if (!lesson.url && !lesson.videoId) {
      throw new Error(`Lesson ${i}: missing "url" or "videoId" field.`);
    }

    const videoId = extractVideoIdFromUrl(lesson.url || lesson.videoId);
    if (!videoId && lesson.url?.includes('youtu')) {
      throw new Error(`Lesson ${i}: couldn't extract video ID from "${lesson.url}".`);
    }

    return {
      id: crypto.randomUUID(),
      title: lesson.title.trim(),
      videoId: videoId || lesson.videoId || '',
      url: lesson.url || (videoId ? `https://youtu.be/${videoId}` : ''),
      thumbnail: videoId ? thumbnailUrl(videoId) : '',
      position: i,
      description: lesson.description || '',
    };
  });

  const groups = autoGroup(validated, {
    groupSize: 5,
    groupByField: 'week',
    moduleLabel: n => `Week ${n}`,
  });

  return {
    course: {
      id: crypto.randomUUID(),
      title: courseMeta.title || 'Imported Course',
      level: courseMeta.level || '',
      label: courseMeta.label || '',
      accent: courseMeta.accent || '#e94560',
      source: 'json_import',
    },
    modules: groups.map(g => ({
      mod: { id: crypto.randomUUID(), title: g.title, position: g.position },
      lessons: g.lessons,
    })),
  };
}

// ─── CSV Import ──────────────────────────────────────────────────────────────

/**
 * Parse CSV import.
 * Required: title, url (or videoId)
 * Optional: week, description
 * First row is header.
 */
export function parseCSVImport(text, courseMeta) {
  if (!text?.trim()) throw new Error('No CSV provided.');

  const lines = text
    .trim()
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#')); // Skip empty and comments

  if (!lines.length) throw new Error('CSV is empty.');

  const [headerLine, ...dataLines] = lines;
  const headers = parseCSVLine(headerLine);

  const titleIdx = headers.findIndex(h => h.toLowerCase() === 'title');
  const urlIdx = headers.findIndex(h => ['url', 'videoid', 'video_id'].includes(h.toLowerCase()));
  const weekIdx = headers.findIndex(h => h.toLowerCase() === 'week');
  const descIdx = headers.findIndex(h => h.toLowerCase() === 'description');

  if (titleIdx === -1) throw new Error('CSV: missing "title" column.');
  if (urlIdx === -1) throw new Error('CSV: missing "url" or "videoId" column.');

  if (!dataLines.length) throw new Error('CSV: no data rows found (only header).');

  const lessons = dataLines.map((line, i) => {
    const fields = parseCSVLine(line);
    const title = (fields[titleIdx] || '').trim();
    const url = (fields[urlIdx] || '').trim();
    const week = weekIdx >= 0 ? parseInt(fields[weekIdx]) || null : null;
    const description = descIdx >= 0 ? (fields[descIdx] || '').trim() : '';

    if (!title) {
      throw new Error(`CSV row ${i + 2}: missing or empty "title".`);
    }
    if (!url) {
      throw new Error(`CSV row ${i + 2}: missing or empty URL.`);
    }

    const videoId = extractVideoIdFromUrl(url);
    if (!videoId && url.includes('youtu')) {
      throw new Error(`CSV row ${i + 2}: couldn't extract video ID from "${url}".`);
    }

    return {
      id: crypto.randomUUID(),
      title,
      videoId: videoId || url,
      url: videoId ? `https://youtu.be/${videoId}` : url,
      thumbnail: videoId ? thumbnailUrl(videoId) : '',
      position: i,
      week: week || null,
      description,
    };
  });

  const groups = autoGroup(lessons, {
    groupSize: 5,
    groupByField: 'week',
    moduleLabel: n => `Week ${n}`,
  });

  return {
    course: {
      id: crypto.randomUUID(),
      title: courseMeta.title || 'Imported Course',
      level: courseMeta.level || '',
      label: courseMeta.label || '',
      accent: courseMeta.accent || '#e94560',
      source: 'csv_import',
    },
    modules: groups.map(g => ({
      mod: { id: crypto.randomUUID(), title: g.title, position: g.position },
      lessons: g.lessons,
    })),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function extractVideoIdFromUrl(url) {
  if (!url) return null;

  // youtu.be/ID
  let match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];

  // youtube.com/watch?v=ID
  match = url.match(/youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];

  // youtube.com/shorts/ID
  match = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];

  // Just an ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;

  return null;
}

function validateBundle(bundle) {
  if (!bundle.course || typeof bundle.course !== 'object') {
    throw new Error('Bundle: missing or invalid "course" object.');
  }

  const { course } = bundle;
  if (!course.id || typeof course.id !== 'string') {
    throw new Error('Bundle: course.id must be a non-empty string.');
  }
  if (!course.title || typeof course.title !== 'string') {
    throw new Error('Bundle: course.title must be a non-empty string.');
  }

  if (!Array.isArray(bundle.modules) || !bundle.modules.length) {
    throw new Error('Bundle: must have at least one module.');
  }

  bundle.modules.forEach((mod, modIdx) => {
    if (!mod.mod || typeof mod.mod !== 'object') {
      throw new Error(`Bundle: module ${modIdx} missing mod object.`);
    }
    if (!mod.mod.id || !mod.mod.title) {
      throw new Error(`Bundle: module ${modIdx} mod missing id or title.`);
    }
    if (!Array.isArray(mod.lessons) || !mod.lessons.length) {
      throw new Error(`Bundle: module ${modIdx} must have at least one lesson.`);
    }

    mod.lessons.forEach((lesson, lessonIdx) => {
      if (!lesson.id || typeof lesson.id !== 'string') {
        throw new Error(`Bundle: module ${modIdx} lesson ${lessonIdx} missing id.`);
      }
      if (!lesson.title || typeof lesson.title !== 'string') {
        throw new Error(`Bundle: module ${modIdx} lesson ${lessonIdx} missing title.`);
      }
      if (!lesson.videoId && !lesson.url) {
        throw new Error(
          `Bundle: module ${modIdx} lesson ${lessonIdx} missing videoId or url.`
        );
      }
    });
  });
}
