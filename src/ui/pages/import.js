/**
 * ui/pages/import.js
 * Content ingestion UI: tabs for YouTube URLs, Playlist, JSON, CSV.
 * Full preview before commit. No code changes needed for new content.
 */

import { bus, navigate, showToast } from '../../app.js';
import {
  importYouTubeURLList,
  importYouTubePlaylist,
  importJSON,
  importCSV,
  commitBundle,
} from '../../ingestion/pipeline.js';
import { sectionHeader } from '../primitives/index.js';

// ─── State ────────────────────────────────────────────────────────

let activeTab     = 'urls';
let pendingBundle = null;      // preview-ready bundle awaiting commit

const TABS = [
  { id: 'urls',     label: '🔗 YouTube URLs' },
  { id: 'playlist', label: '▶ Playlist' },
  { id: 'json',     label: '{ } JSON' },
  { id: 'csv',      label: '⬛ CSV' },
];

const LEVEL_OPTIONS = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Custom'];

// ─── Render ───────────────────────────────────────────────────────

function render() {
  const el = document.getElementById('pageImport');
  if (!el) return;

  el.innerHTML = `
    <div style="max-width:760px;margin:0 auto">
      <div class="mb-24">
        ${sectionHeader('Import Content')}
        <p style="color:var(--text-soft);font-size:0.92rem;line-height:1.7;margin-top:8px">
          Paste YouTube links, a playlist URL, JSON, or a CSV file to create a course automatically.
          Everything is grouped into weekly modules — no code changes needed.
        </p>
      </div>

      ${renderTabs()}
      ${renderTabContent()}
      ${pendingBundle ? renderPreview() : ''}
    </div>`;

  bindEvents(el);
}

// ─── Tabs ─────────────────────────────────────────────────────────

function renderTabs() {
  return `<div class="import-tabs mb-24">
    ${TABS.map(t => `
      <button class="import-tab${activeTab === t.id ? ' active' : ''}" data-tab="${t.id}">
        ${t.label}
      </button>`).join('')}
  </div>`;
}

// ─── Tab content ──────────────────────────────────────────────────

function renderTabContent() {
  const meta = renderMetaFields();
  switch (activeTab) {
    case 'urls':     return renderURLsTab(meta);
    case 'playlist': return renderPlaylistTab(meta);
    case 'json':     return renderJSONTab(meta);
    case 'csv':      return renderCSVTab(meta);
    default:         return '';
  }
}

function renderMetaFields(idPrefix = '') {
  return `
    <div class="import-meta-row">
      <div class="import-meta-field">
        <label class="label-caps" style="display:block;margin-bottom:6px">Course title</label>
        <input id="${idPrefix}metaTitle" class="text-input" placeholder="e.g. German for Beginners" type="text">
      </div>
      <div class="import-meta-field">
        <label class="label-caps" style="display:block;margin-bottom:6px">Level</label>
        <select id="${idPrefix}metaLevel" class="select-input">
          ${LEVEL_OPTIONS.map(l => `<option value="${l}">${l || '— none —'}</option>`).join('')}
        </select>
      </div>
    </div>`;
}

function renderURLsTab(meta) {
  return `
    <div class="card import-card mb-16">
      <h3 class="import-section-title">YouTube Video URLs</h3>
      <p class="import-hint">Paste one URL per line. Supports youtube.com/watch, youtu.be, and Shorts.</p>
      <textarea id="urlsInput" class="import-textarea mt-12"
        placeholder="https://youtu.be/abc123&#10;https://www.youtube.com/watch?v=xyz789&#10;https://youtu.be/def456"
        rows="8"></textarea>
      ${meta}
      <div class="import-actions mt-16">
        <button id="btnImportURLs" class="btn btn--primary">Preview Import</button>
        <span class="import-hint" id="importProgress"></span>
      </div>
    </div>`;
}

function renderPlaylistTab(meta) {
  return `
    <div class="card import-card mb-16">
      <h3 class="import-section-title">YouTube Playlist</h3>
      <p class="import-hint">Paste a playlist URL. Fetches up to 15 videos via the public feed (no API key needed).</p>
      <input id="playlistInput" class="text-input mt-12"
        placeholder="https://www.youtube.com/playlist?list=PLxxxxxx" type="url">
      ${meta}
      <div class="import-actions mt-16">
        <button id="btnImportPlaylist" class="btn btn--primary">Preview Import</button>
        <span class="import-hint" id="importProgress"></span>
      </div>
    </div>
    <div class="card import-card" style="border-color:rgba(245,166,35,0.2)">
      <p class="label-caps" style="color:var(--accent-2);margin-bottom:8px">Tip</p>
      <p class="import-hint">
        For playlists longer than 15 videos, copy all video URLs from the playlist page
        and paste them into the <strong>YouTube URLs</strong> tab instead.
      </p>
    </div>`;
}

function renderJSONTab(meta) {
  const example = JSON.stringify([
    { title: 'Introduction', url: 'https://youtu.be/abc123', week: 1 },
    { title: 'Lesson 2',     url: 'https://youtu.be/def456', week: 1 },
    { title: 'Lesson 3',     url: 'https://youtu.be/ghi789', week: 2 },
  ], null, 2);

  return `
    <div class="card import-card mb-16">
      <h3 class="import-section-title">JSON Import</h3>
      <p class="import-hint">
        Paste a JSON array or a full bundle object. Supported shapes:
        flat array of <code>{ title, url, week? }</code>, or full
        <code>{ course, modules: [{ title, lessons: [...] }] }</code>.
      </p>
      <textarea id="jsonInput" class="import-textarea mt-12" rows="12"
        placeholder="${escapeHtml(example)}"></textarea>
      ${meta}
      <div class="import-actions mt-16">
        <button id="btnImportJSON" class="btn btn--primary">Preview Import</button>
        <label class="btn btn--ghost" style="cursor:pointer">
          Load file
          <input type="file" id="jsonFileInput" accept=".json" style="display:none">
        </label>
      </div>
    </div>`;
}

function renderCSVTab(meta) {
  const example = `title,url,week,description\nIntroduction,https://youtu.be/abc123,1,Course intro\nLesson 2,https://youtu.be/def456,1,\nLesson 3,https://youtu.be/ghi789,2,Second week`;
  return `
    <div class="card import-card mb-16">
      <h3 class="import-section-title">CSV Import</h3>
      <p class="import-hint">
        Required columns: <code>title</code>, <code>url</code> (or <code>videoId</code>).
        Optional: <code>week</code>, <code>description</code>.
        Header row required.
      </p>
      <textarea id="csvInput" class="import-textarea mt-12" rows="10"
        placeholder="${escapeHtml(example)}"></textarea>
      ${meta}
      <div class="import-actions mt-16">
        <button id="btnImportCSV" class="btn btn--primary">Preview Import</button>
        <label class="btn btn--ghost" style="cursor:pointer">
          Load file
          <input type="file" id="csvFileInput" accept=".csv,.txt" style="display:none">
        </label>
      </div>
    </div>
    <div class="import-drop-zone" id="csvDropZone">
      Drop a .csv file here
    </div>`;
}

// ─── Preview panel ────────────────────────────────────────────────

function renderPreview() {
  const { course, modules } = pendingBundle;
  const totalLessons = modules.reduce((n, m) => n + m.lessons.length, 0);

  return `
    <div class="card import-preview mb-24" id="previewPanel" style="border-color:rgba(78,204,163,0.3)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px">
        <div>
          <p class="label-caps" style="color:var(--accent-3);margin-bottom:6px">Preview — Ready to import</p>
          <h3 style="font-family:var(--font-serif);font-size:1.3rem">${course.title}</h3>
          ${course.level ? `<span class="badge-pill" style="margin-top:6px">${course.level}</span>` : ''}
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          <button id="btnCommit" class="btn btn--primary">✓ Add Course</button>
          <button id="btnCancelPreview" class="btn btn--ghost">✕ Discard</button>
        </div>
      </div>

      <div class="preview-stats">
        <div class="preview-stat">
          <strong>${modules.length}</strong>
          <span>modules</span>
        </div>
        <div class="preview-stat">
          <strong>${totalLessons}</strong>
          <span>lessons</span>
        </div>
        <div class="preview-stat">
          <strong>${course.source?.replace('_', ' ')}</strong>
          <span>source</span>
        </div>
      </div>

      <div class="preview-modules">
        ${modules.map(({ mod, lessons }) => `
          <details class="preview-module">
            <summary class="preview-module-title">
              <span>${mod.title}</span>
              <span class="label-mono" style="margin-left:auto">${lessons.length} lessons</span>
            </summary>
            <ul class="preview-lesson-list">
              ${lessons.map(l => `
                <li class="preview-lesson">
                  ${l.thumbnail
                    ? `<img src="${l.thumbnail}" alt="" class="preview-thumb" loading="lazy">`
                    : `<div class="preview-thumb preview-thumb--placeholder"></div>`}
                  <span class="preview-lesson-title">${escapeHtml(l.title)}</span>
                  ${l.videoId ? `<span class="label-mono" style="margin-left:auto;font-size:0.7rem;color:var(--text-muted)">${l.videoId}</span>` : ''}
                </li>`).join('')}
            </ul>
          </details>`).join('')}
      </div>
    </div>`;
}

// ─── Events ───────────────────────────────────────────────────────

function bindEvents(el) {
  // Tab switching
  el.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab     = btn.dataset.tab;
      pendingBundle = null;
      render();
    });
  });

  // Import buttons
  el.querySelector('#btnImportURLs')?.addEventListener('click', () => runURLsImport(el));
  el.querySelector('#btnImportPlaylist')?.addEventListener('click', () => runPlaylistImport(el));
  el.querySelector('#btnImportJSON')?.addEventListener('click', () => runJSONImport(el));
  el.querySelector('#btnImportCSV')?.addEventListener('click', () => runCSVImport(el));

  // File loaders
  el.querySelector('#jsonFileInput')?.addEventListener('change', e => {
    readFile(e.target.files[0], text => {
      const ta = el.querySelector('#jsonInput');
      if (ta) ta.value = text;
    });
  });

  el.querySelector('#csvFileInput')?.addEventListener('change', e => {
    readFile(e.target.files[0], text => {
      const ta = el.querySelector('#csvInput');
      if (ta) ta.value = text;
    });
  });

  // CSV drag-drop
  const dropZone = el.querySelector('#csvDropZone');
  if (dropZone) {
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) readFile(file, text => {
        const ta = el.querySelector('#csvInput');
        if (ta) { ta.value = text; runCSVImport(el); }
      });
    });
  }

  // Preview actions
  el.querySelector('#btnCommit')?.addEventListener('click', commitImport);
  el.querySelector('#btnCancelPreview')?.addEventListener('click', () => {
    pendingBundle = null;
    render();
  });
}

// ─── Import runners ───────────────────────────────────────────────

function getMeta(el, prefix = '') {
  return {
    title:  el.querySelector(`#${prefix}metaTitle`)?.value.trim() || '',
    level:  el.querySelector(`#${prefix}metaLevel`)?.value || '',
    accent: '#e94560',
  };
}

async function runURLsImport(el) {
  const text = el.querySelector('#urlsInput')?.value.trim();
  if (!text) { showToast('Paste at least one YouTube URL.', 'error'); return; }

  const meta = getMeta(el);
  setLoading(el, '#btnImportURLs', true);

  const result = await importYouTubeURLList(text, meta, ({ fetched, total }) => {
    const prog = el.querySelector('#importProgress');
    if (prog) prog.textContent = `Fetching ${fetched}/${total}…`;
  });

  setLoading(el, '#btnImportURLs', false);
  handleResult(result);
}

async function runPlaylistImport(el) {
  const url = el.querySelector('#playlistInput')?.value.trim();
  if (!url) { showToast('Paste a YouTube playlist URL.', 'error'); return; }

  const meta = getMeta(el);
  setLoading(el, '#btnImportPlaylist', true);

  const result = await importYouTubePlaylist(url, meta, ({ fetched, total }) => {
    const prog = el.querySelector('#importProgress');
    if (prog) prog.textContent = `Fetching ${fetched}/${total}…`;
  });

  setLoading(el, '#btnImportPlaylist', false);
  handleResult(result);
}

function runJSONImport(el) {
  const text = el.querySelector('#jsonInput')?.value.trim();
  if (!text) { showToast('Paste or load a JSON file.', 'error'); return; }
  handleResult(importJSON(text, getMeta(el)));
}

function runCSVImport(el) {
  const text = el.querySelector('#csvInput')?.value.trim();
  if (!text) { showToast('Paste or load a CSV file.', 'error'); return; }
  handleResult(importCSV(text, getMeta(el)));
}

function handleResult(result) {
  if (!result.ok) {
    showToast(`Import error: ${result.error}`, 'error');
    return;
  }
  pendingBundle = result.bundle;
  render();
  // Scroll to preview
  setTimeout(() => document.getElementById('previewPanel')?.scrollIntoView({ behavior: 'smooth' }), 50);
}

// ─── Commit ───────────────────────────────────────────────────────

function commitImport() {
  if (!pendingBundle) return;
  try {
    commitBundle(pendingBundle);
    showToast(`✓ "${pendingBundle.course.title}" added successfully!`, 'success');
    pendingBundle = null;
    bus.emit('contentChanged');
    navigate('courses');
  } catch (err) {
    showToast(`Save failed: ${err.message}`, 'error');
  }
}

// ─── Utils ────────────────────────────────────────────────────────

function setLoading(el, selector, loading) {
  const btn = el.querySelector(selector);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Working…' : 'Preview Import';
}

function readFile(file, cb) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => cb(e.target.result);
  reader.readAsText(file);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Bus ──────────────────────────────────────────────────────────

bus.on('navigate', page => {
  if (page === 'import') render();
});
