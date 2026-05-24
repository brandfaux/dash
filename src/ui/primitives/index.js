/**
 * ui/primitives/index.js
 * Pure functions that return HTML strings.
 * No state, no imports from stores — fully reusable.
 */

// ── Progress bar ──────────────────────────────────────────────────
export function progressBar(pct, size = 'md') {
  const cls = size === 'sm' ? 'progress-bar progress-bar--sm' : 'progress-bar';
  return `<div class="${cls}">
    <div class="progress-bar__fill" style="width:${pct}%"></div>
  </div>`;
}

// ── Goal ring (SVG) ───────────────────────────────────────────────
export function goalRing(pct, label, color = 'var(--accent-3)') {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return `<div class="goal-ring" title="${pct}%">
    <svg width="60" height="60" viewBox="0 0 60 60">
      <circle class="track" cx="30" cy="30" r="${r}" />
      <circle class="fill" cx="30" cy="30" r="${r}"
        stroke="${color}"
        stroke-dasharray="${circ}"
        stroke-dashoffset="${offset}" />
    </svg>
    <div class="goal-ring__center">${label}</div>
  </div>`;
}

// ── Stat card ─────────────────────────────────────────────────────
export function statCard(value, label, accent = '') {
  const style = accent ? `style="color:${accent}"` : '';
  return `<div class="stat-card">
    <strong class="stat-card__value" ${style}>${value}</strong>
    <span class="stat-card__label">${label}</span>
  </div>`;
}

// ── Section header ────────────────────────────────────────────────
export function sectionHeader(text) {
  return `<div class="section-header">
    <span class="label-caps">${text}</span>
  </div>`;
}

// ── Heat strip (last 14 days) ─────────────────────────────────────
export function heatStrip(activityLog) {
  const days = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const active = new Set(activityLog ?? []);
  const cells = days.map(iso => {
    const isToday = iso === today.toISOString().slice(0, 10);
    const isActive = active.has(iso);
    const cls = ['heat-cell', isActive ? 'active' : '', isToday ? 'today' : ''].filter(Boolean).join(' ');
    const label = new Date(iso).getDate();
    return `<div class="${cls}">${label}</div>`;
  });
  return `<div class="heat-strip">${cells.join('')}</div>`;
}

// ── Achievement chips ─────────────────────────────────────────────
export function achievementChips(allAchievements, unlockedIds) {
  return allAchievements.map(a => {
    const unlocked = unlockedIds.includes(a.id);
    const cls = `achievement-chip${unlocked ? ' unlocked' : ''}`;
    return `<div class="${cls}" title="${a.desc}">
      <span>${a.icon}</span>
      <span>${a.label}</span>
    </div>`;
  }).join('');
}

// ── Video row ─────────────────────────────────────────────────────
export function videoRow(lesson, progress) {
  const pct = progress?.pct ?? 0;
  const done = progress?.completed ?? false;
  const thumb = lesson.thumbnail || `https://i.ytimg.com/vi/${lesson.videoId}/mqdefault.jpg`;

  return `<div class="video-row${done ? ' completed' : ''}" data-lesson-id="${lesson.id}">
    <div class="video-thumb">
      <img src="${thumb}" alt="" loading="lazy">
      <div class="video-thumb__overlay">
        <div class="play-icon">▶</div>
      </div>
    </div>
    <div class="video-info">
      <div class="video-title">${lesson.title}</div>
      <div class="video-meta">${done ? '✓ Complete' : pct > 0 ? `${pct}% watched` : 'Not started'}</div>
      ${pct > 0 ? `<div class="video-micro-progress">${progressBar(pct, 'sm')}</div>` : ''}
    </div>
    <div>
      ${done
        ? `<span class="done-pill">✓ Done</span>`
        : `<button class="btn btn--ghost" data-action="watch" data-lesson-id="${lesson.id}">Watch</button>`
      }
    </div>
  </div>`;
}

// ── Week block ────────────────────────────────────────────────────
export function weekBlock(mod, lessons, progressMap, openByDefault = false) {
  const done = lessons.filter(l => progressMap[l.id]?.completed).length;
  const pct  = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  const rows  = lessons.map(l => videoRow(l, progressMap[l.id])).join('');
  const open  = openByDefault || done < lessons.length; // auto-open if incomplete

  return `<div class="week-block${open ? ' open' : ''}" data-module-id="${mod.id}">
    <div class="week-summary">
      <div class="week-label">
        <strong>${mod.title}</strong>
        <span class="week-meta">${done}/${lessons.length} lessons · ${pct}%</span>
      </div>
      <span class="week-chevron">▶</span>
    </div>
    <div class="week-content">
      ${progressBar(pct, 'sm')}
      <div class="mt-12">${rows}</div>
    </div>
  </div>`;
}

// ── Course card ───────────────────────────────────────────────────
export function courseCard(course, progress, isActive = false) {
  const pct = progress?.pct ?? 0;
  return `<div class="course-card${isActive ? ' active' : ''}" data-course-id="${course.id}">
    <div class="course-card__meta">${course.level}${course.label ? ' · ' + course.label : ''}</div>
    <div class="course-card__title">${course.title}</div>
    <div class="course-card__progress-label">
      <span>${progress?.done ?? 0}/${progress?.total ?? 0} lessons</span>
      <span>${pct}%</span>
    </div>
    ${progressBar(pct, 'sm')}
  </div>`;
}

// ── Empty state ───────────────────────────────────────────────────
export function emptyState(title, body, cta = '') {
  return `<div class="empty-state">
    <h2>${title}</h2>
    <p>${body}</p>
    ${cta ? `<div class="mt-16">${cta}</div>` : ''}
  </div>`;
}
