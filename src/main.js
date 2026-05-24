/**
 * main.js — Module entry point.
 */

import { init, bus, navigate } from './app.js';
import { PLATFORM }            from './config/platform.js';
import { seedIfEmpty }         from './config/seed.js';

// Pages
import './ui/pages/dashboard.js';
import './ui/pages/courses.js';
import './ui/pages/import.js';
import './ui/pages/flashcards.js';
import './ui/pages/vocab.js';

// Blocks
import './ui/blocks/videoModal.js';
import { renderNavBadges } from './ui/blocks/navBadges.js';

// ── Branding ────────────────────────────────────────────────────
document.getElementById('navLogoMark').textContent = PLATFORM.logo.mark;
document.getElementById('navLogoRest').textContent = PLATFORM.logo.rest;

// ── Feature flags → hide nav items ──────────────────────────────
if (!PLATFORM.features.flashcards) document.querySelector('[data-nav="flashcards"]')?.remove();
if (!PLATFORM.features.vocab)      document.querySelector('[data-nav="vocab"]')?.remove();
if (!PLATFORM.features.import)     document.querySelector('[data-nav="import"]')?.remove();

// ── Nav badge refresh ────────────────────────────────────────────
bus.on('statsChanged',   renderNavBadges);
bus.on('navigate',       renderNavBadges);
bus.on('lessonComplete', renderNavBadges);

// ── Seed demo data if store is empty ────────────────────────────
seedIfEmpty();

// ── Boot ─────────────────────────────────────────────────────────
init();
