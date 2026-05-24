/**
 * ui/pages/courses.js
 * Sidebar course list + main content area with module/lesson breakdown.
 * Responds to: navigate('courses'), selectCourse, lessonComplete, statsChanged.
 */

import { bus, showToast }   from '../../app.js';
import { getCourses, getModules, getLessons, getAllLessonsForCourse, deleteCourse } from '../../store/content.js';
import { getProgress, getAllProgress, computeCourseProgress } from '../../store/progress.js';
import { sectionHeader, progressBar, weekBlock, courseCard, emptyState } from '../primitives/index.js';
import { openVideoModal }    from '../blocks/videoModal.js';

let activeCourseId = null;

// ─── Render ───────────────────────────────────────────────────────

function render() {
  const el = document.getElementById('pageCourses');
  if (!el) return;

  const courses = getCourses();

  if (!courses.length) {
    el.innerHTML = emptyState(
      'No courses yet',
      'Import YouTube links, a playlist, CSV, or JSON to create your first course.',
      `<button class="btn btn--primary" data-action="go-import">Import a course</button>`
    );
    el.querySelector('[data-action="go-import"]')?.addEventListener('click', () => {
      import('../../app.js').then(({ navigate }) => navigate('import'));
    });
    return;
  }

  // Ensure a valid active course
  if (!activeCourseId || !courses.find(c => c.id === activeCourseId)) {
    activeCourseId = courses[0].id;
  }

  el.innerHTML = `
    <div class="courses-layout">
      <aside class="courses-sidebar">
        ${sectionHeader('Your Courses')}
        <div id="courseCardList">${renderSidebar(courses)}</div>
        <button class="btn btn--ghost mt-16" style="width:100%" data-action="go-import">+ Import Course</button>
      </aside>
      <main class="courses-main" id="courseMain">
        ${renderCourseDetail(activeCourseId)}
      </main>
    </div>`;

  bindEvents(el);
}

// ─── Sidebar ──────────────────────────────────────────────────────

function renderSidebar(courses) {
  return courses.map(c => {
    const lessons = getAllLessonsForCourse(c.id);
    const prog    = computeCourseProgress(lessons.map(l => l.id));
    return courseCard(c, prog, c.id === activeCourseId);
  }).join('');
}

// ─── Course detail ────────────────────────────────────────────────

function renderCourseDetail(courseId) {
  const courses = getCourses();
  const course  = courses.find(c => c.id === courseId);
  if (!course) return '';

  const modules   = getModules(courseId);
  const allLessons = getAllLessonsForCourse(courseId);
  const prog       = computeCourseProgress(allLessons.map(l => l.id));
  const progMap    = getAllProgress();

  const headerAccent = course.accent || 'var(--accent-1)';

  const moduleBlocks = modules.map((mod, i) => {
    const lessons = getLessons(mod.id);
    return weekBlock(mod, lessons, progMap, i === 0);
  }).join('');

  return `
    <div class="card course-detail-header mb-16" style="border-top:3px solid ${headerAccent}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div>
          <p class="label-caps" style="margin-bottom:6px;color:${headerAccent}">
            ${course.level}${course.label ? ' · ' + course.label : ''}
          </p>
          <h2 style="font-family:var(--font-serif);font-size:1.5rem;margin-bottom:10px">${course.title}</h2>
          ${course.description ? `<p style="color:var(--text-soft);font-size:0.9rem;line-height:1.7;margin-bottom:12px">${course.description}</p>` : ''}
          <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
            <span class="label-mono">${prog.done}/${prog.total} lessons</span>
            <span class="label-mono">${prog.pct}% complete</span>
            ${course.source !== 'manual' ? `<span class="badge-pill">${course.source}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          <button class="btn btn--ghost" data-action="delete-course" data-course-id="${courseId}"
            style="color:var(--accent-1);border-color:rgba(233,69,96,0.2)">Delete</button>
        </div>
      </div>
      <div class="mt-12">${progressBar(prog.pct)}</div>
    </div>

    <div id="moduleList">
      ${modules.length
        ? moduleBlocks
        : `<div class="empty-state" style="padding:28px"><p>This course has no modules yet.</p></div>`
      }
    </div>`;
}

// ─── Partial re-render helpers ────────────────────────────────────

function refreshSidebar() {
  const list = document.getElementById('courseCardList');
  if (list) list.innerHTML = renderSidebar(getCourses());
  bindSidebarEvents(list);
}

function refreshCourseMain() {
  const main = document.getElementById('courseMain');
  if (main) {
    main.innerHTML = renderCourseDetail(activeCourseId);
    bindMainEvents(main);
  }
}

// ─── Events ───────────────────────────────────────────────────────

function bindEvents(el) {
  bindSidebarEvents(el.querySelector('#courseCardList'));
  bindMainEvents(el.querySelector('#courseMain'));

  el.querySelector('[data-action="go-import"]')?.addEventListener('click', () => {
    import('../../app.js').then(({ navigate }) => navigate('import'));
  });
}

function bindSidebarEvents(container) {
  if (!container) return;
  container.querySelectorAll('.course-card[data-course-id]').forEach(card => {
    card.addEventListener('click', () => {
      activeCourseId = card.dataset.courseId;
      refreshSidebar();
      refreshCourseMain();
    });
  });
}

function bindMainEvents(container) {
  if (!container) return;

  // Week block toggle
  container.querySelectorAll('.week-summary').forEach(summary => {
    summary.addEventListener('click', () => {
      summary.closest('.week-block').classList.toggle('open');
    });
  });

  // Watch / open lesson
  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="watch"]');
    if (btn) {
      const lessonId = btn.dataset.lessonId;
      const lesson   = findLesson(lessonId);
      if (lesson) openVideoModal(lesson);
      return;
    }

    // Click on video row (anywhere)
    const row = e.target.closest('.video-row[data-lesson-id]');
    if (row && !e.target.closest('button')) {
      const lesson = findLesson(row.dataset.lessonId);
      if (lesson) openVideoModal(lesson);
    }

    // Delete course
    const del = e.target.closest('[data-action="delete-course"]');
    if (del) {
      const id = del.dataset.courseId;
      if (confirm('Delete this course and all its lessons? This cannot be undone.')) {
        deleteCourse(id);
        activeCourseId = null;
        render();
      }
    }
  });
}

function findLesson(lessonId) {
  const courses = getCourses();
  for (const c of courses) {
    const found = getAllLessonsForCourse(c.id).find(l => l.id === lessonId);
    if (found) return found;
  }
  return null;
}

// ─── Bus wiring ───────────────────────────────────────────────────

bus.on('navigate', page => {
  if (page === 'courses') render();
});

bus.on('selectCourse', id => {
  activeCourseId = id;
  const page = document.getElementById('pageCourses');
  if (page?.classList.contains('active')) {
    refreshSidebar();
    refreshCourseMain();
  }
});

bus.on('lessonComplete', () => {
  const page = document.getElementById('pageCourses');
  if (page?.classList.contains('active')) {
    refreshSidebar();
    refreshCourseMain();
  }
});

bus.on('contentChanged', () => { if (document.getElementById('pageCourses')?.classList.contains('active')) render(); });
