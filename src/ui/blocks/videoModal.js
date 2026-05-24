/**
 * videoModal.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Video modal with YouTube IFrame API integration.
 */

import { getProgress, setProgress, markComplete, getNextLesson } from '../../store/progress.js';
import { getLesson } from '../../store/content.js';
import { PLATFORM } from '../../config/platform.js';
import { showKeyHintsIfNeeded, destroyKeyHints } from './keyHints.js';
import { startAutoAdvance, cancelAutoAdvance } from './autoAdvance.js';

const { completionThreshold, xpPerLesson } = PLATFORM;

// ─── DOM refs ───────────────────────────────────────────────────
function _el(id) { return document.getElementById(id); }
function _playerEl() { return _el('modalPlayerWrap'); }

// ─── Module state ─────────────────────────────────────────────────
let _bus = null;
let _ytPlayer = null;
let _currentLesson = null;
let _duration = 0;
let _isComplete = false;
let _keyHandler = null;
let _unloadSave = null;

// ─── Helper Functions ────────────────────────────────────────────
function _saveTimestamp() {
  if (!_currentLesson || !_ytPlayer) return;
  try {
    const t = Math.floor(_ytPlayer.getCurrentTime?.() ?? 0);
    setProgress(_currentLesson.id, { resumeAt: t });
  } catch { }
}

async function _openLesson(lessonId, courseId, overrideTimestamp = null) {
  const lesson = await getLesson(lessonId);
  if (!lesson) return;

  _currentLesson = { ...lesson, courseId };
  _isComplete = false;
  _duration = 0;

  _el('videoModalTitle').textContent = lesson.title;
  const ytLink = _el('modalYtLink');
  if (ytLink) ytLink.href = `https://www.youtube.com/watch?v=${lesson.videoId}`;

  const progress = getProgress(lessonId);
  const resumeAt = overrideTimestamp ?? progress?.resumeAt ?? 0;
  const wasComplete = progress?.completed ?? false;

  _el('modalStatus').textContent = wasComplete ? '✓ Completed' : 'Progress: 0%';
  _el('modalCompleteBtn').textContent = wasComplete ? 'Mark Incomplete' : 'Mark Complete';

  _showModal();
  _initOrReplacePlayer(lesson.videoId, resumeAt);
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
    const iframe = _playerEl().querySelector('iframe');
    if (iframe && _bus) {
      _bus.emit('player:detach', {
        iframe,
        lessonId: _currentLesson.id,
        courseId: _currentLesson.courseId,
        ytPlayer: _ytPlayer,
        title: _currentLesson.title,
      });
      _ytPlayer = null;
    } else {
      _destroyPlayer();
    }
  } else {
    _destroyPlayer();
  }

  _currentLesson = null;
  _isComplete = false;
}

function _destroyPlayer() {
  if (_ytPlayer) {
    try { _ytPlayer.destroy(); } catch { }
    _ytPlayer = null;
  }
  const wrap = _playerEl();
  if (wrap) wrap.innerHTML = '';
}

function _initOrReplacePlayer(videoId, startSeconds = 0) {
  if (_ytPlayer) {
    try { _ytPlayer.destroy(); } catch { }
    _ytPlayer = null;
  }
  const wrap = _playerEl();
  if (!wrap) return;
  wrap.innerHTML = '';

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

  const onStateChange = () => {
    if (!_duration && _ytPlayer?.getDuration) {
      _duration = _ytPlayer.getDuration();
    }
    _updateProgress();
  };

  _ytPlayer = new YT.Player('ytPlayerTarget', {
    videoId,
    playerVars: {
      autoplay: 1,
      rel: 0,
      modestbranding: 1,
      enablejsapi: 1,
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

  if (!_isComplete && pct >= completionThreshold) {
    _triggerComplete();
  }
}

let _progressPoll = null;
function _startProgressPoll() {
  _stopProgressPoll();
  _progressPoll = setInterval(_updateProgress, 5000);
}
function _stopProgressPoll() {
  if (_progressPoll) { clearInterval(_progressPoll); _progressPoll = null; }
}

async function _triggerComplete() {
  if (_isComplete || !_currentLesson) return;
  _isComplete = true;

  markComplete(_currentLesson.id);
  setProgress(_currentLesson.id, { resumeAt: 0 });

  _el('modalStatus').textContent = '✓ Completed';
  _el('modalCompleteBtn').textContent = 'Mark Incomplete';

  if (_bus) {
    _bus.emit('lesson:complete', {
      lessonId: _currentLesson.id,
      courseId: _currentLesson.courseId,
      xp: xpPerLesson,
    });
  }

  const next = await getNextLesson(_currentLesson.id);
  if (_bus) startAutoAdvance(next, _bus);
}

function _handleKey(e) {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

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
        if (state === 1) player.pauseVideo();
        else player.playVideo();
      } catch { }
      break;
    case 'ArrowLeft':
      e.preventDefault();
      if (!player) break;
      try {
        const t = (player.getCurrentTime?.() ?? 0) - 10;
        player.seekTo(Math.max(0, t), true);
      } catch { }
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (!player) break;
      try {
        const t = (player.getCurrentTime?.() ?? 0) + 10;
        player.seekTo(t, true);
      } catch { }
      break;
    case 'KeyM':
    case 'm':
      e.preventDefault();
      if (!player) break;
      try {
        if (player.isMuted?.()) player.unMute();
        else player.mute();
      } catch { }
      break;
    case 'KeyF':
    case 'f': {
      e.preventDefault();
      const iframe = _playerEl()?.querySelector('iframe');
      if (!iframe) break;
      try {
        const req = iframe.requestFullscreen || iframe.webkitRequestFullscreen || iframe.mozRequestFullScreen;
        req?.call(iframe);
      } catch { }
      break;
    }
    case 'Escape':
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

function _initStepButtons() {
  document.querySelectorAll('.btn--step[data-pct]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!_ytPlayer || _duration <= 0) return;
      const pct = Number(btn.dataset.pct) / 100;
      try { _ytPlayer.seekTo(pct * _duration, true); } catch { }
    });
  });
}

function _initButtons() {
  const closeBtn = _el('modalCloseBtn');
  const completeBtn = _el('modalCompleteBtn');

  closeBtn?.addEventListener('click', () => _closeModal({ detach: false }));

  completeBtn?.addEventListener('click', () => {
    if (!_currentLesson) return;
    if (_isComplete) {
      _isComplete = false;
      setProgress(_currentLesson.id, { completed: false, resumeAt: 0 });
      _el('modalStatus').textContent = 'Progress: 0%';
      _el('modalCompleteBtn').textContent = 'Mark Complete';
      cancelAutoAdvance();
    } else {
      _triggerComplete();
    }
  });
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Initialize the video modal and subscribe to bus events
 */
export function initVideoModal(bus) {
  _bus = bus;
  _initButtons();
  _initStepButtons();
  _startProgressPoll();

  bus.on('lesson:open', ({ lessonId, courseId }) => {
    _openLesson(lessonId, courseId);
  });

  bus.on('nav:change', () => {
    if (!_currentLesson) return;
    let isPlaying = false;
    try { isPlaying = _ytPlayer?.getPlayerState?.() === 1; } catch { }
    if (isPlaying) {
      _closeModal({ detach: true });
    } else if (_currentLesson) {
      _closeModal({ detach: false });
    }
  });

  bus.on('miniPlayer:expand', ({ lessonId, courseId, timestamp }) => {
    const miniSlot = document.getElementById('miniPlayerVideo');
    const iframe = miniSlot?.querySelector('iframe');
    const wrap = _playerEl();
    if (iframe && wrap) {
      wrap.innerHTML = '';
      wrap.appendChild(iframe);
    }
    bus.emit('player:reattach');
    _openLesson(lessonId, courseId, timestamp);
  });

  bus.on('miniPlayer:closed', () => {
    _ytPlayer = null;
    _currentLesson = null;
    _isComplete = false;
  });

  bus.on('lesson:autoAdvance', ({ lesson, courseId }) => {
    cancelAutoAdvance();
    _closeModal({ detach: false });
    setTimeout(() => {
      bus.emit('lesson:open', { lessonId: lesson.id, courseId });
    }, 300);
  });
}

/**
 * Open a video modal for a specific lesson
 * This is a convenience wrapper around the bus event
 */
export function openVideoModal(lesson, courseId = null) {
  if (!lesson) return;
  
  // Import bus dynamically to avoid circular dependencies
  import('../../app.js').then(({ bus }) => {
    bus.emit('lesson:open', { 
      lessonId: lesson.id, 
      courseId: courseId || lesson.courseId 
    });
  });
}