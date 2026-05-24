/**
 * src/ui/blocks/generateCardsModal.js
 *
 * Modal for generating flashcards from course lessons.
 * Renders a checklist of lessons for a given course; on submit emits:
 *   bus.emit('cards:generateRequest', { deckId, lessonIds })
 *
 * Usage:
 *   import { openGenerateCardsModal } from './generateCardsModal.js';
 *   openGenerateCardsModal({ deckId, courseId, bus });
 */

import { getAllLessonsForCourse } from '../../store/content.js';
import { showToast } from '../../app.js';

const MODAL_ID = 'generateCardsModal';

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * @param {{ deckId: string, courseId: string, bus: EventBus }} opts
 */
export function openGenerateCardsModal({ deckId, courseId, bus }) {
  _removeExisting();

  const lessons = getAllLessonsForCourse(courseId);
  const modal = _buildModal(lessons, deckId, courseId, bus);
  document.body.appendChild(modal);

  // focus trap — close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeGenerateCardsModal();
  });

  requestAnimationFrame(() => modal.classList.add('is-open'));
}

export function closeGenerateCardsModal() {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.addEventListener('transitionend', () => modal.remove(), { once: true });
}

// ─── build ───────────────────────────────────────────────────────────────────

function _buildModal(lessons, deckId, courseId, bus) {
  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'gcm-title');

  if (lessons.length === 0) {
    overlay.innerHTML = `
      <div class="modal-box gcm-box">
        <h2 id="gcm-title" class="gcm-title">Generate Cards</h2>
        <p class="gcm-empty">No lessons found for this course.</p>
        <div class="gcm-actions">
          <button class="btn btn-secondary" id="gcm-cancel">Close</button>
        </div>
      </div>`;
    overlay.querySelector('#gcm-cancel').addEventListener('click', closeGenerateCardsModal);
    return overlay;
  }

  const listItems = lessons
    .map(
      (l) => `
      <label class="gcm-lesson-row">
        <input type="checkbox" class="gcm-check" value="${l.id}" checked />
        <span class="gcm-lesson-title">${_esc(l.title)}</span>
      </label>`
    )
    .join('');

  overlay.innerHTML = `
    <div class="modal-box gcm-box">
      <h2 id="gcm-title" class="gcm-title">Generate Cards from Lessons</h2>
      <p class="gcm-hint">Select the lessons to include. Generation runs in Phase 8.</p>

      <div class="gcm-controls">
        <button class="btn-link" id="gcm-all">Select all</button>
        <span class="gcm-sep">·</span>
        <button class="btn-link" id="gcm-none">None</button>
      </div>

      <div class="gcm-list" role="group" aria-label="Lessons">
        ${listItems}
      </div>

      <div class="gcm-actions">
        <button class="btn btn-secondary" id="gcm-cancel">Cancel</button>
        <button class="btn btn-primary" id="gcm-generate">Generate</button>
      </div>
    </div>`;

  // wiring
  overlay.querySelector('#gcm-cancel').addEventListener('click', closeGenerateCardsModal);

  overlay.querySelector('#gcm-all').addEventListener('click', () => {
    overlay.querySelectorAll('.gcm-check').forEach((c) => (c.checked = true));
  });

  overlay.querySelector('#gcm-none').addEventListener('click', () => {
    overlay.querySelectorAll('.gcm-check').forEach((c) => (c.checked = false));
  });

  overlay.querySelector('#gcm-generate').addEventListener('click', () => {
    const lessonIds = [...overlay.querySelectorAll('.gcm-check:checked')].map((c) => c.value);
    if (lessonIds.length === 0) {
      showToast('Pick at least one lesson.');
      return;
    }
    bus.emit('cards:generateRequest', { deckId, lessonIds });
    showToast('Generation queued — coming in Phase 8 🚀');
    closeGenerateCardsModal();
  });

  return overlay;
}

function _removeExisting() {
  document.getElementById(MODAL_ID)?.remove();
}

function _esc(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
