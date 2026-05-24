/**
 * schema/entities.js
 * Runtime-validated entity shapes. No build step — plain JS validators.
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
    videoId:     '',
    url:         '',
    thumbnail:   '',
    duration:    0,
    position:    0,
    description: '',
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
    position:  0,
    topics:    '',
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
    level:       '',
    label:       '',
    accent:      '#e94560',
    description: '',
    moduleIds:   [],
    source:      'manual',
    sourceUrl:   '',
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
    lastActive:   null,
    activityLog:  [],
    achievements: [],
    createdAt:    now(),
  }),
  (r) => {
    if (!r.userId) return 'userStats.userId is required';
  }
);

// ─── User ─────────────────────────────────────────────────────────────────────

export const UserSchema = makeSchema(
  () => ({
    id:        uuid(),
    name:      'Learner',
    email:     null,
    avatarUrl: null,
    provider:  'local',
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
    words:    [],
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
    courseId:  null,
    title:     '',
    created:   Date.now(),
    cardCount: 0,
  }),
  (r) => {
    if (!r.title) return 'flashcardDeck.title is required';
    if (r.cardCount < 0) return 'flashcardDeck.cardCount must be >= 0';
  }
);

// Export alias for backward compatibility
export const DeckSchema = FlashcardDeckSchema;

// ─── Flashcard (SM-2 fields) ─────────────────────────────────────────────────

export const FlashcardSchema = makeSchema(
  () => ({
    id:           uuid(),
    deckId:       '',
    front:        '',
    back:         '',
    created:      Date.now(),
    nextReview:   0,
    interval:     0,
    easeFactor:   2.5,
    repetitions:  0,
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