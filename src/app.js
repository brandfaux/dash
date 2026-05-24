/**
 * app.js — Entry point.
 * Handles init, routing, and a minimal event bus for cross-module communication.
 */

import { PLATFORM } from './config/platform.js';
import { getUser, tickStreak } from './store/user.js';
import { evaluateAchievements } from './engine/achievements.js';

// ─── Event Bus ────────────────────────────────────────────────────────────────

const listeners = {};

export const bus = {
  on(event, fn)  { (listeners[event] ??= []).push(fn); },
  off(event, fn) { listeners[event] = (listeners[event] ?? []).filter(f => f !== fn); },
  emit(event, data) { (listeners[event] ?? []).forEach(fn => fn(data)); },
};

// ─── Router ───────────────────────────────────────────────────────────────────

let currentPage = 'dashboard';

export function navigate(page) {
  if (currentPage === page) return;
  currentPage = page;
  document.querySelectorAll('.page').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page)
  );
  document.querySelectorAll('[data-nav]').forEach(el =>
    el.classList.toggle('active', el.dataset.nav === page)
  );
  bus.emit('navigate', page);
}

export function getCurrentPage() { return currentPage; }

// ─── Toast ────────────────────────────────────────────────────────────────────

export function showToast(message, type = 'default') {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  wrap.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ─── Lesson Complete Handler ──────────────────────────────────────────────────

export function onLessonComplete(lessonId, lessonTitle) {
  tickStreak();
  const unlocked = evaluateAchievements();
  unlocked.forEach(a => showToast(`${a.icon} ${a.label} unlocked!`, 'achievement'));
  bus.emit('lessonComplete', { lessonId, lessonTitle });
  bus.emit('statsChanged');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function init() {
  // Ensure user exists
  getUser();

  // Apply platform branding
  document.title = PLATFORM.name;

  // Tick streak on session start (safe to call repeatedly)
  tickStreak();

  // Nav click handlers
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.nav));
  });

  // Keyboard: Escape closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') bus.emit('closeModal');
  });

  // Initial render — emit navigate to trigger page renderers
  const first = document.querySelector('[data-nav].active')?.dataset.nav ?? 'dashboard';
  currentPage = first;
  bus.emit('navigate', first);
  bus.emit('statsChanged');
}