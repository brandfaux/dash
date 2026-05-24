/**
 * autoAdvance.js
 * ─────────────────────────────────────────────────────────────────────────────
 * When a lesson is marked complete, show a 5-second countdown card in the
 * modal footer. If the user does not cancel, emit 'lesson:autoAdvance' on the
 * bus with the next lesson payload so videoModal.js can open it.
 *
 * Public API
 *   startAutoAdvance(nextLesson, bus)  — show countdown; pass null to skip
 *   cancelAutoAdvance()               — cancel any running countdown
 */

const COUNTDOWN_ID = 'autoAdvanceBar';
const SECONDS      = 5;

let _timer    = null;
let _interval = null;

/** Remove the countdown bar from the DOM. */
function _remove() {
  const el = document.getElementById(COUNTDOWN_ID);
  if (el) el.remove();
}

/** Cancel timers and clean up. */
export function cancelAutoAdvance() {
  clearTimeout(_timer);
  clearInterval(_interval);
  _timer    = null;
  _interval = null;
  _remove();
}

/**
 * Inject a countdown bar into `.modal-footer` and auto-advance after SECONDS.
 *
 * @param {{ courseId: string, lesson: { id: string, title: string } }} nextLesson
 * @param {EventEmitter} bus — the app-level event bus
 */
export function startAutoAdvance(nextLesson, bus) {
  cancelAutoAdvance(); // clear any previous run

  if (!nextLesson) return; // no next lesson in course

  const footer = document.querySelector('#videoModal .modal-footer');
  if (!footer) return;

  // Remove any stale bar
  _remove();

  let remaining = SECONDS;

  const bar = document.createElement('div');
  bar.id        = COUNTDOWN_ID;
  bar.className = 'auto-advance-bar';
  bar.innerHTML = `
    <div class="auto-advance-info">
      <span class="auto-advance-label">Up next</span>
      <span class="auto-advance-title">${_escape(nextLesson.lesson.title)}</span>
    </div>
    <div class="auto-advance-controls">
      <span class="auto-advance-count" id="autoAdvanceCount">${remaining}</span>
      <button class="btn btn--ghost auto-advance-cancel" id="autoAdvanceCancel">Cancel</button>
    </div>
    <div class="auto-advance-progress">
      <div class="auto-advance-progress-fill" id="autoAdvanceFill"
           style="animation-duration: ${SECONDS}s"></div>
    </div>
  `;

  footer.appendChild(bar);

  // Animate fill in next frame
  requestAnimationFrame(() => {
    const fill = document.getElementById('autoAdvanceFill');
    if (fill) fill.classList.add('auto-advance-progress-fill--running');
  });

  document.getElementById('autoAdvanceCancel')
    .addEventListener('click', () => cancelAutoAdvance(), { once: true });

  // Tick countdown display
  _interval = setInterval(() => {
    remaining -= 1;
    const countEl = document.getElementById('autoAdvanceCount');
    if (countEl) countEl.textContent = remaining;
  }, 1000);

  // Fire after SECONDS
  _timer = setTimeout(() => {
    clearInterval(_interval);
    _remove();
    bus.emit('lesson:autoAdvance', nextLesson);
  }, SECONDS * 1000);
}

/** Minimal HTML escaping to prevent XSS in lesson titles. */
function _escape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
