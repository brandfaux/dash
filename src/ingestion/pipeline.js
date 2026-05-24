/**
 * ingestion/pipeline.js
 * Orchestrates all import flows → normalized bundle → writeCourseBundle().
 *
 * Each handler is async and returns:
 *   { ok: true,  bundle }      ready to preview + save
 *   { ok: false, error }       show to user
 */

import { extractVideoId, extractPlaylistId, fetchVideoMeta, thumbnailUrl } from './youtube.js';
import { parseJSONImport, parseCSVImport } from './importers.js';
import { autoGroup } from './autoGroup.js';
import { writeCourseBundle } from '../store/content.js';

// ─── Single YouTube video ─────────────────────────────────────────────────────

export async function importYouTubeVideo(url, courseMeta) {
  const videoId = extractVideoId(url);
  if (!videoId) return { ok: false, error: 'Could not extract a video ID from that URL.' };

  // Try oEmbed for title (graceful fallback to URL)
  const meta = await fetchVideoMeta(videoId);
  const title = meta?.title || `Video ${videoId}`;

  const bundle = {
    course: {
      id:     crypto.randomUUID(),
      title:  courseMeta.title  || title,
      level:  courseMeta.level  || '',
      label:  courseMeta.label  || '',
      accent: courseMeta.accent || '#e94560',
      source: 'youtube_video',
    },
    modules: [{
      mod: { id: crypto.randomUUID(), title: 'Lessons', position: 1 },
      lessons: [{
        id:        crypto.randomUUID(),
        title,
        videoId,
        url,
        thumbnail: thumbnailUrl(videoId),
        position:  0,
      }],
    }],
  };

  return { ok: true, bundle };
}

// ─── Multiple YouTube URLs ────────────────────────────────────────────────────

export async function importYouTubeURLList(rawText, courseMeta, onProgress) {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  if (!lines.length) return { ok: false, error: 'No URLs found.' };

  const lessons = [];
  let fetched = 0;

  for (const line of lines) {
    const videoId = extractVideoId(line);
    if (!videoId) continue;

    const meta = await fetchVideoMeta(videoId).catch(() => null);
    lessons.push({
      title:     meta?.title || `Video ${videoId}`,
      videoId,
      url:       line,
      thumbnail: thumbnailUrl(videoId),
    });

    fetched++;
    onProgress?.({ fetched, total: lines.length });
  }

  if (!lessons.length) return { ok: false, error: 'None of the lines contained valid YouTube URLs.' };

  const groups = autoGroup(lessons, {
    groupSize:   5,
    moduleLabel: n => `Week ${n}`,
  });

  const bundle = {
    course: {
      id:     crypto.randomUUID(),
      title:  courseMeta.title  || 'Imported Course',
      level:  courseMeta.level  || '',
      label:  courseMeta.label  || '',
      accent: courseMeta.accent || '#e94560',
      source: 'youtube_urls',
    },
    modules: groups.map(g => ({
      mod: { id: crypto.randomUUID(), title: g.title, position: g.position },
      lessons: g.lessons.map((l, i) => ({ id: crypto.randomUUID(), position: i, ...l })),
    })),
  };

  return { ok: true, bundle };
}

// ─── YouTube Playlist ─────────────────────────────────────────────────────────

export async function importYouTubePlaylist(url, courseMeta, onProgress) {
  const playlistId = extractPlaylistId(url);
  if (!playlistId) return { ok: false, error: 'Could not find a playlist ID in that URL.' };

  // YouTube Data API v3 is key-gated; use noembed + oEmbed per video is too slow for playlists.
  // Best no-key approach: fetch via YouTube's RSS/atom feed (no CORS issues via a proxy).
  // We use the public playlist RSS endpoint which returns up to 15 items.
  // For full playlists, instruct user to paste URLs instead.

  const rssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;

  try {
    // CORS: YouTube RSS doesn't have CORS headers, so we use a public proxy
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error('Feed fetch failed');

    const xml  = await res.text();
    const parser = new DOMParser();
    const doc  = parser.parseFromString(xml, 'text/xml');
    const entries = Array.from(doc.querySelectorAll('entry'));

    if (!entries.length) throw new Error('No videos found in playlist feed.');

    let fetched = 0;
    const lessons = entries.map((entry, i) => {
      const videoId = entry.querySelector('videoId')?.textContent
        || entry.querySelector('id')?.textContent?.split(':').pop()
        || '';
      const title = entry.querySelector('title')?.textContent || `Lesson ${i + 1}`;

      fetched++;
      onProgress?.({ fetched, total: entries.length });

      return {
        id:        crypto.randomUUID(),
        title,
        videoId,
        url:       `https://youtu.be/${videoId}`,
        thumbnail: videoId ? thumbnailUrl(videoId) : '',
        position:  i,
      };
    });

    const feedTitle = doc.querySelector('feed > title')?.textContent || 'Playlist';
    const groups = autoGroup(lessons, { groupSize: 5, moduleLabel: n => `Week ${n}` });

    const bundle = {
      course: {
        id:       crypto.randomUUID(),
        title:    courseMeta.title  || feedTitle,
        level:    courseMeta.level  || '',
        label:    courseMeta.label  || '',
        accent:   courseMeta.accent || '#e94560',
        source:   'youtube_playlist',
        sourceUrl: url,
      },
      modules: groups.map(g => ({
        mod: { id: crypto.randomUUID(), title: g.title, position: g.position },
        lessons: g.lessons,
      })),
    };

    return { ok: true, bundle };
  } catch (err) {
    return {
      ok: false,
      error: `Playlist import failed: ${err.message}. Try pasting individual video URLs instead.`,
    };
  }
}

// ─── JSON / CSV text ──────────────────────────────────────────────────────────

export function importJSON(text, courseMeta) {
  try {
    const bundle = parseJSONImport(text, courseMeta);
    return { ok: true, bundle };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function importCSV(text, courseMeta) {
  try {
    const bundle = parseCSVImport(text, courseMeta);
    return { ok: true, bundle };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── Commit ───────────────────────────────────────────────────────────────────

export function commitBundle(bundle) {
  return writeCourseBundle(bundle);
}
