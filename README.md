# LearnEngine 🎓

> A **local-first, zero-framework learning platform** for self-directed learners. Built with vanilla JavaScript (ES modules), no build step, no dependencies.

**Live demo:** Host with `python -m http.server` or open `index.html` directly.  
**Repository:** [github.com/brandfaux/dash](https://github.com/brandfaux/dash)

---

## ✨ Features

- **📺 Video Lessons** — Embed and track YouTube videos with built-in progress tracking, keyboard shortcuts (Space/←/→), and resume timestamps
- **📊 Analytics Dashboard** — Weekly XP chart (SVG), 28-day activity heatmap, completion funnel, per-course breakdown
- **🎴 Flashcards + Spaced Repetition** — Study with SM-2 algorithm, flip cards, track due dates, organize by decks
- **📚 Content Import** — Add courses from YouTube URLs, playlists, JSON, or CSV; live preview before saving
- **🏆 Gamification** — XP counter, daily streak tracking, 6 achievement badges
- **🎨 Responsive Design** — Works on desktop, tablet, mobile with a carefully designed three-typeface system
- **♿ Accessible** — ARIA labels, semantic HTML, keyboard navigation (Escape closes modals, full flashcard navigation)
- **🚀 Zero Dependencies** — No npm, no build tools, no frameworks—just modern ES modules and CSS
- **💾 Local Storage** — All data stored securely in your browser; no accounts, no servers

---

## 🚀 Quick Start

### Option 1: Local HTTP Server (Recommended)

```bash
# Clone the repository
git clone https://github.com/brandfaux/dash.git
cd dash

# Serve locally (pick any method):
python -m http.server 8080
# or
npx serve .
# or
php -S localhost:8080
```

Then open **http://localhost:8080** in your browser.

### Option 2: Direct File

Open `index.html` directly in your browser (⚠️ YouTube IFrame API requires HTTPS or localhost).

---

## 📖 User Guide

### Dashboard

Your learning hub — displays:
- **Continue Card** — Resume your last watched lesson
- **Stats** — Total XP, current streak, courses enrolled
- **Activity Heatmap** — 28-day view of your study consistency
- **Achievements** — Badges unlocked (Streak Master, Focused, Dedicated, Quick Learner, Speed Runner, Knowledge Seeker)

### Courses

Browse all imported courses organized by module. Click a lesson card to open the video modal.

**Video Modal Controls:**
- **Keyboard Shortcuts:**
  - `Space` — Play/pause
  - `←` / `→` — Rewind/forward 5 seconds
  - `M` — Mute
  - `F` — Fullscreen
  - `Esc` — Close modal
- **Progress Buttons** — Jump to 25%, 50%, 75% of video
- **Mark Complete** — Log completion and earn XP
- **Mini Player** — Detach video to corner, watch while browsing other sections

### Flashcards

Study with spaced repetition. Create or import decks and study due cards.

**Study Session:**
1. Click a deck → see overview (card count, due cards)
2. Click "Study Now" → enter full-screen flip-card mode
3. Click card or press `Space` to flip
4. Grade your answer: **Again** (fail), **Hard**, **Good**, **Easy**, **Perfect**
5. Progress bar shows cards remaining
6. Next review date auto-calculates based on SM-2 algorithm

**Deck Management:**
- Create new decks manually or generate from courses
- View all cards, edit/delete as needed
- Track due dates with next-review indicators

### Analytics

See your learning progress:
- **Weekly XP** — Line chart of earned XP over past 7 days
- **Activity Heatmap** — 28-day grid showing study consistency
- **Completion Funnel** — Percentage of lessons started vs. completed
- **Per-Course Breakdown** — Total XP, completion %, time invested

### Import

Add content from four sources:

1. **Single YouTube Video** — Paste a URL
2. **YouTube Playlist** — Paste a playlist URL, import all videos
3. **JSON File** — Upload or paste structured course data
4. **CSV File** — Drag-and-drop or file picker for spreadsheets

**Preview before committing** — See thumbnails, course titles, and lesson count before saving.

### Vocabulary

Coming soon — reserved for future word/phrase review features.

---

## ⚙️ Configuration

Edit `src/config/platform.js` to rebrand or reconfigure:

```javascript
export const PLATFORM = {
  name: 'Your App Name',                    // App title
  shortName: 'Short',                       // For PWA manifest
  logo: { mark: 'L', rest: 'earn' },       // Logo parts
  xpPerLesson: 50,                          // XP awarded per lesson
  completionThreshold: 0.9,                 // 90% watched = complete
  features: {
    flashcards: true,                       // Enable/disable sections
    offline: false,                         // PWA (future)
    auth: false,                            // Supabase auth (future)
  },
};
```

---

## 🏗️ Architecture

### No Build, No Framework

- **ES Modules** — `type="module"` entry point, zero transpilation
- **Event Bus** — Modules communicate via `app.js` event bus (loose coupling)
- **Stores** — `src/store/` handles all data I/O through a single localStorage adapter
- **Pages** — Vanilla JS pages render into empty `<section>` containers
- **Styles** — Split into `base.css` (tokens), `components.css` (UI), `pages.css` (layout), plus `analytics.css` and `flashcards.css`

### Folder Structure

```
dash/
├── index.html                 # Single HTML shell
├── README.md                  # This file
├── LICENSE                    # MIT license
├── CONTRIBUTING.md            # Developer guide
├── CODEBASE.md               # Architecture deep dive
└── src/
    ├── main.js               # Entry point
    ├── app.js                # Router, bus, toasts
    ├── config/
    │   ├── platform.js       # Branding & feature flags
    │   ├── achievements.js   # Badge definitions
    │   └── seed.js           # Demo data
    ├── schema/
    │   └── entities.js       # Data shape definitions (JSDoc)
    ├── store/
    │   ├── storage.js        # localStorage adapter
    │   ├── content.js        # Courses & lessons CRUD
    │   ├── progress.js       # Lesson progress & resume
    │   ├── user.js           # User stats, streak, XP
    │   ├── flashcards.js     # Decks & cards CRUD
    │   ├── analytics-store.js # Activity heatmap & XP history
    │   └── index.js          # Barrel export
    ├── ingestion/
    │   ├── pipeline.js       # Import orchestration
    │   ├── youtube.js        # YouTube API helpers
    │   ├── importers.js      # JSON/CSV parsing
    │   ├── autoGroup.js      # Auto-organize lessons
    │   └── index.js          # Barrel export
    ├── engine/
    │   └── achievements.js   # Badge unlock logic
    ├── utils/
    │   └── sm2.js            # Spaced repetition (SM-2 algorithm)
    └── ui/
        ├── primitives/
        │   └── index.js      # reusable HTML builders
        ├── blocks/
        │   ├── videoModal.js       # Video player + controls
        │   ├── miniPlayer.js       # Corner player dock
        │   ├── autoAdvance.js      # Next-lesson countdown
        │   ├── keyHints.js         # Keyboard shortcuts overlay
        │   ├── navBadges.js        # XP/streak badge refresh
        │   └── generateCardsModal.js # Flashcard generation
        ├── pages/
        │   ├── dashboard.js
        │   ├── analytics-page.js
        │   ├── courses.js
        │   ├── flashcards.js
        │   ├── vocab.js
        │   └── import.js
        └── styles/
            ├── base.css        # Design system
            ├── components.css  # Reusable UI
            ├── pages.css       # Page-specific
            ├── analytics.css   # Analytics dashboard
            └── flashcards.css  # Flashcard styles
```

---

## 🔌 Data Format

### Import JSON Schema

```json
{
  "course": {
    "id": "uuid",
    "title": "My Course",
    "level": "beginner",
    "label": "German",
    "accent": "#e94560",
    "source": "youtube_video"
  },
  "modules": [
    {
      "mod": { "id": "uuid", "title": "Week 1", "position": 1 },
      "lessons": [
        {
          "id": "uuid",
          "title": "Intro to A1",
          "videoId": "dQw4w9WgXcQ",
          "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          "thumbnail": "https://i.ytimg.com/...",
          "position": 0
        }
      ]
    }
  ]
}
```

### Export Progress

Your progress is automatically saved in localStorage keys:
- `le_user` — User stats (XP, streak, created date)
- `le_progress` — Video completion timestamps and resume points
- `le_content` — Imported courses
- `le_decks` — Flashcard decks metadata
- `le_cards_<deckId>` — Cards in each deck

To export, open browser DevTools (F12) → Console and run:
```javascript
const data = {
  user: localStorage.getItem('le_user'),
  progress: localStorage.getItem('le_progress'),
  content: localStorage.getItem('le_content'),
  decks: localStorage.getItem('le_decks'),
};
console.log(JSON.stringify(data, null, 2));
```

---

## 🚀 Deployment

### GitHub Pages (Free)

1. Push code to GitHub
2. Go to **Settings → Pages**
3. Set source to `main` branch, `/root` folder
4. Site publishes to `https://username.github.io/dash`

### Vercel (Free)

```bash
npm install -g vercel
vercel
```

### Self-Hosted (Any Static Hosting)

Upload the entire `dash/` folder to any static file host (Netlify, Railway, etc.).

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for developer setup, code style, and contribution guidelines.

**Quick dev setup:**
```bash
git clone https://github.com/brandfaux/dash.git
cd dash
python -m http.server 8080
# Open http://localhost:8080 in your browser
```

---

## 📋 Keyboard Shortcuts

| Shortcut | Context | Action |
|----------|---------|--------|
| `Space` | Video playing | Play/pause |
| `←` / `→` | Video playing | Rewind/forward 5s |
| `M` | Video playing | Mute |
| `F` | Video playing | Fullscreen |
| `Esc` | Anywhere | Close modal |
| `Space` | Flashcard study | Flip card |
| `1-5` | Flashcard study | Quick grade (Again to Perfect) |

---

## ♿ Accessibility

- **WCAG 2.1 Level A** compliance throughout
- Semantic HTML (`<nav>`, `<main>`, `<section>`, `<button>`)
- ARIA labels on modals, buttons, and interactive regions
- Full keyboard navigation — all features accessible via Tab + Enter
- Screen reader support for toast notifications and status updates
- Color contrast ratios meet AA standards

---

## 📄 License

MIT License — See [LICENSE](LICENSE) file. Free to use, modify, and distribute.

---

## 🐛 Found a Bug?

Open an issue on [GitHub Issues](https://github.com/brandfaux/dash/issues) with:
- Steps to reproduce
- Expected vs. actual behavior
- Browser and OS

---

## 🙋 Questions?

Check out:
- [CODEBASE.md](CODEBASE.md) — Architecture deep dive
- [CONTRIBUTING.md](CONTRIBUTING.md) — Developer guide
- [GitHub Discussions](https://github.com/brandfaux/dash/discussions)

---

**Happy learning! 🚀**
