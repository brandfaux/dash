/**
 * videoModal.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Video modal with YouTube IFrame API integration.
 *
 * Phase 6 additions on top of existing Phase 3 behaviour:
 *   • Resume from timestamp  — seeks to progress.resumeAt on player ready
 *   • Save timestamp on close / page unload
 *   • Keyboard shortcuts     — Space, ←, →, M, F, Esc (with first-open hint overlay)
 *   • Auto-advance           — 5 s countdown after completion → next lesson
 *   • Mini player            — detach iframe instead of destroy on nav-away
 *   • Mini player expand     — re-dock iframe into modal at current timestamp
 *
 * Bus events consumed:
 *   'lesson:open'        { lessonId, courseId }
 *   'miniPlayer:expand'  { lessonId, courseId, timestamp }
 *   'lesson:autoAdvance' { lesson: { id }, courseId }      (from autoAdvance.js)
 *   'miniPlayer:closed'                                    (from miniPlayer.js)
 *
 * Bus events emitted:
 *   'lesson:complete'    { lessonId, courseId, xp }
 *   'player:detach'      { iframe, lessonId, courseId, ytPlayer, title }
 *   'player:reattach'
 */

import { getProgress, setProgress, markComplete, getNextLesson } from '../../store/progress.js';
import { getLesson } from '../../store/content.js';
import { completionThreshold, xpPerLesson } from '../../config/platform.js';
import { showKeyHintsIfNeeded, destroyKeyHints } from './keyHints.js';
import { startAutoAdvance, cancelAutoAdvance } from './autoAdvance.js';

// ─── DOM refs (resolved once on first call) ───────────────────────────────────
const $ = id => document.getElementById(id);

// ─── Module state ─────────────────────────────────────────────────────────────
let _bus         = null;
let _ytPlayer    = null;    // YT.Player instance
let _currentLesson = null;  // { id, courseId, title, youtubeId, duration }
let _duration    = 0;       // video duration in seconds
let _isComplete  = false;   // has this session triggered completion
let _keyHandler  = null;    // bound keyboard listener (to remove later)
let _unloadSave  = null;    // bound beforeunload handler

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _el(id) { return document.getElementById(id); }

function _playerEl() { return _el('modalPlayerWrap'); }

function _saveTimestamp() {
  if (!_currentLesson || !_ytPlayer) return;
  try {
    const t = Math.floor(_ytPlayer.getCurrentTime?.() ?? 0);
    setProgress(_currentLesson.id, { resumeAt: t });
  } catch { /* player may already be gone */ }
}

async function _openLesson(lessonId, courseId, overrideTimestamp = null) {
  const lesson = await getLesson(lessonId);
  if (!lesson) return;

  _currentLesson = { ...lesson, courseId };
  _isComplete    = false;
  _duration      = 0;

  // Update modal header
  _el('videoModalTitle').textContent = lesson.title;
  const ytLink = _el('modalYtLink');
  if (ytLink) ytLink.href = `https://www.youtube.com/watch?v=${lesson.youtubeId}`;

  const progress   = getProgress(lessonId);
  const resumeAt   = overrideTimestamp ?? progress?.resumeAt ?? 0;
  const wasComplete = progress?.completed ?? false;

  _el('modalStatus').textContent = wasComplete ? '✓ Completed' : 'Progress: 0%';
  _el('modalCompleteBtn').textContent = wasComplete ? 'Mark Incomplete' : 'Mark Complete';

  _showModal();
  _initOrReplacePlayer(lesson.youtubeId, resumeAt);
  showKeyHintsIfNeeded();
  _registerKeyboard();
  _registerUnload();
}

function _showModal() {
  const modal = _el('videoModal');
  if (modal) {
    modal.classList.add('active');
    modal.removeAttribute('hidden');
  }
}

function _closeModal({ detach = false } = {}) {
  _saveTimestamp();
  _unregisterKeyboard();
  _unregisterUnload();
  destroyKeyHints();
  cancelAutoAdvance();

  const modal = _el('videoModal');
  if (modal) {
    modal.classList.remove('active');
    modal.setAttribute('hidden', '');
  }

  if (detach && _ytPlayer && _currentLesson) {
    // Hand the iframe to miniPlayer instead of destroying it
    const iframe = _playerEl().querySelector('iframe');
    if (iframe) {
      _bus.emit('player:detach', {
        iframe,
        lessonId:  _currentLesson.id,
        courseId:  _currentLesson.courseId,
        ytPlayer:  _ytPlayer,
        title:     _currentLesson.title,
      });
      // Don't null _ytPlayer here — mini player owns it now.
      // We null our own reference so we don't accidentally destroy it.
      _ytPlayer = null;
    } else {
      _destroyPlayer();
    }
  } else {
    _destroyPlayer();
  }

  _currentLesson = null;
  _isComplete    = false;
}

function _destroyPlayer() {
  if (_ytPlayer) {
    try { _ytPlayer.destroy(); } catch { /* ignore */ }
    _ytPlayer = null;
  }
  const wrap = _playerEl();
  if (wrap) wrap.innerHTML = '';
}

// ─── YouTube IFrame API ───────────────────────────────────────────────────────

function _initOrReplacePlayer(videoId, startSeconds = 0) {
  // Destroy previous player if any
  if (_ytPlayer) {
    try { _ytPlayer.destroy(); } catch { /* ignore */ }
    _ytPlayer = null;
  }
  const wrap = _playerEl();
  if (!wrap) return;
  wrap.innerHTML = ''; // clear old iframe

  // Create placeholder div for YT to replace
  const placeholder = document.createElement('div');
  placeholder.id = 'ytPlayerTarget';
  wrap.appendChild(placeholder);

  const onReady = (event) => {
    _duration = event.target.getDuration() || 0;
    if (startSeconds > 0 && _duration > 0) {
      event.target.seekTo(startSeconds, true);
    }
    event.target.playVideo();
  };

  const onStateChange = (event) => {
    // YT.PlayerState.PLAYING = 1, PAUSED = 2, ENDED = 0
    if (!_duration && event.target.getDuration) {
      _duration = event.target.getDuration();
    }
    _updateProgress();
  };

  _ytPlayer = new YT.Player('ytPlayerTarget', {
    videoId,
    playerVars: {
      autoplay:       1,
      rel:            0,
      modestbranding: 1,
      enablejsapi:    1,
    },
    events: {
      onReady,
      onStateChange,
    },
  });
}

function _updateProgress() {
  if (!_ytPlayer || !_currentLesson || _duration <= 0) return;

  let current = 0;
  try { current = _ytPlayer.getCurrentTime?.() ?? 0; } catch { return; }

  const pct = current / _duration;
  const display = Math.round(pct * 100);
  const statusEl = _el('modalStatus');
  if (statusEl) statusEl.textContent = `Progress: ${display}%`;

  // Auto-complete at threshold
  if (!_isComplete && pct >= completionThreshold) {
    _triggerComplete();
  }
}

// Poll progress every 5 s while modal is open
let _progressPoll = null;
function _startProgressPoll() {
  _stopProgressPoll();
  _progressPoll = setInterval(_updateProgress, 5000);
}
function _stopProgressPoll() {
  if (_progressPoll) { clearInterval(_progressPoll); _progressPoll = null; }
}

// ─── Completion ───────────────────────────────────────────────────────────────

async function _triggerComplete() {
  if (_isComplete || !_currentLesson) return;
  _isComplete = true;

  markComplete(_currentLesson.id);
  setProgress(_currentLesson.id, { resumeAt: 0 }); // reset resume on completion

  _el('modalStatus').textContent        = '✓ Completed';
  _el('modalCompleteBtn').textContent   = 'Mark Incomplete';

  if (_bus) {
    _bus.emit('lesson:complete', {
      lessonId: _currentLesson.id,
      courseId: _currentLesson.courseId,
      xp:       xpPerLesson,
    });
  }

  // Kick off auto-advance
  const next = await getNextLesson(_currentLesson.id);
  if (_bus) startAutoAdvance(next, _bus);
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────

function _handleKey(e) {
  // Ignore if focus is inside a text input
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  // Ignore if modal isn't open
  const modal = _el('videoModal');
  if (!modal?.classList.contains('active')) return;

  const player = _ytPlayer;

  switch (e.code || e.key) {
    case 'Space':
    case ' ':
      e.preventDefault();
      if (!player) break;
      try {
        const state = player.getPlayerState?.();
        if (state === 1 /* PLAYING */) player.pauseVideo();
        else player.playVideo();
      } catch { /* ignore */ }
      break;

    case 'ArrowLeft':
      e.preventDefault();
      if (!player) break;
      try {
        const t = (player.getCurrentTime?.() ?? 0) - 10;
        player.seekTo(Math.max(0, t), true);
      } catch { /* ignore */ }
      break;

    case 'ArrowRight':
      e.preventDefault();
      if (!player) break;
      try {
        const t = (player.getCurrentTime?.() ?? 0) + 10;
        player.seekTo(t, true);
      } catch { /* ignore */ }
      break;

    case 'KeyM':
    case 'm':
      e.preventDefault();
      if (!player) break;
      try {
        if (player.isMuted?.()) player.unMute();
        else player.mute();
      } catch { /* ignore */ }
      break;

    case 'KeyF':
    case 'f': {
      e.preventDefault();
      const iframe = _playerEl()?.querySelector('iframe');
      if (!iframe) break;
      try {
        const req = iframe.requestFullscreen
          || iframe.webkitRequestFullscreen
          || iframe.mozRequestFullScreen;
        req?.call(iframe);
      } catch { /* ignore — some browsers block programmatic fullscreen */ }
      break;
    }

    case 'Escape':
      // Save timestamp, then close. Bus 'modal:close' may also fire from nav.
      _closeModal({ detach: false });
      break;

    default:
      break;
  }
}

function _registerKeyboard() {
  _unregisterKeyboard();
  _keyHandler = _handleKey.bind(null);
  document.addEventListener('keydown', _keyHandler);
}

function _unregisterKeyboard() {
  if (_keyHandler) {
    document.removeEventListener('keydown', _keyHandler);
    _keyHandler = null;
  }
}

// ─── Before-unload timestamp save ────────────────────────────────────────────

function _registerUnload() {
  _unregisterUnload();
  _unloadSave = () => _saveTimestamp();
  window.addEventListener('beforeunload', _unloadSave);
}

function _unregisterUnload() {
  if (_unloadSave) {
    window.removeEventListener('beforeunload', _unloadSave);
    _unloadSave = null;
  }
}

// ─── Step buttons (25 / 50 / 75%) ────────────────────────────────────────────

function _initStepButtons() {
  document.querySelectorAll('.btn--step[data-pct]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!_ytPlayer || _duration <= 0) return;
      const pct = Number(btn.dataset.pct) / 100;
      try { _ytPlayer.seekTo(pct * _duration, true); } catch { /* ignore */ }
    });
  });
}

// ─── Close & Complete button wiring ──────────────────────────────────────────

function _initButtons() {
  const closeBtn    = _el('modalCloseBtn');
  const completeBtn = _el('modalCompleteBtn');

  closeBtn?.addEventListener('click', () => _closeModal({ detach: false }));

  completeBtn?.addEventListener('click', () => {
    if (!_currentLesson) return;
    if (_isComplete) {
      // Toggle back to incomplete
      _isComplete = false;
      setProgress(_currentLesson.id, { completed: false, resumeAt: 0 });
      _el('modalStatus').textContent      = 'Progress: 0%';
      _el('modalCompleteBtn').textContent = 'Mark Complete';
      cancelAutoAdvance();
    } else {
      _triggerComplete();
    }
  });
}

// ─── Public init ─────────────────────────────────────────────────────────────

/**
 * Initialise the video modal and subscribe to bus events.
 * Call once from main.js / app.js.
 *
 * @param {EventEmitter} bus
 */
export function initVideoModal(bus) {
  _bus = bus;

  _initButtons();
  _initStepButtons();
  _startProgressPoll();

  // ── Bus: open a lesson ──────────────────────────────────────────────────
  bus.on('lesson:open', ({ lessonId, courseId }) => {
    _openLesson(lessonId, courseId);
  });

  // ── Bus: nav-away while playing → detach to mini player ────────────────
  bus.on('nav:change', () => {
    if (!_currentLesson) return;
    // Only detach if video is actively playing
    let isPlaying = false;
    try { isPlaying = _ytPlayer?.getPlayerState?.() === 1; } catch { /* ignore */ }

    if (isPlaying) {
      _closeModal({ detach: true });
    } else if (_currentLesson) {
      _closeModal({ detach: false });
    }
  });

  // ── Bus: mini player expand → re-open modal at current timestamp ────────
  bus.on('miniPlayer:expand', ({ lessonId, courseId, timestamp }) => {
    // Reclaim the iframe from mini player's DOM back into our wrap
    const miniSlot = document.getElementById('miniPlayerVideo');
    const iframe   = miniSlot?.querySelector('iframe');
    const wrap     = _playerEl();

    if (iframe && wrap) {
      wrap.innerHTML = '';
      wrap.appendChild(iframe);
    }

    bus.emit('player:reattach');
    _openLesson(lessonId, courseId, timestamp);
  });

  // ── Bus: mini player was fully closed externally ────────────────────────
  bus.on('miniPlayer:closed', () => {
    // Ensure our state is clean (player was destroyed by miniPlayer.js)
    _ytPlayer      = null;
    _currentLesson = null;
    _isComplete    = false;
  });

  // ── Bus: auto-advance fires ──────────────────────────────────────────────
  bus.on('lesson:autoAdvance', ({ lesson, courseId }) => {
    cancelAutoAdvance(); // bar already removed by autoAdvance.js
    _closeModal({ detach: false });
    // Short delay so close animation completes before re-open
    setTimeout(() => {
      bus.emit('lesson:open', { lessonId: lesson.id, courseId });
    }, 300);
  });
}