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
const list = $('#work-list');
const toast = $('#toast');
const status = $('#scene-status');
const tooltip = $('#work-tooltip');
const tooltipNumber = $('#work-tooltip-number');
const tooltipTitle = $('#work-tooltip-title');

let studio = null;
let activeWorkId = null;
let toastTimer = null;
let previousWorkTrigger = null;
let selectionRevision = 0;
let browsingState = 'overview';

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
  status.textContent = work ? `已选中：${work.title}` : '小幅拖动改变视角；悬停提示，点击模型浏览作品';
}

async function openWork(id, trigger = canvas) {
  const work = works.find((entry) => entry.id === id);
  if (!work || browsingState === 'focusing' || browsingState === 'returning') return false;
  const revision = ++selectionRevision;
  if (browsingState === 'overview') {
    previousWorkTrigger = trigger || canvas;
    studio?.saveView();
  }
  if (dialog.open) dialog.close();
  browsingState = 'focusing';
  hideTooltip();
  setActive(id);
  status.textContent = `正在靠近：${work.title}`;
  const index = works.indexOf(work) + 1;
  $('#work-title').textContent = work.title;
  $('#work-category').textContent = work.category;
  $('#work-description').textContent = work.description;
  $('#work-index').textContent = String(index).padStart(2, '0');
  $('#work-number').textContent = `作品 ${String(index).padStart(2, '0')} / ${String(works.length).padStart(2, '0')}`;
  const motion = studio?.focusWork(id);
  const moved = motion && typeof motion.then === 'function' ? await motion : true;
  if (!moved || revision !== selectionRevision || activeWorkId !== id) return false;
  browsingState = 'details';
  status.textContent = `正在查看：${work.title}`;
  if (!dialog.open) dialog.showModal();
  return true;
}

function closeWork({ overview = false } = {}) {
  const revision = ++selectionRevision;
  browsingState = 'returning';
  if (dialog.open) dialog.close();
  hideTooltip();
  setActive(null);
  const motion = overview ? studio?.returnToOverview() : studio?.restoreView();
  return Promise.resolve(motion).then((completed) => {
    if (revision !== selectionRevision || completed === false) return;
    browsingState = 'overview';
    if (previousWorkTrigger?.isConnected) previousWorkTrigger.focus({ preventScroll: true });
  });
}

$('#close-work').addEventListener('click', () => closeWork());
$('#reset-view').addEventListener('click', () => {
  previousWorkTrigger = $('#reset-view');
  closeWork({ overview: true });
});
dialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeWork();
});

function stepWork(direction) {
  const current = works.findIndex((work) => work.id === activeWorkId);
  const next = (current + direction + works.length) % works.length;
  openWork(works[next].id, direction > 0 ? $('#next-work') : $('#previous-work'));
}

$('#previous-work').addEventListener('click', () => stepWork(-1));
$('#next-work').addEventListener('click', () => stepWork(1));
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
    status.textContent = '小幅拖动改变视角；悬停提示，点击模型浏览作品';
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
  onReset() {
    previousWorkTrigger = canvas;
    closeWork({ overview: true });
  },
  onHover(id, point) {
    for (const chip of list.querySelectorAll('.work-chip')) chip.classList.toggle('hovered', chip.dataset.workId === id);
    const workIndex = works.findIndex((work) => work.id === id);
    if (workIndex < 0 || !point) {
      hideTooltip();
      return;
    }
    const work = works[workIndex];
    tooltipNumber.textContent = String(workIndex + 1).padStart(2, '0');
    tooltipTitle.textContent = work.title;
    const x = Math.max(10, Math.min(point.width - 184, point.x + 14));
    const y = Math.max(76, Math.min(point.height - 144, point.y + 14));
    tooltip.style.setProperty('--tooltip-x', `${x}px`);
    tooltip.style.setProperty('--tooltip-y', `${y}px`);
    tooltip.classList.add('visible');
  },
});

function hideTooltip() {
  tooltip.classList.remove('visible');
}

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
      await openWork(id, canvas);
      return { opened: dialog.open && activeWorkId === id, id, title: works.find((work) => work.id === id).title };
    },
  });
  register({
    name: 'return_to_studio_overview',
    title: 'Return to studio overview',
    description: 'Close the current work panel and restore the full studio view.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async () => {
      await closeWork({ overview: true });
      return { view: 'studio-overview', openWork: null };
    },
  });
}

updateLoadProgress(0);
