import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

const BASE_URL = import.meta.env.BASE_URL;
const MODEL_URL = `${BASE_URL}models/studio.glb`;
const WORK_IDS = new Set(['printer', 'game-board', 'computer', 'video', 'architecture']);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createStudio({ canvas, onLoaded, onProgress, onError, onSelect, onHover, onReset }) {
  const scene = new THREE.Scene();
  const backdrop = new THREE.Color('#bab6b0');
  scene.background = backdrop;
  scene.fog = new THREE.Fog(0xe5e8dd, 48, 142);
  createSky(scene);
  createMeadow(scene);
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
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const pixelRatioLimit = () => canvas.clientHeight > canvas.clientWidth ? 1.45 : 1.7;
  const getPixelRatio = () => Math.min(window.devicePixelRatio || 1, pixelRatioLimit());
  renderer.setPixelRatio(getPixelRatio());

  const ambientLight = new THREE.HemisphereLight(0xf4f8ff, 0x82775e, 2.2);
  scene.add(ambientLight);
  const sunlight = new THREE.DirectionalLight(0xffedcf, 1.2);
  sunlight.position.set(-7, 12, 10);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  sunlight.shadow.camera.left = -13;
  sunlight.shadow.camera.right = 13;
  sunlight.shadow.camera.top = 12;
  sunlight.shadow.camera.bottom = -3;
  sunlight.shadow.camera.near = 0.1;
  sunlight.shadow.camera.far = 42;
  sunlight.shadow.bias = -0.0002;
  sunlight.shadow.normalBias = 0.02;
  sunlight.shadow.radius = 5;
  sunlight.shadow.camera.updateProjectionMatrix();
  scene.add(sunlight);
  const softFill = new THREE.DirectionalLight(0xf0f4e8, 0.62);
  softFill.position.set(8, 5, 2);
  scene.add(softFill);

  const focusSpotlight = new THREE.SpotLight(0xffefd3, 0, 0, 0.42, 0.9, 2);
  focusSpotlight.castShadow = false;
  focusSpotlight.visible = false;
  scene.add(focusSpotlight, focusSpotlight.target);
  const beamMaterial = new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 0 } },
    vertexShader: `varying float vHeight;
      void main() {
        vHeight = position.y + 0.5;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `uniform float opacity;
      varying float vHeight;
      void main() {
        float edgeFade = smoothstep(0.0, 0.18, vHeight) * (1.0 - smoothstep(0.72, 1.0, vHeight));
        gl_FragColor = vec4(1.0, 0.92, 0.76, opacity * edgeFade);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const focusBeam = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 32, 1, true), beamMaterial);
  focusBeam.visible = false;
  focusBeam.frustumCulled = false;
  scene.add(focusBeam);
  const overviewLighting = { ambient: 2.2, sun: 1.2, fill: 0.62, spot: 0, beam: 0 };
  const selectedLighting = { ambient: 1.78, sun: 0.91, fill: 0.45, spot: 19, beam: 0.095 };

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
  let labelUpdateHandler = null;
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

  const render = () => {
    composer.render();
    if (labelUpdateHandler && workRoots.size) labelUpdateHandler(projectWorkLabels());
  };

  function projectWorkLabels() {
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    const points = [];
    for (const [id, root] of workRoots) {
      const bounds = new THREE.Box3().setFromObject(root);
      if (bounds.isEmpty()) continue;
      const size = bounds.getSize(new THREE.Vector3());
      const point = bounds.getCenter(new THREE.Vector3());
      point.y = bounds.min.y + size.y * 0.45;
      point.project(camera);
      points.push({
        id,
        x: (point.x * 0.5 + 0.5) * canvas.clientWidth,
        y: (0.5 - point.y * 0.5) * canvas.clientHeight,
        visible: point.z > -1 && point.z < 1 && point.x > -1.1 && point.x < 1.1,
      });
    }
    return points;
  }

  function focusLightPose(root) {
    const bounds = new THREE.Box3().setFromObject(root);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const beamHeight = Math.max(2.7, Math.min(4.2, size.y + 2.6));
    const radius = THREE.MathUtils.clamp(Math.max(size.x, size.z) * 0.78, 0.48, 1.3);
    const bottom = bounds.min.y + size.y * 0.2;
    return {
      spotPosition: new THREE.Vector3(center.x, bottom + beamHeight, center.z + 0.15),
      spotTarget: center.clone(),
      beamPosition: new THREE.Vector3(center.x, bottom + beamHeight * 0.5, center.z + 0.15),
      beamScale: new THREE.Vector3(radius, beamHeight, radius),
    };
  }

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
  draco.setDecoderPath(`${BASE_URL}draco/`);
  draco.setDecoderConfig({ type: 'wasm' });
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.load(
    MODEL_URL,
    (gltf) => {
      const model = gltf.scene;
      restoreWoodMaterials(model, renderer.capabilities.getMaxAnisotropy());
      scene.add(model);
      loadWallTitle();
      model.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
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

  function loadWallTitle() {
    const loader = new FontLoader();
    loader.load(
      `${BASE_URL}fonts/helvetiker_bold.typeface.json`,
      (font) => {
        const title = createWallTitle(font);
        scene.add(title);
        render();
      },
      undefined,
      (error) => console.error('Unable to load the studio title font.', error),
    );
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

  function animateView(position, target, done, focusId = null) {
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
    const lightFrom = {
      ambient: ambientLight.intensity,
      sun: sunlight.intensity,
      fill: softFill.intensity,
      spot: focusSpotlight.intensity,
      beam: beamMaterial.uniforms.opacity.value,
    };
    const lightTo = focusId ? selectedLighting : overviewLighting;
    const root = focusId ? workRoots.get(focusId) : null;
    const pose = root ? focusLightPose(root) : null;
    const fromSpotPosition = focusSpotlight.position.clone();
    const fromSpotTarget = focusSpotlight.target.position.clone();
    const fromBeamPosition = focusBeam.position.clone();
    const fromBeamScale = focusBeam.scale.clone();
    if (pose) {
      focusSpotlight.visible = true;
      focusBeam.visible = true;
      if (lightFrom.spot === 0) {
        focusSpotlight.position.copy(pose.spotPosition);
        focusSpotlight.target.position.copy(pose.spotTarget);
        focusBeam.position.copy(pose.beamPosition);
        focusBeam.scale.copy(pose.beamScale);
      }
    }
    // The camera move explains where a work sits in the studio. Keep that
    // orientation cue visible even when the browser requests less motion.
    const duration = reduceMotion ? 850 : 1150;
    return new Promise((resolve) => {
      motionResolve = resolve;
      const frame = (now) => {
        const t = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
        const eased = t * t * (3 - 2 * t);
        const lightT = Math.min(1, (now - startedAt) / (reduceMotion ? 120 : 380));
        const lightEased = lightT * lightT * (3 - 2 * lightT);
        ambientLight.intensity = THREE.MathUtils.lerp(lightFrom.ambient, lightTo.ambient, lightEased);
        sunlight.intensity = THREE.MathUtils.lerp(lightFrom.sun, lightTo.sun, lightEased);
        softFill.intensity = THREE.MathUtils.lerp(lightFrom.fill, lightTo.fill, lightEased);
        focusSpotlight.intensity = THREE.MathUtils.lerp(lightFrom.spot, lightTo.spot, lightEased);
        beamMaterial.uniforms.opacity.value = THREE.MathUtils.lerp(lightFrom.beam, lightTo.beam, lightEased);
        if (pose && lightFrom.spot > 0) {
          focusSpotlight.position.lerpVectors(fromSpotPosition, pose.spotPosition, lightEased);
          focusSpotlight.target.position.lerpVectors(fromSpotTarget, pose.spotTarget, lightEased);
          focusBeam.position.lerpVectors(fromBeamPosition, pose.beamPosition, lightEased);
          focusBeam.scale.lerpVectors(fromBeamScale, pose.beamScale, lightEased);
        }
        focusSpotlight.target.updateMatrixWorld();
        camera.position.lerpVectors(fromPosition, position, eased);
        controls.target.lerpVectors(fromTarget, target, eased);
        controls.update();
        if (t < 1) animationFrame = requestAnimationFrame(frame);
        else {
          if (!focusId) {
            focusSpotlight.visible = false;
            focusBeam.visible = false;
          }
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
    return animateView(nextPosition, nextTarget, null, id);
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
    setHoveredWork,
    setLabelUpdateHandler(handler) { labelUpdateHandler = handler; render(); },
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

function restoreWoodMaterials(model, anisotropy) {
  const palettes = [
    { name: 'Workbench | warm birch grain', dark: [192, 159, 119], light: [221, 195, 160], seed: 13 },
    { name: 'Cabinet | pale timber', dark: [199, 174, 143], light: [228, 207, 179], seed: 29 },
    { name: 'Workbench | birch front', dark: [192, 158, 117], light: [218, 191, 155], seed: 47 },
  ];
  const textureByName = new Map();

  model.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const wasArray = Array.isArray(node.material);
    const materials = wasArray ? node.material : [node.material];
    const restored = materials.map((material) => {
      const palette = palettes.find((entry) => entry.name === material.name);
      if (!palette) return material;

      let texture = textureByName.get(palette.name);
      if (!texture) {
        texture = createWoodGrainTexture(palette, anisotropy);
        textureByName.set(palette.name, texture);
      }

      const replacement = material.clone();
      replacement.map = texture;
      replacement.color.set('#ffffff');
      replacement.roughness = Math.max(replacement.roughness, 0.72);
      replacement.metalness = 0;
      replacement.needsUpdate = true;
      return replacement;
    });
    node.material = wasArray ? restored : restored[0];
  });
}

function createWoodGrainTexture({ dark, light, seed }, anisotropy) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const image = context.createImageData(size, size);
  const TAU = Math.PI * 2;
  const clamp = (value) => THREE.MathUtils.clamp(value, 0, 1);

  for (let y = 0; y < size; y += 1) {
    const phase = (y / size) * TAU;
    for (let x = 0; x < size; x += 1) {
      const across = (x / size) * TAU;
      const warp = 2.8 * Math.sin(across * 2 + Math.sin(phase * 3 + seed) * 0.55);
      const broad = Math.sin(phase * 7 + Math.sin(phase * 2 + across) * 0.9 + warp * 0.08);
      const grain = Math.sin(phase * 27 + warp + Math.sin(across * 3 + seed) * 0.7);
      const fine = Math.sin(phase * 71 + warp * 1.6 + Math.sin(across * 5 + seed) * 1.2);
      const streak = Math.max(0, Math.sin(phase * 119 + warp * 2.1 + Math.sin(across * 7) * 1.8) - 0.94);
      const variation = (broad * 0.28 + grain * 0.2 + fine * 0.09 + (seededTextureNoise(x, y, seed) - 0.5) * 0.08);
      const tone = clamp(0.51 + variation * 0.3 - streak * 0.16);
      const shade = 0.97 + variation * 0.045;
      const offset = (y * size + x) * 4;
      image.data[offset] = THREE.MathUtils.clamp(THREE.MathUtils.lerp(dark[0], light[0], tone) * shade, 0, 255);
      image.data[offset + 1] = THREE.MathUtils.clamp(THREE.MathUtils.lerp(dark[1], light[1], tone) * shade, 0, 255);
      image.data[offset + 2] = THREE.MathUtils.clamp(THREE.MathUtils.lerp(dark[2], light[2], tone) * shade, 0, 255);
      image.data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'Procedural warm birch grain';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = Math.min(anisotropy, 8);
  texture.needsUpdate = true;
  return texture;
}

function seededTextureNoise(x, y, seed) {
  const value = Math.sin((x + seed) * 127.1 + (y + seed * 3) * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function createWallTitle(font) {
  const title = new THREE.Group();
  title.name = 'Scene title: AI＋3D＝？';
  title.userData.displayText = 'AI＋3D＝？';

  const material = new THREE.MeshStandardMaterial({
    color: '#fffaf2',
    roughness: 0.7,
    metalness: 0,
    emissive: '#32150d',
    emissiveIntensity: 0.12,
  });
  const size = 0.5;
  const depth = 0.035;
  const gap = 0.1;
  let cursor = 0;

  const addText = (text, scaleX = 1) => {
    const geometry = new TextGeometry(text, {
      font,
      size,
      depth,
      curveSegments: 8,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.005,
      bevelSegments: 2,
    });
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    const width = bounds.getSize(new THREE.Vector3()).x * scaleX;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(cursor - bounds.min.x * scaleX, -bounds.min.y, 0);
    mesh.scale.x = scaleX;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    title.add(mesh);
    cursor += width + gap;
  };

  const addExtrudedShape = (points) => {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) shape.lineTo(points[i][0], points[i][1]);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 2,
      curveSegments: 2,
    });
  };

  const addOperatorMesh = (geometry, width, y = size * 0.5) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(cursor + width * 0.5, y, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    title.add(mesh);
    cursor += width + gap;
  };

  addText('AI');

  const plusWidth = 0.34;
  const plusHeight = 0.34;
  const plusStroke = 0.045;
  const halfWidth = plusWidth * 0.5;
  const halfHeight = plusHeight * 0.5;
  const halfStroke = plusStroke * 0.5;
  const plusPoints = [
    [-halfStroke, -halfHeight], [halfStroke, -halfHeight],
    [halfStroke, -halfStroke], [halfWidth, -halfStroke],
    [halfWidth, halfStroke], [halfStroke, halfStroke],
    [halfStroke, halfHeight], [-halfStroke, halfHeight],
    [-halfStroke, halfStroke], [-halfWidth, halfStroke],
    [-halfWidth, -halfStroke], [-halfStroke, -halfStroke],
  ];
  addOperatorMesh(addExtrudedShape(plusPoints), plusWidth, size * 0.52);

  addText('3D');

  const equalsWidth = 0.38;
  const equalsBar = 0.044;
  const equalsGap = 0.09;
  const equals = new THREE.Group();
  for (const y of [size * 0.43 - equalsGap * 0.5, size * 0.43 + equalsGap * 0.5]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(equalsWidth, equalsBar, depth), material);
    bar.position.set(0, y, depth * 0.5);
    bar.castShadow = true;
    bar.receiveShadow = true;
    equals.add(bar);
  }
  equals.position.x = cursor + equalsWidth * 0.5;
  title.add(equals);
  cursor += equalsWidth + gap;

  const questionGeometry = new TextGeometry('?', {
    font,
    size,
    depth,
    curveSegments: 8,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.005,
    bevelSegments: 2,
  });
  questionGeometry.computeBoundingBox();
  const questionBounds = questionGeometry.boundingBox;
  const questionWidth = 0.4;
  const questionScaleX = questionWidth / questionBounds.getSize(new THREE.Vector3()).x;
  const questionMark = new THREE.Mesh(questionGeometry, material);
  questionMark.position.set(cursor - questionBounds.min.x * questionScaleX, -questionBounds.min.y, 0);
  questionMark.scale.x = questionScaleX;
  questionMark.castShadow = true;
  questionMark.receiveShadow = true;
  title.add(questionMark);
  cursor += questionWidth;

  const titleWidth = cursor - gap;
  title.scale.x = 1.32;
  title.position.set(-titleWidth * title.scale.x * 0.5, 2.7, -5.48);
  return title;
}


function createSky(scene) {
  const geometry = new THREE.SphereGeometry(420, 48, 32);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `varying vec3 vSkyDirection; void main(){ vec4 world = modelMatrix * vec4(position,1.0); vSkyDirection = normalize(world.xyz - cameraPosition); gl_Position = projectionMatrix * viewMatrix * world; }`,
    fragmentShader: `
      varying vec3 vSkyDirection;
      float cloudPuff(vec2 point, vec2 center, vec2 radius) {
        vec2 q = (point - center) / radius;
        return exp(-dot(q, q) * 2.2);
      }
      float cloudCluster(vec2 point, float x, float y) {
        float mass = cloudPuff(point, vec2(x, y - 0.008), vec2(0.085, 0.019));
        mass += cloudPuff(point, vec2(x - 0.045, y + 0.006), vec2(0.043, 0.028));
        mass += cloudPuff(point, vec2(x - 0.012, y + 0.026), vec2(0.047, 0.037));
        mass += cloudPuff(point, vec2(x + 0.034, y + 0.018), vec2(0.046, 0.032));
        mass += cloudPuff(point, vec2(x + 0.071, y + 0.004), vec2(0.035, 0.023));
        return smoothstep(1.18, 1.58, mass);
      }
      void main() {
        vec3 d = normalize(vSkyDirection);
        float elevation = asin(clamp(d.y, -1.0, 1.0));
        float azimuth = atan(d.x, -d.z);
        float h = smoothstep(-0.055, 0.19, d.y);
        vec3 horizon = vec3(1.00, 0.91, 0.77);
        vec3 zenith = vec3(0.29, 0.57, 0.89);
        vec3 color = mix(horizon, zenith, h);
        vec2 skyPoint = vec2(azimuth, elevation);
        float clouds = max(max(cloudCluster(skyPoint, -0.46, 0.078), cloudCluster(skyPoint, -0.23, 0.092)), max(cloudCluster(skyPoint, 0.02, 0.076), max(cloudCluster(skyPoint, 0.27, 0.094), cloudCluster(skyPoint, 0.49, 0.078))));
        vec3 cloudColor = mix(vec3(0.90, 0.86, 0.78), vec3(1.0, 0.99, 0.96), smoothstep(0.015, 0.055, elevation));
        color = mix(color, cloudColor, clouds * 0.98);
        vec3 sunDirection = normalize(vec3(-0.28, 0.055, -0.96));
        float sunDot = max(dot(d, sunDirection), 0.0);
        float sunDisk = smoothstep(0.99945, 0.99978, sunDot);
        float sunHalo = pow(sunDot, 24.0) * 0.18 + pow(sunDot, 72.0) * 0.26;
        color = mix(color, vec3(1.0, 0.97, 0.86), sunDisk);
        color += vec3(0.12, 0.09, 0.05) * sunHalo;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(geometry, material);
  sky.renderOrder = -2;
  sky.frustumCulled = false;
  scene.add(sky);
}

function createMeadow(scene) {
  const segments = 126;
  const geometry = new THREE.PlaneGeometry(320, 320, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const palettes = [new THREE.Color('#506d47'), new THREE.Color('#8a965e')];
  const finePalettes = [new THREE.Color('#637a4b'), new THREE.Color('#82905a')];
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const broad = valueNoise(x * 0.28, z * 0.28);
    const fine = valueNoise(x * 0.9, z * 0.9);
    const tone = THREE.MathUtils.clamp(0.39 + broad * 0.42 + fine * 0.19, 0, 1);
    const base = palettes[0].clone().lerp(palettes[1], tone);
    const tint = finePalettes[0].clone().lerp(finePalettes[1], fine);
    base.lerp(tint, 0.16);
    colors[i * 3] = base.r;
    colors[i * 3 + 1] = base.g;
    colors[i * 3 + 2] = base.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98, metalness: 0 }));
  ground.position.y = -0.39;
  ground.frustumCulled = false;
  ground.receiveShadow = false;
  scene.add(ground);
  createGrassBlades(scene);
  createWildflowers(scene);
}

function valueNoise(x, z) {
  const ix = Math.floor(x); const iz = Math.floor(z);
  const fx0 = x - ix; const fz0 = z - iz;
  const fx = fx0 * fx0 * (3 - 2 * fx0); const fz = fz0 * fz0 * (3 - 2 * fz0);
  const a = noiseHash(ix, iz); const b = noiseHash(ix + 1, iz);
  const c = noiseHash(ix, iz + 1); const d = noiseHash(ix + 1, iz + 1);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, fx), THREE.MathUtils.lerp(c, d, fx), fz);
}

function noiseHash(x, z) {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function createGrassBlades(scene) {
  const vertices = new Float32Array([
    0, 0, 0, -0.045, 0.12, 0, 0.035, 0.34, 0,
    0, 0, 0, 0.045, 0.14, 0, -0.035, 0.25, 0,
    0, 0, 0, 0, 0.11, -0.045, 0, 0.29, 0.04,
  ]);
  const bladeGeometry = new THREE.BufferGeometry();
  bladeGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  bladeGeometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: false, side: THREE.DoubleSide, roughness: 1, metalness: 0 });
  const count = 3900;
  const blades = new THREE.InstancedMesh(bladeGeometry, material, count);
  blades.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  blades.castShadow = false;
  blades.receiveShadow = false;
  const random = seededRandom(91273);
  const dummy = new THREE.Object3D();
  let inserted = 0;
  for (let i = 0; i < count * 2 && inserted < count; i += 1) {
    const x = (random() - 0.5) * 88;
    const z = (random() - 0.5) * 88;
    if (Math.abs(x) < 9.25 && Math.abs(z) < 7.05) continue;
    const height = 0.55 + random() * 0.75;
    const width = 0.6 + random() * 0.65;
    dummy.position.set(x, -0.388, z);
    dummy.rotation.y = random() * Math.PI;
    dummy.scale.set(width, height, width);
    dummy.updateMatrix();
    blades.setMatrixAt(inserted, dummy.matrix);
    const shade = 0.76 + random() * 0.36;
    blades.setColorAt(inserted, new THREE.Color().setRGB(0.46 * shade, 0.66 * shade, 0.35 * shade));
    inserted += 1;
  }
  blades.count = inserted;
  blades.instanceMatrix.needsUpdate = true;
  if (blades.instanceColor) blades.instanceColor.needsUpdate = true;
  blades.computeBoundingSphere();
  scene.add(blades);
}

function createWildflowers(scene) {
  const patchCount = 15;
  const flowers = [];
  const random = seededRandom(62481);
  const petalColors = ['#f58bb5', '#f8a2c2', '#ee79a7', '#ffc0d5'].map((color) => new THREE.Color(color));
  const centerColor = new THREE.Color('#f4c66e');
  const stemColor = new THREE.Color('#6f9259');

  for (let patch = 0; patch < patchCount; patch += 1) {
    const foreground = patch < 5;
    const side = random() < 0.5 ? -1 : 1;
    const patchX = foreground ? (random() - 0.5) * 14 : side * (16.5 + random() * 7);
    const patchZ = foreground ? 8 + random() * 4 : -32 + random() * 19;
    const patchFlowers = foreground ? 4 + Math.floor(random() * 3) : 4 + Math.floor(random() * 4);
    for (let i = 0; i < patchFlowers; i += 1) {
      const spread = foreground ? 1.4 : 2.2;
      const x = patchX + (random() + random() + random() - 1.5) * spread;
      const z = patchZ + (random() + random() + random() - 1.5) * spread;
      flowers.push({
        x,
        z,
        stemHeight: 0.48 + random() * 0.29,
        angle: random() * Math.PI * 2,
        petalColor: petalColors[Math.floor(random() * petalColors.length)],
      });
    }
  }

  if (flowers.length === 0) return;
  const petalGeometry = new THREE.SphereGeometry(1, 8, 6);
  const petalMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84, metalness: 0 });
  const petals = new THREE.InstancedMesh(petalGeometry, petalMaterial, flowers.length * 5);
  const centerGeometry = new THREE.SphereGeometry(1, 7, 5);
  const centers = new THREE.InstancedMesh(centerGeometry, new THREE.MeshStandardMaterial({ color: centerColor, roughness: 0.78 }), flowers.length);
  const stemGeometry = new THREE.CylinderGeometry(0.007, 0.011, 1, 5);
  const stems = new THREE.InstancedMesh(stemGeometry, new THREE.MeshStandardMaterial({ color: stemColor, roughness: 0.92 }), flowers.length);
  const dummy = new THREE.Object3D();
  const headY = (flower) => -0.39 + flower.stemHeight;

  flowers.forEach((flower, index) => {
    const y = headY(flower);
    for (let petal = 0; petal < 5; petal += 1) {
      const angle = flower.angle + (petal / 5) * Math.PI * 2;
      dummy.position.set(flower.x + Math.cos(angle) * 0.043, y + Math.sin(angle) * 0.043, flower.z + 0.012);
      dummy.rotation.set(0, 0, angle);
      dummy.scale.set(0.056, 0.039, 0.014);
      dummy.updateMatrix();
      const instance = index * 5 + petal;
      petals.setMatrixAt(instance, dummy.matrix);
      petals.setColorAt(instance, flower.petalColor);
    }

    dummy.position.set(flower.x, y, flower.z + 0.028);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(0.018, 0.018, 0.01);
    dummy.updateMatrix();
    centers.setMatrixAt(index, dummy.matrix);

    dummy.position.set(flower.x, -0.39 + flower.stemHeight / 2, flower.z);
    dummy.scale.set(1, flower.stemHeight, 1);
    dummy.updateMatrix();
    stems.setMatrixAt(index, dummy.matrix);
  });

  petals.instanceMatrix.needsUpdate = true;
  if (petals.instanceColor) petals.instanceColor.needsUpdate = true;
  centers.instanceMatrix.needsUpdate = true;
  stems.instanceMatrix.needsUpdate = true;
  petals.computeBoundingSphere();
  centers.computeBoundingSphere();
  stems.computeBoundingSphere();
  scene.add(stems, petals, centers);
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
