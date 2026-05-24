/**
 * main.js — Module entry point.
 */

import { init, bus, navigate } from './app.js';
import { PLATFORM } from './config/platform.js';
import { seedIfEmpty } from './config/seed.js';

// Pages
import './ui/pages/dashboard.js';
import './ui/pages/analytics.js';
import './ui/pages/courses.js';
import './ui/pages/import.js';
import { mountFlashcardsPage } from './ui/pages/flashcards.js';

// Blocks
import { initVideoModal } from './ui/blocks/videoModal.js';
import { initMiniPlayer } from './ui/blocks/miniPlayer.js';
import { renderNavBadges } from './ui/blocks/navBadges.js';

console.log('Main.js loaded');

// ── Branding ────────────────────────────────────────────────────
const logoMark = document.getElementById('navLogoMark');
const logoRest = document.getElementById('navLogoRest');
if (logoMark) logoMark.textContent = PLATFORM.logo.mark;
if (logoRest) logoRest.textContent = PLATFORM.logo.rest;

// ── Feature flags → hide nav items ──────────────────────────────
if (!PLATFORM.features.flashcards) document.querySelector('[data-nav="flashcards"]')?.remove();
if (!PLATFORM.features.vocab) document.querySelector('[data-nav="vocab"]')?.remove();
if (!PLATFORM.features.import) document.querySelector('[data-nav="import"]')?.remove();

// ── Nav badge refresh ────────────────────────────────────────────
bus.on('statsChanged', renderNavBadges);
bus.on('navigate', renderNavBadges);
bus.on('lessonComplete', renderNavBadges);

// ── Seed demo data if store is empty ────────────────────────────
console.log('Seeding data...');
seedIfEmpty();

// ── Initialize modules that need bus ────────────────────────────
console.log('Initializing video modal...');
initVideoModal(bus);
console.log('Initializing mini player...');
initMiniPlayer(bus);

// ── Handle flashcards page ──────────────────────────────────────
bus.on('navigate', (page) => {
  if (page === 'flashcards') {
    const el = document.getElementById('pageFlashcards');
    if (el) mountFlashcardsPage(el, bus);
  }
});

// ── Boot ─────────────────────────────────────────────────────────
console.log('Calling init()...');
init();
console.log('Init complete');

// Force initial render if dashboard is active
setTimeout(() => {
  if (document.querySelector('.page.active')?.dataset.page === 'dashboard') {
    bus.emit('navigate', 'dashboard');
  }
}, 100);