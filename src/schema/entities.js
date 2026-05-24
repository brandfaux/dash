/**
 * schema/entities.js
 * Runtime-validated entity shapes. No build step — plain JS validators.
 * When Zod is available (build pipeline), swap these for z.object() equivalents.
 *
 * Each schema exposes:
 *   parse(raw)   → validated object (throws on invalid)
 *   safeParse(raw) → { ok, data, error }
 *   defaults()   → fresh default instance
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

function uuid() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function now() {
  return new Date().toISOString();
}

function makeSchema(defaults, validate) {
  return {
    defaults: () => ({ ...defaults() }),
    parse(raw) {
      const result = { ...defaults(), ...raw };
      const error = validate(result);
      if (error) throw new Error(`Schema error: ${error}`);
      return result;
    },
    safeParse(raw) {
      try {
        return { ok: true, data: this.parse(raw) };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
  };
}

// ─── Lesson ─────────────────────────────────────────────────────────────────

export const LessonSchema = makeSchema(
  () => ({
    id:          uuid(),
    courseId:    '',
    moduleId:    '',
    title:       '',
    videoId:     '',           // YouTube video ID
    url:         '',           // original URL
    thumbnail:   '',           // resolved thumbnail URL
    duration:    0,            // seconds, 0 = unknown
    position:    0,            // order within module
    description: '',
    // AI-reserved (never populated yet)
    summary:       null,
    aiQuiz:        null,
    speakingPrompts: [],
    createdAt:   now(),
  }),
  (r) => {
    if (!r.title) return 'lesson.title is required';
    if (!r.videoId && !r.url) return 'lesson needs videoId or url';
  }
);

// ─── Module ─────────────────────────────────────────────────────────────────

export const ModuleSchema = makeSchema(
  () => ({
    id:        uuid(),
    courseId:  '',
    title:     '',
    position:  0,      // week/chapter number
    topics:    '',     // short descriptor
    lessonIds: [],
    createdAt: now(),
  }),
  (r) => {
    if (!r.title) return 'module.title is required';
  }
);

// ─── Course ──────────────────────────────────────────────────────────────────

export const CourseSchema = makeSchema(
  () => ({
    id:          uuid(),
    title:       '',
    level:       '',      // A1, A2, B1, B2, C1, C2, custom
    label:       '',      // 'Beginner', 'Intermediate', etc.
    accent:      '#e94560',
    description: '',
    moduleIds:   [],
    source:      'manual',  // 'manual' | 'youtube_playlist' | 'json' | 'csv'
    sourceUrl:   '',
    // AI-reserved
    aiEnabled:   false,
    createdAt:   now(),
  }),
  (r) => {
    if (!r.title) return 'course.title is required';
  }
);

// ─── Progress (per lesson, per user) ─────────────────────────────────────────

export const ProgressSchema = makeSchema(
  () => ({
    lessonId:  '',
    userId:    '',
    pct:       0,
    completed: false,
    resumeAt:  0,
    lastSeen:  null,
  }),
  (r) => {
    if (!r.lessonId) return 'progress.lessonId is required';
    if (r.pct < 0 || r.pct > 100) return 'progress.pct must be 0–100';
  }
);

// ─── UserStats ───────────────────────────────────────────────────────────────

export const UserStatsSchema = makeSchema(
  () => ({
    userId:       '',
    xp:           0,
    streak:       0,
    lastActive:   null,    // ISO date string YYYY-MM-DD
    activityLog:  [],      // ISO date strings
    achievements: [],      // achievement IDs
    createdAt:    now(),
  }),
  (r) => {
    if (!r.userId) return 'userStats.userId is required';
  }
);

// ─── User (local identity, Supabase-compatible shape) ───────────────────────

export const UserSchema = makeSchema(
  () => ({
    id:        uuid(),
    name:      'Learner',
    email:     null,      // null until auth is enabled
    avatarUrl: null,
    provider:  'local',   // 'local' | 'supabase'
    createdAt: now(),
  }),
  () => null
);

// ─── VocabularySet ───────────────────────────────────────────────────────────

export const VocabSetSchema = makeSchema(
  () => ({
    id:       uuid(),
    courseId: '',
    lessonId: null,
    title:    '',
    words:    [],   // [{ term, definition, example? }]
    source:   'manual',
    createdAt: now(),
  }),
  (r) => {
    if (!r.title) return 'vocabSet.title is required';
  }
);

// ─── FlashcardDeck (Phase 7) ─────────────────────────────────────────────────

export const FlashcardDeckSchema = makeSchema(
  () => ({
    id:        uuid(),
    courseId:  null,    // string | null — linked course, if any
    title:     '',
    created:   Date.now(),   // Unix timestamp (ms)
    cardCount: 0,            // denormalised; updated on write/delete
  }),
  (r) => {
    if (!r.title) return 'flashcardDeck.title is required';
    if (r.cardCount < 0) return 'flashcardDeck.cardCount must be >= 0';
  }
);

// ─── Flashcard (SM-2 fields) ─────────────────────────────────────────────────

export const FlashcardSchema = makeSchema(
  () => ({
    id:           uuid(),
    deckId:       '',            // parent deck id
    front:        '',            // question / prompt text
    back:         '',            // answer text
    created:      Date.now(),    // Unix timestamp (ms)
    nextReview:   0,             // Unix timestamp (ms); 0 = new card / due immediately
    interval:     0,             // days until next review (SM-2 I_n)
    easeFactor:   2.5,           // SM-2 EF; starts at 2.5, floor 1.3
    repetitions:  0,             // consecutive correct reviews (SM-2 n)
  }),
  (r) => {
    if (!r.deckId) return 'flashcard.deckId is required';
    if (!r.front) return 'flashcard.front is required';
    if (!r.back) return 'flashcard.back is required';
    if (r.interval < 0) return 'flashcard.interval must be >= 0';
    if (r.easeFactor < 1.3) return 'flashcard.easeFactor must be >= 1.3';
    if (r.repetitions < 0) return 'flashcard.repetitions must be >= 0';
  }
);