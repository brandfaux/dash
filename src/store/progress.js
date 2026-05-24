/**
 * store/progress.js — Per-lesson watch state.
 * All reads/writes are keyed by userId so data is auth-ready.
 */

import { PLATFORM } from '../config/platform.js';
import { ProgressSchema } from '../schema/entities.js';
import { storage } from './storage.js';
import { getUser } from './user.js';
import { getCourses, getAllLessonsForCourse } from './content.js';

const PREFIX = PLATFORM.storageKeys.progress;

function key(lessonId) {
  return `${PREFIX}_${getUser().id}_${lessonId}`;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export function getProgress(lessonId) {
  return storage.get(key(lessonId)) ?? ProgressSchema.defaults();
}

/** Returns all progress entries as { [lessonId]: ProgressRecord } */
export function getAllProgress() {
  const userId = getUser().id;
  const prefix = `${PREFIX}_${userId}_`;
  const result = {};
  // Walk localStorage for this user's progress entries
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        const lessonId = k.slice(prefix.length);
        try {
          const val = JSON.parse(localStorage.getItem(k));
          if (val) result[lessonId] = val;
        } catch {}
      }
    }
  } catch {}
  return result;
}

// ─── Write ────────────────────────────────────────────────────────────────────

export function setProgress(lessonId, patch) {
  const current = getProgress(lessonId);
  const updated = {
    ...current,
    ...patch,
    lessonId,
    userId: getUser().id,
    lastSeen: Date.now(),
  };
  storage.set(key(lessonId), updated);
  return updated;
}

export function markComplete(lessonId) {
  return setProgress(lessonId, { completed: true, pct: 100, resumeAt: 0 });
}

// ─── Derived ──────────────────────────────────────────────────────────────────

/** Returns { done, total, pct } for an array of lessonIds */
export function computeCourseProgress(lessonIds) {
  if (!lessonIds?.length) return { done: 0, total: 0, pct: 0 };
  const done = lessonIds.filter(id => getProgress(id).completed).length;
  return { done, total: lessonIds.length, pct: Math.round((done / lessonIds.length) * 100) };
}

/**
 * Find the best lesson to continue:
 * 1. Most recently watched, not completed
 * 2. First unwatched lesson
 */
export function getContinueLesson(lessons) {
  if (!lessons?.length) return null;
  const inProgress = lessons
    .map(l => ({ lesson: l, p: getProgress(l.id) }))
    .filter(x => x.p.pct > 0 && !x.p.completed)
    .sort((a, b) => (b.p.lastSeen ?? 0) - (a.p.lastSeen ?? 0));

  if (inProgress.length) return inProgress[0].lesson;
  return lessons.find(l => !getProgress(l.id).completed) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// getNextLesson — Phase 6: Auto-advance to next lesson
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return the lesson that follows `currentLessonId` within its course.
 * Returns null if the current lesson is last, or not found.
 *
 * @param  {string} currentLessonId
 * @returns {Promise<{ courseId: string, lesson: object } | null>}
 */
export async function getNextLesson(currentLessonId) {
  const courses = await getCourses();

  for (const course of courses) {
    const lessons = await getAllLessonsForCourse(course.id);
    const idx = lessons.findIndex(l => l.id === currentLessonId);
    if (idx === -1) continue;                    // not in this course

    const next = lessons[idx + 1];               // undefined if last
    if (!next) return null;                      // end of course

    return { courseId: course.id, lesson: next };
  }

  return null; // lesson not found in any course
}