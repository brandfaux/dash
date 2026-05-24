/**
 * platform.js — Edit this file to rebrand or reconfigure the entire app.
 * No other file needs touching for a white-label deployment.
 */
export const PLATFORM = {
  // Branding
  name: 'Deutsch Lern-Dashboard',
  shortName: 'Deutsch',
  logo: { mark: 'Deutsch', rest: ' Lern-Dashboard' },

  // Target language context (used in UI copy, future AI prompts)
  targetLang: 'de',
  nativeLang: 'en',

  // Gamification (keep minimal)
  xpPerLesson: 50,
  xpPerLevel: 200,       // not shown in UI yet, reserved
  streakEnabled: true,

  // Progress thresholds
  completionThreshold: 0.9,   // 90% watched = complete

  // Storage keys (change if deploying multiple instances on same domain)
  storageKeys: {
    user:     'le_user',
    progress: 'le_progress',
    content:  'le_content',
  },

  // Feature flags (flip to true when ready)
  features: {
    auth:        false,   // Supabase auth
    aiSummaries: false,   // AI-generated lesson summaries
    aiQuizzes:   false,   // AI-generated quizzes
    flashcards:  true,    // Manual flashcard decks
    vocab:       true,    // Vocabulary sets
    import:      true,    // Content import page
    offline:     false,   // PWA / service worker
  },
};
