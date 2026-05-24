/**
 * store/content.js — Courses, Modules, Lessons.
 * Everything is dynamic — no hardcoded course arrays anywhere else.
 *
 * Data shape (all stored under one key for simplicity at this scale):
 * {
 *   courses:  { [id]: Course },
 *   modules:  { [id]: Module },
 *   lessons:  { [id]: Lesson },
 *   vocabSets: { [id]: VocabSet },
 *   decks:    { [id]: FlashcardDeck },
 * }
 */

import { PLATFORM } from '../config/platform.js';
import {
  CourseSchema, ModuleSchema, LessonSchema,
  VocabSetSchema, FlashcardDeckSchema,
} from '../schema/entities.js';
import { storage } from './storage.js';

const KEY = PLATFORM.storageKeys.content;

// ─── Internal ─────────────────────────────────────────────────────────────────

function load() {
  return storage.get(KEY) ?? { courses: {}, modules: {}, lessons: {}, vocabSets: {}, decks: {} };
}

function save(db) {
  storage.set(KEY, db);
}

// ─── Courses ─────────────────────────────────────────────────────────────────

export function getCourses() {
  return Object.values(load().courses).sort((a, b) =>
    new Date(a.createdAt) - new Date(b.createdAt)
  );
}

export function getCourse(id) {
  return load().courses[id] ?? null;
}

export function saveCourse(raw) {
  const course = CourseSchema.parse(raw);
  const db = load();
  db.courses[course.id] = course;
  save(db);
  return course;
}

export function deleteCourse(id) {
  const db = load();
  const course = db.courses[id];
  if (!course) return;
  // Cascade: remove modules + lessons
  course.moduleIds.forEach(mid => {
    const mod = db.modules[mid];
    if (mod) mod.lessonIds.forEach(lid => delete db.lessons[lid]);
    delete db.modules[mid];
  });
  delete db.courses[id];
  save(db);
}

// ─── Modules ──────────────────────────────────────────────────────────────────

export function getModules(courseId) {
  return Object.values(load().modules)
    .filter(m => m.courseId === courseId)
    .sort((a, b) => a.position - b.position);
}

export function saveModule(raw) {
  const mod = ModuleSchema.parse(raw);
  const db = load();
  db.modules[mod.id] = mod;
  // Register in course if not already
  const course = db.courses[mod.courseId];
  if (course && !course.moduleIds.includes(mod.id)) {
    course.moduleIds.push(mod.id);
  }
  save(db);
  return mod;
}

// ─── Lessons ─────────────────────────────────────────────────────────────────

export function getLessons(moduleId) {
  return Object.values(load().lessons)
    .filter(l => l.moduleId === moduleId)
    .sort((a, b) => a.position - b.position);
}

export function getLessonsByIds(ids) {
  const db = load();
  return ids.map(id => db.lessons[id]).filter(Boolean);
}

export function getAllLessonsForCourse(courseId) {
  const db = load();
  const course = db.courses[courseId];
  if (!course) return [];
  return course.moduleIds.flatMap(mid => {
    const mod = db.modules[mid];
    return mod ? mod.lessonIds.map(lid => db.lessons[lid]).filter(Boolean) : [];
  });
}

export function getLesson(id) {
  return load().lessons[id] ?? null;
}

export function saveLesson(raw) {
  const lesson = LessonSchema.parse(raw);
  const db = load();
  db.lessons[lesson.id] = lesson;
  // Register in module if not already
  const mod = db.modules[lesson.moduleId];
  if (mod && !mod.lessonIds.includes(lesson.id)) {
    mod.lessonIds.push(lesson.id);
  }
  save(db);
  return lesson;
}

// ─── Vocab Sets ───────────────────────────────────────────────────────────────

export function getVocabSets(courseId) {
  return Object.values(load().vocabSets)
    .filter(v => v.courseId === courseId);
}

export function saveVocabSet(raw) {
  const set = VocabSetSchema.parse(raw);
  const db = load();
  db.vocabSets[set.id] = set;
  save(db);
  return set;
}

// ─── Flashcard Decks ──────────────────────────────────────────────────────────

export function getDecks(courseId) {
  return Object.values(load().decks)
    .filter(d => d.courseId === courseId);
}

export function saveDeck(raw) {
  const deck = FlashcardDeckSchema.parse(raw);
  const db = load();
  db.decks[deck.id] = deck;
  save(db);
  return deck;
}

// ─── Bulk Write (used by ingestion pipeline) ─────────────────────────────────

/**
 * Atomically write a full course bundle produced by the ingestion pipeline.
 * bundle: { course, modules: [{ mod, lessons: [...] }] }
 */
export function writeCourseBundle(bundle) {
  const db = load();

  const course = CourseSchema.parse(bundle.course);
  course.moduleIds = [];
  db.courses[course.id] = course;

  bundle.modules.forEach(({ mod: rawMod, lessons: rawLessons }) => {
    const mod = ModuleSchema.parse({ ...rawMod, courseId: course.id });
    mod.lessonIds = [];
    db.modules[mod.id] = mod;
    course.moduleIds.push(mod.id);

    rawLessons.forEach((rawLesson, i) => {
      const lesson = LessonSchema.parse({
        ...rawLesson,
        courseId: course.id,
        moduleId: mod.id,
        position: i,
      });
      db.lessons[lesson.id] = lesson;
      mod.lessonIds.push(lesson.id);
    });
  });

  save(db);
  return course;
}
