/**
 * miniPlayer.js
 * ─────────────────────────────────────────────────────────────────────────────
 * A bottom-right docked mini player. When the user navigates away while a
 * video is playing, the modal closes but the iframe is detached into this
 * mini player instead of being destroyed. Clicking the mini player re-opens
 * the full modal at the current timestamp. The close (✕) button on the mini
 * player fully destroys the player.
 *
 * This module does NOT import videoModal.js to avoid circular deps.
 * It communicates exclusively via the bus:
 *
 *   Listens for:
 *     'player:detach'   { iframe, lessonId, courseId, ytPlayer }
 *                        → show mini player with the detached iframe
 *     'player:reattach' — modal has reclaimed the iframe; hide mini player UI
 *
 *   Emits:
 *     'miniPlayer:expand'  { lessonId, courseId, timestamp }
 *                          → videoModal.js opens lesson at timestamp
 *     'miniPlayer:closed'  — user fully closed the mini player
 *
 * Init:
 *   import { initMiniPlayer } from './miniPlayer.js';
 *   initMiniPlayer(bus);   // called once from main.js / app.js
 */

const MINI_ID = 'miniPlayer';

let _bus      = null;
let _ytPlayer = null; // reference to YT.Player kept by videoModal
let _lessonId = null;
let _courseId = null;

/** Ensure the mini player DOM node exists (idempotent). */
function _ensureEl() {
  if (document.getElementById(MINI_ID)) return;

  const el = document.createElement('div');
  el.id        = MINI_ID;
  el.className = 'mini-player';
  el.setAttribute('aria-label', 'Mini video player');

  el.innerHTML = `
    <div class="mini-player__video" id="miniPlayerVideo"></div>
    <div class="mini-player__bar">
      <span class="mini-player__title label-mono" id="miniPlayerTitle"></span>
      <div class="mini-player__actions">
        <button class="mini-player__btn" id="miniPlayerExpand" aria-label="Expand to full player">⤢</button>
        <button class="mini-player__btn mini-player__btn--close" id="miniPlayerClose" aria-label="Close mini player">✕</button>
      </div>
    </div>
  `;

  document.body.appendChild(el);

  document.getElementById('miniPlayerExpand').addEventListener('click', _onExpand);
  document.getElementById('miniPlayerClose').addEventListener('click', _onClose);
}

function _show() {
  const el = document.getElementById(MINI_ID);
  if (el) {
    el.classList.add('mini-player--visible');
  }
}

function _hide() {
  const el = document.getElementById(MINI_ID);
  if (el) {
    el.classList.remove('mini-player--visible');
  }
}

/** Move iframe into mini player's video slot. */
function _attachIframe(iframe) {
  const slot = document.getElementById('miniPlayerVideo');
  if (!slot || !iframe) return;
  // Clear slot first
  slot.innerHTML = '';
  slot.appendChild(iframe);
}

/** Handle the expand button: fire bus event so videoModal re-opens. */
function _onExpand() {
  if (!_bus || !_lessonId) return;

  let timestamp = 0;
  if (_ytPlayer && typeof _ytPlayer.getCurrentTime === 'function') {
    try { timestamp = Math.floor(_ytPlayer.getCurrentTime()); }
    catch { /* player may be in bad state */ }
  }

  _bus.emit('miniPlayer:expand', {
    lessonId:  _lessonId,
    courseId:  _courseId,
    timestamp,
  });
  // Hide chrome — modal will reclaim iframe and call player:reattach
  _hide();
}

/** Handle the close (✕) button: fully destroy the player. */
function _onClose() {
  if (_ytPlayer && typeof _ytPlayer.destroy === 'function') {
    try { _ytPlayer.destroy(); } catch { /* ignore */ }
  }
  _ytPlayer = null;
  _lessonId = null;
  _courseId = null;
  _hide();

  const slot = document.getElementById('miniPlayerVideo');
  if (slot) slot.innerHTML = '';

  if (_bus) _bus.emit('miniPlayer:closed');
}

/**
 * Initialise the mini player and subscribe to bus events.
 * Call once from main.js / app.js after the bus is created.
 *
 * @param {EventEmitter} bus
 */
export function initMiniPlayer(bus) {
  _bus = bus;
  _ensureEl();

  // Modal is handing off the iframe to us
  bus.on('player:detach', ({ iframe, lessonId, courseId, ytPlayer, title }) => {
    _lessonId = lessonId;
    _courseId = courseId;
    _ytPlayer = ytPlayer;

    _ensureEl(); // safe to call again
    _attachIframe(iframe);

    const titleEl = document.getElementById('miniPlayerTitle');
    if (titleEl) titleEl.textContent = title || 'Playing…';

    _show();
  });

  // Modal has reclaimed the iframe; just hide our chrome
  bus.on('player:reattach', () => {
    _hide();
    // Don't clear slot — iframe is already gone (modal moved it via appendChild)
    _ytPlayer = null;
    _lessonId = null;
    _courseId = null;
  });
}
