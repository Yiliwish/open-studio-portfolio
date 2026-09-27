import './styles.css';
import { works } from './portfolio.js';
import { createStudio } from './scene.js';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#studio-canvas');
const loading = $('#loading');
const loadingTitle = $('#loading-title');
const loadingDetail = $('#loading-detail');
const loadingBar = $('#loading-bar');
const loadingPercent = $('#loading-percent');
const dialog = $('#work-dialog');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const list = $('#work-list');
const toast = $('#toast');
const status = $('#scene-status');

let studio = null;
let activeWorkId = null;
let toastTimer = null;
let previousWorkTrigger = null;

works.forEach((work, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'work-chip';
  button.dataset.workId = work.id;
  button.setAttribute('aria-label', `查看作品 ${String(index + 1).padStart(2, '0')}：${work.title}`);
  button.innerHTML = `<span class="chip-index">${String(index + 1).padStart(2, '0')}</span><span class="chip-name">${work.name}</span><span class="chip-arrow" aria-hidden="true">↗</span>`;
  button.addEventListener('click', () => openWork(work.id, button));
  list.append(button);
});

function updateLoadProgress(percent) {
  loadingBar.style.width = `${percent}%`;
  loadingPercent.textContent = `${percent}%`;
  $('#loading').setAttribute('aria-valuenow', String(percent));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3000);
}

function setActive(id) {
  activeWorkId = id;
  for (const chip of list.querySelectorAll('.work-chip')) {
    const selected = chip.dataset.workId === id;
    chip.classList.toggle('active', selected);
    chip.setAttribute('aria-pressed', String(selected));
  }
  const work = works.find((entry) => entry.id === id);
  status.textContent = work ? `已选中：${work.title}` : '拖动旋转工作室，点击桌面模型查看作品';
}

function openWork(id, trigger = canvas) {
  const work = works.find((entry) => entry.id === id);
  if (!work) return;
  if (!dialog.open) {
    previousWorkTrigger = trigger || canvas;
    studio?.saveView();
    if (!dialog.open) dialog.showModal();
  }
  setActive(id);
  const index = works.indexOf(work) + 1;
  $('#work-title').textContent = work.title;
  $('#work-category').textContent = work.category;
  $('#work-description').textContent = work.description;
  $('#work-index').textContent = String(index).padStart(2, '0');
  $('#work-number').textContent = `作品 ${String(index).padStart(2, '0')} / ${String(works.length).padStart(2, '0')}`;
  studio?.focusWork(id);
}

function closeWork({ overview = false } = {}) {
  if (dialog.open) dialog.close();
  if (overview) studio?.returnToOverview();
  else if (studio?.restoreView) studio.restoreView();
  if (previousWorkTrigger?.isConnected) {
    window.setTimeout(() => previousWorkTrigger.focus({ preventScroll: true }), reducedMotion ? 0 : 740);
  }
}

$('#close-work').addEventListener('click', () => closeWork());
$('#reset-view').addEventListener('click', () => {
  if (dialog.open) dialog.close();
  studio?.returnToOverview();
  setActive(null);
});
dialog.addEventListener('cancel', () => {
  if (studio) studio.restoreView();
});
dialog.addEventListener('close', () => setActive(null));

function stepWork(direction) {
  const current = works.findIndex((work) => work.id === activeWorkId);
  const next = (current + direction + works.length) % works.length;
  openWork(works[next].id, direction > 0 ? $('#next-work') : $('#previous-work'));
}

$('#previous-work').addEventListener('click', () => stepWork(-1));
$('#next-work').addEventListener('click', () => stepWork(1));
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && dialog.open) {
    event.preventDefault();
    closeWork();
  }
});

const controller = createStudio({
  canvas,
  onProgress(percent) {
    loadingTitle.textContent = '正在载入工作室';
    loadingDetail.textContent = '读取模型与材质';
    updateLoadProgress(percent);
  },
  onLoaded({ workRoots }) {
    studio = controller;
    loading.classList.add('loaded');
    $('#scene-poster').classList.add('hidden');
    document.documentElement.classList.add('scene-ready');
    updateLoadProgress(100);
    status.textContent = '拖动旋转工作室，点击桌面模型查看作品';
    canvas.focus({ preventScroll: true });
    if (workRoots.size < works.length) showToast('工作室已打开，部分桌面模型正在整理。');
    registerWebMcp();
  },
  onError(error) {
    console.error('Studio scene could not be loaded.', error);
    loadingTitle.textContent = '工作室模型暂时无法打开';
    loadingDetail.textContent = '仍可从下方目录浏览作品';
    $('#scene-poster').classList.remove('hidden');
    loading.classList.add('loaded', 'error');
    showToast('3D 场景加载失败，作品目录仍可使用。');
    registerWebMcp();
  },
  onSelect(id, { source }) {
    openWork(id, source === 'canvas' ? canvas : null);
  },
  onHover(id) {
    for (const chip of list.querySelectorAll('.work-chip')) chip.classList.toggle('hovered', chip.dataset.workId === id);
  },
});

function registerWebMcp() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const register = (tool) => {
    try {
      Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch((error) => console.info('WebMCP unavailable.', error));
    } catch (error) {
      console.info('WebMCP unavailable.', error);
    }
  };
  register({
    name: 'list_studio_works',
    title: 'List studio works',
    description: 'List the five models available in the studio portfolio.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: () => ({ works: works.map(({ id, title, category }) => ({ id, title, category })) }),
  });
  register({
    name: 'open_studio_work',
    title: 'Open studio work',
    description: 'Focus the 3D camera on one listed model and open its visible details panel.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', enum: works.map((work) => work.id) } },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async ({ id }) => {
      if (!works.some((work) => work.id === id)) throw new TypeError('Unknown studio work id.');
      openWork(id, canvas);
      await new Promise((resolve) => window.setTimeout(resolve, reducedMotion ? 0 : 760));
      return { opened: activeWorkId === id, id, title: works.find((work) => work.id === id).title };
    },
  });
  register({
    name: 'return_to_studio_overview',
    title: 'Return to studio overview',
    description: 'Close the current work panel and restore the full studio view.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async () => {
      closeWork({ overview: true });
      setActive(null);
      await new Promise((resolve) => window.setTimeout(resolve, reducedMotion ? 0 : 760));
      return { view: 'studio-overview', openWork: null };
    },
  });
}

updateLoadProgress(0);
