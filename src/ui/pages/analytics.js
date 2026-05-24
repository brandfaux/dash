/**
 * ui/pages/analytics.js
 * Analytics Dashboard.
 */

import { bus } from '../../app.js';
import { getStats } from '../../store/user.js';
import {
  getWeeklyXP,
  getDailyActivity,
  getCompletionRate,
  getPerCourseStats,
  getStudyTimeEstimate,
  getOverallSummary,
} from '../../store/analytics.js';
import { sectionHeader, statCard, progressBar } from '../primitives/index.js';

function render() {
  const el = document.getElementById('pageAnalytics');
  if (!el) return;

  const summary = getOverallSummary();
  const weeklyXP = getWeeklyXP();
  const daily = getDailyActivity();
  const completion = getCompletionRate();
  const perCourse = getPerCourseStats();
  const studyTime = getStudyTimeEstimate();
  const stats = getStats();

  el.innerHTML = `
    <div class="analytics-page">
      <div class="analytics-header mb-24">
        <div>
          <p class="label-caps" style="margin-bottom:6px">LearnEngine</p>
          <h1 style="font-family:var(--font-serif);font-size:2rem;font-weight:300;line-height:1.15">
            Analytics
          </h1>
        </div>
        <p class="label-mono" style="align-self:flex-end;padding-bottom:4px">
          Your learning at a glance
        </p>
      </div>
      
      <div class="mb-24">
        ${sectionHeader('Overview')}
        <div class="grid-4-analytics">
          ${statCard(summary.totalDone, 'Lessons done', 'var(--accent-3)')}
          ${statCard(studyTime.totalHours + 'h', 'Study time', 'var(--accent-1)')}
          ${statCard(`${stats.streak}d`, 'Current streak', 'var(--accent-2)')}
          ${statCard(summary.longestStreak + 'd', 'Longest streak', 'var(--accent-3)')}
        </div>
      </div>
      
      <div class="mb-24">
        ${sectionHeader('Weekly Activity')}
        <div class="card">
          <p class="label-mono">${weeklyXP.at(-1)?.xp || 0} XP this week</p>
          <div style="margin-top:12px">
            ${weeklyXP.map(w => `<div style="margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;font-size:0.8rem">
                <span>${w.label}</span>
                <span>${w.xp} XP</span>
              </div>
              ${progressBar(Math.min(100, (w.xp / Math.max(...weeklyXP.map(w2 => w2.xp), 1)) * 100), 'sm')}
            </div>`).join('')}
          </div>
        </div>
      </div>
      
      <div class="mb-24">
        ${sectionHeader('Daily Activity — Last 28 Days')}
        <div class="card">
          <div style="display:grid;grid-template-columns:repeat(14,1fr);gap:5px">
            ${daily.map(d => `<div style="aspect-ratio:1;border-radius:5px;background:rgba(78,204,163,${Math.min(0.8, d.count / 5)});display:flex;align-items:center;justify-content:center;font-size:0.6rem" title="${d.iso}: ${d.count} lessons">${new Date(d.iso).getDate()}</div>`).join('')}
          </div>
        </div>
      </div>
      
      ${perCourse.length ? `
      <div class="mb-24">
        ${sectionHeader('Courses')}
        <div class="card">
          ${perCourse.map(c => `
            <div style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <strong>${c.course.title}</strong>
                <span>${c.done}/${c.total} (${c.pct}%)</span>
              </div>
              ${progressBar(c.pct, 'sm')}
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
    </div>
  `;
}

bus.on('navigate', page => {
  if (page === 'analytics') render();
});

bus.on('statsChanged', () => {
  const el = document.getElementById('pageAnalytics');
  if (el?.closest('.page.active')) render();
});

bus.on('lessonComplete', () => {
  const el = document.getElementById('pageAnalytics');
  if (el?.closest('.page.active')) render();
});