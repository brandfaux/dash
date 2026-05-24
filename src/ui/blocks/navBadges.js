/**
 * ui/blocks/navBadges.js — XP & streak badge display
 */

import { getStats } from '../../store/user.js';

export function renderNavBadges() {
  const stats = getStats();
  
  const streakEl = document.getElementById('streakBadge');
  const xpEl = document.getElementById('xpBadge');
  
  if (streakEl) {
    streakEl.textContent = `🔥 ${stats.streak}`;
  }
  
  if (xpEl) {
    xpEl.textContent = `⚡ ${stats.xp} XP`;
  }
}