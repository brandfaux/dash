/**
 * ui/blocks/videoModal.js — YouTube video player modal.
 * Tracks progress, marks complete, fires bus events.
 */

import { bus, showToast }        from '../../app.js';
import { PLATFORM }              from '../../config/platform.js';
import { setProgress, markComplete, getProgress } from '../../store/progress.js';
import { addXP }                 from '../../store/user.js';
import { evaluateAchievements }  from '../../engine/achievements.js';
import { tickStreak }            from '../../store/user.js';

let ytPlayer       = null;
let currentLesson  = null;
let progressTimer  = null;

// ─── Public API ───────────────────────────────────────────────────

export function openVideoModal(lesson) {
  if (!lesson?.videoId) {
    showToast('No video ID found for this lesson.', 'error');
    return;
  }
  currentLesson = lesson;

  const saved = getProgress(lesson.id);

  document.getElementById('videoModalTitle').textContent = lesson.title;
  document.getElementById('modalYtLink').href =
    `https://www.youtube.com/watch?v=${lesson.videoId}`;
  document.getElementById('modalStatus').textContent =
    `Progress: ${saved.pct}%`;
  document.getElementById('videoModal').classList.add('open');

  loadPlayer(lesson.videoId, saved.resumeAt || 0);
}

// ─── Player ───────────────────────────────────────────────────────

function loadPlayer(videoId, startAt = 0) {
  const wrap = document.getElementById('modalPlayerWrap');
  wrap.innerHTML = '<div id="ytPlayerEl"></div>';

  const create = () => {
    ytPlayer = new YT.Player('ytPlayerEl', {
      videoId,
      playerVars: {
        autoplay: 1,
        modestbranding: 1,
        rel: 0,
        start: Math.floor(startAt),
        enablejsapi: 1,
      },
      events: {
        onReady:       ()  => startTracking(),
        onStateChange: (e) => handleStateChange(e),
      },
    });
  };

  if (window.YT?.Player) create();
  else {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); create(); };
  }
}

function startTracking() {
  clearInterval(progressTimer);
  progressTimer = setInterval(saveSnapshot, 3000);
}

function saveSnapshot() {
  if (!currentLesson || !ytPlayer?.getCurrentTime) return;
  const current  = ytPlayer.getCurrentTime();
  const duration = ytPlayer.getDuration() || 1;
  const pct      = Math.min(100, Math.round((current / duration) * 100));

  setProgress(currentLesson.id, { pct, resumeAt: current });
  updateStatusBar(pct);

  if (pct >= PLATFORM.completionThreshold * 100) {
    completeLesson();
  }
}

function handleStateChange(event) {
  const S = YT.PlayerState;
  if (event.data === S.PLAYING)  startTracking();
  if (event.data === S.PAUSED)   saveSnapshot();
  if (event.data === S.ENDED)    completeLesson();
}

// ─── Completion ───────────────────────────────────────────────────

function completeLesson() {
  if (!currentLesson) return;
  clearInterval(progressTimer);

  const alreadyDone = getProgress(currentLesson.id).completed;
  markComplete(currentLesson.id);

  if (!alreadyDone) {
    addXP(PLATFORM.xpPerLesson);
    tickStreak();
    const unlocked = evaluateAchievements();
    unlocked.forEach(a => showToast(`${a.icon} ${a.label} unlocked!`, 'achievement'));
    showToast(`✓ Lesson complete — +${PLATFORM.xpPerLesson} XP`, 'success');
  }

  updateStatusBar(100);
  bus.emit('lessonComplete', { lessonId: currentLesson.id, lesson: currentLesson });
  bus.emit('statsChanged');
}

// ─── UI helpers ───────────────────────────────────────────────────

function updateStatusBar(pct) {
  const el = document.getElementById('modalStatus');
  if (el) el.textContent = `Progress: ${pct}%`;
}

function closeModal() {
  if (ytPlayer) {
    try { saveSnapshot(); ytPlayer.destroy(); } catch {}
    ytPlayer = null;
  }
  clearInterval(progressTimer);
  document.getElementById('videoModal').classList.remove('open');
  currentLesson = null;
}

// ─── Event wiring ─────────────────────────────────────────────────

document.getElementById('modalCloseBtn').addEventListener('click', closeModal);

document.getElementById('videoModal').addEventListener('click', e => {
  if (e.target === document.getElementById('videoModal')) closeModal();
});

document.getElementById('modalCompleteBtn').addEventListener('click', () => {
  if (currentLesson) completeLesson();
});

document.querySelectorAll('.btn--step').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!currentLesson) return;
    const pct = Number(btn.dataset.pct);
    setProgress(currentLesson.id, { pct });
    updateStatusBar(pct);
    showToast(`Progress set to ${pct}%`);
  });
});

bus.on('closeModal', closeModal);
