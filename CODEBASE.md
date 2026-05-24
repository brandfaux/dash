# LearnEngine Codebase Guide

This document provides a deep architectural overview of LearnEngine's implementation, patterns, and design decisions.

---

## 🏛️ Core Architecture

### The Event Bus Pattern

LearnEngine uses a pub/sub event bus to decouple modules. All cross-module communication flows through `src/app.js:bus`.

**Why?**
- Pages don't import each other (no circular dependencies)
- UI updates don't tightly couple to data changes
- Easy to swap implementations (e.g., localStorage → Supabase)

**Example:**
```javascript
// page1.js — Emit when something important happens
import { bus } from '../app.js';
bus.emit('lesson:complete', { lessonId, xp: 50 });

// page2.js — React to it
import { bus } from '../app.js';
bus.on('lesson:complete', ({ xp }) => {
  updateXPDisplay(xp);
});
```

### The Router

The router lives in `app.js:navigate()`. It switches pages by toggling CSS classes:

```javascript
export function navigate(page) {
  document.querySelectorAll('.page').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page)
  );
  bus.emit('navigate', page);  // Notify pages they're active
}
```

Pages listen for the `navigate` event and render their content once:

```javascript
// pages/courses.js
bus.on('navigate', (page) => {
  if (page === 'courses') renderCoursesPage();
});
```

### The Store Pattern

**One adapter rule:** Only `src/store/storage.js` touches `localStorage`.

Each store module (content.js, progress.js, etc.) exports read/write functions:

```javascript
export function getCourses() {
  return storage.get('le_content')?.courses ?? [];
}

export function writeCourseBundle(bundle) {
  const data = storage.get('le_content') ?? {};
  data.courses = [...data.courses, bundle.course];
  storage.set('le_content', data);
}
```

**Why?**
- To migrate from localStorage → Supabase, only edit `storage.js`
- All stores follow same pattern (predictable, testable)
- No DOM queries in stores (pure data)

---

## 📂 Module Reference

### `src/app.js` — Runtime Kernel

**Responsibilities:**
- Event bus definition
- Router (page navigation)
- Toast notifications
- Global keyboard handlers (Escape key)
- Lesson completion callback

**Key exports:**
```javascript
export { bus }              // event emitter/listener
export { navigate }         // switch pages
export { showToast }        // show notification
export { onLessonComplete } // handle lesson finish
export { init }             // boot the app
```

**Bus events emitted here:**
- `navigate` → `(page)`
- `statsChanged` → `()`

### `src/main.js` — Entry Point

**Flow:**
1. Import all pages & blocks (registers their event listeners)
2. Apply branding (logo, title)
3. Hide disabled features (based on `PLATFORM.features`)
4. Setup badge listeners
5. Call `init()` to boot

### `src/config/platform.js` — White-Label Config

Edit this ONE file to rebrand the entire app.

**Key properties:**
```javascript
{
  name: 'App Title',
  logo: { mark: 'L', rest: 'earn' },
  xpPerLesson: 50,
  completionThreshold: 0.9,    // 90% watched = complete
  features: {
    flashcards: true,          // Show/hide in nav
    offline: false,            // PWA (future)
    auth: false,               // Supabase (future)
  },
}
```

### `src/schema/entities.js` — Data Types

**No runtime checks, pure documentation** via JSDoc.

Example:
```javascript
/**
 * @typedef {object} FlashcardSchema
 * @property {string} id - UUID
 * @property {string} deckId - Parent deck
 * @property {string} front - Question
 * @property {string} back - Answer
 * @property {number} nextReview - Unix timestamp
 * @property {number} interval - Days until next review (SM-2)
 * @property {number} easeFactor - SM-2 difficulty factor (default 2.5)
 * @property {number} repetitions - Times reviewed (SM-2)
 */
```

No validation happens here—validation occurs in stores or importers.

### `src/store/` — Data Layer

#### `storage.js`
**The only file that touches localStorage.** Simple adapter:

```javascript
export const storage = {
  get(key) {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key) {
    localStorage.removeItem(key);
  },
};
```

To migrate to Supabase later, replace this file's implementation—nothing else changes.

#### `content.js`
**Course & lesson management:**

```javascript
export function getCourses()              // → CourseSchema[]
export function getAllLessonsForCourse()  // → LessonSchema[]
export function getLesson()               // → LessonSchema
export function writeCourseBundle()       // Save imported course
export function deleteLesson()            // Remove a lesson
```

All backed by storage adapter.

#### `progress.js`
**Video watch progress & resume:**

```javascript
export function getProgress(lessonId)     // → ProgressSchema
export function setProgress()             // Update timestamp
export function markComplete()            // 90% → complete
export function getNextLesson()           // For auto-advance
```

#### `user.js`
**User stats:**

```javascript
export function getUser()                 // → UserSchema (init if missing)
export function addXP(amount)             // Increment XP
export function tickStreak()              // Increment/reset streak
export function evaluateAchievements()    // Check badge criteria
```

#### `flashcards.js`
**Decks & cards CRUD:**

```javascript
export function getDecks()                // All decks
export function getDeck(id)               // One deck
export function writeDeck(deck)           // Create/update
export function deleteDeck(id)            // Delete deck + cards
export function getCards(deckId)          // All cards in deck
export function getDueCards(deckId)       // Cards due for review (nextReview <= now)
export function writeCard(card)           // Create/update card
export function deleteCard(id)            // Remove card
```

#### `analytics-store.js`
**Activity tracking:**

```javascript
export function getActivityHeatmap()      // 28-day grid
export function getWeeklyXP()             // Last 7 days
export function recordStudySession()      // Log activity
```

### `src/ingestion/` — Import Pipeline

#### `pipeline.js`
**Orchestrates all import flows:**

```javascript
export async function importYouTubeVideo()    // Single URL
export async function importYouTubePlaylist()  // Playlist URL
export async function importJSON()             // JSON file/text
export async function importCSV()              // CSV file
```

Each returns: `{ ok: true, bundle } | { ok: false, error }`

Example:
```javascript
const result = await importYouTubeVideo(url, { title: 'My Course' });
if (result.ok) {
  writeCourseBundle(result.bundle);
} else {
  showToast(result.error, 'error');
}
```

#### `youtube.js`
**YouTube API helpers:**

```javascript
export function extractVideoId(url)    // Parse URL → video ID
export function extractPlaylistId(url) // Parse URL → playlist ID
export async function fetchVideoMeta() // Get title via oEmbed
export function thumbnailUrl(videoId) // Generate thumbnail URL
```

#### `importers.js`
**Format parsers:**

```javascript
export function parseJSONImport(text)  // Parse JSON course bundle
export function parseCSVImport(text)   // CSV → course bundle
```

#### `autoGroup.js`
**Auto-organize lessons:**

```javascript
export function autoGroup(lessons)     // Group into modules by date/pattern
```

### `src/engine/` — Business Logic

#### `achievements.js`
**Badge unlock criteria:**

```javascript
export function evaluateAchievements() // Check all badge criteria
// Returns newly unlocked badges (empty if none)
// Persists to localStorage
```

Badges:
- Streak Master (7+ day streak)
- Focused (completed 5 lessons in a day)
- Dedicated (50+ total XP)
- Quick Learner (completed first lesson in < 5 min)
- Speed Runner (completed 10+ lessons)
- Knowledge Seeker (500+ XP total)

### `src/utils/` — Utilities

#### `sm2.js`
**Spaced Repetition (SM-2 algorithm):**

```javascript
export function reviewCard(card, grade)
// @param {FlashcardSchema} card
// @param {number} grade - 0-5 (0=fail, 5=perfect)
// @returns Updated card fields: { interval, easeFactor, repetitions, nextReview }
```

Pure function, no side effects. Stores call it, then persist the updated card.

---

## 🎨 UI Layer

### `src/ui/primitives/index.js`

Reusable HTML builders to reduce repetition:

```javascript
export function button(text, onClick, cssClass)     // → <button>
export function card(title, body)                   // → <div class="card">
export function heatmapCell(value, maxValue)        // → <div class="heat-cell">
```

### `src/ui/blocks/` — Complex Components

#### `videoModal.js`
**Manages video playback, progress, and controls:**

- Loads YouTube IFrame API
- Keyboard shortcuts (Space, ←, →, M, F, Esc)
- Progress tracking (25%/50%/75% buttons)
- Mark Complete button (emit `lesson:complete`)
- Resume from timestamp (stored in progress.js)
- Next-lesson auto-advance (if available)
- Mini-player detach/reattach

**Bus events:**
- Listen: `lesson:open` → { lessonId, courseId }
- Emit: `lesson:complete` → { lessonId, courseId, xp }

#### `miniPlayer.js`
**Detachable corner player:**

- Bottom-right dock
- Click expand to restore to modal
- Keyboard: `M` to toggle, `Esc` to close
- Continues video playback while browsing

**Bus events:**
- Listen: `player:detach`, `player:reattach`, `miniPlayer:expand`
- Emit: `miniPlayer:closed`

#### `autoAdvance.js`
**5-second countdown to next lesson:**

- Shows after mark complete
- Auto-advances on countdown finish
- User can skip or cancel

#### `keyHints.js`
**First-open keyboard shortcuts overlay:**

- Shows on first video open (localStorage flag)
- Can be dismissed
- Lists all keyboard shortcuts

#### `navBadges.js`
**XP & streak badge display:**

```javascript
export function renderNavBadges()
// Called on: statsChanged, navigate, lessonComplete
// Updates #streakBadge and #xpBadge text
```

#### `generateCardsModal.js`
**Generate flashcards from a course:**

- Modal shows checklist of lessons
- User selects which lessons to include
- Emits `cards:generateRequest` (Phase 8 scope)

### `src/ui/pages/` — Full Page Implementations

Each page is a module that:
1. Listens for `navigate` event
2. Renders into its `<section>` container on nav
3. Emits relevant events on user interaction

#### `dashboard.js`
- Continue card (last watched lesson)
- Stats (XP, streak, course count)
- Activity heatmap
- Achievements list

#### `courses.js`
- Course list (sidebar)
- Module view (week blocks)
- Lesson cards (click → `bus.emit('lesson:open')`)

#### `flashcards.js`
- Deck list (sidebar with due counts)
- Deck overview or study session
- Flip cards, grading, progress bar

#### `analytics-page.js`
- Weekly XP chart (SVG, no library)
- 28-day heatmap
- Completion funnel
- Per-course breakdown

#### `import.js`
- 4 tabs: YouTube URL, Playlist, JSON, CSV
- Live progress (fetch/parse)
- Preview panel (thumbnails, stats)
- Commit button to save

#### `vocab.js`
- Placeholder for future vocabulary feature

### `src/ui/styles/` — CSS Architecture

#### `base.css`
**Design tokens & resets:**

```css
:root {
  --text-primary: #1a1a1a;
  --text-muted: #666;
  --border: #e0e0e0;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
}

* { box-sizing: border-box; }
body { margin: 0; font-family: var(--font-ui); }
```

#### `components.css`
**Reusable UI:**

```css
.btn { }
.btn--primary { }
.btn--ghost { }
.badge-pill { }
.card { }
.modal-card { }
.nav { }
```

#### `pages.css`
**Page-specific layout:**

```css
.page { display: none; }
.page.active { display: block; }
.page-wrap { display: grid; }
```

#### `analytics.css`
**Analytics dashboard styles:**

```css
.grid-4-analytics { }
.xp-chart-svg { }
.heatmap-grid { }
```

#### `flashcards.css`
**Flashcard UI:**

```css
.fc-layout { }
.fc-sidebar { }
.flashcard-flip { transform: rotateY(180deg); }
```

---

## 🔄 Data Flow Example: Import & Play Video

### 1. User imports YouTube playlist

```
import.js (user clicks "Import")
  → importYouTubePlaylist(url)
    → fetchVideoMeta() × N
    → { ok: true, bundle }
  → Preview in panel
  → User clicks "Save"
  → writeCourseBundle(bundle)
    → storage.set('le_content', ...)
  → bus.emit('statsChanged')
  → showToast('Course imported!')
```

### 2. User opens video

```
courses.js (user clicks lesson)
  → bus.emit('lesson:open', { lessonId, courseId })
  → videoModal.js listens
    → Load YouTube IFrame API
    → Fetch progress (resume timestamp)
    → Render modal
    → Initialize keyboard listeners
```

### 3. User marks complete

```
videoModal.js (user clicks "Mark Complete")
  → markComplete(lessonId) in progress.js
  → addXP(50) in user.js
  → evaluateAchievements() in achievements.js
  → bus.emit('lesson:complete', { lessonId, xp: 50 })
  → app.js listens
    → onLessonComplete()
    → showToast('✅ Lesson complete!')
    → bus.emit('statsChanged')
  → navBadges.js listens
    → renderNavBadges() (update XP display)
```

---

## 🚀 Performance Notes

### No Bundle Bloat
- Zero npm dependencies
- No framework overhead
- Minimal CSS (~15KB uncompressed)
- Single HTTP request per CSS file

### localStorage Limits
- Most browsers: 5-10MB per domain
- Typical usage: 100KB-500KB for 50+ courses
- Mitigation: Export & archive old courses if needed

### Browser APIs Used
- `localStorage` — Data persistence
- `fetch()` — YouTube metadata
- `Intl.DateTimeFormat` — Date formatting
- `crypto.randomUUID()` — ID generation
- YouTube IFrame API — Video embedding

---

## 🔐 Security Considerations

### No Server, No Secrets
- All data is client-side
- No API keys exposed
- No authentication (yet—Supabase in Phase 8)
- CORS: YouTube oEmbed is public, no auth needed

### Import Safety
- CSV/JSON parsing uses `JSON.parse()` with error handling
- URL validation before fetching
- No `eval()` or `Function()` constructor
- No `innerHTML` (using `.textContent` and DOM APIs)

### localStorage Security
- Not encrypted (browser sandbox protection only)
- Same as cookies
- Private browsing mode: data cleared on session end

---

## 🧪 Testing Strategy

**No testing framework is in use.** Manual testing:

1. **Functional testing** — All features work in browser
2. **Cross-browser** — Test on Chrome, Firefox, Safari
3. **Responsive** — Mobile (width 320px), tablet (768px), desktop
4. **Accessibility** — Keyboard nav, screen readers, ARIA
5. **Performance** — DevTools Lighthouse, Network tab

---

## 🎯 Future Phases

### Phase 8: AI Summaries & Quizzes
- Auto-generate flashcards from video transcripts
- Quiz builder with image uploads

### Phase 9: Supabase Integration
- User auth
- Cloud sync
- Share courses

### Phase 10: Mobile App
- React Native wrapper
- Offline-first with sync

---

## 📚 Reading Order for New Contributors

1. [README.md](README.md) — High-level features
2. This file (CODEBASE.md) — Architecture & patterns
3. [CONTRIBUTING.md](CONTRIBUTING.md) — Dev setup & code style
4. `src/app.js` — Bus & router
5. `src/store/storage.js` — Adapter pattern
6. A page like `src/ui/pages/dashboard.js` — UI pattern
7. The rest of the codebase (patterns are consistent)

---

## ❓ Architecture FAQs

**Q: Why no frameworks?**
A: Simpler deployment, fewer dependencies, direct control, smaller bundle, easier to understand.

**Q: Why the event bus instead of React-style state?**
A: Decoupling, flexibility, easy to replace, pub/sub is a proven pattern.

**Q: Why split CSS into 4 files?**
A: Separation of concerns—base (tokens), components (UI), pages (layout), features (analytics/flashcards).

**Q: Can I use a build tool?**
A: Sure! Add a build step if you like. The project is designed to work without it, but optional minification is fine.

**Q: How do I add dark mode?**
A: Add CSS custom properties to `:root[data-theme="dark"]`, toggle with `document.documentElement.dataset.theme = 'dark'`, persist in localStorage.

---

**Happy hacking! 🚀**
