/**
 * store/user.js — Local user identity + stats.
 * Shape is Supabase-compatible: swap getUser() to return session.user later.
 */

import { PLATFORM } from '../config/platform.js';
import { UserSchema, UserStatsSchema } from '../schema/entities.js';
import { storage } from './storage.js';

const KEYS = PLATFORM.storageKeys;

// ─── User Identity ────────────────────────────────────────────────────────────

export function getUser() {
  let user = storage.get(KEYS.user);
  if (!user) {
    user = UserSchema.defaults();
    storage.set(KEYS.user, user);
  }
  return user;
}

export function updateUser(patch) {
  const user = getUser();
  const updated = { ...user, ...patch };
  storage.set(KEYS.user, updated);
  return updated;
}

// ─── User Stats ───────────────────────────────────────────────────────────────

function statsKey() {
  return `${KEYS.user}_stats_${getUser().id}`;
}

export function getStats() {
  let stats = storage.get(statsKey());
  if (!stats) {
    stats = { ...UserStatsSchema.defaults(), userId: getUser().id };
    storage.set(statsKey(), stats);
  }
  return stats;
}

function saveStats(stats) {
  storage.set(statsKey(), stats);
  return stats;
}

// ─── XP ──────────────────────────────────────────────────────────────────────

export function addXP(amount) {
  const stats = getStats();
  stats.xp += amount;
  return saveStats(stats);
}

// ─── Streak ──────────────────────────────────────────────────────────────────

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Call once per session (on init) and after each lesson completion.
 * Returns updated stats.
 */
export function tickStreak() {
  const stats = getStats();
  const today = todayISO();

  if (stats.lastActive === today) return stats; // already counted

  if (stats.lastActive === yesterday()) {
    stats.streak += 1;
  } else if (stats.lastActive && stats.lastActive !== today) {
    stats.streak = 1; // reset — gap in activity
  } else {
    stats.streak = Math.max(1, stats.streak);
  }

  stats.lastActive = today;
  if (!stats.activityLog.includes(today)) {
    stats.activityLog.push(today);
  }

  return saveStats(stats);
}

/**
 * Rollover: called on init. Resets todayVideos if the day changed.
 * Does NOT modify streak (tickStreak handles that).
 */
export function rolloverDay() {
  // Currently managed in progress store — this is a hook for future session logic
}

// ─── Achievements ─────────────────────────────────────────────────────────────

export function grantAchievement(id) {
  const stats = getStats();
  if (stats.achievements.includes(id)) return stats;
  stats.achievements = [...stats.achievements, id];
  return saveStats(stats);
}

export function hasAchievement(id) {
  return getStats().achievements.includes(id);
}
