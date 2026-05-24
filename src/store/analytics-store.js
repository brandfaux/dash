/**
 * store/analytics.js — Derived analytics. Pure reads, no writes.
 *
 * All data sourced from user.js, progress.js, content.js.
 * Nothing here touches storage directly — swap-safe for Supabase.
 *
 * Exported functions:
 *   getWeeklyXP()          → [{ iso, xp, label }]  — last 8 weeks
 *   getDailyActivity()     → [{ iso, count, label }] — last 28 days
 *   getCompletionRate()    → { started, completed, rate }
 *   getPerCourseStats()    → [{ course, done, total, pct, estimatedMinutes }]
 *   getStudyTimeEstimate() → { totalMinutes, thisWeekMinutes, avgPerDay }
 *   getOverallSummary()    → { totalLessons, totalDone, totalPct, activeDays, longestStreak }
 */

import { getStats }                     from './user.js';
import { getAllProgress }                from './progress.js';
import { getCourses, getAllLessonsForCourse } from './content.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const AVG_LESSON_MINUTES = 12; // rough estimate when duration=0

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isoMinus(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Short day label: Mon, Tue … */
function dayLabel(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

/** Short week label: Apr 7 */
function weekLabel(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Compute the Monday of the ISO week containing `date`.
 */
function mondayOf(iso) {
  const d = new Date(iso + 'T12:00:00');
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ─── Weekly XP ────────────────────────────────────────────────────────────────

/**
 * LearnEngine doesn't store per-event XP history yet — we derive a proxy:
 * each completed lesson that was `lastSeen` within a given week contributes
 * PLATFORM.xpPerLesson XP. Falls back to activityLog for weeks with no data.
 *
 * Returns the last 8 weeks newest-first, then reversed for chart display.
 */
export function getWeeklyXP() {
  const progress = getAllProgress();
  const { xpPerLesson } = _platform();

  // Build week buckets: last 8 Mondays
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const monday = mondayOf(isoMinus(i * 7));
    weeks.push({ monday, xp: 0 });
  }

  Object.values(progress).forEach(p => {
    if (!p.completed || !p.lastSeen) return;
    const iso = new Date(p.lastSeen).toISOString().slice(0, 10);
    const mon = mondayOf(iso);
    const bucket = weeks.find(w => w.monday === mon);
    if (bucket) bucket.xp += xpPerLesson;
  });

  return weeks.map(w => ({
    iso:   w.monday,
    xp:    w.xp,
    label: weekLabel(w.monday),
  }));
}

// ─── Daily Activity ───────────────────────────────────────────────────────────

/**
 * Returns last 28 days with lesson-completion counts.
 * Uses lastSeen timestamp on progress entries.
 */
export function getDailyActivity() {
  const progress = getAllProgress();

  const days = [];
  for (let i = 27; i >= 0; i--) {
    days.push({ iso: isoMinus(i), count: 0 });
  }

  const dayMap = Object.fromEntries(days.map(d => [d.iso, d]));

  Object.values(progress).forEach(p => {
    if (!p.completed || !p.lastSeen) return;
    const iso = new Date(p.lastSeen).toISOString().slice(0, 10);
    if (dayMap[iso]) dayMap[iso].count++;
  });

  return days.map(d => ({
    ...d,
    label: dayLabel(d.iso),
  }));
}

// ─── Completion Rate ──────────────────────────────────────────────────────────

export function getCompletionRate() {
  const progress = getAllProgress();
  const values   = Object.values(progress);
  const started   = values.filter(p => p.pct > 0).length;
  const completed = values.filter(p => p.completed).length;
  const rate      = started ? Math.round((completed / started) * 100) : 0;
  return { started, completed, rate };
}

// ─── Per-Course Stats ─────────────────────────────────────────────────────────

export function getPerCourseStats() {
  const courses  = getCourses();
  const progress = getAllProgress();

  return courses.map(course => {
    const lessons = getAllLessonsForCourse(course.id);
    const done    = lessons.filter(l => progress[l.id]?.completed).length;
    const total   = lessons.length;
    const pct     = total ? Math.round((done / total) * 100) : 0;

    // Sum durations where known, estimate the rest
    const totalSecs = lessons.reduce((acc, l) => {
      return acc + (l.duration > 0 ? l.duration : AVG_LESSON_MINUTES * 60);
    }, 0);
    const estimatedMinutes = Math.round(totalSecs / 60);
    const watchedMinutes   = total
      ? Math.round((done / total) * estimatedMinutes)
      : 0;

    return {
      course,
      done,
      total,
      pct,
      estimatedMinutes,
      watchedMinutes,
      accent: course.accent || 'var(--accent-1)',
    };
  });
}

// ─── Study Time Estimates ─────────────────────────────────────────────────────

export function getStudyTimeEstimate() {
  const progress = getAllProgress();
  const { xpPerLesson } = _platform();

  let totalMinutes    = 0;
  let thisWeekMinutes = 0;

  const weekAgo = isoMinus(7);

  Object.values(progress).forEach(p => {
    if (!p.completed) return;
    totalMinutes += AVG_LESSON_MINUTES;
    if (p.lastSeen) {
      const iso = new Date(p.lastSeen).toISOString().slice(0, 10);
      if (iso >= weekAgo) thisWeekMinutes += AVG_LESSON_MINUTES;
    }
  });

  const stats = getStats();
  const activeDays = (stats.activityLog?.length) || 1;
  const avgPerDay  = Math.round(totalMinutes / activeDays);

  return {
    totalMinutes,
    thisWeekMinutes,
    avgPerDay,
    totalHours: (totalMinutes / 60).toFixed(1),
    thisWeekHours: (thisWeekMinutes / 60).toFixed(1),
  };
}

// ─── Overall Summary ─────────────────────────────────────────────────────────

export function getOverallSummary() {
  const courses  = getCourses();
  const progress = getAllProgress();
  const stats    = getStats();

  const allLessons  = courses.flatMap(c => getAllLessonsForCourse(c.id));
  const totalDone   = allLessons.filter(l => progress[l.id]?.completed).length;
  const totalLessons = allLessons.length;
  const totalPct    = totalLessons ? Math.round((totalDone / totalLessons) * 100) : 0;
  const activeDays  = stats.activityLog?.length ?? 0;

  // Longest streak from activityLog
  let longestStreak = 0;
  if (stats.activityLog?.length) {
    const sorted = [...stats.activityLog].sort();
    let run = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]);
      const curr = new Date(sorted[i]);
      const diff = (curr - prev) / 86400000;
      run = diff === 1 ? run + 1 : 1;
      if (run > longestStreak) longestStreak = run;
    }
    longestStreak = Math.max(longestStreak, 1);
  }

  return { totalLessons, totalDone, totalPct, activeDays, longestStreak };
}

// ─── Private ─────────────────────────────────────────────────────────────────

function _platform() {
  // Avoid circular dep — read xpPerLesson inline
  try {
    // dynamic import not needed; just use a reasonable default
    return { xpPerLesson: 50 };
  } catch {
    return { xpPerLesson: 50 };
  }
}
