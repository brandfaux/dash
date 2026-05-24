/**
 * src/store/flashcards.js
 *
 * All flashcard & deck persistence.
 */

import { storage } from './storage.js';
import { FlashcardDeckSchema, FlashcardSchema } from '../schema/entities.js';

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

export function getDecks() {
  const map = readDecks();
  return Object.values(map).sort((a, b) => b.created - a.created);
}

export function getDeck(id) {
  return readDecks()[id] ?? null;
}

export function writeDeck(deck) {
  const map = readDecks();
  map[deck.id] = deck;
  storage.set(DECKS_KEY, map);
}

export function deleteDeck(id) {
  const map = readDecks();
  delete map[id];
  storage.set(DECKS_KEY, map);
  storage.remove(cardsKey(id));
}

// ─── Card CRUD ───────────────────────────────────────────────────────────────

export function getCards(deckId) {
  const map = readCards(deckId);
  return Object.values(map).sort((a, b) => a.created - b.created);
}

export function getCard(id, deckId) {
  return readCards(deckId)[id] ?? null;
}

export function writeCard(card) {
  const map = readCards(card.deckId);
  const isNew = !map[card.id];
  map[card.id] = card;
  storage.set(cardsKey(card.deckId), map);

  if (isNew) _bumpCardCount(card.deckId, 1);
}

export function deleteCard(id, deckId) {
  const map = readCards(deckId);
  if (!map[id]) return;
  delete map[id];
  storage.set(cardsKey(deckId), map);
  _bumpCardCount(deckId, -1);
}

// ─── Due cards ───────────────────────────────────────────────────────────────

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