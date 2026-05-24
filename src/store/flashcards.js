/**
 * src/store/flashcards.js
 *
 * All flashcard & deck persistence. Follows the same pattern as
 * src/store/content.js — one clear adapter boundary through storage.js.
 *
 * Storage keys:
 *   le_decks          → { [deckId]: DeckSchema }
 *   le_cards_<deckId> → { [cardId]: FlashcardSchema }
 */

import { storage } from './storage.js';

// ─── key helpers ────────────────────────────────────────────────────────────

const DECKS_KEY = 'le_decks';
const cardsKey = (deckId) => `le_cards_${deckId}`;

// ─── internal read/write helpers ────────────────────────────────────────────

function readDecks() {
  return storage.get(DECKS_KEY) ?? {};
}

function readCards(deckId) {
  return storage.get(cardsKey(deckId)) ?? {};
}

// ─── Deck CRUD ───────────────────────────────────────────────────────────────

/** @returns {DeckSchema[]} all decks, sorted newest first */
export function getDecks() {
  const map = readDecks();
  return Object.values(map).sort((a, b) => b.created - a.created);
}

/** @returns {DeckSchema|null} */
export function getDeck(id) {
  return readDecks()[id] ?? null;
}

/**
 * Upsert a deck. Caller is responsible for setting all required fields.
 * @param {DeckSchema} deck
 */
export function writeDeck(deck) {
  const map = readDecks();
  map[deck.id] = deck;
  storage.set(DECKS_KEY, map);
}

/**
 * Delete a deck and all its cards.
 * @param {string} id
 */
export function deleteDeck(id) {
  const map = readDecks();
  delete map[id];
  storage.set(DECKS_KEY, map);
  storage.remove(cardsKey(id));
}

// ─── Card CRUD ───────────────────────────────────────────────────────────────

/**
 * @param {string} deckId
 * @returns {FlashcardSchema[]} all cards in deck, sorted by creation
 */
export function getCards(deckId) {
  const map = readCards(deckId);
  return Object.values(map).sort((a, b) => a.created - b.created);
}

/** @returns {FlashcardSchema|null} */
export function getCard(id, deckId) {
  return readCards(deckId)[id] ?? null;
}

/**
 * Upsert a card. Also keeps deck.cardCount in sync.
 * @param {FlashcardSchema} card
 */
export function writeCard(card) {
  const map = readCards(card.deckId);
  const isNew = !map[card.id];
  map[card.id] = card;
  storage.set(cardsKey(card.deckId), map);

  // keep cardCount denormalised
  if (isNew) _bumpCardCount(card.deckId, 1);
}

/**
 * Delete a single card.
 * @param {string} id
 * @param {string} deckId
 */
export function deleteCard(id, deckId) {
  const map = readCards(deckId);
  if (!map[id]) return;
  delete map[id];
  storage.set(cardsKey(deckId), map);
  _bumpCardCount(deckId, -1);
}

// ─── Due cards ───────────────────────────────────────────────────────────────

/**
 * Returns cards whose nextReview timestamp is <= now.
 * New cards (nextReview === 0) are always due.
 * @param {string} deckId
 * @returns {FlashcardSchema[]}
 */
export function getDueCards(deckId) {
  const now = Date.now();
  return getCards(deckId).filter((c) => c.nextReview <= now);
}

// ─── internal helpers ────────────────────────────────────────────────────────

function _bumpCardCount(deckId, delta) {
  const deck = getDeck(deckId);
  if (!deck) return;
  deck.cardCount = Math.max(0, (deck.cardCount ?? 0) + delta);
  writeDeck(deck);
}
