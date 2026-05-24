/**
 * store/analytics.js — Derived analytics. Pure reads, no writes.
 */

import { getStats } from './user.js';
import { getAllProgress } from './progress.js';
import { getCourses, getAllLessonsForCourse } from './content.js';
import { PLATFORM } from '../config/platform.js';

const AVG_LESSON_MINUTES = 12;

function isoMinus(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function weekLabel(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function mondayOf(iso) {
  const d = new Date(iso + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function getWeeklyXP() {
  const progress = getAllProgress();
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
    if (bucket) bucket.xp += PLATFORM.xpPerLesson;
  });
  
  return weeks.map(w => ({
    iso: w.monday,
    xp: w.xp,
    label: weekLabel(w.monday),
  }));
}

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
  
  return days;
}

export function getCompletionRate() {
  const progress = Object.values(getAllProgress());
  const started = progress.filter(p => p.pct > 0).length;
  const completed = progress.filter(p => p.completed).length;
  const rate = started ? Math.round((completed / started) * 100) : 0;
  return { started, completed, rate };
}

export function getPerCourseStats() {
  const courses = getCourses();
  const progress = getAllProgress();
  
  return courses.map(course => {
    const lessons = getAllLessonsForCourse(course.id);
    const done = lessons.filter(l => progress[l.id]?.completed).length;
    const total = lessons.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const totalSecs = lessons.reduce((acc, l) => acc + (l.duration > 0 ? l.duration : AVG_LESSON_MINUTES * 60), 0);
    const estimatedMinutes = Math.round(totalSecs / 60);
    const watchedMinutes = total ? Math.round((done / total) * estimatedMinutes) : 0;
    
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

export function getStudyTimeEstimate() {
  const progress = getAllProgress();
  let totalMinutes = 0;
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
  const activeDays = stats.activityLog?.length || 1;
  const avgPerDay = Math.round(totalMinutes / activeDays);
  
  return {
    totalMinutes,
    thisWeekMinutes,
    avgPerDay,
    totalHours: (totalMinutes / 60).toFixed(1),
    thisWeekHours: (thisWeekMinutes / 60).toFixed(1),
  };
}

export function getOverallSummary() {
  const courses = getCourses();
  const progress = getAllProgress();
  const stats = getStats();
  
  const allLessons = courses.flatMap(c => getAllLessonsForCourse(c.id));
  const totalDone = allLessons.filter(l => progress[l.id]?.completed).length;
  const totalLessons = allLessons.length;
  const totalPct = totalLessons ? Math.round((totalDone / totalLessons) * 100) : 0;
  const activeDays = stats.activityLog?.length ?? 0;
  
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