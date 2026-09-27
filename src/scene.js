import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

const MODEL_URL = '/models/studio.glb';
const WORK_IDS = new Set(['printer', 'game-board', 'computer', 'video', 'architecture']);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createStudio({ canvas, onLoaded, onProgress, onError, onSelect, onHover, onReset }) {
  const scene = new THREE.Scene();
  const backdrop = new THREE.Color('#bab6b0');
  scene.background = backdrop;
  scene.fog = new THREE.Fog(backdrop, 48, 142);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 700);
  const homePosition = new THREE.Vector3(0, 9.7, 27.5);
  const homeTarget = new THREE.Vector3(0, 3.55, 0);
  camera.position.copy(homePosition);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (error) {
    onError(error);
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  const pixelRatioLimit = () => canvas.clientHeight > canvas.clientWidth ? 1.45 : 1.7;
  const getPixelRatio = () => Math.min(window.devicePixelRatio || 1, pixelRatioLimit());
  renderer.setPixelRatio(getPixelRatio());

  scene.add(new THREE.HemisphereLight(0xf4f8ff, 0x82775e, 2.05));
  const sunlight = new THREE.DirectionalLight(0xffedcf, 1.55);
  sunlight.position.set(-7, 12, 10);
  sunlight.castShadow = false;
  scene.add(sunlight);
  const softFill = new THREE.DirectionalLight(0xf0f4e8, 0.42);
  softFill.position.set(8, 5, 2);
  scene.add(softFill);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(homeTarget);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.rotateSpeed = 0.42;
  controls.zoomSpeed = 0.62;
  controls.minDistance = 13;
  controls.maxDistance = 54;
  controls.minPolarAngle = 1.28;
  controls.maxPolarAngle = 1.48;
  controls.minAzimuthAngle = -0.48;
  controls.maxAzimuthAngle = 0.48;
  controls.update();

  const raycaster = new THREE.Raycaster();
  raycaster.params.Line.threshold = 0.12;
  const pointer = new THREE.Vector2();
  const interactive = [];
  const workRoots = new Map();
  const workBaseY = new Map();
  const workLift = new Map();
  let viewChangeHandler = null;
  let composer = null;
  let outlinePass = null;
  let animationFrame = 0;
  let hoverFrame = 0;
  let hoveredWorkId = null;
  let lastHoverFrameAt = 0;
  let pressed = null;
  let activeMotion = false;
  let rememberedView = null;
  let motionResolve = null;

  const render = () => composer.render();

  function prepareOutlinePass() {
    if (composer) return;
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(canvas.clientWidth, canvas.clientHeight);
    composer.addPass(new RenderPass(scene, camera));
    outlinePass = new OutlinePass(new THREE.Vector2(canvas.clientWidth, canvas.clientHeight), scene, camera);
    outlinePass.visibleEdgeColor.set('#fff0c5');
    outlinePass.hiddenEdgeColor.setRGB(0, 0, 0);
    outlinePass.edgeStrength = 2.25;
    outlinePass.edgeThickness = 1.25;
    outlinePass.edgeGlow = 0.2;
    outlinePass.enabled = false;
    composer.addPass(outlinePass);
    composer.addPass(new OutputPass());
  }

  // Keep the same tone-mapping and color-space path before, during, and after hover.
  prepareOutlinePass();

  function setHoveredWork(id) {
    const nextId = id && workRoots.has(id) ? id : null;
    if (hoveredWorkId === nextId) return;
    hoveredWorkId = nextId;
    if (hoveredWorkId) {
      outlinePass.selectedObjects = [workRoots.get(hoveredWorkId)];
      outlinePass.enabled = true;
    } else if (outlinePass) {
      outlinePass.selectedObjects = [];
      outlinePass.enabled = false;
    }
    if (!hoverFrame) {
      lastHoverFrameAt = performance.now();
      hoverFrame = requestAnimationFrame(animateWorkLift);
    }
    render();
  }

  function animateWorkLift(now) {
    const delta = Math.min((now - lastHoverFrameAt) / 1000, 0.05);
    lastHoverFrameAt = now;
    const blend = 1 - Math.exp(-delta / 0.065);
    let moving = false;
    for (const [id, root] of workRoots) {
      const baseY = workBaseY.get(id) ?? root.position.y;
      const targetY = baseY + (id === hoveredWorkId ? workLift.get(id) ?? 0 : 0);
      const difference = targetY - root.position.y;
      if (Math.abs(difference) < 0.0008) root.position.y = targetY;
      else {
        root.position.y += difference * blend;
        moving = true;
      }
    }
    render();
    if (moving) hoverFrame = requestAnimationFrame(animateWorkLift);
    else hoverFrame = 0;
  }

  controls.addEventListener('change', render);
  render();

  const resize = new ResizeObserver(() => {
    const { clientWidth, clientHeight } = canvas;
    if (!clientWidth || !clientHeight) return;
    const portrait = clientHeight > clientWidth;
    camera.fov = portrait ? 48 : 38;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(getPixelRatio());
    renderer.setSize(clientWidth, clientHeight, false);
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(clientWidth, clientHeight);
    }
    render();
  });
  resize.observe(canvas);

  const draco = new DRACOLoader();
  draco.setDecoderPath('/draco/');
  draco.setDecoderConfig({ type: 'wasm' });
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.load(
    MODEL_URL,
    (gltf) => {
      const model = gltf.scene;
      scene.add(model);
      model.traverse((node) => {
        if (node.userData?.portfolio_id && WORK_IDS.has(node.userData.portfolio_id)) {
          workRoots.set(node.userData.portfolio_id, node);
          interactive.push(node);
        }
      });
      if (workRoots.size !== WORK_IDS.size) {
        for (const [fallbackName, id] of [['Printer', 'printer'], ['Game', 'game-board'], ['Computer', 'computer'], ['Video', 'video'], ['Building', 'architecture']]) {
          if (workRoots.has(id)) continue;
          const candidate = model.getObjectByName(fallbackName);
          if (candidate) {
            workRoots.set(id, candidate);
            interactive.push(candidate);
          }
        }
      }
      scene.updateMatrixWorld(true);
      for (const [id, root] of workRoots) {
        workBaseY.set(id, root.position.y);
        const bounds = new THREE.Box3().setFromObject(root);
        const height = bounds.getSize(new THREE.Vector3()).y;
        workLift.set(id, THREE.MathUtils.clamp(height * 0.06, 0.04, 0.095));
      }
      render();
      onLoaded({ scene: model, workRoots, controls, camera });
    },
    (event) => {
      if (event.total > 0) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    },
    (error) => onError(error),
  );

  function hitsAt(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(interactive, true);
  }

  function resolveWork(object) {
    let current = object;
    while (current) {
      const id = current.userData?.portfolio_id;
      if (id && WORK_IDS.has(id)) return id;
      current = current.parent;
    }
    for (const [id, root] of workRoots) {
      if (root === object || root.getObjectById(object.id)) return id;
    }
    return null;
  }

  function animateView(position, target, done) {
    cancelAnimationFrame(animationFrame);
    if (motionResolve) {
      const resolvePrevious = motionResolve;
      motionResolve = null;
      activeMotion = false;
      controls.enabled = true;
      resolvePrevious(false);
    }
    controls.enabled = false;
    const fromPosition = camera.position.clone();
    const fromTarget = controls.target.clone();
    const startedAt = performance.now();
    // The camera move explains where a work sits in the studio. Keep that
    // orientation cue visible even when the browser requests less motion.
    const duration = reduceMotion ? 850 : 1150;
    return new Promise((resolve) => {
      motionResolve = resolve;
      const frame = (now) => {
        const t = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
        const eased = t * t * (3 - 2 * t);
        camera.position.lerpVectors(fromPosition, position, eased);
        controls.target.lerpVectors(fromTarget, target, eased);
        controls.update();
        if (t < 1) animationFrame = requestAnimationFrame(frame);
        else {
          activeMotion = false;
          controls.enabled = true;
          if (motionResolve === resolve) motionResolve = null;
          if (done) done();
          render();
          resolve(true);
        }
      };
      activeMotion = true;
      animationFrame = requestAnimationFrame(frame);
    });
  }

  function focusWork(id) {
    const root = workRoots.get(id);
    if (!root) return false;
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const height = Math.max(size.y, size.x * 0.68, size.z * 0.8, 0.8);
    const direction = camera.position.clone().sub(controls.target).normalize();
    const distance = Math.max(2.8, Math.min(5.5, height * 2.15));
    const nextPosition = center.clone().addScaledVector(direction, distance);
    nextPosition.y = Math.max(nextPosition.y, center.y + height * 0.48);
    nextPosition.z = Math.max(nextPosition.z, 4.4);
    const nextTarget = center.clone().add(new THREE.Vector3(0, height * 0.1, 0));
    controls.minDistance = 2.2;
    return animateView(nextPosition, nextTarget);
  }

  function returnToOverview() {
    rememberedView = null;
    return animateView(homePosition, homeTarget, () => {
      controls.minDistance = 13;
    });
  }

  canvas.addEventListener('pointermove', (event) => {
    if (activeMotion || interactive.length === 0) return;
    const dragging = pressed && Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > 6;
    const pointerCanHover = event.pointerType !== 'touch' && !dragging;
    const first = pointerCanHover ? hitsAt(event)[0] : null;
    const id = first ? resolveWork(first.object) : null;
    setHoveredWork(id);
    canvas.style.cursor = id ? 'pointer' : 'grab';
    const rect = canvas.getBoundingClientRect();
    const point = id ? { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width, height: rect.height } : null;
    if (onHover) onHover(id, point);
    if (viewChangeHandler) viewChangeHandler(id, point);
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    pressed = { x: event.clientX, y: event.clientY, id: event.pointerId };
    canvas.focus({ preventScroll: true });
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!pressed || pressed.id !== event.pointerId) return;
    const travel = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y);
    pressed = null;
    if (travel > 6 || activeMotion) return;
    const first = hitsAt(event)[0];
    const id = first ? resolveWork(first.object) : null;
    if (id) {
      setHoveredWork(null);
      if (onHover) onHover(null, null);
      onSelect(id, { source: 'canvas' });
    }
  });
  canvas.addEventListener('pointerleave', () => {
    canvas.style.cursor = 'grab';
    setHoveredWork(null);
    if (onHover) onHover(null, null);
    if (viewChangeHandler) viewChangeHandler(null, null);
  });
  canvas.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'r' || event.key === 'Home') {
      event.preventDefault();
      if (onReset) onReset();
      else returnToOverview();
    }
  });

  return {
    workRoots,
    controls,
    camera,
    focusWork,
    returnToOverview,
    setViewChangeHandler(handler) { viewChangeHandler = handler; },
    saveView() { rememberedView = { position: camera.position.clone(), target: controls.target.clone(), minDistance: controls.minDistance }; },
    restoreView() {
      if (!rememberedView) return returnToOverview();
      const view = rememberedView;
      return animateView(view.position, view.target, () => {
        controls.minDistance = view.minDistance;
        rememberedView = null;
      });
    },
    render,
    dispose() {
      cancelAnimationFrame(animationFrame);
      cancelAnimationFrame(hoverFrame);
      resize.disconnect();
      controls.dispose();
      draco.dispose();
      if (outlinePass) outlinePass.dispose();
      if (composer) composer.dispose();
      renderer.dispose();
      scene.traverse((node) => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) {
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          for (const material of materials) {
            for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
            material.dispose();
          }
        }
      });
    },
  };
}
