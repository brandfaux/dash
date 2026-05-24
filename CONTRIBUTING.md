# Contributing to LearnEngine

Thank you for your interest in contributing! This guide explains how to set up a development environment, understand the codebase, and submit contributions.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 14+ (for running local servers, optional)
- A modern web browser (Chrome, Firefox, Safari, Edge)
- Git

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/brandfaux/dash.git
   cd dash
   ```

2. **Start a local server:**
   ```bash
   # Option 1: Python (built-in on most systems)
   python -m http.server 8080
   
   # Option 2: Node (requires npm)
   npx serve .
   
   # Option 3: PHP (built-in on most systems)
   php -S localhost:8080
   ```

3. **Open in browser:**
   Navigate to `http://localhost:8080`

4. **Open DevTools:**
   - Press `F12` or `Cmd+Option+I`
   - Monitor Console for errors
   - Inspect localStorage (`Application` tab → `Local Storage`)

---

## 📁 Code Organization

All source code is in `src/` with this structure:

### `src/config/`
**Platform configuration & constants**
- `platform.js` — Branding, feature flags, constants (edit this to rebrand)
- `achievements.js` — Badge definitions
- `seed.js` — Demo data

### `src/store/`
**Data persistence layer**
- `storage.js` — localStorage adapter (only file that touches localStorage)
- `content.js` — Course & lesson CRUD
- `progress.js` — Video progress & resume timestamps
- `user.js` — User stats, streak, XP
- `flashcards.js` — Flashcard decks & cards CRUD
- `analytics-store.js` — Activity heatmap & XP history

### `src/schema/`
**Data shape definitions**
- `entities.js` — JSDoc type definitions (no runtime checks, documentation only)

### `src/ingestion/`
**Content import pipeline**
- `pipeline.js` — Main orchestrator
- `youtube.js` — YouTube API helpers
- `importers.js` — JSON/CSV parsing
- `autoGroup.js` — Auto-organize lessons into modules

### `src/engine/`
**Business logic**
- `achievements.js` — Badge unlock criteria

### `src/utils/`
**Utilities**
- `sm2.js` — Spaced repetition algorithm (pure function, no side effects)

### `src/ui/`
**User interface**
- `primitives/` — Reusable HTML builders
- `blocks/` — Complex UI components (modal, mini-player, etc.)
- `pages/` — Full page implementations
- `styles/` — CSS split by concern

### `src/app.js`
**Core runtime**
- Event bus (all cross-module communication)
- Router (navigation, page switching)
- Toast notifications
- Lesson completion handler

### `src/main.js`
**Module entry point**
- Imports all pages & blocks
- Initializes branding
- Boots the app

---

## 🏗️ Architecture Principles

### 1. No Build, No Dependencies
- Pure ES modules (`type="module"`)
- No npm packages (all functionality is hand-written)
- No transpilation, no minification in dev

### 2. Event Bus Communication
Instead of direct imports and coupling:

```javascript
// ❌ BAD — Tightly coupled
import { updateUI } from './ui.js';
updateUI();

// ✅ GOOD — Loose coupling via bus
import { bus } from '../app.js';
bus.emit('statsChanged', { xp: 100 });
```

### 3. Single Responsibility
Each file does one thing:
- `pages/courses.js` → renders course list only
- `store/content.js` → manages course data only
- `blocks/videoModal.js` → manages video modal only

### 4. Stores as Adapters
All I/O goes through `src/store/`. To add a new data source (e.g., Supabase):
1. Create `src/store/supabase.js`
2. Export same functions as current store
3. Update imports in other modules (only 1 place changes)

### 5. CSS Namespacing
Use BEM-like naming to avoid collisions:

```css
/* ✅ Block + element + modifier */
.flashcards__sidebar { }
.flashcards__deck-item { }
.flashcards__deck-item--active { }
```

---

## 🔄 Event Bus Reference

The event bus is the nervous system of the app. Emit events, other modules listen:

```javascript
import { bus } from './app.js';

// Emit
bus.emit('lesson:complete', { lessonId, xp: 50 });

// Listen
bus.on('lesson:complete', (data) => {
  console.log('Lesson done:', data.lessonId);
});
```

### Core Events (in use)
- `navigate` — Page changed: `(page: string)`
- `lesson:open` — Video modal opened: `{ lessonId, courseId }`
- `lesson:complete` — Video marked complete: `{ lessonId, courseId, xp }`
- `statsChanged` — User stats updated
- `closeModal` — Close any open modal

---

## 🎨 CSS Architecture

### `base.css`
Design tokens, resets, global styles:
```css
:root {
  --text-primary: #1a1a1a;
  --border: #e0e0e0;
  --space-3: 12px;
}
```

### `components.css`
Reusable UI components:
```css
.btn { }
.btn--primary { }
.badge-pill { }
.modal-card { }
```

### `pages.css`
Page-specific layout:
```css
.page { display: none; }
.page.active { display: block; }
```

### `analytics.css` & `flashcards.css`
Feature-specific styles (append to imports in `index.html`).

---

## 📝 Code Style

### JavaScript
- **Arrow functions** for callbacks/short functions
- **const/let** only (no var)
- **JSDoc comments** for public functions
- **No semicolons** (Prettier-optional)
- **Destructuring** for readability

```javascript
// ✅ Good
export function getDeck(id) {
  const deck = readDecks()[id];
  return deck ?? null;
}

// ✅ Good
const { flashcards: enabled } = PLATFORM.features;
```

### HTML
- Semantic tags (`<section>`, `<nav>`, `<button>`)
- data-attributes for JS hooks: `data-page="courses"`
- ARIA labels on interactive elements
- No inline styles

```html
<!-- ✅ Good -->
<button
  class="btn btn--primary"
  data-action="save"
  aria-label="Save deck"
>
  Save
</button>
```

### CSS
- BEM-like naming: `.block__element--modifier`
- Use CSS variables from `:root`
- Mobile-first media queries
- Avoid `!important`

```css
/* ✅ Good */
.flashcard {
  padding: var(--space-4);
}

.flashcard__front { }
.flashcard__front--flipped { }

@media (max-width: 640px) {
  .flashcard { padding: var(--space-2); }
}
```

---

## ✅ Testing Checklist

Before submitting a PR, manually test:

- [ ] Feature works on desktop (Chrome)
- [ ] Feature works on mobile (open DevTools, toggle device toolbar)
- [ ] All keyboard shortcuts work (Esc, Space, etc.)
- [ ] All links/buttons navigate correctly
- [ ] No console errors or warnings
- [ ] localStorage isn't bloated (< 5MB for typical use)
- [ ] Modals close properly
- [ ] Toast notifications appear and disappear

---

## 🐛 Bug Reports

When opening an issue, include:

1. **Browser & OS** — e.g., "Chrome 120 on Windows 11"
2. **Steps to reproduce** — Exact actions to trigger the bug
3. **Expected behavior** — What should happen
4. **Actual behavior** — What actually happens
5. **Console errors** — Any errors in DevTools Console (F12)
6. **Screenshots** — If it's visual

Example:
```
**Browser:** Firefox 125 on macOS 14

**Steps:**
1. Open "Courses" tab
2. Click any video
3. Press the X button to close

**Expected:** Modal closes

**Actual:** Modal stays open, console shows error

**Error:** TypeError: cannot read property of null
```

---

## 💡 Feature Request Template

When suggesting a new feature:

1. **Problem** — What does the user want to do?
2. **Current behavior** — What's missing?
3. **Proposed solution** — How should it work?
4. **Alternatives** — Are there other approaches?

---

## 🔀 Git Workflow

1. **Create a branch:**
   ```bash
   git checkout -b feature/flashcard-search
   ```

2. **Make commits:**
   - Keep commits focused (one feature per commit)
   - Write descriptive messages
   ```bash
   git commit -m "Add search filter to flashcard deck list"
   ```

3. **Push & open PR:**
   ```bash
   git push origin feature/flashcard-search
   ```

4. **PR guidelines:**
   - Describe what changed and why
   - Reference any related issues
   - Include before/after screenshots for UI changes

---

## 📚 Further Reading

- [README.md](README.md) — User guide & features
- [CODEBASE.md](CODEBASE.md) — Deep architecture dive
- [schema/entities.js](src/schema/entities.js) — Data type definitions

---

## 🎯 Areas Needing Help

Good first-time contributions:

1. **Accessibility** — Fix keyboard navigation, add missing ARIA labels
2. **Styling** — Responsive CSS improvements, dark mode
3. **Documentation** — JSDoc comments, inline explanations
4. **Bugs** — Fix console errors or UI glitches
5. **Performance** — Optimize bundle size, reduce localStorage usage

---

## ❓ Questions?

- Open a [GitHub Discussion](https://github.com/brandfaux/dash/discussions)
- Check [GitHub Issues](https://github.com/brandfaux/dash/issues)
- Review existing code in `src/` for patterns

**Thank you for contributing! 🚀**
