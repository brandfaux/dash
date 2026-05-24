/**
 * src/ui/pages/flashcardsPage.js
 *
 * Mounted into #pageFlashcards.
 */

import { bus, showToast } from '../../app.js';
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
import { reviewCard, isPassing } from '../../utils/sm2.js';
import { openGenerateCardsModal } from '../blocks/generateCardsModal.js';
import { FlashcardSchema } from '../../schema/entities.js';

// ─── mount ───────────────────────────────────────────────────────────────────

let currentBus = null;

export function mountFlashcardsPage(el, busInstance) {
  currentBus = busInstance;
  el.innerHTML = '';
  el.appendChild(_buildShell());
  _renderDeckList(el, null);
  _showEmptyOrOverview(el, null);
}

// ─── shell layout ────────────────────────────────────────────────────────────

function _buildShell() {
  const wrap = document.createElement('div');
  wrap.className = 'fc-layout';
  wrap.innerHTML = `
    <aside class="fc-sidebar" id="fcSidebar">
      <div class="fc-sidebar-header">
        <h2 class="fc-sidebar-title">Decks</h2>
        <button class="btn btn--primary btn-sm" id="fcNewDeck">+ New Deck</button>
      </div>
      <ul class="fc-deck-list" id="fcDeckList" role="list"></ul>
    </aside>
    <main class="fc-main" id="fcMain"></main>`;

  wrap.querySelector('#fcNewDeck').addEventListener('click', () => _promptNewDeck(wrap));
  return wrap;
}

// ─── sidebar ────────────────────────────────────────────────────────────────

function _renderDeckList(rootEl, activeDeckId = null) {
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
      _setActiveDeck(rootEl, deck.id);
    });
    list.appendChild(li);
  });
}

function _setActiveDeck(rootEl, deckId) {
  _renderDeckList(rootEl, deckId);
  _showDeckOverview(rootEl, deckId);
}

// ─── new deck dialog ─────────────────────────────────────────────────────────

function _promptNewDeck(rootEl) {
  const title = window.prompt('Deck name:')?.trim();
  if (!title) return;

  const deck = {
    id: _uid(),
    title,
    created: Date.now(),
    cardCount: 0,
    courseId: null,
  };
  writeDeck(deck);
  _renderDeckList(rootEl, deck.id);
  _showDeckOverview(rootEl, deck.id);
}

// ─── overview ────────────────────────────────────────────────────────────────

function _showEmptyOrOverview(rootEl, deckId) {
  const main = rootEl.querySelector('#fcMain');
  if (!main) return;

  const decks = getDecks();
  if (decks.length === 0) {
    main.innerHTML = `
      <div class="fc-empty-state">
        <div class="fc-empty-icon">🗂️</div>
        <h3>No decks yet</h3>
        <p>Create a deck using the <strong>+ New Deck</strong> button.</p>
      </div>`;
    return;
  }

  _showDeckOverview(rootEl, deckId ?? decks[0].id);
}

function _showDeckOverview(rootEl, deckId) {
  const main = rootEl.querySelector('#fcMain');
  if (!main) return;

  const deck = getDeck(deckId);
  if (!deck) return;

  const cards = getCards(deckId);
  const due = getDueCards(deckId).length;

  main.innerHTML = '';
  main.appendChild(_buildOverviewPanel(deck, cards, due, rootEl));
}

function _buildOverviewPanel(deck, cards, due, rootEl) {
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
        <button class="btn btn--secondary btn-sm" id="fcAddCard">+ Add Card</button>
        <button class="btn btn--primary btn-sm" id="fcStudy" ${due === 0 ? 'disabled' : ''}>
          Study Now ${due > 0 ? `(${due})` : ''}
        </button>
        <button class="btn btn--ghost btn-sm fc-danger" id="fcDeleteDeck">🗑 Delete</button>
      </div>
    </div>
    <div id="fcCardTableWrap">
      ${_buildCardTable(cards, deck.id, rootEl)}
    </div>`;

  panel.querySelector('#fcStudy')?.addEventListener('click', () => {
    _startStudySession(rootEl, deck.id);
  });

  panel.querySelector('#fcAddCard')?.addEventListener('click', () => {
    _promptAddCard(rootEl, deck.id);
  });

  panel.querySelector('#fcDeleteDeck')?.addEventListener('click', () => {
    if (!window.confirm(`Delete deck "${deck.title}" and all its cards?`)) return;
    deleteDeck(deck.id);
    _renderDeckList(rootEl, null);
    _showEmptyOrOverview(rootEl, null);
  });

  return panel;
}

function _buildCardTable(cards, deckId, rootEl) {
  if (cards.length === 0) {
    return `<p class="fc-no-cards">No cards yet — add one above.</p>`;
  }

  const rows = cards.map((c) => {
    const nextStr = c.nextReview === 0 ? 'New' : new Date(c.nextReview).toLocaleDateString();
    const frontTrunc = c.front.length > 60 ? c.front.slice(0, 60) + '…' : c.front;
    return `
      <tr>
        <td class="fc-td-front">${_esc(frontTrunc)}</td>
        <td class="fc-td-review">${nextStr}</td>
        <td class="fc-td-reps">${c.repetitions}</td>
        <td class="fc-td-del">
          <button class="btn-icon fc-danger" data-delete-card="${c.id}" data-deck-id="${deckId}">✕</button>
        </td>
      </tr>`;
  }).join('');

  const table = document.createElement('div');
  table.innerHTML = `
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
  
  table.querySelectorAll('[data-delete-card]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cardId = btn.dataset.deleteCard;
      const dId = btn.dataset.deckId;
      if (!window.confirm('Delete this card?')) return;
      deleteCard(cardId, dId);
      _showDeckOverview(rootEl, dId);
      _renderDeckList(rootEl, dId);
    });
  });
  
  return table.innerHTML;
}

// ─── add card dialog ─────────────────────────────────────────────────────────

function _promptAddCard(rootEl, deckId) {
  const front = window.prompt('Front (question / prompt):')?.trim();
  if (!front) return;
  const back = window.prompt('Back (answer):')?.trim();
  if (!back) return;

  const card = {
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
  _showDeckOverview(rootEl, deckId);
  _renderDeckList(rootEl, deckId);
  showToast('Card added ✓');
}

// ─── study session ───────────────────────────────────────────────────────────

function _startStudySession(rootEl, deckId) {
  const main = rootEl.querySelector('#fcMain');
  if (!main) return;

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
      _showSessionComplete(main, rootEl, deckId, totalInSession);
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

    if (isPassing(g) && currentBus) {
      currentBus.emit('xp:earn', { amount: 10 });
    } else {
      sessionQueue.push({ ...updated, nextReview: 0 });
    }

    index += 1;
    render();
  }

  function endSession() {
    _renderDeckList(rootEl, deckId);
    _showDeckOverview(rootEl, deckId);
  }

  function onKey(e) {
    if (e.code === 'Space') { e.preventDefault(); flip(); return; }
    if (!isFlipped) return;
    if (e.key === '1') grade(0);
    else if (e.key === '2') grade(2);
    else if (e.key === '3') grade(3);
    else if (e.key === '4') grade(5);
  }
  
  document.addEventListener('keydown', onKey);
  
  const origEnd = endSession;
  window._fcCleanup = () => document.removeEventListener('keydown', onKey);
  
  render();
}

function _buildStudyView(card, index, total, flipFn, gradeFn, endFn) {
  const remaining = total - index;
  const pct = total > 0 ? Math.round((index / total) * 100) : 0;

  const view = document.createElement('div');
  view.className = 'fc-study-view';

  view.innerHTML = `
    <div class="fc-study-topbar">
      <button class="btn btn--ghost btn-sm" id="fcEndSession">← End session</button>
      <span class="fc-study-progress-label">${remaining} remaining</span>
    </div>
    <div class="fc-progress-bar-wrap">
      <div class="fc-progress-bar" style="width: ${pct}%"></div>
    </div>
    <div class="fc-flip-card-wrap">
      <div class="fc-flip-card" id="fcFlipCard" tabindex="0">
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
        <button class="btn fc-grade-btn fc-grade-hard" data-grade="2">Hard</button>
        <button class="btn fc-grade-btn fc-grade-good" data-grade="3">Good</button>
        <button class="btn fc-grade-btn fc-grade-easy" data-grade="5">Easy</button>
      </div>
    </div>`;

  view.querySelector('#fcEndSession').addEventListener('click', () => {
    if (window._fcCleanup) window._fcCleanup();
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

function _showSessionComplete(main, rootEl, deckId, reviewed) {
  main.innerHTML = `
    <div class="fc-session-complete">
      <div class="fc-complete-icon">🎉</div>
      <h2>Session complete!</h2>
      <p>You reviewed <strong>${reviewed}</strong> card${reviewed !== 1 ? 's' : ''}.</p>
      <button class="btn btn--primary" id="fcBackToOverview">Back to deck</button>
    </div>`;
  main.querySelector('#fcBackToOverview').addEventListener('click', () => {
    if (window._fcCleanup) window._fcCleanup();
    _renderDeckList(rootEl, deckId);
    _showDeckOverview(rootEl, deckId);
  });
}

// ─── utils ───────────────────────────────────────────────────────────────────

function _uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function _esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Listen for navigation
bus.on('navigate', (page) => {
  if (page === 'flashcards') {
    const el = document.getElementById('pageFlashcards');
    if (el) mountFlashcardsPage(el, bus);
  }
});