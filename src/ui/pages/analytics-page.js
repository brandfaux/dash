/**
 * ui/pages/analytics.js
 * Phase 5: Analytics Dashboard.
 *
 * Sections:
 *   1. Summary row (total time, this-week XP, completion rate, streak)
 *   2. Weekly XP bar chart (last 8 weeks, SVG, no library)
 *   3. Daily activity heatmap (last 28 days, wider than dashboard strip)
 *   4. Per-course completion breakdown
 *   5. Study time estimates
 *
 * Wiring: re-renders on navigate('analytics') and statsChanged.
 * No tight coupling — all cross-page communication via bus.
 */

import { bus }            from '../../app.js';
import { getStats }       from '../../store/user.js';
import {
  getWeeklyXP,
  getDailyActivity,
  getCompletionRate,
  getPerCourseStats,
  getStudyTimeEstimate,
  getOverallSummary,
} from '../../store/analytics.js';
import { sectionHeader, statCard, progressBar } from '../primitives/index.js';

// ─── Render ───────────────────────────────────────────────────────────────────

function render() {
  const el = document.getElementById('pageAnalytics');
  if (!el) return;

  const summary     = getOverallSummary();
  const weeklyXP    = getWeeklyXP();
  const daily       = getDailyActivity();
  const completion  = getCompletionRate();
  const perCourse   = getPerCourseStats();
  const studyTime   = getStudyTimeEstimate();
  const stats       = getStats();

  el.innerHTML = `
    <div class="analytics-page">
      ${renderPageHeader()}
      ${renderSummaryRow(summary, studyTime, stats)}
      ${renderWeeklyXPChart(weeklyXP)}
      ${renderDailyHeatmap(daily)}
      ${renderCompletionFunnel(completion)}
      ${renderPerCourse(perCourse)}
      ${renderStudyTime(studyTime, stats)}
    </div>
  `;

  bindEvents(el);
}

// ─── Page header ──────────────────────────────────────────────────────────────

function renderPageHeader() {
  return `
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
  </div>`;
}

// ─── Summary row ─────────────────────────────────────────────────────────────

function renderSummaryRow(summary, studyTime, stats) {
  const thisWeekXP = getWeeklyXP().at(-1)?.xp ?? 0;
  return `
  <div class="mb-24">
    ${sectionHeader('Overview')}
    <div class="grid grid-4-analytics">
      ${statCard(summary.totalDone, 'Lessons done', 'var(--accent-3)')}
      ${statCard(studyTime.totalHours + 'h', 'Study time', 'var(--accent-1)')}
      ${statCard(`${stats.streak}d`, 'Current streak', 'var(--accent-2)')}
      ${statCard(summary.longestStreak + 'd', 'Longest streak', 'var(--accent-3)')}
    </div>
  </div>`;
}

// ─── Weekly XP Chart (SVG) ────────────────────────────────────────────────────

function renderWeeklyXPChart(weeks) {
  const maxXP   = Math.max(...weeks.map(w => w.xp), 1);
  const W       = 640;
  const H       = 160;
  const barW    = 44;
  const gap     = (W - weeks.length * barW) / (weeks.length + 1);
  const padTop  = 20;
  const padBot  = 36;
  const chartH  = H - padTop - padBot;

  const bars = weeks.map((w, i) => {
    const x      = gap + i * (barW + gap);
    const barH   = w.xp ? Math.max(4, (w.xp / maxXP) * chartH) : 3;
    const y      = padTop + chartH - barH;
    const isLast = i === weeks.length - 1;
    const fill   = isLast
      ? 'url(#xpGradientActive)'
      : 'url(#xpGradient)';

    return `
      <g class="xp-bar-group" data-xp="${w.xp}" data-label="${w.label}">
        <rect x="${x}" y="${y}" width="${barW}" height="${barH}"
              rx="6" ry="6" fill="${fill}"
              class="xp-bar${isLast ? ' xp-bar--current' : ''}" />
        ${w.xp > 0
          ? `<text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle"
               class="xp-bar-value">${w.xp}</text>`
          : ''}
        <text x="${x + barW / 2}" y="${H - 6}" text-anchor="middle"
              class="xp-bar-label">${w.label}</text>
      </g>`;
  });

  // Horizontal grid lines at 25%, 50%, 75%, 100%
  const gridLines = [0.25, 0.5, 0.75, 1].map(pct => {
    const y = padTop + chartH - chartH * pct;
    const xpVal = Math.round(maxXP * pct);
    return `
      <line x1="0" y1="${y}" x2="${W}" y2="${y}"
            stroke="rgba(255,255,255,0.05)" stroke-width="1" />
      <text x="4" y="${y - 3}" class="xp-grid-label">${xpVal} XP</text>`;
  });

  const thisWeekXP = weeks.at(-1)?.xp ?? 0;

  return `
  <div class="mb-24">
    ${sectionHeader('Weekly XP — Last 8 Weeks')}
    <div class="card analytics-chart-card">
      <div class="analytics-chart-meta">
        <span style="font-family:var(--font-serif);font-size:1.6rem">${thisWeekXP}</span>
        <span class="label-mono" style="margin-left:8px">XP this week</span>
      </div>
      <div class="analytics-chart-wrap" role="img" aria-label="Weekly XP bar chart">
        <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
             class="xp-chart-svg" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stop-color="var(--accent-1)" stop-opacity="0.55"/>
              <stop offset="100%" stop-color="var(--accent-1)" stop-opacity="0.18"/>
            </linearGradient>
            <linearGradient id="xpGradientActive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stop-color="var(--accent-2)" stop-opacity="0.95"/>
              <stop offset="100%" stop-color="var(--accent-1)" stop-opacity="0.55"/>
            </linearGradient>
          </defs>
          ${gridLines.join('')}
          ${bars.join('')}
        </svg>
      </div>
    </div>
  </div>`;
}

// ─── Daily Heatmap (28 days) ──────────────────────────────────────────────────

function renderDailyHeatmap(days) {
  const maxCount = Math.max(...days.map(d => d.count), 1);
  const todayISO = new Date().toISOString().slice(0, 10);

  const cells = days.map(d => {
    const intensity = d.count ? Math.ceil((d.count / maxCount) * 4) : 0;
    const isToday   = d.iso === todayISO;
    const cls = [
      'aheat-cell',
      intensity > 0 ? `aheat-cell--l${intensity}` : '',
      isToday ? 'aheat-cell--today' : '',
    ].filter(Boolean).join(' ');

    const label = new Date(d.iso + 'T12:00:00').getDate();
    const title = `${d.iso}: ${d.count} lesson${d.count !== 1 ? 's' : ''}`;

    return `<div class="${cls}" title="${title}" aria-label="${title}">
      <span class="aheat-day">${label}</span>
    </div>`;
  });

  // Week labels
  const weekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const totalActive = days.filter(d => d.count > 0).length;

  return `
  <div class="mb-24">
    ${sectionHeader('Daily Activity — Last 28 Days')}
    <div class="card">
      <div class="aheat-meta">
        <span class="label-mono">${totalActive} active days</span>
        <div class="aheat-legend">
          <span class="label-mono">Less</span>
          <div class="aheat-cell aheat-cell--l0 aheat-cell--sm"></div>
          <div class="aheat-cell aheat-cell--l1 aheat-cell--sm"></div>
          <div class="aheat-cell aheat-cell--l2 aheat-cell--sm"></div>
          <div class="aheat-cell aheat-cell--l3 aheat-cell--sm"></div>
          <div class="aheat-cell aheat-cell--l4 aheat-cell--sm"></div>
          <span class="label-mono">More</span>
        </div>
      </div>
      <div class="aheat-grid" role="grid" aria-label="28-day activity heatmap">
        ${cells.join('')}
      </div>
    </div>
  </div>`;
}

// ─── Completion Funnel ────────────────────────────────────────────────────────

function renderCompletionFunnel(completion) {
  const { started, completed, rate } = completion;
  const notStarted = Math.max(0, started - completed);

  return `
  <div class="mb-24">
    ${sectionHeader('Completion Funnel')}
    <div class="card analytics-funnel-card">
      <div class="funnel-cols">
        <div class="funnel-item">
          <div class="funnel-bar-wrap">
            <div class="funnel-bar funnel-bar--started"
                 style="height:100%" aria-valuenow="${started}"></div>
          </div>
          <strong class="funnel-value" style="color:var(--accent-1)">${started}</strong>
          <span class="label-mono">Started</span>
        </div>
        <div class="funnel-arrow">→</div>
        <div class="funnel-item">
          <div class="funnel-bar-wrap">
            <div class="funnel-bar funnel-bar--completed"
                 style="height:${started ? (completed / started) * 100 : 0}%"
                 aria-valuenow="${completed}"></div>
          </div>
          <strong class="funnel-value" style="color:var(--accent-3)">${completed}</strong>
          <span class="label-mono">Completed</span>
        </div>
        <div class="funnel-arrow">→</div>
        <div class="funnel-item funnel-item--rate">
          <div class="funnel-ring-wrap">
            ${renderCompletionRing(rate)}
          </div>
          <strong class="funnel-value" style="color:var(--accent-2)">${rate}%</strong>
          <span class="label-mono">Rate</span>
        </div>
      </div>
      ${started === 0
        ? `<p class="label-mono" style="margin-top:16px;text-align:center">
             Start watching lessons to see your completion rate.
           </p>`
        : ''}
    </div>
  </div>`;
}

function renderCompletionRing(pct) {
  const r    = 28;
  const circ = 2 * Math.PI * r;
  const off  = circ - (pct / 100) * circ;
  return `
  <svg width="72" height="72" viewBox="0 0 72 72">
    <circle cx="36" cy="36" r="${r}"
            fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="6"/>
    <circle cx="36" cy="36" r="${r}"
            fill="none" stroke="var(--accent-2)" stroke-width="6"
            stroke-dasharray="${circ}" stroke-dashoffset="${off}"
            stroke-linecap="round"
            transform="rotate(-90 36 36)"/>
    <text x="36" y="40" text-anchor="middle"
          style="font-family:var(--font-serif);font-size:13px;fill:var(--text)">${pct}%</text>
  </svg>`;
}

// ─── Per-Course Breakdown ─────────────────────────────────────────────────────

function renderPerCourse(courses) {
  if (!courses.length) return '';

  const rows = courses.map(c => {
    const accent = c.accent || 'var(--accent-1)';
    return `
    <div class="course-stat-row">
      <div class="course-stat-top">
        <div class="course-stat-title">
          <span class="course-stat-dot" style="background:${accent}"></span>
          <span style="font-family:var(--font-serif)">${c.course.title}</span>
          ${c.course.level
            ? `<span class="badge-pill" style="margin-left:8px">${c.course.level}</span>`
            : ''}
        </div>
        <div class="course-stat-nums">
          <span class="label-mono">${c.done}/${c.total}</span>
          <span class="label-mono course-stat-pct" style="color:${accent}">${c.pct}%</span>
        </div>
      </div>
      ${progressBar(c.pct, 'sm')}
      <div class="course-stat-sub">
        <span class="label-mono">~${c.watchedMinutes}m watched</span>
        <span class="label-mono">~${c.estimatedMinutes}m total</span>
      </div>
    </div>`;
  }).join('');

  return `
  <div class="mb-24">
    ${sectionHeader('Per-Course Breakdown')}
    <div class="card">
      ${rows}
    </div>
  </div>`;
}

// ─── Study Time ───────────────────────────────────────────────────────────────

function renderStudyTime(studyTime, stats) {
  const { totalMinutes, thisWeekMinutes, avgPerDay, totalHours, thisWeekHours } = studyTime;
  const activeDays = stats.activityLog?.length ?? 0;

  // Visual clock-ring representing this week vs 7h "goal"
  const weekGoalMinutes = 7 * 60; // 7 hours/week goal
  const weekPct = Math.min(100, Math.round((thisWeekMinutes / weekGoalMinutes) * 100));

  return `
  <div class="mb-24">
    ${sectionHeader('Study Time Estimates')}
    <div class="analytics-time-grid">
      <div class="card analytics-time-ring-card">
        <div class="time-ring-wrap">
          ${renderTimeRing(weekPct, thisWeekHours + 'h')}
        </div>
        <div>
          <p class="label-caps" style="margin-bottom:4px">This Week</p>
          <strong style="font-family:var(--font-serif);font-size:1.8rem">${thisWeekHours}h</strong>
          <p class="label-mono" style="margin-top:4px">of ~7h weekly goal</p>
          ${progressBar(weekPct, 'sm')}
        </div>
      </div>

      <div class="analytics-time-stats">
        <div class="card">
          <p class="label-caps" style="margin-bottom:6px">Total Studied</p>
          <strong style="font-family:var(--font-serif);font-size:2rem;display:block">${totalHours}h</strong>
          <span class="label-mono">${totalMinutes} minutes</span>
        </div>
        <div class="card">
          <p class="label-caps" style="margin-bottom:6px">Daily Average</p>
          <strong style="font-family:var(--font-serif);font-size:2rem;display:block">${avgPerDay}m</strong>
          <span class="label-mono">over ${activeDays} active days</span>
        </div>
        <div class="card">
          <p class="label-caps" style="margin-bottom:6px">Estimate basis</p>
          <strong style="font-family:var(--font-serif);font-size:1.1rem;display:block;margin-top:4px">
            ~12 min/lesson
          </strong>
          <span class="label-mono">duration data auto-updates</span>
        </div>
      </div>
    </div>
  </div>`;
}

function renderTimeRing(pct, label) {
  const r    = 38;
  const circ = 2 * Math.PI * r;
  const off  = circ - (pct / 100) * circ;
  return `
  <svg width="96" height="96" viewBox="0 0 96 96">
    <circle cx="48" cy="48" r="${r}"
            fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="7"/>
    <circle cx="48" cy="48" r="${r}"
            fill="none" stroke="var(--accent-3)" stroke-width="7"
            stroke-dasharray="${circ}" stroke-dashoffset="${off}"
            stroke-linecap="round"
            transform="rotate(-90 48 48)"/>
    <text x="48" y="52" text-anchor="middle"
          style="font-family:var(--font-serif);font-size:14px;fill:var(--text)">${label}</text>
  </svg>`;
}

// ─── Events ───────────────────────────────────────────────────────────────────

function bindEvents(el) {
  // XP bar tooltip on hover (show full week label + XP)
  el.querySelectorAll('.xp-bar-group').forEach(g => {
    g.addEventListener('mouseenter', () => {
      g.querySelector('.xp-bar')?.classList.add('xp-bar--hover');
    });
    g.addEventListener('mouseleave', () => {
      g.querySelector('.xp-bar')?.classList.remove('xp-bar--hover');
    });
  });
}

// ─── Bus wiring ───────────────────────────────────────────────────────────────

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
