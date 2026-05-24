/**
 * keyHints.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows a one-time overlay listing keyboard shortcuts when the video modal
 * opens for the first time. Dismissed state is persisted in localStorage so
 * it never shows again once the user acknowledges it.
 *
 * Public API
 *   showKeyHintsIfNeeded()  — call on every modal open; no-ops after first dismiss
 *   destroyKeyHints()       — remove overlay from DOM immediately (e.g. on close)
 */

const STORAGE_KEY = 'le_keyhints_seen';
const OVERLAY_ID  = 'keyHintsOverlay';

const HINTS = [
  { key: 'Space',  label: 'Play / Pause'  },
  { key: '←  →',  label: 'Seek ±10 s'    },
  { key: 'M',      label: 'Mute toggle'   },
  { key: 'F',      label: 'Fullscreen'    },
  { key: 'Esc',    label: 'Close modal'   },
];

function _alreadySeen() {
  try { return !!localStorage.getItem(STORAGE_KEY); }
  catch { return false; }
}

function _markSeen() {
  try { localStorage.setItem(STORAGE_KEY, '1'); }
  catch { /* storage blocked — just don't show again this session */ }
}

/**
 * Build and inject the overlay into the modal card.
 * The overlay sits inside `.modal-card` so it respects the modal's stacking
 * context without an extra backdrop layer.
 */
function _render() {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) return; // already mounted

  const modal = document.querySelector('#videoModal .modal-card');
  if (!modal) return;

  const el = document.createElement('div');
  el.id = OVERLAY_ID;
  el.className = 'key-hints-overlay';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Keyboard shortcuts');

  el.innerHTML = `
    <div class="key-hints-card">
      <h3 class="key-hints-title label-caps">Keyboard Shortcuts</h3>
      <ul class="key-hints-list">
        ${HINTS.map(h => `
          <li class="key-hints-row">
            <kbd class="key-hints-key">${h.key}</kbd>
            <span class="key-hints-desc">${h.label}</span>
          </li>`).join('')}
      </ul>
      <button class="btn btn--primary key-hints-dismiss" id="keyHintsDismiss">
        Got it
      </button>
    </div>
  `;

  modal.appendChild(el);

  document.getElementById('keyHintsDismiss')
    .addEventListener('click', () => {
      _markSeen();
      destroyKeyHints();
    }, { once: true });

  // Also dismiss on backdrop click (clicking outside the card)
  el.addEventListener('click', e => {
    if (e.target === el) {
      _markSeen();
      destroyKeyHints();
    }
  });

  // Animate in
  requestAnimationFrame(() => el.classList.add('key-hints-overlay--visible'));
}

/** Show overlay only if the user hasn't dismissed it yet. */
export function showKeyHintsIfNeeded() {
  if (_alreadySeen()) return;
  _render();
}

/** Remove overlay from DOM immediately. */
export function destroyKeyHints() {
  const el = document.getElementById(OVERLAY_ID);
  if (!el) return;
  el.classList.remove('key-hints-overlay--visible');
  // Wait for fade-out transition before removal
  el.addEventListener('transitionend', () => el.remove(), { once: true });
  // Fallback in case transition doesn't fire (e.g. prefers-reduced-motion)
  setTimeout(() => el.remove(), 400);
}
