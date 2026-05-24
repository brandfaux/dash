/**
 * ui/pages/dashboard.js
 * Full dashboard render — hero, stats, continue card, activity, achievements.
 */

import { bus, navigate, showToast } from '../../app.js';
import { getStats, getUser } from '../../store/user.js';
import { getCourses, getAllLessonsForCourse } from '../../store/content.js';
import { getProgress, getAllProgress, computeCourseProgress, getContinueLesson } from '../../store/progress.js';
import { ACHIEVEMENTS } from '../../config/achievements.js';
import { PLATFORM } from '../../config/platform.js';
import {
  sectionHeader, statCard, goalRing,
  heatStrip, achievementChips, progressBar, courseCard,
} from '../primitives/index.js';
import { openVideoModal } from '../blocks/videoModal.js';

console.log('Dashboard module loaded'); // Debug

// ─── Render ───────────────────────────────────────────────────────

function render() {
  console.log('Dashboard render called'); // Debug
  
  const el = document.getElementById('pageDashboard');
  if (!el) {
    console.error('Dashboard element not found!');
    return;
  }
  
  console.log('Dashboard element found, rendering...');

  const stats = getStats();
  const courses = getCourses();
  const progress = getAllProgress();
  
  console.log('Stats:', stats);
  console.log('Courses:', courses);
  console.log('Progress:', progress);

  // Compute totals across all courses
  const allLessons = courses.flatMap(c => getAllLessonsForCourse(c.id));
  const totalDone = allLessons.filter(l => progress[l.id]?.completed).length;
  const totalCount = allLessons.length;
  const totalPct = totalCount ? Math.round((totalDone / totalCount) * 100) : 0;

  // Find best lesson to continue
  const continueLesson = getContinueLesson(allLessons);
  const continueCourse = continueLesson
    ? courses.find(c => getAllLessonsForCourse(c.id).some(l => l.id === continueLesson.id))
    : null;
  const continueProgress = continueLesson ? getProgress(continueLesson.id) : null;

  // Today's completions
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayDone = allLessons.filter(l => {
    const p = progress[l.id];
    return p?.completed && p.lastSeen && new Date(p.lastSeen).toISOString().slice(0,10) === todayIso;
  }).length;

  const html = `
    ${renderHero(stats, courses, totalDone, totalCount, totalPct, todayDone)}
    ${courses.length ? renderContinueCard(continueLesson, continueCourse, continueProgress) : ''}
    ${renderStatsRow(stats, totalDone, totalPct)}
    ${renderCourseOverview(courses, progress)}
    ${renderActivity(stats)}
    ${renderAchievements(stats)}
  `;
  
  console.log('HTML generated, length:', html.length);
  el.innerHTML = html;
  
  bindEvents(el);
}

// ─── Hero ─────────────────────────────────────────────────────────

function renderHero(stats, courses, done, total, pct, todayDone) {
  const greeting = greeting_text();
  const user = getUser();

  return `
  <div class="mb-24">
    <div class="dash-hero-panel">
      <div class="card dash-hero">
        <div>
          <p class="label-caps" style="margin-bottom:8px">${greeting}</p>
          <h1 class="dash-title">${PLATFORM.logo.mark}</h1>
          <p class="dash-subtitle">
            ${total === 0
              ? 'Import a course to get started.'
              : `${done} of ${total} lessons complete — keep going!`}
          </p>
        </div>
        <div class="mt-16">
          ${total > 0 ? `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span class="label-mono">Overall progress</span>
              <span class="label-mono">${pct}%</span>
            </div>
            ${progressBar(pct)}
          ` : `
            <button class="btn btn--primary" data-action="go-import">Import your first course →</button>
          `}
        </div>
      </div>

      <div class="dash-hero-side">
        <div class="card" style="text-align:center;padding:18px">
          ${goalRing(pct, `${pct}%`, 'var(--accent-3)')}
          <p class="label-mono" style="margin-top:10px">Progress</p>
        </div>
        <div class="card" style="padding:16px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:1.5rem">🔥</span>
            <div>
              <strong style="font-family:var(--font-serif);font-size:1.5rem;display:block">${stats.streak}</strong>
              <span class="label-mono">day streak</span>
            </div>
          </div>
        </div>
        <div class="card" style="padding:16px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:1.5rem">⚡</span>
            <div>
              <strong style="font-family:var(--font-serif);font-size:1.5rem;display:block">${stats.xp}</strong>
              <span class="label-mono">total XP</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// ─── Continue card ────────────────────────────────────────────────

function renderContinueCard(lesson, course, progress) {
  if (!lesson) return '';

  const pct = progress?.pct ?? 0;
  const thumb = lesson.thumbnail || `https://i.ytimg.com/vi/${lesson.videoId}/mqdefault.jpg`;

  return `
  <div class="mb-24">
    ${sectionHeader('Continue Learning')}
    <div class="card continue-card" data-action="watch-continue" data-lesson-id="${lesson.id}"
         style="cursor:pointer;display:grid;grid-template-columns:140px 1fr;gap:16px;align-items:center">
      <div class="continue-thumb">
        <img src="${thumb}" alt="" loading="lazy" style="border-radius:12px;width:100%;aspect-ratio:16/10;object-fit:cover">
      </div>
      <div>
        ${course ? `<p class="label-caps" style="margin-bottom:6px;color:${course.accent || 'var(--accent-1)'}">
          ${course.level ? course.level + ' · ' : ''}${course.title}
        </p>` : ''}
        <h3 style="font-family:var(--font-serif);font-size:1.1rem;margin-bottom:10px;line-height:1.3">${lesson.title}</h3>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <span class="label-mono">${pct > 0 ? `${pct}% watched` : 'Start lesson'}</span>
          <span class="btn btn--primary" style="pointer-events:none;font-size:0.8rem;padding:6px 12px">
            ${pct > 0 ? '▶ Resume' : '▶ Start'}
          </span>
        </div>
        ${pct > 0 ? progressBar(pct, 'sm') : ''}
      </div>
    </div>
  </div>`;
}

// ─── Stats row ────────────────────────────────────────────────────

function renderStatsRow(stats, totalDone, totalPct) {
  const today = new Date().toISOString().slice(0,10);
  const weekDays = stats.activityLog?.filter(d => {
    const diff = (new Date(today) - new Date(d)) / 86400000;
    return diff <= 7;
  }).length ?? 0;

  return `
  <div class="mb-24">
    ${sectionHeader('Your Stats')}
    <div class="grid grid-3">
      ${statCard(totalDone, 'Lessons completed', 'var(--accent-3)')}
      ${statCard(`${stats.streak}d`, 'Current streak', 'var(--accent-2)')}
      ${statCard(`${weekDays}/7`, 'Days active this week', 'var(--accent-1)')}
    </div>
  </div>`;
}

// ─── Course overview ──────────────────────────────────────────────

function renderCourseOverview(courses, progressMap) {
  if (!courses.length) return '';

  const cards = courses.map(c => {
    const lessons = getAllLessonsForCourse(c.id);
    const ids = lessons.map(l => l.id);
    const prog = computeCourseProgress(ids);
    return courseCard(c, prog, false);
  }).join('');

  return `
  <div class="mb-24">
    ${sectionHeader('Courses')}
    <div class="grid grid-auto">${cards}</div>
  </div>`;
}

// ─── Activity strip ───────────────────────────────────────────────

function renderActivity(stats) {
  return `
  <div class="mb-24">
    ${sectionHeader('Activity — Last 14 Days')}
    <div class="card">
      ${heatStrip(stats.activityLog)}
      <p class="label-mono" style="margin-top:12px">
        ${stats.activityLog?.length ?? 0} days studied total
      </p>
    </div>
  </div>`;
}

// ─── Achievements ─────────────────────────────────────────────────

function renderAchievements(stats) {
  return `
  <div class="mb-24">
    ${sectionHeader('Achievements')}
    <div class="card">
      <div style="display:flex;flex-wrap:wrap;gap:10px">
        ${achievementChips(ACHIEVEMENTS, stats.achievements)}
      </div>
    </div>
  </div>`;
}

// ─── Helpers ──────────────────────────────────────────────────────

function greeting_text() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// ─── Events ───────────────────────────────────────────────────────

function bindEvents(el) {
  el.querySelectorAll('.course-card[data-course-id]').forEach(card => {
    card.addEventListener('click', () => {
      navigate('courses');
      bus.emit('selectCourse', card.dataset.courseId);
    });
  });

  const continueCard = el.querySelector('[data-action="watch-continue"]');
  if (continueCard) {
    continueCard.addEventListener('click', () => {
      const lessonId = continueCard.dataset.lessonId;
      const courses = getCourses();
      let target = null;
      for (const c of courses) {
        const found = getAllLessonsForCourse(c.id).find(l => l.id === lessonId);
        if (found) { target = found; break; }
      }
      if (target) openVideoModal(target);
    });
  }

  el.querySelector('[data-action="go-import"]')?.addEventListener('click', () => navigate('import'));
}

// ─── Bus wiring ───────────────────────────────────────────────────

console.log('Setting up bus listeners for dashboard'); // Debug

bus.on('navigate', page => { 
  console.log('Navigate event received:', page); // Debug
  if (page === 'dashboard') render(); 
});

bus.on('statsChanged', () => { 
  console.log('StatsChanged event received'); // Debug
  if (document.getElementById('pageDashboard')?.closest('.page.active')) render(); 
});

bus.on('lessonComplete', () => { 
  console.log('LessonComplete event received'); // Debug
  if (document.getElementById('pageDashboard')?.closest('.page.active')) render(); 
});

bus.on('contentChanged', () => { 
  console.log('ContentChanged event received'); // Debug
  if (document.getElementById('pageDashboard')?.closest('.page.active')) render(); 
});

// Initial render if dashboard is active
console.log('Checking if dashboard is active...'); // Debug
if (document.getElementById('pageDashboard')?.classList.contains('active')) {
  console.log('Dashboard is active, rendering...');
  render();
}