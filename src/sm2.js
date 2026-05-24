/**
 * src/utils/sm2.js
 *
 * Pure SM-2 spaced-repetition algorithm.
 * No side effects — returns updated card fields only.
 * Store write is the caller's responsibility.
 *
 * grade 0-5:
 *   0 = complete blackout
 *   1 = wrong, remembered on seeing answer
 *   2 = hard — correct with serious difficulty
 *   3 = good — correct after hesitation
 *   4 = easy — correct with minor hesitation
 *   5 = perfect — immediate correct response
 *
 * Grades 0-1 → fail (reset repetitions, short re-review)
 * Grades 2-5 → pass (advance interval, adjust EF)
 */

const MIN_EASE = 1.3;
const INITIAL_EASE = 2.5;

/**
 * @param {object} card  — FlashcardSchema fields
 * @param {number} grade — 0–5
 * @returns {object}     — updated card fields (spread into original)
 */
export function reviewCard(card, grade) {
  let { interval, easeFactor, repetitions } = card;

  if (grade < 2) {
    // Fail: reset to beginning, keep EF, re-show soon
    repetitions = 0;
    interval = 0; // show again in this session (getDueCards handles it)
  } else {
    // Pass: advance interval per SM-2
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }

    repetitions += 1;

    // Update EF: EF' = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02))
    easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
    if (easeFactor < MIN_EASE) easeFactor = MIN_EASE;
  }

  const nextReview =
    interval === 0
      ? Date.now() // due immediately (failed card — re-queue within session)
      : Date.now() + interval * 24 * 60 * 60 * 1000;

  return {
    ...card,
    interval,
    easeFactor: Math.round(easeFactor * 1000) / 1000, // 3 dp
    repetitions,
    nextReview,
  };
}

/**
 * Convenience: is this grade a passing grade?
 * Used by UI to decide whether to emit xp:earn.
 */
export function isPassing(grade) {
  return grade >= 2;
}
