// main.js — bootstrap: load the data, wire the toolbar/tabs, keep the views in sync.

import { loadGuideData } from './data.js';
import { createTracker, downloadProgress } from './tracker.js';
import { createFilterState } from './filters.js';
import { renderProgress, renderChips, renderList, renderDetail, renderRoadmap, renderMissables } from './render.js';

const VIEWS = ['trophies', 'roadmap', 'missables', 'about'];

async function boot() {
  const { trophies, byId, roadmap } = await loadGuideData();
  const tracker = createTracker(trophies.map((t) => t.id));
  const state = createFilterState();
  let selectedId = trophies[0]?.id ?? null;
  let view = 'trophies';

  const nodes = {
    progress: document.getElementById('progress'),
    chips: document.getElementById('kind-chips'),
    list: document.getElementById('trophy-list'),
    head: document.getElementById('list-head'),
    detail: document.getElementById('trophy-detail'),
    roadmap: document.getElementById('view-roadmap'),
    missables: document.getElementById('view-missables'),
    search: document.getElementById('search'),
    grade: document.getElementById('grade-filter'),
    spoiler: document.getElementById('spoiler-toggle'),
    hideEarned: document.getElementById('hide-earned'),
    exportBtn: document.getElementById('export-btn'),
    importBtn: document.getElementById('import-btn'),
    importFile: document.getElementById('import-file'),
    resetBtn: document.getElementById('reset-btn'),
    tabs: document.getElementById('tabs'),
  };
  nodes.spoiler.checked = tracker.spoiler;

  function renderTrophiesView() {
    renderProgress(nodes.progress, trophies, tracker);
    renderChips(nodes.chips, trophies, state, tracker, tracker.spoiler, (kind) => {
      state.kind = kind;
      renderTrophiesView();
    });
    renderList(nodes.list, nodes.head, trophies, state, tracker, tracker.spoiler, selectedId, selectTrophy, toggleEarned);
    renderDetail(nodes.detail, byId.get(selectedId) ?? null, tracker, tracker.spoiler, toggleEarned);
  }

  function renderAll() {
    renderTrophiesView();
    renderRoadmap(nodes.roadmap, roadmap, byId, tracker, tracker.spoiler, jumpToTrophy);
    renderMissables(nodes.missables, trophies, roadmap, tracker, tracker.spoiler, jumpToTrophy);
  }

  function selectTrophy(id) {
    selectedId = id;
    renderTrophiesView();
  }

  function toggleEarned(id) {
    tracker.toggle(id);
    renderAll();
  }

  function jumpToTrophy(id) {
    selectedId = id;
    state.kind = 'all';
    state.query = '';
    nodes.search.value = '';
    location.hash = `#trophies/${id}`;
    switchView('trophies');
    renderAll();
    const row = nodes.list.querySelector('.trow.selected');
    if (row) row.scrollIntoView({ block: 'nearest' });
  }

  function switchView(name) {
    view = VIEWS.includes(name) ? name : 'trophies';
    for (const v of VIEWS) {
      document.getElementById(`view-${v}`).hidden = v !== view;
    }
    for (const button of nodes.tabs.querySelectorAll('button')) {
      button.classList.toggle('active', button.dataset.view === view);
    }
    window.scrollTo(0, 0);
  }

  function applyHash() {
    const hash = location.hash.replace(/^#/, '');
    const [name, idPart] = hash.split('/');
    if (name && VIEWS.includes(name)) switchView(name);
    const id = Number(idPart);
    if (id && byId.has(id)) {
      selectedId = id;
      renderTrophiesView();
    }
  }

  nodes.tabs.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-view]');
    if (!button) return;
    location.hash = `#${button.dataset.view}`;
    switchView(button.dataset.view);
  });
  window.addEventListener('hashchange', applyHash);

  nodes.search.addEventListener('input', () => {
    state.query = nodes.search.value;
    renderTrophiesView();
  });
  nodes.grade.addEventListener('change', () => {
    state.grade = nodes.grade.value;
    renderTrophiesView();
  });
  nodes.spoiler.addEventListener('change', () => {
    tracker.setSpoiler(nodes.spoiler.checked);
    renderAll();
  });
  nodes.hideEarned.addEventListener('change', () => {
    state.hideEarned = nodes.hideEarned.checked;
    renderTrophiesView();
  });

  nodes.exportBtn.addEventListener('click', () => downloadProgress(tracker.exportDoc()));
  nodes.importBtn.addEventListener('click', () => nodes.importFile.click());
  nodes.importFile.addEventListener('change', async () => {
    const file = nodes.importFile.files?.[0];
    nodes.importFile.value = '';
    if (!file) return;
    try {
      const restored = tracker.importDoc(JSON.parse(await file.text()));
      nodes.spoiler.checked = tracker.spoiler;
      renderAll();
      nodes.head.textContent = `Imported ${restored} earned marks from ${file.name}.`;
    } catch (err) {
      nodes.head.textContent = `Import failed: ${err.message}`;
    }
  });
  nodes.resetBtn.addEventListener('click', () => {
    if (!window.confirm('Clear all earned marks? Export first if you want a backup.')) return;
    tracker.reset();
    renderAll();
  });

  applyHash();
  renderAll();
  document.body.dataset.ready = 'true';
}

boot().catch((err) => {
  const main = document.querySelector('main');
  main.textContent = `The guide could not start: ${err.message}`;
});