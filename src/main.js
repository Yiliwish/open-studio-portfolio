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
const sceneLabels = $('#scene-work-labels');
const toast = $('#toast');
const status = $('#scene-status');
const tooltip = $('#work-tooltip');
const tooltipNumber = $('#work-tooltip-number');
const tooltipTitle = $('#work-tooltip-title');
const resumeLightbox = $('#resume-lightbox');
const resumeLightboxPages = $('#resume-lightbox-pages');
const projectTabs = $('#project-tabs');
const mediaStage = $('#media-stage');
const mediaGallery = $('#media-gallery');
const themeToggle = $('#theme-toggle');
const themeLabel = $('#scene-lighting-label');
const THEME_STORAGE_KEY = 'open-studio-theme';

function readSavedTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'night' ? 'night' : 'day';
  } catch {
    return 'day';
  }
}

let activeTheme = readSavedTheme();

function syncThemeUI(theme) {
  const isNight = theme === 'night';
  document.documentElement.dataset.theme = isNight ? 'night' : 'day';
  themeToggle.setAttribute('aria-pressed', String(isNight));
  const nextLabel = isNight ? '切换到日间模式' : '切换到夜间模式';
  themeToggle.setAttribute('aria-label', nextLabel);
  themeToggle.title = nextLabel;
  themeLabel.textContent = isNight ? '夜色 · 暖光工作室' : '晴日 · 自然光';
  $('meta[name="theme-color"]').content = isNight ? '#172536' : '#e8e8dc';
}

function setPortfolioTheme(theme) {
  activeTheme = theme === 'night' ? 'night' : 'day';
  syncThemeUI(activeTheme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, activeTheme);
  } catch {
    // The current session still follows the selected theme when storage is unavailable.
  }
  studio?.setTheme(activeTheme);
}

syncThemeUI(activeTheme);

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
const labelButtons = new Map();
const compactNames = { printer: '3D 打印', 'game-board': '游戏 Demo', computer: '个人简历', video: '视频 / 漫剧', architecture: '建筑项目' };

function highlightWork(id) {
  for (const chip of list.querySelectorAll('.work-chip')) chip.classList.toggle('hovered', chip.dataset.workId === id);
  for (const button of labelButtons.values()) button.classList.toggle('hovered', button.dataset.workId === id);
}

function setLabelMode(mode) {
  sceneLabels.dataset.mode = mode;
  sceneLabels.inert = mode !== 'overview';
}

function createSceneLabels(workRoots) {
  for (const [index, work] of works.entries()) {
    if (!workRoots.has(work.id)) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'scene-work-label';
    button.dataset.workId = work.id;
    button.setAttribute('aria-label', `查看作品 ${String(index + 1).padStart(2, '0')}：${work.title}`);
    button.innerHTML = `<span class="scene-work-index">${String(index + 1).padStart(2, '0')}</span><span class="scene-work-name">${compactNames[work.id]}</span>`;
    button.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'touch' || browsingState !== 'overview') return;
      studio?.setHoveredWork(work.id);
      highlightWork(work.id);
      hideTooltip();
    });
    button.addEventListener('pointerleave', () => {
      if (browsingState !== 'overview') return;
      studio?.setHoveredWork(null);
      highlightWork(null);
    });
    button.addEventListener('focus', () => {
      if (browsingState !== 'overview') return;
      studio?.setHoveredWork(work.id);
      highlightWork(work.id);
    });
    button.addEventListener('blur', () => {
      studio?.setHoveredWork(null);
      highlightWork(null);
    });
    button.addEventListener('click', () => openWork(work.id, button));
    labelButtons.set(work.id, button);
    sceneLabels.append(button);
  }
  sceneLabels.hidden = false;
  setLabelMode('overview');
}

function updateSceneLabels(points) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const compact = width <= 760;
  const labelWidth = compact ? 44 : 108;
  const labelHeight = compact ? 44 : 34;
  const visible = points.filter((point) => point.visible && point.y >= 72 && point.y <= height - 90 && labelButtons.has(point.id)).sort((a, b) => a.x - b.x);
  for (const point of points) {
    const button = labelButtons.get(point.id);
    if (button) button.hidden = !visible.includes(point);
  }
  if (!visible.length) return;
  const gap = compact ? 8 : 7;
  const placed = visible.map((point, index) => ({
    point,
    x: index === 0 ? point.x : 0,
  }));
  for (let index = 1; index < placed.length; index += 1) {
    placed[index].x = Math.max(placed[index].point.x, placed[index - 1].x + labelWidth + gap);
  }
  const anchorCenter = visible.reduce((sum, point) => sum + point.x, 0) / visible.length;
  const placedCenter = placed.reduce((sum, entry) => sum + entry.x, 0) / placed.length;
  const leftEdge = placed[0].x - labelWidth / 2 + anchorCenter - placedCenter;
  const rightEdge = placed.at(-1).x + labelWidth / 2 + anchorCenter - placedCenter;
  const shift = anchorCenter - placedCenter + Math.max(0, 10 - leftEdge) - Math.max(0, rightEdge - width + 10);
  const lowestAnchor = Math.max(...visible.map((point) => point.y));
  const below = lowestAnchor + 84 < height - 146;
  const rowBottom = below ? lowestAnchor + 84 : Math.max(112, Math.min(height - 146, Math.min(...visible.map((point) => point.y)) - 8));
  for (const { point, x: rawX } of placed) {
    const button = labelButtons.get(point.id);
    const x = rawX + shift;
    const bottom = below ? rowBottom : Math.min(rowBottom, point.y - 8);
    const dx = point.x - x;
    const dy = below ? bottom - labelHeight - point.y : point.y - bottom;
    button.classList.toggle('is-below', below);
    button.style.left = `${x}px`;
    button.style.top = `${bottom}px`;
    button.style.setProperty('--leader-length', `${Math.max(8, Math.hypot(dx, dy) - 4)}px`);
    button.style.setProperty('--leader-angle', `${Math.atan2(dx, dy)}rad`);
  }
}

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
  for (const button of labelButtons.values()) button.classList.toggle('active', button.dataset.workId === id);
  const work = works.find((entry) => entry.id === id);
  status.textContent = work ? `已选中：${work.title}` : '小幅拖动改变视角；点击桌面标签或模型浏览作品';
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
  setLabelMode('focusing');
  hideTooltip();
  studio?.setHoveredWork(null);
  highlightWork(null);
  setActive(id);
  status.textContent = `正在靠近：${work.title}`;
  const index = works.indexOf(work) + 1;
  $('#work-number').textContent = `作品 ${String(index).padStart(2, '0')} / ${String(works.length).padStart(2, '0')}`;
  const motion = studio?.focusWork(id);
  const moved = motion && typeof motion.then === 'function' ? await motion : true;
  if (!moved || revision !== selectionRevision || activeWorkId !== id) return false;
  renderWork(work, index);
  browsingState = 'details';
  setLabelMode('details');
  status.textContent = `正在查看：${work.title}`;
  if (!dialog.open) dialog.showModal();
  return true;
}

function closeWork({ overview = false } = {}) {
  const revision = ++selectionRevision;
  browsingState = 'returning';
  setLabelMode('returning');
  if (resumeLightbox.open) resumeLightbox.close();
  clearMediaStage();
  if (dialog.open) dialog.close();
  hideTooltip();
  setActive(null);
  const motion = overview ? studio?.returnToOverview() : studio?.restoreView();
  return Promise.resolve(motion).then((completed) => {
    if (revision !== selectionRevision || completed === false) return;
    browsingState = 'overview';
    setLabelMode('overview');
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
    if (item.type === 'image' || item.type === 'video' || (item.type === 'model' && item.poster)) {
      const image = makeElement('img', 'thumb-image');
      image.src = item.type === 'image' ? item.src : item.poster;
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
    if (dialog.classList.contains('resume-view')) {
      const trigger = makeElement('button', 'resume-zoom-trigger');
      trigger.type = 'button';
      trigger.setAttribute('aria-label', '点击放大查看简历');
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.append(image, makeElement('span', 'stage-caption', '点击放大查看'));
      trigger.addEventListener('click', () => {
        const pages = item.pages || [item.src];
        resumeLightboxPages.replaceChildren(...pages.map((src, index) => {
          const page = makeElement('img', 'resume-lightbox-image');
          page.src = src;
          page.alt = `${item.alt || item.label}（第 ${index + 1} 页）`;
          page.decoding = 'async';
          return page;
        }));
        if (!resumeLightbox.open) resumeLightbox.showModal();
      });
      mediaStage.append(trigger);
      return;
    }
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
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', `${item.alt || item.label}；拖动旋转，滚轮缩放；方向键旋转，加减号缩放`);
    const status = makeElement('span', 'model-status', '正在载入 3D 模型…');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    mediaStage.append(canvas, status, makeElement('span', 'stage-caption', '拖动旋转 · 滚轮缩放'));
    mountModelViewer(canvas, item, status);
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

async function mountModelViewer(canvas, item, status) {
  const revision = mediaRevision;
  const isGlb = item.src.toLowerCase().endsWith('.glb');
  const showModelError = () => {
    if (status.isConnected) {
      status.textContent = '模型暂时无法载入，请切换其他预览。';
      status.classList.add('is-error');
    }
    showToast('3D 模型暂时无法载入，可继续浏览其他图片。');
  };
  const viewer = { frame: 0, observer: null, controls: null, renderer: null, dracoLoader: null, model: null };
  activeModelViewer = viewer;
  const disposeModel = (object) => {
    object?.traverse((node) => {
      node.geometry?.dispose();
      for (const material of [node.material].flat().filter(Boolean)) {
        for (const value of Object.values(material)) {
          if (value?.isTexture) value.dispose();
        }
        material.dispose();
      }
    });
  };
  const dispose = () => {
    cancelAnimationFrame(viewer.frame);
    viewer.observer?.disconnect();
    viewer.controls?.dispose();
    viewer.dracoLoader?.dispose();
    disposeModel(viewer.model);
    viewer.renderer?.dispose();
  };
  viewer.dispose = dispose;

  try {
    const [THREE, { OrbitControls }, loaderModule, dracoModule] = await Promise.all([
      import('three').then((module) => module),
      import('three/addons/controls/OrbitControls.js'),
      isGlb ? import('three/addons/loaders/GLTFLoader.js') : import('three/addons/loaders/STLLoader.js'),
      isGlb ? import('three/addons/loaders/DRACOLoader.js') : Promise.resolve(null),
    ]);
    if (revision !== mediaRevision || !canvas.isConnected) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor('#e7e4dc', 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (isGlb) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
    }
    viewer.renderer = renderer;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
    scene.add(new THREE.HemisphereLight('#fffdf6', '#908b7f', isGlb ? 1.5 : 2.1));
    const key = new THREE.DirectionalLight('#fff7e8', isGlb ? 1.8 : 2.3);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight('#d6e5f2', isGlb ? 0.7 : 1.1);
    fill.position.set(-4, 2, -3);
    scene.add(fill);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.minDistance = 0.5;
    controls.maxDistance = 40;
    controls.enablePan = false;
    controls.target.set(0, 0, 0);
    viewer.controls = controls;
    canvas.addEventListener('keydown', (event) => {
      const rotation = { ArrowLeft: -0.14, ArrowRight: 0.14, ArrowUp: -0.14, ArrowDown: 0.14 };
      const zoom = event.key === '+' || event.key === '=' ? 0.9 : event.key === '-' ? 1.1 : null;
      if (!(event.key in rotation) && zoom === null) return;
      event.preventDefault();
      const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') spherical.theta += rotation[event.key];
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') spherical.phi = THREE.MathUtils.clamp(spherical.phi + rotation[event.key], 0.08, Math.PI - 0.08);
      if (zoom !== null) spherical.radius = THREE.MathUtils.clamp(spherical.radius * zoom, controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
      controls.update();
    });

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

    const loader = isGlb ? new loaderModule.GLTFLoader() : new loaderModule.STLLoader();
    if (isGlb && dracoModule) {
      const dracoLoader = new dracoModule.DRACOLoader();
      dracoLoader.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
      loader.setDRACOLoader(dracoLoader);
      viewer.dracoLoader = dracoLoader;
    }
    let lastProgress = -10;
    loader.load(item.src, (loaded) => {
      const content = isGlb ? loaded.scene : new THREE.Mesh(
        loaded,
        new THREE.MeshStandardMaterial({ color: '#b1a17e', roughness: 0.72, metalness: 0.08 }),
      );
      if (revision !== mediaRevision || !canvas.isConnected) {
        disposeModel(content);
        dispose();
        return;
      }
      if (!isGlb) {
        // Blender's STL export uses Z-up; Three.js viewers use Y-up.
        loaded.rotateX(-Math.PI / 2);
        loaded.computeVertexNormals();
      }
      const bounds = new THREE.Box3().setFromObject(content);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = (isGlb ? 3 : 2.5) / Math.max(size.x, size.y, size.z, 0.001);
      const sourceCamera = isGlb ? loaded.cameras?.[0] : null;
      const model = new THREE.Group();
      model.add(content);
      model.scale.setScalar(scale);
      model.position.copy(center).multiplyScalar(-scale);
      scene.add(model);
      viewer.model = model;
      model.updateMatrixWorld(true);
      controls.target.set(0, 0, 0);
      const normalizedSize = size.multiplyScalar(scale);
      const radius = normalizedSize.length() * 0.5;
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov * 0.5) * Math.max(camera.aspect, 0.1));
      const limitingFov = Math.min(verticalFov, horizontalFov);
      const distance = (radius / Math.sin(limitingFov * 0.5)) * 1.16;
      camera.near = Math.max(distance / 1000, 0.001);
      camera.far = Math.max(distance * 40, 100);
      const viewDirection = sourceCamera?.getWorldDirection(new THREE.Vector3()).normalize()
        ?? new THREE.Vector3(-0.55, -0.34, -0.76).normalize();
      camera.position.copy(viewDirection).multiplyScalar(-distance);
      camera.updateProjectionMatrix();
      controls.minDistance = Math.max(radius * 0.65, 0.08);
      controls.maxDistance = Math.max(distance * 3, controls.minDistance * 4);
      controls.update();
      status.remove();
    }, (event) => {
      if (event.lengthComputable && status.isConnected) {
        const progress = Math.round((event.loaded / event.total) * 100);
        if (progress >= lastProgress + 10 || progress === 100) {
          lastProgress = progress;
          status.textContent = `正在载入 3D 模型 ${progress}%`;
        }
      }
    }, showModelError);

    const draw = () => {
      if (revision !== mediaRevision) return;
      viewer.frame = requestAnimationFrame(draw);
      controls.update();
      renderer.render(scene, camera);
    };
    draw();
  } catch (error) {
    console.error('Unable to load the model viewer.', error);
    if (revision === mediaRevision) showModelError();
  }
}

$('#close-work').addEventListener('click', () => closeWork());
$('#close-resume-lightbox').addEventListener('click', () => resumeLightbox.close());
resumeLightbox.addEventListener('close', () => resumeLightboxPages.replaceChildren());
$('#reset-view').addEventListener('click', () => {
  previousWorkTrigger = $('#reset-view');
  closeWork({ overview: true });
});
themeToggle.addEventListener('click', () => setPortfolioTheme(activeTheme === 'night' ? 'day' : 'night'));
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
  initialTheme: activeTheme,
  onProgress(percent) {
    loadingTitle.textContent = '正在载入工作室';
    loadingDetail.textContent = '读取模型与材质';
    updateLoadProgress(percent);
  },
  onLoaded({ workRoots }) {
    studio = controller;
    createSceneLabels(workRoots);
    studio.setLabelUpdateHandler(updateSceneLabels);
    loading.classList.add('loaded');
    $('#scene-poster').classList.add('hidden');
    document.documentElement.classList.add('scene-ready');
    updateLoadProgress(100);
    status.textContent = '小幅拖动改变视角；点击桌面标签或模型浏览作品';
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
    highlightWork(id);
    if (labelButtons.size) {
      hideTooltip();
      return;
    }
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
