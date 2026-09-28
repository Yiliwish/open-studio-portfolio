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
const projectTabs = $('#project-tabs');
const mediaStage = $('#media-stage');
const mediaGallery = $('#media-gallery');

let studio = null;
let activeWorkId = null;
let toastTimer = null;
let previousWorkTrigger = null;
let selectionRevision = 0;
let browsingState = 'overview';
let activePartIndex = 0;
let activeMediaIndex = 0;
let mediaRevision = 0;
let activeModelViewer = null;

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
  clearMediaStage();
  browsingState = 'focusing';
  hideTooltip();
  setActive(id);
  status.textContent = `正在靠近：${work.title}`;
  const index = works.indexOf(work) + 1;
  $('#work-number').textContent = `作品 ${String(index).padStart(2, '0')} / ${String(works.length).padStart(2, '0')}`;
  const motion = studio?.focusWork(id);
  const moved = motion && typeof motion.then === 'function' ? await motion : true;
  if (!moved || revision !== selectionRevision || activeWorkId !== id) return false;
  renderWork(work, index);
  browsingState = 'details';
  status.textContent = `正在查看：${work.title}`;
  if (!dialog.open) dialog.showModal();
  return true;
}

function closeWork({ overview = false } = {}) {
  const revision = ++selectionRevision;
  browsingState = 'returning';
  clearMediaStage();
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

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderWork(work, index) {
  activePartIndex = 0;
  dialog.classList.toggle('resume-view', work.id === 'computer');
  $('#work-index').textContent = String(index).padStart(2, '0');
  renderProjectPart(work);
}

function renderProjectPart(work) {
  clearMediaStage();
  const part = work.parts[Math.min(activePartIndex, work.parts.length - 1)];
  const partIndex = Math.min(activePartIndex, work.parts.length - 1);
  activePartIndex = partIndex;

  projectTabs.replaceChildren();
  projectTabs.hidden = work.parts.length < 2;
  if (work.parts.length > 1) {
    work.parts.forEach((entry, index) => {
      const tab = makeElement('button', 'project-tab', entry.label);
      tab.type = 'button';
      tab.setAttribute('aria-pressed', String(index === partIndex));
      tab.addEventListener('click', () => {
        activePartIndex = index;
        renderProjectPart(work);
      });
      projectTabs.append(tab);
    });
  }

  $('#work-category').textContent = `${work.category}  /  ${part.label}`;
  $('#work-title').textContent = part.title;
  $('#work-description').textContent = part.intro || work.description;

  const stages = $('#work-stages');
  stages.replaceChildren();
  part.steps.forEach((step, index) => {
    const row = makeElement('div', 'process-step');
    const number = makeElement('span', 'process-number', String(index + 1).padStart(2, '0'));
    const copy = makeElement('div', 'process-copy');
    copy.append(makeElement('strong', '', step.title), makeElement('p', '', step.text));
    row.append(number, copy);
    stages.append(row);
  });

  const tags = $('#work-tags');
  tags.replaceChildren();
  part.tags.forEach((tag) => tags.append(makeElement('span', 'work-tag', tag)));

  const note = $('#work-note');
  note.textContent = part.note || '';
  note.hidden = !part.note;

  const actions = $('#work-actions');
  actions.replaceChildren();
  part.actions.forEach((action) => {
    const link = makeElement('a', `work-action${action.download ? ' download-action' : ''}`);
    link.href = action.href;
    link.textContent = action.label;
    if (action.download) link.setAttribute('download', '');
    if (action.external) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.append(makeElement('span', 'action-arrow', '↗'));
      link.title = action.note || action.label;
    }
    actions.append(link);
  });
  actions.hidden = part.actions.length === 0;

  $('#detail-hint').textContent = part.media.length > 1 ? '选择下方预览切换图片、视频或模型' : '滚动阅读项目内容';
  activeMediaIndex = 0;
  renderMediaGallery(part.media);
  renderMedia(part.media[activeMediaIndex]);
}

function renderMediaGallery(media) {
  mediaGallery.replaceChildren();
  media.forEach((item, index) => {
    const button = makeElement('button', 'media-thumb');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(index === activeMediaIndex));
    button.setAttribute('aria-label', `查看${item.label}`);
    if (item.type === 'image' || item.type === 'video') {
      const image = makeElement('img', 'thumb-image');
      image.src = item.type === 'video' ? item.poster : item.src;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      button.append(image);
    } else {
      button.append(makeElement('span', `thumb-icon ${item.type}-icon`, item.type === 'model' ? '3D' : item.type === 'pdf' ? 'PDF' : '流程'));
    }
    const caption = makeElement('span', 'thumb-label', item.label);
    button.append(caption);
    button.addEventListener('click', () => {
      activeMediaIndex = index;
      for (const [position, thumb] of [...mediaGallery.children].entries()) {
        const selected = position === index;
        thumb.setAttribute('aria-pressed', String(selected));
      }
      renderMedia(item);
    });
    mediaGallery.append(button);
  });
}

function clearMediaStage() {
  mediaRevision += 1;
  for (const video of mediaStage.querySelectorAll('video')) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  if (activeModelViewer) {
    activeModelViewer.dispose();
    activeModelViewer = null;
  }
  mediaStage.replaceChildren();
}

function renderMedia(item) {
  clearMediaStage();
  mediaStage.setAttribute('aria-label', item.alt || item.label);

  if (item.type === 'image') {
    const image = makeElement('img', 'stage-image');
    image.src = item.src;
    image.alt = item.alt || item.label;
    image.decoding = 'async';
    image.fetchPriority = 'high';
    mediaStage.append(image, makeElement('span', 'stage-caption', item.label));
    return;
  }

  if (item.type === 'video') {
    const preview = makeElement('button', 'video-preview');
    preview.type = 'button';
    preview.setAttribute('aria-label', `播放：${item.label}`);
    const poster = makeElement('img', 'stage-image');
    poster.src = item.poster;
    poster.alt = '';
    poster.decoding = 'async';
    preview.append(poster, makeElement('span', 'play-mark', '▶'), makeElement('span', 'video-label', item.label));
    preview.addEventListener('click', async () => {
      const video = makeElement('video', 'stage-video');
      video.controls = true;
      video.playsInline = true;
      video.preload = 'none';
      video.poster = item.poster;
      video.setAttribute('aria-label', item.alt || item.label);
      video.src = item.src;
      mediaStage.replaceChildren(video);
      video.load();
      try { await video.play(); } catch { showToast('视频已就绪，点击播放器继续播放。'); }
    }, { once: true });
    mediaStage.append(preview);
    return;
  }

  if (item.type === 'pdf') {
    const frame = makeElement('iframe', 'stage-pdf');
    frame.src = `${item.src}#view=FitH&toolbar=0`;
    frame.title = item.alt || item.label;
    frame.loading = 'lazy';
    mediaStage.append(frame);
    return;
  }

  if (item.type === 'model') {
    const canvas = makeElement('canvas', 'stage-model');
    canvas.setAttribute('aria-label', item.alt || item.label);
    mediaStage.append(canvas, makeElement('span', 'stage-caption', '拖动旋转 · 滚轮缩放'));
    mountStlViewer(canvas, item);
    return;
  }

  if (item.type === 'workflow') {
    const workflow = makeElement('div', 'workflow-art');
    workflow.append(makeElement('span', 'workflow-kicker', 'MANJU / AI CONTENT WORKFLOW'));
    workflow.append(makeElement('h2', 'workflow-title', '从故事原文到漫剧成片'));
    const steps = makeElement('ol', 'workflow-steps');
    item.stages.forEach((stage, index) => {
      const row = makeElement('li', 'workflow-node');
      row.append(makeElement('span', 'workflow-node-number', String(index + 1).padStart(2, '0')));
      row.append(makeElement('strong', '', stage));
      steps.append(row);
    });
    workflow.append(steps, makeElement('span', 'workflow-foot', '文本 · 角色 · 场景 · 分镜 · 合成'));
    mediaStage.append(workflow);
  }
}

async function mountStlViewer(canvas, item) {
  const revision = mediaRevision;
  const viewer = { frame: 0, observer: null, controls: null, renderer: null };
  activeModelViewer = viewer;
  const dispose = () => {
    cancelAnimationFrame(viewer.frame);
    viewer.observer?.disconnect();
    viewer.controls?.dispose();
    viewer.renderer?.dispose();
  };
  viewer.dispose = dispose;

  try {
    const [THREE, { STLLoader }, { OrbitControls }] = await Promise.all([
      import('three').then((module) => module),
      import('three/addons/loaders/STLLoader.js'),
      import('three/addons/controls/OrbitControls.js'),
    ]);
    if (revision !== mediaRevision || !canvas.isConnected) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor('#e7e4dc', 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    viewer.renderer = renderer;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
    camera.position.set(3, 2.3, 3.5);
    scene.add(new THREE.HemisphereLight('#fffdf6', '#908b7f', 2.1));
    const key = new THREE.DirectionalLight('#fff7e8', 2.3);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight('#d6e5f2', 1.1);
    fill.position.set(-4, 2, -3);
    scene.add(fill);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.minDistance = 2.2;
    controls.maxDistance = 9;
    controls.enablePan = false;
    controls.target.set(0, 0, 0);
    viewer.controls = controls;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
    };
    viewer.observer = new ResizeObserver(resize);
    viewer.observer.observe(canvas);
    resize();

    new STLLoader().load(item.src, (geometry) => {
      if (revision !== mediaRevision || !canvas.isConnected) {
        geometry.dispose();
        dispose();
        return;
      }
      // Blender's STL export uses Z-up; Three.js viewers use Y-up.
      geometry.rotateX(-Math.PI / 2);
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      const center = geometry.boundingBox.getCenter(new THREE.Vector3());
      const size = geometry.boundingBox.getSize(new THREE.Vector3());
      geometry.translate(-center.x, -center.y, -center.z);
      const scale = 2.35 / Math.max(size.x, size.y, size.z, 0.001);
      geometry.scale(scale, scale, scale);
      geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({ color: '#b1a17e', roughness: 0.72, metalness: 0.08 });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      camera.position.set(2.6, 1.8, 3.6);
      controls.target.set(0, 0, 0);
      controls.update();
    }, undefined, () => showToast('3D 模型暂时无法载入，可继续浏览打印预览图。'));

    const draw = () => {
      if (revision !== mediaRevision) return;
      viewer.frame = requestAnimationFrame(draw);
      controls.update();
      renderer.render(scene, camera);
    };
    draw();
  } catch (error) {
    console.error('Unable to load the printable model viewer.', error);
    if (revision === mediaRevision) showToast('3D 模型暂时无法载入，可继续浏览打印预览图。');
  }
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
