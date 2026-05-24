/**
 * src/ui/pages/flashcardsPage.js
 *
 * Mounted into #pageFlashcards by the router in app.js.
 *
 * Two top-level views:
 *   - Deck overview  (default)
 *   - Study session  (when "Study Now" is clicked)
 *
 * Communicates via bus:
 *   Emits → xp:earn { amount }
 *   Emits → cards:generateRequest (delegated to generateCardsModal)
 */

import {
  getDecks,
  getDeck,
  writeDeck,
  deleteDeck,
  getCards,
  writeCard,
  deleteCard,
  getDueCards,
} from '../../store/flashcards.js';
import { getDecks as _gd } from '../../store/flashcards.js'; // alias kept for clarity
import { reviewCard, isPassing } from '../../utils/sm2.js';
import { openGenerateCardsModal } from '../blocks/generateCardsModal.js';
import { FlashcardSchema, DeckSchema } from '../../schema/entities.js';
import { showToast } from '../../app.js';

// ─── mount ───────────────────────────────────────────────────────────────────

/** Called by the router. el = #pageFlashcards, bus = app event bus */
export function mountFlashcardsPage(el, bus) {
  el.innerHTML = '';
  el.appendChild(_buildShell(bus));
  _renderDeckList(el, bus);
  _showEmptyOrOverview(el, bus, null);
}

// ─── shell layout ────────────────────────────────────────────────────────────

function _buildShell(bus) {
  const wrap = document.createElement('div');
  wrap.className = 'fc-layout';
  wrap.innerHTML = `
    <aside class="fc-sidebar" id="fcSidebar">
      <div class="fc-sidebar-header">
        <h2 class="fc-sidebar-title">Decks</h2>
        <button class="btn btn-primary btn-sm" id="fcNewDeck">+ New Deck</button>
      </div>
      <ul class="fc-deck-list" id="fcDeckList" role="list"></ul>
    </aside>
    <main class="fc-main" id="fcMain"></main>`;

  wrap.querySelector('#fcNewDeck').addEventListener('click', () => _promptNewDeck(wrap, bus));
  return wrap;
}

// ─── sidebar ────────────────────────────────────────────────────────────────

function _renderDeckList(rootEl, bus, activeDeckId = null) {
  const list = rootEl.querySelector('#fcDeckList');
  if (!list) return;
  list.innerHTML = '';

  const decks = getDecks();
  if (decks.length === 0) {
    list.innerHTML = '<li class="fc-deck-empty">No decks yet</li>';
    return;
  }

  decks.forEach((deck) => {
    const due = getDueCards(deck.id).length;
    const li = document.createElement('li');
    li.className = 'fc-deck-item' + (deck.id === activeDeckId ? ' is-active' : '');
    li.setAttribute('role', 'listitem');
    li.innerHTML = `
      <button class="fc-deck-btn" data-id="${deck.id}">
        <span class="fc-deck-name">${_esc(deck.title)}</span>
        ${due > 0 ? `<span class="fc-badge">${due}</span>` : ''}
      </button>`;
    li.querySelector('.fc-deck-btn').addEventListener('click', () => {
      _setActiveDeck(rootEl, bus, deck.id);
    });
    list.appendChild(li);
  });
}

function _setActiveDeck(rootEl, bus, deckId) {
  _renderDeckList(rootEl, bus, deckId);
  _showDeckOverview(rootEl, bus, deckId);
}

// ─── new deck dialog ─────────────────────────────────────────────────────────

function _promptNewDeck(rootEl, bus) {
  const title = window.prompt('Deck name:')?.trim();
  if (!title) return;

  const deck = {
    ...DeckSchema,
    id: _uid(),
    title,
    created: Date.now(),
    cardCount: 0,
  };
  writeDeck(deck);
  _renderDeckList(rootEl, bus, deck.id);
  _showDeckOverview(rootEl, bus, deck.id);
}

// ─── overview ────────────────────────────────────────────────────────────────

function _showEmptyOrOverview(rootEl, bus, deckId) {
  const main = rootEl.querySelector('#fcMain');
  if (!main) return;

  const decks = getDecks();
  if (decks.length === 0) {
    main.innerHTML = `
      <div class="fc-empty-state">
        <div class="fc-empty-icon">🗂️</div>
        <h3>No decks yet</h3>
        <p>Create a deck using the <strong>+ New Deck</strong> button, or generate cards from a course.</p>
      </div>`;
    return;
  }

  // show first deck if nothing selected
  _showDeckOverview(rootEl, bus, deckId ?? decks[0].id);
}

function _showDeckOverview(rootEl, bus, deckId) {
  const main = rootEl.querySelector('#fcMain');
  if (!main) return;

  const deck = getDeck(deckId);
  if (!deck) return;

  const cards = getCards(deckId);
  const due = getDueCards(deckId).length;

  main.innerHTML = '';
  main.appendChild(_buildOverviewPanel(deck, cards, due, rootEl, bus));
}

function _buildOverviewPanel(deck, cards, due, rootEl, bus) {
  const panel = document.createElement('div');
  panel.className = 'fc-overview';

  panel.innerHTML = `
    <div class="fc-overview-header">
      <div>
        <h2 class="fc-overview-title">${_esc(deck.title)}</h2>
        <p class="fc-overview-meta">
          ${cards.length} card${cards.length !== 1 ? 's' : ''}
          · <strong>${due}</strong> due
        </p>
      </div>
      <div class="fc-overview-actions">
        ${deck.courseId ? `<button class="btn btn-secondary btn-sm" id="fcGenerate">Generate Cards</button>` : ''}
        <button class="btn btn-secondary btn-sm" id="fcAddCard">+ Add Card</button>
        <button class="btn btn-primary btn-sm" id="fcStudy" ${due === 0 ? 'disabled title="No cards due"' : ''}>
          Study Now ${due > 0 ? `(${due})` : ''}
        </button>
        <button class="btn btn-ghost btn-sm fc-danger" id="fcDeleteDeck" title="Delete deck">🗑</button>
      </div>
    </div>

    <div id="fcCardTableWrap">
      ${_buildCardTable(cards)}
    </div>`;

  // wiring
  panel.querySelector('#fcStudy')?.addEventListener('click', () => {
    _startStudySession(rootEl, bus, deck.id);
  });

  panel.querySelector('#fcAddCard')?.addEventListener('click', () => {
    _promptAddCard(rootEl, bus, deck.id);
  });

  panel.querySelector('#fcGenerate')?.addEventListener('click', () => {
    openGenerateCardsModal({ deckId: deck.id, courseId: deck.courseId, bus });
  });

  panel.querySelector('#fcDeleteDeck')?.addEventListener('click', () => {
    if (!window.confirm(`Delete deck "${deck.title}" and all its cards?`)) return;
    deleteDeck(deck.id);
    _renderDeckList(rootEl, bus, null);
    _showEmptyOrOverview(rootEl, bus, null);
  });

  // per-card delete buttons
  panel.querySelectorAll('[data-delete-card]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cardId = btn.dataset.deleteCard;
      if (!window.confirm('Delete this card?')) return;
      deleteCard(cardId, deck.id);
      _showDeckOverview(rootEl, bus, deck.id);
      _renderDeckList(rootEl, bus, deck.id);
    });
  });

  return panel;
}

function _buildCardTable(cards) {
  if (cards.length === 0) {
    return `<p class="fc-no-cards">No cards yet — add one above.</p>`;
  }

  const rows = cards
    .map((c) => {
      const nextStr =
        c.nextReview === 0 ? 'New' : new Date(c.nextReview).toLocaleDateString();
      const frontTrunc = c.front.length > 60 ? c.front.slice(0, 60) + '…' : c.front;
      return `
        <tr>
          <td class="fc-td-front">${_esc(frontTrunc)}</td>
          <td class="fc-td-review">${nextStr}</td>
          <td class="fc-td-reps">${c.repetitions}</td>
          <td class="fc-td-del">
            <button class="btn-icon fc-danger" data-delete-card="${c.id}" title="Delete card">✕</button>
          </td>
        </tr>`;
    })
    .join('');

  return `
    <table class="fc-card-table">
      <thead>
        <tr>
          <th>Front</th>
          <th>Next review</th>
          <th>Reps</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ─── add card dialog ─────────────────────────────────────────────────────────

function _promptAddCard(rootEl, bus, deckId) {
  const front = window.prompt('Front (question / prompt):')?.trim();
  if (!front) return;
  const back = window.prompt('Back (answer):')?.trim();
  if (!back) return;

  const card = {
    ...FlashcardSchema,
    id: _uid(),
    deckId,
    front,
    back,
    created: Date.now(),
    nextReview: 0,
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
  };
  writeCard(card);
  _showDeckOverview(rootEl, bus, deckId);
  _renderDeckList(rootEl, bus, deckId);
  showToast('Card added ✓');
}

// ─── study session ───────────────────────────────────────────────────────────

function _startStudySession(rootEl, bus, deckId) {
  const main = rootEl.querySelector('#fcMain');
  if (!main) return;

  // snapshot due cards at session start; failed cards get re-queued in-session
  const sessionQueue = [...getDueCards(deckId)];
  if (sessionQueue.length === 0) {
    showToast('No cards due right now!');
    return;
  }

  let index = 0;
  let isFlipped = false;
  let totalInSession = sessionQueue.length;

  function currentCard() {
    return sessionQueue[index];
  }

  function render() {
    const card = currentCard();
    if (!card) {
      _showSessionComplete(main, rootEl, bus, deckId, totalInSession);
      return;
    }

    isFlipped = false;
    main.innerHTML = '';
    main.appendChild(_buildStudyView(card, index, sessionQueue.length, flip, grade, endSession));
  }

  function flip() {
    if (isFlipped) return;
    isFlipped = true;
    const flipCard = main.querySelector('.fc-flip-card');
    flipCard?.classList.add('is-flipped');
    main.querySelector('.fc-grade-buttons')?.classList.remove('hidden');
    main.querySelector('.fc-flip-hint')?.classList.add('hidden');
  }

  function grade(g) {
    const card = currentCard();
    const updated = reviewCard(card, g);
    writeCard(updated);

    if (isPassing(g)) {
      bus.emit('xp:earn', { amount: 10 });
    } else {
      // fail: push to end of queue for re-review this session
      sessionQueue.push({ ...updated, nextReview: 0 });
    }

    index += 1;
    render();
  }

  function endSession() {
    _renderDeckList(rootEl, bus, deckId);
    _showDeckOverview(rootEl, bus, deckId);
  }

  // keyboard handler
  function onKey(e) {
    if (e.code === 'Space') { e.preventDefault(); flip(); return; }
    if (!isFlipped) return;
    if (e.key === '1') grade(0);
    else if (e.key === '2') grade(2);
    else if (e.key === '3') grade(3);
    else if (e.key === '4') grade(5);
  }
  document.addEventListener('keydown', onKey);

  // clean up listener when session ends
  const orig = endSession;
  function endSessionClean() {
    document.removeEventListener('keydown', onKey);
    orig();
  }

  // re-bind so inner grade() / endSession ref points to clean version
  // We do this by patching — simpler than closures over mutable refs
  main._endStudy = () => { document.removeEventListener('keydown', onKey); };

  render();
}

function _buildStudyView(card, index, total, flipFn, gradeFn, endFn) {
  const remaining = total - index;
  const pct = Math.round((index / total) * 100);

  const view = document.createElement('div');
  view.className = 'fc-study-view';

  view.innerHTML = `
    <div class="fc-study-topbar">
      <button class="btn btn-ghost btn-sm" id="fcEndSession">← End session</button>
      <span class="fc-study-progress-label">${remaining} remaining</span>
    </div>

    <div class="fc-progress-bar-wrap" role="progressbar"
         aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
      <div class="fc-progress-bar" style="width: ${pct}%"></div>
    </div>

    <div class="fc-flip-card-wrap">
      <div class="fc-flip-card" id="fcFlipCard" tabindex="0" role="button"
           aria-label="Click or press Space to reveal answer">
        <div class="fc-flip-front">
          <p class="fc-card-text">${_esc(card.front)}</p>
        </div>
        <div class="fc-flip-back">
          <p class="fc-card-text">${_esc(card.back)}</p>
        </div>
      </div>
      <p class="fc-flip-hint">Click card or press <kbd>Space</kbd> to reveal</p>
    </div>

    <div class="fc-grade-buttons hidden">
      <p class="fc-grade-label">How did you do? <span class="fc-grade-hint">(keys 1–4)</span></p>
      <div class="fc-grade-row">
        <button class="btn fc-grade-btn fc-grade-again" data-grade="0">Again</button>
        <button class="btn fc-grade-btn fc-grade-hard"  data-grade="2">Hard</button>
        <button class="btn fc-grade-btn fc-grade-good"  data-grade="3">Good</button>
        <button class="btn fc-grade-btn fc-grade-easy"  data-grade="5">Easy</button>
      </div>
    </div>`;

  // wiring
  view.querySelector('#fcEndSession').addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('_fcEndStudy'));
    endFn();
  });

  const flipCard = view.querySelector('#fcFlipCard');
  flipCard.addEventListener('click', flipFn);
  flipCard.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); flipFn(); } });

  view.querySelectorAll('.fc-grade-btn').forEach((btn) => {
    btn.addEventListener('click', () => gradeFn(Number(btn.dataset.grade)));
  });

  return view;
}

function _showSessionComplete(main, rootEl, bus, deckId, reviewed) {
  main.innerHTML = `
    <div class="fc-session-complete">
      <div class="fc-complete-icon">🎉</div>
      <h2>Session complete!</h2>
      <p>You reviewed <strong>${reviewed}</strong> card${reviewed !== 1 ? 's' : ''}.</p>
      <button class="btn btn-primary" id="fcBackToOverview">Back to deck</button>
    </div>`;
  main.querySelector('#fcBackToOverview').addEventListener('click', () => {
    _renderDeckList(rootEl, bus, deckId);
    _showDeckOverview(rootEl, bus, deckId);
  });
}

// ─── utils ───────────────────────────────────────────────────────────────────

function _uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function _esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
