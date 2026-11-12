import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  PHALANX_RADIUS,
  TOWERS,
  coverageScore,
  distToPath,
  map,
  onLevel,
  pointAlong,
  terrainColor,
  terrainHeight,
} from './data.js';
import { towerStats } from './sim.js';
import { buildTowerV3 } from './towers-v3.js';
import { buildTowerV4 } from './towers-v4.js';
import { getGraphicsVersion, onGraphicsVersion } from './version.js';

const GEO = {
  body: new THREE.CapsuleGeometry(0.18, 0.36, 4, 8),
  head: new THREE.SphereGeometry(0.15, 10, 8),
  shield: new THREE.CylinderGeometry(0.26, 0.26, 0.055, 12),
  spear: new THREE.CylinderGeometry(0.028, 0.02, 1.05, 5),
  plume: new THREE.ConeGeometry(0.08, 0.32, 6),
  horse: new THREE.BoxGeometry(0.34, 0.28, 0.9),
  leg: new THREE.CylinderGeometry(0.045, 0.04, 0.32, 5),
  cape: new THREE.PlaneGeometry(0.46, 0.72),
  horn: new THREE.ConeGeometry(0.06, 0.28, 5),
  bar: new THREE.PlaneGeometry(1, 1),
};

const materials = new Map();
let inkStyle = false;
let toonGradient = null;

function inkRamp() {
  if (toonGradient) return toonGradient;
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  ['#241c16', '#6d5844', '#d8c4a4', '#fff8ec'].forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.fillRect(index, 0, 1, 1);
  });
  toonGradient = new THREE.CanvasTexture(canvas);
  toonGradient.minFilter = THREE.NearestFilter;
  toonGradient.magFilter = THREE.NearestFilter;
  toonGradient.generateMipmaps = false;
  toonGradient.colorSpace = THREE.NoColorSpace;
  return toonGradient;
}

const inkEdge = new THREE.MeshBasicMaterial({ color: 0x16110d, side: THREE.BackSide });
const posterScratch = new THREE.Color();

function posterHex(color) {
  posterScratch.set(color);
  const hsl = { h: 0, s: 0, l: 0 };
  posterScratch.getHSL(hsl);
  hsl.h = Math.round(hsl.h * 6) / 6;
  hsl.s = hsl.s < 0.08 ? 0.05 : Math.min(0.9, 0.28 + hsl.s * 0.85);
  if (hsl.l > 0.78) hsl.l = 0.86;
  else if (hsl.l < 0.16) hsl.l = 0.14;
  else hsl.l = 0.46;
  posterScratch.setHSL(hsl.h, hsl.s, hsl.l);
  return posterScratch.getHex();
}

function setInkStyle(on) {
  if (inkStyle === on) return false;
  inkStyle = on;
  if (on) inkRamp();
  const stale = [...materials.values()];
  materials.clear();
  stale.forEach((material) => material.dispose());
  return true;
}

function std(color, extra = {}) {
  const side = extra.side ?? THREE.FrontSide;
  const emissive = extra.emissive ?? 0;
  if (inkStyle) {
    const tint = posterHex(color);
    const key = `ink|${tint}|${emissive}|${side}`;
    let material = materials.get(key);
    if (!material) {
      material = new THREE.MeshToonMaterial({
        color: tint,
        gradientMap: inkRamp(),
        emissive,
        emissiveIntensity: emissive ? 0.35 : 0,
        side,
      });
      materials.set(key, material);
    }
    return material;
  }
  const roughness = extra.roughness ?? 0.76;
  const metalness = extra.metalness ?? 0.05;
  const key = `${color}|${roughness}|${metalness}|${emissive}|${side}`;
  let material = materials.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      emissive,
      emissiveIntensity: emissive ? 0.55 : 0,
      side,
    });
    materials.set(key, material);
  }
  return material;
}

function surfaceMaterial(color, { roughness = 1, factor = -1, opacity = 1 } = {}) {
  if (inkStyle) {
    return new THREE.MeshToonMaterial({
      color,
      gradientMap: inkRamp(),
      polygonOffset: true,
      polygonOffsetFactor: factor,
      polygonOffsetUnits: factor,
      transparent: opacity < 1,
      opacity,
    });
  }
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: factor,
    polygonOffsetUnits: factor,
    transparent: opacity < 1,
    opacity,
  });
}

function inkOutline(root) {
  if (!inkStyle) return;
  const meshes = [];
  root.traverse((child) => {
    if (child.isMesh && !child.userData.inkShell && !child.userData.noInk && child.geometry !== GEO.bar) {
      meshes.push(child);
    }
  });
  meshes.forEach((child) => {
    const shell = new THREE.Mesh(child.geometry, inkEdge);
    shell.scale.setScalar(1.08);
    shell.castShadow = false;
    shell.receiveShadow = false;
    shell.userData.inkShell = true;
    child.add(shell);
  });
}

function uniqueBasic(color, opacity = 1) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
  });
  material.userData.unique = true;
  return material;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dampAngle(current, target, dt) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * Math.min(1, dt * 10);
}

function disposeObject(object) {
  object.traverse((child) => {
    const material = child.material;
    if (material?.userData?.unique) {
      material.map?.dispose();
      material.dispose();
    }
  });
}

function buildRibbon(points, width, y) {
  const positions = [];
  const indices = [];
  for (let i = 0; i < points.length; i += 1) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    let tx = next.x - prev.x;
    let tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    const px = -tz * width;
    const pz = tx * width;
    const p = points[i];
    positions.push(p.x + px, y, p.z + pz, p.x - px, y, p.z - pz);
  }
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const GradeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      col = pow(max(col, 0.0), vec3(0.94));
      col.r += 0.012;
      col.g += 0.004;
      float edge = smoothstep(0.25, 0.82, length(vUv - 0.5));
      col *= mix(1.0, 0.82, edge);
      gl_FragColor = vec4(col, c.a);
    }
  `,
};

const InkShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    varying vec2 vUv;
    float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
    void main() {
      vec2 px = 1.4 / max(resolution, vec2(1.0));
      vec4 c = texture2D(tDiffuse, vUv);
      float l = luma(c.rgb);
      float e = 0.0;
      e += abs(l - luma(texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb));
      e += abs(l - luma(texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb));
      e += abs(l - luma(texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb));
      e += abs(l - luma(texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb));
      float edge = smoothstep(0.28, 0.55, e);
      vec3 stepped = floor(c.rgb * 6.0 + 0.5) / 6.0;
      vec3 col = mix(c.rgb, stepped, 0.72);
      col = mix(col, vec3(0.09, 0.06, 0.04), edge);
      float grain = fract(sin(dot(vUv, vec2(91.7, 43.2))) * 43758.5453);
      col *= 0.94 + grain * 0.08;
      float vig = smoothstep(0.9, 0.3, length(vUv - 0.5));
      col *= mix(0.88, 1.0, vig);
      gl_FragColor = vec4(col, c.a);
    }
  `,
};

const INK_SKY = `
  varying vec3 vPos;
  void main() {
    vec3 dir = normalize(vPos);
    float h = dir.y;
    vec3 col = vec3(0.97, 0.91, 0.78);
    if (h > 0.06) col = vec3(0.47, 0.68, 0.88);
    if (h > 0.38) col = vec3(0.16, 0.28, 0.58);
    vec3 sunDir = normalize(vec3(0.62, 0.55, 0.22));
    if (dot(dir, sunDir) > 0.994) col = vec3(0.90, 0.22, 0.12);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const INK_WATER = `
  varying vec3 vW;
  uniform float uTime;
  void main() {
    float stripe = smoothstep(0.78, 0.84, fract(vW.z * 0.04 + vW.x * 0.01 + uTime * 0.08));
    vec3 col = mix(vec3(0.08, 0.22, 0.52), vec3(0.20, 0.48, 0.74), stripe);
    float spark = smoothstep(0.93, 0.98, fract(vW.x * 0.07 - uTime * 0.08));
    col = mix(col, vec3(0.96, 0.93, 0.86), spark * 0.9);
    gl_FragColor = vec4(col, 0.96);
  }
`;

function canvasTexture(draw, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function textSprite(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.font = '600 64px Outfit, Palatino, serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  material.userData.unique = true;
  const sprite = new THREE.Sprite(material);
  return sprite;
}

export function createRenderer(canvas, { onPick }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe7d3ae);
  scene.fog = new THREE.Fog(0xe7d3ae, 72, 160);

  const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 240);
  const target = new THREE.Vector3(1.4, 0, -6);
  let theta = Math.PI + 0.28;
  let phi = 0.74;
  let radius = 68;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(2, 2);
  let pointerInside = false;
  let dragging = false;
  let dragButton = 0;
  let downX = 0;
  let downY = 0;
  let moved = 0;

  const clock = { t: 0 };
  const padMeshes = [];
  const towerMeshes = new Map();
  const enemyMeshes = new Map();
  const shotMeshes = new Map();
  const effectMeshes = new Map();
  const dynamic = new THREE.Group();
  scene.add(dynamic);
  const links = new THREE.Group();
  scene.add(links);
  const labelLayer = new THREE.Group();
  scene.add(labelLayer);

  const rangeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.94, 1, 64),
    new THREE.MeshBasicMaterial({
      color: 0xf0d7a2,
      transparent: true,
      opacity: 0.33,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  rangeRing.rotation.x = -Math.PI / 2;
  rangeRing.visible = false;
  scene.add(rangeRing);

  const ships = [];
  const steams = [];
  const linkGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 5);
  let campFire = null;
  let trailRibbon = null;
  let mainArrows = null;
  let trailArrows = null;
  const waterUniforms = { uTime: { value: 0 } };
  const dummy = new THREE.Object3D();
  const aimDir = new THREE.Vector3();
  const shotDir = new THREE.Vector3();
  const worldRoot = new THREE.Group();
  scene.add(worldRoot);
  let graphicsVersion = getGraphicsVersion();
  let passesReady = false;
  setInkStyle(graphicsVersion === 4);

  const hemi = new THREE.HemisphereLight(0xc9ddf0, 0x7a6238, 0.62);
  const ambient = new THREE.AmbientLight(0xfff4e4, 0.28);
  const sun = new THREE.DirectionalLight(0xffe2b0, 1.75);
  sun.position.set(22, 34, 10);
  sun.target.position.set(0, 0, -2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -36;
  sun.shadow.camera.right = 36;
  sun.shadow.camera.top = 42;
  sun.shadow.camera.bottom = -42;
  sun.shadow.camera.near = 4;
  sun.shadow.camera.far = 110;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.03;
  sun.shadow.camera.updateProjectionMatrix();
  const fill = new THREE.DirectionalLight(0xc9d7e8, 0.28);
  fill.position.set(-20, 12, -18);
  scene.add(hemi, ambient, sun, sun.target, fill);

  function syncGrading() {
    const inkOn = graphicsVersion === 4;
    renderer.toneMapping = inkOn ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = inkOn ? 1 : 1.08;
    renderer.shadowMap.type = inkOn ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    renderer.shadowMap.needsUpdate = true;
    if (!passesReady) return;
    bloomPass.enabled = !inkOn;
    gradePass.enabled = !inkOn;
    inkPass.enabled = inkOn;
  }

  function applyLook() {
    const classic = graphicsVersion === 1;
    const theme = map.theme || 'coast';
    hemi.intensity = classic ? 0.55 : 0.62;
    ambient.intensity = classic ? 0.38 : 0.28;
    fill.intensity = 0.28;
    if (theme === 'mesa') {
      hemi.color.set(0xfff4e2);
      hemi.groundColor.set(0xc4844a);
      sun.color.set(0xfff6e8);
      sun.intensity = 1.95;
      sun.position.set(4, 42, 8);
      scene.fog.color.set(0xf0d8b4);
      scene.fog.near = 42;
      scene.fog.far = 118;
    } else if (theme === 'plain') {
      hemi.color.set(0xf0c090);
      hemi.groundColor.set(0x8a4a28);
      sun.color.set(0xffb070);
      sun.intensity = 1.15;
      sun.position.set(6, 12, 16);
      scene.fog.color.set(0xc4a07a);
      scene.fog.near = 26;
      scene.fog.far = 88;
    } else if (theme === 'walls') {
      hemi.color.set(0xe7e2d8);
      hemi.groundColor.set(0x8a7a58);
      sun.color.set(0xffe6c4);
      sun.intensity = 1.5;
      sun.position.set(16, 26, 4);
      scene.fog.color.set(0xd9d3c6);
      scene.fog.near = 46;
      scene.fog.far = 130;
    } else if (theme === 'island') {
      hemi.color.set(0xd7eef2);
      hemi.groundColor.set(0x1a6070);
      sun.color.set(0xfff0d0);
      sun.intensity = 1.7;
      sun.position.set(20, 30, 6);
      scene.fog.color.set(0xb7d5d4);
      scene.fog.near = 36;
      scene.fog.far = 120;
    } else {
      hemi.color.set(classic ? 0xc5d6e6 : 0xc9ddf0);
      hemi.groundColor.set(classic ? 0x8d6a42 : 0x7a6238);
      sun.color.set(classic ? 0xfff0d2 : 0xffe2b0);
      sun.intensity = classic ? 1.7 : 1.75;
      sun.position.set(22, 34, 10);
      scene.fog.color.set(0xe7d3ae);
      scene.fog.near = classic ? 48 : 72;
      scene.fog.far = classic ? 128 : 160;
    }
    if (graphicsVersion === 4) {
      ambient.intensity = 0.18;
      hemi.intensity = 0.42;
      hemi.color.set(0x8eb4e8);
      hemi.groundColor.set(0xe0a04a);
      sun.color.set(0xfff6e4);
      sun.intensity = 1.65;
      fill.intensity = 0.08;
      scene.fog.color.set(0xf6edd8);
      scene.fog.near = 78;
      scene.fog.far = 168;
      scene.background.set(0xf6edd8);
    } else {
      scene.background.copy(scene.fog.color);
    }
    syncGrading();
  }

  function applyView() {
    const view = map.view;
    if (!view) {
      target.set(1.4, 0, -6);
      theta = Math.PI + 0.28;
      phi = 0.74;
      radius = 68;
      return;
    }
    target.set(view.x, 0, view.z);
    theta = view.theta;
    phi = view.phi;
    radius = view.radius;
  }

  function sharedMaterials() {
    return new Set(materials.values());
  }

  function disposeLoose(object) {
    const kept = sharedMaterials();
    const sharedGeo = new Set(Object.values(GEO));
    object.traverse((child) => {
      if (child.geometry && !sharedGeo.has(child.geometry)) child.geometry.dispose();
      const list = [].concat(child.material || []);
      list.forEach((material) => {
        if (!material || kept.has(material)) return;
        material.map?.dispose();
        material.dispose();
      });
    });
  }

  function dropTowers() {
    towerMeshes.forEach((mesh) => {
      dynamic.remove(mesh);
      disposeObject(mesh);
    });
    towerMeshes.clear();
  }

  function dropDynamics() {
    [enemyMeshes, shotMeshes, effectMeshes].forEach((store) => {
      store.forEach((mesh) => {
        dynamic.remove(mesh);
        disposeObject(mesh);
      });
      store.clear();
    });
  }

  function rebuildWorld() {
    const doomed = [...worldRoot.children];
    worldRoot.clear();
    padMeshes.length = 0;
    ships.length = 0;
    steams.length = 0;
    mainArrows = null;
    trailArrows = null;
    trailRibbon = null;
    campFire = null;
    doomed.forEach(disposeLoose);
    applyLook();
    buildWorld();
  }

  buildWorld();
  buildLabels();
  if (document.fonts?.ready) document.fonts.ready.then(buildLabels);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.1, 0.3, 0.94);
  composer.addPass(bloomPass);
  const gradePass = new ShaderPass(GradeShader);
  composer.addPass(gradePass);
  const inkPass = new ShaderPass(InkShader);
  composer.addPass(inkPass);
  composer.addPass(new OutputPass());
  passesReady = true;
  inkPass.uniforms.resolution.value.copy(renderer.getDrawingBufferSize(new THREE.Vector2()));
  syncGrading();

  function applyCamera() {
    const sinPhi = Math.sin(phi);
    camera.position.set(
      target.x + radius * sinPhi * Math.sin(theta),
      radius * Math.cos(phi),
      target.z + radius * sinPhi * Math.cos(theta),
    );
    camera.lookAt(target);
  }

  function buildWorld() {
    applyLook();
    const classic = graphicsVersion === 1;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(150, 24, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        toneMapped: false,
        vertexShader: `
          varying vec3 vPos;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vPos = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `,
        fragmentShader: `
          varying vec3 vPos;
          void main() {
            vec3 dir = normalize(vPos);
            float h = dir.y;
            vec3 hor = vec3(0.97, 0.72, 0.46);
            vec3 mid = vec3(0.73, 0.84, 0.93);
            vec3 top = vec3(0.28, 0.45, 0.68);
            vec3 col = mix(hor, mid, smoothstep(0.02, 0.28, h));
            col = mix(col, top, smoothstep(0.2, 0.78, h));
            vec3 sunDir = normalize(vec3(0.62, 0.46, 0.22));
            float glow = pow(max(dot(dir, sunDir), 0.0), 6.0);
            float disc = pow(max(dot(dir, sunDir), 0.0), 220.0);
            col += vec3(1.0, 0.72, 0.38) * glow * 0.55;
            col += vec3(1.0, 0.96, 0.82) * disc * 1.4;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    );
    if (inkStyle) {
      sky.material.fragmentShader = INK_SKY;
      sky.material.needsUpdate = true;
    } else if (classic) {
      sky.material.fragmentShader = `
        varying vec3 vPos;
        void main() {
          float h = normalize(vPos).y;
          vec3 hor = vec3(0.93, 0.78, 0.58);
          vec3 mid = vec3(0.76, 0.84, 0.90);
          vec3 top = vec3(0.39, 0.54, 0.70);
          vec3 col = mix(hor, mid, smoothstep(0.0, 0.28, h));
          col = mix(col, top, smoothstep(0.22, 0.8, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `;
      sky.material.needsUpdate = true;
    }
    worldRoot.add(sky);

    const groundGeo = new THREE.PlaneGeometry(72, 96, 88, 120);
    groundGeo.rotateX(-Math.PI / 2);
    const position = groundGeo.attributes.position;
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const h = terrainHeight(x, z);
      position.setY(i, h);
      const color = terrainColor(x, z, h, graphicsVersion);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    let groundMeshGeo = groundGeo;
    if (inkStyle) {
      groundMeshGeo = groundGeo.toNonIndexed();
      groundGeo.dispose();
    }
    groundMeshGeo.computeVertexNormals();
    const groundMaterial = inkStyle
      ? new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: inkRamp() })
      : new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: classic ? 0.95 : 0.92,
        metalness: 0,
      });
    if (!classic && !inkStyle) {
      const grit = canvasTexture((ctx, size) => {
        const image = ctx.createImageData(size, size);
        for (let i = 0; i < size * size; i += 1) {
          const shade = 150 + Math.random() * 105;
          image.data[i * 4] = shade;
          image.data[i * 4 + 1] = shade;
          image.data[i * 4 + 2] = shade;
          image.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(image, 0, 0);
      });
      grit.repeat.set(36, 48);
      grit.colorSpace = THREE.NoColorSpace;
      groundMaterial.roughnessMap = grit;
    }
    const ground = new THREE.Mesh(groundMeshGeo, groundMaterial);
    ground.receiveShadow = true;
    worldRoot.add(ground);

    const roadMat = surfaceMaterial(classic ? 0x8d7349 : 0x6d5a46, { roughness: 1, factor: -1 });
    const laneMat = surfaceMaterial(classic ? 0xb08958 : 0xd2ae72, { roughness: 0.9, factor: -2 });
    const road = new THREE.Mesh(buildRibbon(map.main.points, classic ? 0.78 : 0.72, classic ? 0.1 : 0.11), roadMat);
    const lane = new THREE.Mesh(buildRibbon(map.main.points, classic ? 0.46 : 0.36, classic ? 0.14 : 0.15), laneMat);
    road.receiveShadow = true;
    lane.receiveShadow = true;
    const theme = map.theme || 'coast';
    if (theme === 'walls') {
      roadMat.color.set(0x8e877c);
      laneMat.color.set(0x5c6c78);
    } else if (theme === 'plain') {
      roadMat.color.set(0x8d4e2c);
      laneMat.color.set(0xd2a06a);
    } else if (theme === 'island') {
      roadMat.color.set(0xd8c4a0);
      laneMat.color.set(0xf2e4c4);
    } else if (theme === 'mesa') {
      roadMat.color.set(0xc4a06c);
      laneMat.color.set(0xf3e6cc);
    }
    if (inkStyle) {
      roadMat.color.set(0x1c140e);
      laneMat.color.set(0xf6edd4);
    }
    worldRoot.add(road, lane);
    if (!classic) {
      const curb = new THREE.Mesh(
        buildRibbon(map.main.points, 1.02, 0.07),
        surfaceMaterial(inkStyle ? 0xc42318 : 0x8d8478, { factor: -1 }),
      );
      curb.receiveShadow = true;
      worldRoot.add(curb);
    }
    trailRibbon = new THREE.Mesh(
      buildRibbon(map.trail.points, 0.42, 0.12),
      surfaceMaterial(inkStyle ? 0x1c140e : 0x6e5a40, { factor: -1 }),
    );
    trailRibbon.receiveShadow = true;
    worldRoot.add(trailRibbon);

    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240, 24, 24),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: waterUniforms,
        vertexShader: `
          varying vec3 vW;
          uniform float uTime;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            world.y += sin(world.x * 0.32 + uTime) * 0.07 + sin(world.z * 0.24 + uTime * 1.15) * 0.05;
            vW = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `,
        fragmentShader: `
          varying vec3 vW;
          uniform float uTime;
          void main() {
            float wave = sin(vW.x * 0.15 + vW.z * 0.04 + uTime * 0.65);
            float swell = sin(vW.x * 0.05 - vW.z * 0.08 + uTime * 0.35);
            float crest = clamp(wave * 0.6 + swell * 0.4, -1.0, 1.0);
            vec3 deep = vec3(0.02, 0.16, 0.30);
            vec3 shallow = vec3(0.10, 0.48, 0.58);
            vec3 col = mix(deep, shallow, crest * 0.5 + 0.5);
            vec3 normal = normalize(vec3(-cos(vW.x * 0.32 + uTime) * 0.12, 1.0, -cos(vW.z * 0.22 + uTime * 1.1) * 0.08));
            vec3 viewDir = normalize(cameraPosition - vW);
            float fres = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
            vec3 sunDir = normalize(vec3(0.55, 0.72, 0.22));
            float spec = pow(max(dot(normal, normalize(viewDir + sunDir)), 0.0), 90.0);
            col = mix(col, vec3(0.62, 0.82, 0.88), fres * 0.55);
            col += vec3(1.0, 0.9, 0.7) * spec * 0.7;
            float shore = smoothstep(9.2, 6.15, vW.x);
            float foam = smoothstep(0.82, 0.97, shore) * (0.65 + 0.35 * sin(vW.z * 1.7 + uTime * 1.4));
            col = mix(col, vec3(0.9, 0.86, 0.75), shore * 0.28 + foam * 0.55);
            gl_FragColor = vec4(col, 0.94);
          }
        `,
      }),
    );
    if (inkStyle) {
      water.material.fragmentShader = INK_WATER;
      water.material.needsUpdate = true;
    } else if (classic) {
      water.material.fragmentShader = `
        varying vec3 vW;
        uniform float uTime;
        void main() {
          float wave = sin(vW.x * 0.16 + vW.z * 0.045 + uTime * 0.7);
          float swell = sin(vW.x * 0.05 - vW.z * 0.09 + uTime * 0.4);
          float crest = clamp(wave * 0.62 + swell * 0.38, -1.0, 1.0);
          vec3 col = mix(vec3(0.04, 0.22, 0.36), vec3(0.22, 0.58, 0.64), crest * 0.5 + 0.5);
          float shore = smoothstep(10.5, 6.3, vW.x);
          col = mix(col, vec3(0.86, 0.80, 0.66), shore * 0.72);
          gl_FragColor = vec4(col, 0.96);
        }
      `;
      water.material.needsUpdate = true;
    }
    water.rotation.x = -Math.PI / 2;
    if (theme === 'island') water.position.set(0, -0.5, 0);
    else if (theme === 'coast') water.position.set(36, -0.42, -4);
    else water.visible = false;
    worldRoot.add(water);
    if (theme === 'walls') {
      addWaterBand(0, 30, 70, 16, 0x1a4a62);
      addWaterBand(0, -30, 70, 14, 0x1a4a62);
    } else if (theme === 'plain') {
      addWaterBand(0, -16.5, 36, 7, 0x3a5c52);
    } else if (theme === 'mesa') {
      addWaterBand(23.5, 0, 9, 52, 0x2a6e68);
    }

    scatterNature();
    if (!classic && (inkStyle || (map.theme || 'coast') === 'coast')) addClouds();
    buildProps();
    placePads();
    applyView();
    mainArrows = makeArrows(Math.max(8, Math.floor(map.main.length / 2.7)), 0xc4895a);
    trailArrows = makeArrows(Math.max(4, Math.floor(map.trail.length / 2.3)), 0x8a6244);
    worldRoot.add(mainArrows, trailArrows);
  }

  function makeArrows(count, color) {
    const material = inkStyle
      ? new THREE.MeshToonMaterial({ color: 0x1c140e, gradientMap: inkRamp() })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(inkStyle ? 0.22 : 0.16, 0.05, inkStyle ? 0.48 : 0.38),
      material,
      count,
    );
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.count = count;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  }

  function dressIsland() {
    const stone = std(0xc8b89a, { roughness: 0.86 });
    const dark = std(0x8d7d68, { roughness: 0.9 });
    for (let i = 0; i < 18; i += 1) {
      const angle = (i / 18) * Math.PI * 2;
      const wx = Math.sin(angle) * 6.3;
      const wz = Math.cos(angle) * 6.3;
      if (map.pads.some((pad) => Math.hypot(pad.x - wx, pad.z - wz) < 1.8)) continue;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.15, 0.45), i % 2 ? stone : dark);
      wall.position.set(wx, 0.7, wz);
      wall.rotation.y = angle;
      wall.castShadow = true;
      wall.receiveShadow = true;
      worldRoot.add(wall);
    }
    const palace = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 2.2), std(0xe7d7b4, { roughness: 0.75 }));
    palace.position.set(0, 0.9, 0.2);
    palace.castShadow = true;
    worldRoot.add(palace);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.7, 4), std(0x8d3a28));
    roof.position.set(0, 1.85, 0.2);
    roof.rotation.y = Math.PI / 4;
    worldRoot.add(roof);
    for (const [x, z, yaw] of [[18, 8, 0.4], [16, -9, -0.6], [-14, 8, 1.2], [-16, -6, 2.2], [8, 16, -1], [-6, -16, 0.8]]) {
      const hull = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.26, 2), std(0x6a341c, { roughness: 0.6 }));
      hull.position.y = 0.1;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.2, 5), std(0xe7d7b8));
      mast.position.y = 0.7;
      const ship = new THREE.Group();
      ship.add(hull, mast);
      ship.position.set(x, -0.35, z);
      ship.rotation.y = yaw;
      ship.userData.baseY = -0.35;
      worldRoot.add(ship);
      ships.push(ship);
    }
  }

  function dressWalls() {
    const stone = std(0xb7aa96, { roughness: 0.88 });
    const dark = std(0x7d746c, { roughness: 0.92 });
    for (let z = -20; z <= 18; z += 4) {
      if (map.pads.some((pad) => Math.hypot(pad.x + 0.35, pad.z - z) < 1.8)) continue;
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.7, 3.6), (z / 4) % 2 ? stone : dark);
      block.position.set(-0.35, 0.85, z);
      block.castShadow = true;
      block.receiveShadow = true;
      worldRoot.add(block);
      if (z % 8 === 0) {
        const tower = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.3, 1.3), stone);
        tower.position.set(-0.35, 1.15, z);
        tower.castShadow = true;
        worldRoot.add(tower);
      }
    }
    const plaster = std(0xe6d8c4, { roughness: 0.8 });
    const tile = std(0x8d3a2c, { roughness: 0.7 });
    for (const [x, z] of [[-4.5, -12], [-6, -4], [-5, 4], [-6.5, 12], [-4, 18], [-7, -16]]) {
      const house = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.8), plaster);
      house.position.set(x, 0.7, z);
      house.castShadow = true;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.55, 4), tile);
      roof.position.set(x, 1.45, z);
      roof.rotation.y = 0.4;
      worldRoot.add(house, roof);
    }
    for (const [x, z] of [[8, -8], [11, 2], [9, 12], [13, -16]]) {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1, 6), std(0xc45a3a, { roughness: 0.8 }));
      tent.position.set(x, 0.5, z);
      tent.castShadow = true;
      worldRoot.add(tent);
    }
  }

  function dressPlain() {
    const white = std(0xefe6d4, { roughness: 0.78 });
    const thatch = std(0x8a5a32, { roughness: 0.9 });
    const stone = std(0xb7aa96, { roughness: 0.9 });
    const bag = std(0xd8c07a, { roughness: 0.95 });
    const hospital = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.05, 1.7), white);
    hospital.position.set(-3.4, 0.6, 3.6);
    hospital.castShadow = true;
    const hRoof = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.18, 2), std(0x8d2e28));
    hRoof.position.set(-3.4, 1.15, 3.6);
    const store = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.15, 1.8), stone);
    store.position.set(4.4, 0.65, 0.6);
    store.castShadow = true;
    const sRoof = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.16, 2.1), thatch);
    sRoof.position.set(4.4, 1.25, 0.6);
    worldRoot.add(hospital, hRoof, store, sRoof);
    const bags = [
      [-5.2, 0, 0.5, 6.5],
      [0, -4.6, 7, 0.5],
      [5.4, 0.4, 0.5, 5],
      [-1, 5.2, 6, 0.5],
    ];
    for (const [x, z, w, d] of bags) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, d), bag);
      wall.position.set(x, 0.28, z);
      wall.castShadow = true;
      worldRoot.add(wall);
    }
  }

  function scatterClassic(rng) {
    const trunk = std(0x5c4632, { roughness: 0.9 });
    const leaf = std(0x314528, { roughness: 0.85 });
    const rockMat = std(0x7b756c, { roughness: 0.95 });
    let trees = 0;
    for (let i = 0; i < 500 && trees < 40; i += 1) {
      const x = -20 + rng() * 18;
      const z = -36 + rng() * 68;
      const h = terrainHeight(x, z);
      if (h < 0.4 || h > 3.4) continue;
      if (distToPath(x, z, map.main.points) < 2.7) continue;
      if (distToPath(x, z, map.trail.points) < 1.7) continue;
      if (map.pads.some((pad) => Math.hypot(pad.x - x, pad.z - z) < 1.8)) continue;
      const scale = 0.75 + rng() * 0.85;
      const tree = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.55, 6), trunk);
      stem.position.y = 0.25;
      stem.castShadow = true;
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.38 * scale, 1.7 * scale, 7), leaf);
      crown.position.y = 0.7 + 0.55 * scale;
      crown.castShadow = true;
      tree.add(stem, crown);
      tree.position.set(x, h, z);
      worldRoot.add(tree);
      trees += 1;
    }
    let rocks = 0;
    for (let i = 0; i < 300 && rocks < 26; i += 1) {
      const x = -20 + rng() * 16;
      const z = -36 + rng() * 70;
      const h = terrainHeight(x, z);
      if (h < 1.1) continue;
      if (distToPath(x, z, map.main.points) < 2.2) continue;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 + rng() * 0.45, 0), rockMat);
      rock.position.set(x, h + 0.15, z);
      rock.rotation.set(rng(), rng(), rng());
      rock.castShadow = true;
      worldRoot.add(rock);
      rocks += 1;
    }
  }

  function addWaterBand(x, z, width, depth, color) {
    const material = inkStyle
      ? new THREE.MeshToonMaterial({
        color,
        gradientMap: inkRamp(),
        transparent: true,
        opacity: 0.94,
        depthWrite: false,
      })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.15, transparent: true, opacity: 0.92 });
    const band = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      material,
    );
    band.rotation.x = -Math.PI / 2;
    band.position.set(x, -0.28, z);
    worldRoot.add(band);
  }

  function scatterNature() {
    const rng = mulberry32(480);
    const theme = map.theme || 'coast';
    if (theme !== 'coast') {
      scatterLocal(rng, theme);
      return;
    }
    if (graphicsVersion === 1) {
      scatterClassic(rng);
      return;
    }
    const trunkMat = std(0x4e3828, { roughness: 0.9 });
    const rockMat = std(0x8a8176, { roughness: 0.94 });
    const darkRock = std(0x5e574e, { roughness: 0.96 });
    let trees = 0;
    for (let i = 0; i < 700 && trees < 58; i += 1) {
      const x = -20 + rng() * 18;
      const z = -36 + rng() * 68;
      const h = terrainHeight(x, z);
      if (h < 0.35 || h > 3.6) continue;
      if (distToPath(x, z, map.main.points) < 2.6) continue;
      if (distToPath(x, z, map.trail.points) < 1.6) continue;
      if (map.pads.some((pad) => Math.hypot(pad.x - x, pad.z - z) < 1.8)) continue;
      const scale = 0.85 + rng() * 0.9;
      const tree = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 0.7, 6), trunkMat);
      stem.position.y = 0.32;
      stem.castShadow = true;
      tree.add(stem);
      [0x1c3022, 0x2c4a32, 0x4d6a40].forEach((color, layer) => {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry((0.46 - layer * 0.1) * scale, (1.25 - layer * 0.18) * scale, 7),
          std(color, { roughness: 0.88 }),
        );
        cone.position.y = 0.75 + layer * 0.48 * scale;
        cone.castShadow = true;
        tree.add(cone);
      });
      tree.position.set(x, h, z);
      tree.rotation.y = rng() * Math.PI * 2;
      worldRoot.add(tree);
      trees += 1;
    }
    let rocks = 0;
    for (let i = 0; i < 360 && rocks < 34; i += 1) {
      const x = -20 + rng() * 17;
      const z = -36 + rng() * 70;
      const h = terrainHeight(x, z);
      if (h < 0.9) continue;
      if (distToPath(x, z, map.main.points) < 2.1) continue;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.22 + rng() * 0.55, 0),
        rng() > 0.5 ? rockMat : darkRock,
      );
      rock.position.set(x, h + 0.12, z);
      rock.rotation.set(rng(), rng(), rng());
      rock.scale.y = 0.55 + rng() * 0.5;
      rock.castShadow = true;
      rock.receiveShadow = true;
      worldRoot.add(rock);
      rocks += 1;
    }
    const shrubMat = std(0x6f7a32, { roughness: 0.9 });
    let shrubs = 0;
    for (let i = 0; i < 400 && shrubs < 46; i += 1) {
      const x = -4 + rng() * 10;
      const z = -32 + rng() * 62;
      const h = terrainHeight(x, z);
      if (Math.abs(h) > 0.35) continue;
      if (distToPath(x, z, map.main.points) < 1.5) continue;
      if (x > 5.3) continue;
      const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18 + rng() * 0.16, 0), shrubMat);
      shrub.scale.y = 0.55;
      shrub.position.set(x, h + 0.08, z);
      shrub.castShadow = true;
      worldRoot.add(shrub);
      shrubs += 1;
    }
    const blades = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.05, 0.32, 4),
      std(0x7ea23a, { roughness: 0.95 }),
      320,
    );
    let grown = 0;
    for (let i = 0; i < 1600 && grown < 320; i += 1) {
      const x = -3.2 + rng() * 8.4;
      const z = -31 + rng() * 60;
      const h = terrainHeight(x, z);
      if (h < -0.02 || h > 0.22) continue;
      if (distToPath(x, z, map.main.points) < 1.25) continue;
      if (x > 5.2) continue;
      dummy.position.set(x, h + 0.12, z);
      dummy.rotation.set(0, rng() * 6, 0);
      const s = 0.7 + rng() * 0.9;
      dummy.scale.set(s, 0.55 + rng() * 1.1, s);
      dummy.updateMatrix();
      blades.setMatrixAt(grown, dummy.matrix);
      grown += 1;
    }
    blades.count = grown;
    blades.receiveShadow = true;
    worldRoot.add(blades);
  }

  function addClouds() {
    if (graphicsVersion === 1 || inkStyle) return;
    const texture = canvasTexture((ctx, size) => {
      ctx.clearRect(0, 0, size, size);
      ctx.beginPath();
      ctx.ellipse(size * 0.38, size * 0.55, size * 0.28, size * 0.12, 0, 0, Math.PI * 2);
      ctx.ellipse(size * 0.55, size * 0.48, size * 0.22, size * 0.11, 0, 0, Math.PI * 2);
      ctx.ellipse(size * 0.68, size * 0.58, size * 0.16, size * 0.08, 0, 0, Math.PI * 2);
      if (inkStyle) {
        ctx.fillStyle = '#f7f1e4';
        ctx.fill();
        ctx.lineWidth = size * 0.035;
        ctx.strokeStyle = '#1c140e';
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255, 247, 236, 0.92)';
        ctx.fill();
      }
    }, 256);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: inkStyle ? 1 : 0.72,
    });
    const spots = [
      [-8, 34, 18, 18],
      [14, 30, -8, 22],
      [6, 38, -24, 16],
      [-16, 28, -12, 14],
      [22, 36, 10, 20],
    ];
    for (const [x, y, z, scale] of spots) {
      const cloud = new THREE.Sprite(material);
      cloud.position.set(x, y, z);
      cloud.scale.set(scale, scale * 0.45, 1);
      worldRoot.add(cloud);
    }
  }

  function scatterLocal(rng, theme) {
    if (theme === 'mesa') {
      const rockMat = std(0xc4a078, { roughness: 0.95 });
      const scrub = std(0x8a6a3a, { roughness: 0.9 });
      for (let i = 0; i < 22; i += 1) {
        const x = -20 + rng() * 40;
        const z = -18 + rng() * 36;
        const summit = (x / 8.2) ** 2 + (z / 10.4) ** 2;
        if (summit < 1.35) continue;
        if (distToPath(x, z, map.main.points) < 2.2) continue;
        if (distToPath(x, z, map.trail.points) < 2) continue;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18 + rng() * 0.35, 0), rockMat);
        const h = terrainHeight(x, z);
        rock.position.set(x, h + 0.1, z);
        rock.rotation.set(rng(), rng(), 0);
        rock.scale.y = 0.45;
        worldRoot.add(rock);
        if (i % 2 === 0) {
          const bush = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 5), scrub);
          bush.position.set(x + 0.4, h + 0.12, z - 0.3);
          worldRoot.add(bush);
        }
      }
      return;
    }
    if (theme === 'plain') {
      const trunk = std(0x6a4a32, { roughness: 0.9 });
      const canopy = std(0x6a7a3a, { roughness: 0.85 });
      for (let i = 0; i < 18; i += 1) {
        const x = -14 + rng() * 28;
        const z = -8 + rng() * 22;
        if (Math.hypot(x, z) < 8) continue;
        if (distToPath(x, z, map.main.points) < 2) continue;
        const tree = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.7, 5), trunk);
        stem.position.y = 0.35;
        const top = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), canopy);
        top.scale.y = 0.35;
        top.position.y = 0.85;
        tree.add(stem, top);
        tree.position.set(x, terrainHeight(x, z), z);
        worldRoot.add(tree);
      }
      return;
    }
    if (theme === 'walls') {
      const rockMat = std(0x8a8176, { roughness: 0.95 });
      for (let i = 0; i < 12; i += 1) {
        const x = 6 + rng() * 10;
        const z = -18 + rng() * 36;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + rng() * 0.25, 0), rockMat);
        rock.position.set(x, 0.15, z);
        rock.rotation.set(rng(), rng(), 0);
        worldRoot.add(rock);
      }
    }
  }

  function dressMesa() {
    const stone = std(0xe7dcc4, { roughness: 0.9 });
    const shade = std(0xc4a888, { roughness: 0.92 });
    const nearPad = (x, z, r = 1.8) => map.pads.some((pad) => Math.hypot(pad.x - x, pad.z - z) < r);
    for (let i = 0; i < 18; i += 1) {
      const angle = (i / 18) * Math.PI * 2;
      const x = Math.sin(angle) * 6.5;
      const z = Math.cos(angle) * 8.4;
      if (nearPad(x, z)) continue;
      if (distToPath(x, z, map.main.points) < 1.7) continue;
      if (distToPath(x, z, map.trail.points) < 1.5) continue;
      const block = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.15, 0.45), i % 2 ? stone : shade);
      block.position.set(x, terrainHeight(x, z) + 0.58, z);
      block.rotation.y = angle;
      block.castShadow = true;
      block.receiveShadow = true;
      worldRoot.add(block);
    }
    const palace = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.15, 1.6), stone);
    palace.position.set(2.4, 0.7, 9.1);
    palace.castShadow = true;
    const terrace = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.45, 2.2), shade);
    terrace.position.set(2.4, 0.22, 8.6);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 1.8), std(0xc45a38));
    roof.position.set(2.4, 1.32, 9.1);
    worldRoot.add(palace, terrace, roof);
    const stores = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 3.2), shade);
    stores.position.set(-4.8, 0.5, 4.8);
    stores.castShadow = true;
    worldRoot.add(stores);
    const bath = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 1.5), stone);
    bath.position.set(0.2, 0.42, -0.6);
    bath.castShadow = true;
    worldRoot.add(bath);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.3, 1.1), std(0x8a5a3c));
    tower.position.set(-13.6, 1.15, 2.3);
    tower.castShadow = true;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 1.4), shade);
    top.position.set(-13.6, 2.35, 2.3);
    worldRoot.add(tower, top);
    for (const [x, z] of [[-16.6, -3.6], [-15.2, 3.6], [-18.4, 2.2]]) {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.85, 4), std(0x8d2e28));
      const h = terrainHeight(x, z);
      tent.position.set(x, h + 0.42, z);
      tent.castShadow = true;
      worldRoot.add(tent);
    }
  }

  function buildProps() {
    const theme = map.theme || 'coast';
    if (theme === 'mesa') {
      dressMesa();
      return;
    }
    if (theme === 'island') {
      dressIsland();
      return;
    }
    if (theme === 'walls') {
      dressWalls();
      return;
    }
    if (theme === 'plain') {
      dressPlain();
      return;
    }
    const start = map.main.points[0];
    const end = map.main.points[map.main.points.length - 1];
    const gateDist = map.main.cum[map.joinIndex] || 0;
    const gate = pointAlong(map.main, gateDist);
    const glen = Math.hypot(gate.dx, gate.dz) || 1;
    const px = -gate.dz / glen;
    const pz = gate.dx / glen;

    for (const sign of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.45, 0.72), std(0x90887e, { roughness: 0.94 }));
      pillar.position.set(gate.x + px * sign * 1.9, 0.72, gate.z + pz * sign * 1.9);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.16, 0.95), std(0x6d655c, { roughness: 0.9 }));
      cap.position.set(pillar.position.x, 1.5, pillar.position.z);
      cap.castShadow = true;
      worldRoot.add(pillar, cap);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.28, 0.62), std(0x7c756c, { roughness: 0.9 }));
    lintel.position.set(gate.x, 1.62, gate.z);
    lintel.rotation.y = Math.atan2(-pz, px);
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    if (graphicsVersion > 1) worldRoot.add(lintel);
    else lintel.geometry.dispose();

    const steamMat = () => uniqueBasic(0xf7f1e6, 0.22);
    for (let i = 0; i < 8; i += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), steamMat());
      puff.userData.seed = i * 0.37;
      puff.position.set(gate.x, 0.3, gate.z);
      worldRoot.add(puff);
      steams.push(puff);
    }

    const camp = new THREE.Group();
    camp.position.set(end.x, 0, end.z);
    const tents = [
      [-1.7, 0.6, 0x8f2d28],
      [1.6, 0.2, 0xd9c7a2],
      [-1.2, -1.2, 0x2c4d73],
    ];
    for (const [x, z, color] of tents) {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.95, 4), std(color, { roughness: 0.85 }));
      tent.position.set(x, 0.48, z);
      tent.rotation.y = 0.5;
      tent.castShadow = true;
      camp.add(tent);
    }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 2.2, 6), std(0x6a5340));
    pole.position.set(-0.9, 1.1, 1.1);
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.78),
      std(0x1d3f74, { side: THREE.DoubleSide, roughness: 0.8 }),
    );
    cloth.position.set(-0.55, 1.7, 1.1);
    const fire = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), uniqueBasic(0xff7a32));
    fire.position.set(0.55, 0.22, -0.4);
    campFire = fire;
    const fireLight = new THREE.PointLight(0xff7a3c, 1.5, 10, 2);
    fireLight.position.set(0.55, 0.7, -0.4);
    if (graphicsVersion > 1) for (let i = 0; i < 9; i += 1) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.85, 5), std(0x6a5038));
      const angle = -0.8 + i * 0.22;
      post.position.set(Math.cos(angle) * 2.1, 0.42, Math.sin(angle) * 1.5 - 0.2);
      post.castShadow = true;
      camp.add(post);
    }
    camp.add(pole, cloth, fire, fireLight);
    worldRoot.add(camp);

    for (const sign of [-1, 1]) {
      const bannerPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 1.8, 5), std(0x5a4030));
      bannerPole.position.set(start.x + sign * 1.6, 0.9, start.z + 0.4);
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.55, 0.7),
        std(0x8d1d1d, { side: THREE.DoubleSide }),
      );
      flag.position.set(start.x + sign * 1.25, 1.45, start.z + 0.4);
      worldRoot.add(bannerPole, flag);
    }

    const hullMat = std(0x6a341c, { roughness: 0.62 });
    const sailTex = canvasTexture((ctx, size) => {
      ctx.fillStyle = '#f4efe4';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#8d1e1e';
      ctx.fillRect(0, size * 0.42, size, size * 0.12);
      ctx.fillStyle = '#c4a15a';
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.28, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
    });
    const sailMat = new THREE.MeshStandardMaterial({ map: sailTex, roughness: 0.75, side: THREE.DoubleSide });
    const spots = [
      [13, 10, 0.5],
      [17.5, -2, -0.4],
      [15, -16, 0.25],
      [20, 18, -0.15],
      [12.2, -28, 0.7],
    ];
    for (const [x, z, yaw] of spots) {
      if (graphicsVersion === 1) {
        const ship = new THREE.Group();
        const hull = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.32, 2.3), hullMat);
        hull.position.y = 0.16;
        hull.castShadow = true;
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 1.5, 6), std(0xd7c7a4));
        mast.position.y = 0.95;
        const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.9), std(0xefe2cc, { side: THREE.DoubleSide, roughness: 0.8 }));
        sail.position.set(0, 1.1, 0);
        ship.add(hull, mast, sail);
        ship.position.set(x, -0.2, z);
        ship.rotation.y = yaw;
        ship.userData.baseY = -0.2;
        worldRoot.add(ship);
        ships.push(ship);
        continue;
      }
      const ship = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.28, 2.15), hullMat);
      hull.position.y = 0.16;
      hull.castShadow = true;
      const prow = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.7, 4), hullMat);
      prow.rotation.x = -Math.PI / 2;
      prow.position.set(0, 0.16, 1.25);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.06, 2.05), std(0xe6c98a, { metalness: 0.4, roughness: 0.4 }));
      stripe.position.y = 0.28;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.7, 6), std(0xe7d7b8));
      mast.position.y = 1.05;
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.05), sailMat);
      sail.position.set(0, 1.2, 0);
      const yard = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.04, 0.04), std(0x6a5038));
      yard.position.y = 1.7;
      ship.add(hull, prow, stripe, mast, sail, yard);
      ship.position.set(x, -0.18, z);
      ship.rotation.y = yaw;
      ship.userData.baseY = -0.18;
      worldRoot.add(ship);
      ships.push(ship);
    }
    if (graphicsVersion === 1) {
      sailMat.map.dispose();
      sailMat.dispose();
    }

  }

  function placePads() {
    map.pads.forEach((pad, index) => {
      const material = inkStyle
        ? new THREE.MeshToonMaterial({
          color: 0xf4ecd6,
          gradientMap: inkRamp(),
          emissive: 0x3a2418,
          emissiveIntensity: 0.15,
        })
        : new THREE.MeshStandardMaterial({
          color: 0xe7dcc8,
          roughness: 0.55,
          metalness: 0.08,
          emissive: 0x3a2c18,
          emissiveIntensity: 0.35,
        });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.22, inkStyle ? 6 : 10), material);
      const ground = terrainHeight(pad.x, pad.z);
      mesh.position.set(pad.x, ground + 0.16, pad.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.kind = 'pad';
      mesh.userData.index = index;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(inkStyle ? 1.18 : 0.92, inkStyle ? 0.1 : 0.07, 8, inkStyle ? 6 : 28),
        inkStyle
          ? new THREE.MeshBasicMaterial({ color: 0x1c140e })
          : new THREE.MeshStandardMaterial({
            color: 0xf0d090,
            emissive: 0xc48a2a,
            emissiveIntensity: 0.85,
            metalness: 0.6,
            roughness: 0.28,
          }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = inkStyle ? 0.2 : 0.14;
      mesh.add(ring);
      worldRoot.add(mesh);
      padMeshes.push(mesh);
    });
  }

  function buildLabels() {
    while (labelLayer.children.length) {
      const child = labelLayer.children[0];
      labelLayer.remove(child);
      disposeObject(child);
    }
    const end = map.main.points[map.main.points.length - 1];
    const start = map.main.points[0];
    const trail = map.trail.points[0];
    const gate = pointAlong(map.main, map.main.cum[map.joinIndex] || 0);
    const labels = map.labels || {
      camp: 'Greek camp',
      attack: 'Persia',
      trail: 'Goat trail',
      landmark: 'Hot Gates',
    };
    const specs = [
      [labels.camp, end.x, 2.6, end.z - 0.2],
      [labels.attack, start.x, 2.3, start.z + 1.2],
      [labels.trail, trail.x + 0.4, 2.4, trail.z],
      [labels.landmark, gate.x, 2.5, gate.z],
    ];
    for (const [text, x, y, z] of specs) {
      const sprite = textSprite(text, inkStyle ? '#1c140e' : '#f6edd9');
      sprite.position.set(x, y, z);
      sprite.scale.set(4.4, 1.1, 1);
      labelLayer.add(sprite);
    }
  }

  function addBands(group) {
    const colors = inkStyle ? [0xc42318, 0xe0a030] : [0xc4a15a, 0xf0d7a2];
    const bands = colors.map((color, index) => {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(inkStyle ? 0.98 : 0.8, inkStyle ? 0.055 : 0.035, 6, inkStyle ? 6 : 18),
        std(color, { metalness: 0.55, roughness: 0.35 }),
      );
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.2 + index * 0.08;
      band.visible = false;
      group.add(band);
      return band;
    });
    group.userData.bands = bands;
  }

  function stone(parent, radius, height, color) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.06, height, 10), std(color, { roughness: 0.95 }));
    mesh.position.y = height / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
  }

  function makeTower(tower) {
    const group = new THREE.Group();
    group.userData.kind = 'tower';
    group.userData.id = tower.id;
    const kind = tower.hero ? 'hero' : tower.type;
    if (graphicsVersion >= 4) {
      buildTowerV4(group, kind, { std, basic: uniqueBasic, addBands });
      if (!tower.hero) group.scale.setScalar(1.2);
    } else if (graphicsVersion >= 3) {
      buildTowerV3(group, kind, { std, basic: uniqueBasic, addBands });
      if (!tower.hero) group.scale.setScalar(1.18);
    } else if (tower.hero) buildHero(group);
    else if (tower.type === 'archer') buildArcher(group);
    else if (tower.type === 'oil') buildOil(group);
    else if (tower.type === 'scorpion') buildScorpion(group);
    else buildHoplite(group);
    inkOutline(group);
    return group;
  }

  function buildHoplite(group) {
    stone(group, 0.72, 0.34, 0x8c847a);
    const aim = new THREE.Group();
    aim.position.y = 0.34;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.7, 8), std(0x6a5340));
    post.position.y = 0.35;
    post.castShadow = true;
    const shield = new THREE.Mesh(GEO.shield, std(0xb44828, { metalness: 0.25, roughness: 0.42 }));
    shield.rotation.x = Math.PI / 2;
    shield.position.set(0, 0.82, 0.18);
    shield.castShadow = true;
    const spear = new THREE.Mesh(GEO.spear, std(0xd2c091, { metalness: 0.45, roughness: 0.32 }));
    spear.position.set(0.22, 0.95, 0);
    spear.rotation.z = -0.2;
    const plume = new THREE.Mesh(GEO.plume, std(0x8e1e1e));
    plume.position.y = 1.22;
    aim.add(post, shield, spear, plume);
    group.add(aim);
    group.userData.aim = aim;
    addBands(group);
  }

  function buildArcher(group) {
    stone(group, 0.78, 0.28, 0x7c756c);
    for (const [x, z] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.15, 6), std(0x6b4e32));
      post.position.set(x, 0.84, z);
      post.castShadow = true;
      group.add(post);
    }
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 10), std(0x7a5a38));
    deck.position.y = 1.42;
    deck.castShadow = true;
    group.add(deck);
    const aim = new THREE.Group();
    aim.position.y = 1.5;
    const body = new THREE.Mesh(GEO.body, std(0x355c32));
    body.scale.setScalar(0.55);
    body.position.y = 0.25;
    body.castShadow = true;
    const head = new THREE.Mesh(GEO.head, std(0xd2b48a));
    head.scale.setScalar(0.55);
    head.position.y = 0.58;
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.018, 6, 16, Math.PI), std(0xc2a36a));
    bow.rotation.y = Math.PI / 2;
    bow.position.set(0, 0.38, 0.12);
    aim.add(body, head, bow);
    group.add(aim);
    group.userData.aim = aim;
    addBands(group);
  }

  function buildScorpion(group) {
    stone(group, 0.82, 0.24, 0x6e675f);
    const aim = new THREE.Group();
    aim.position.y = 0.42;
    const armGeo = new THREE.BoxGeometry(0.08, 0.08, 1.2);
    const armMat = std(0x5c4632);
    const armL = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-0.18, 0.16, 0.28);
    armL.castShadow = true;
    const armR = new THREE.Mesh(armGeo, armMat);
    armR.position.set(0.18, 0.16, 0.28);
    armR.castShadow = true;
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.95), std(0x3e342c));
    spine.position.set(0, 0.12, 0.16);
    const bolt = new THREE.Mesh(GEO.spear, std(0x2c2c2a, { metalness: 0.35 }));
    bolt.rotation.x = Math.PI / 2;
    bolt.scale.set(0.7, 0.7, 0.7);
    bolt.position.set(0, 0.2, 0.4);
    aim.add(armL, armR, spine, bolt);
    group.add(aim);
    group.userData.aim = aim;
    addBands(group);
  }

  function buildOil(group) {
    stone(group, 0.74, 0.3, 0x7a6558);
    const aim = new THREE.Group();
    aim.position.y = 0.3;
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), std(0x4a4038, { metalness: 0.4, roughness: 0.38 }));
    pot.scale.y = 0.72;
    pot.position.y = 0.4;
    pot.castShadow = true;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 8), uniqueBasic(0xff5a1a));
    flame.position.y = 0.78;
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 6), uniqueBasic(0xffd27a));
    core.position.y = 0.84;
    const light = new THREE.PointLight(0xff6a2a, 0.8, 6, 2);
    light.position.y = 0.9;
    aim.add(pot, flame, core, light);
    group.add(aim);
    group.userData.aim = aim;
    group.userData.flame = flame;
    group.userData.core = core;
    addBands(group);
  }

  function buildHero(group) {
    const aim = new THREE.Group();
    const body = new THREE.Mesh(GEO.body, std(0x8d1f1f));
    body.position.y = 0.72;
    body.castShadow = true;
    const head = new THREE.Mesh(GEO.head, std(0xd7b894));
    head.position.y = 1.22;
    const plume = new THREE.Mesh(GEO.plume, std(0xc81e1e));
    plume.position.y = 1.55;
    plume.scale.setScalar(1.35);
    const shield = new THREE.Mesh(GEO.shield, std(0xb08a3e, { metalness: 0.5, roughness: 0.32 }));
    shield.rotation.x = Math.PI / 2;
    shield.position.set(-0.2, 0.78, 0.2);
    shield.scale.setScalar(1.3);
    shield.castShadow = true;
    const spear = new THREE.Mesh(GEO.spear, std(0xe6d7a8, { metalness: 0.55, roughness: 0.28 }));
    spear.position.set(0.22, 1.0, 0.08);
    const cape = new THREE.Mesh(GEO.cape, std(0x7a1420, { side: THREE.DoubleSide }));
    cape.position.set(0, 0.78, -0.16);
    aim.add(body, head, plume, shield, spear, cape);
    group.add(aim);
    group.userData.aim = aim;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.12, 28),
      new THREE.MeshBasicMaterial({ color: 0xe6c36a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    group.add(ring);
  }

  function makeSoldier(enemy) {
    const group = new THREE.Group();
    const colors = {
      infantry: [0x9c3030, 0xb08a4a, 0x8e1e1e],
      skirmisher: [0xc2a05a, 0x6a5340, 0],
      shield: [0x8d9284, 0x2f3b32, 0x5c1d1d],
      immortal: [0x6a2a78, 0xe1b84a, 0xe1b84a],
      champion: [0x1c140f, 0xe6c36a, 0xe6c36a],
    };
    const [tunic, shieldColor, plumeColor] = colors[enemy.type] || colors.infantry;
    const body = new THREE.Mesh(GEO.body, std(tunic));
    body.position.y = 0.55;
    body.castShadow = true;
    const head = new THREE.Mesh(GEO.head, std(0xd2b48a));
    head.position.y = 1.02;
    head.castShadow = true;
    group.add(body, head);
    if (enemy.type !== 'skirmisher') {
      const shieldMesh = new THREE.Mesh(GEO.shield, std(shieldColor, { metalness: 0.25, roughness: 0.45 }));
      shieldMesh.rotation.x = Math.PI / 2;
      shieldMesh.position.set(0, 0.62, 0.24);
      shieldMesh.scale.setScalar(enemy.type === 'shield' || enemy.type === 'champion' ? 1.35 : 1);
      const boss = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), std(0xf2e2b4, { metalness: 0.75, roughness: 0.22 }));
      boss.position.set(0, 0.62, 0.3);
      group.add(shieldMesh, boss);
    }
    if (enemy.type === 'infantry' || enemy.type === 'immortal' || enemy.type === 'champion') {
      const spear = new THREE.Mesh(GEO.spear, std(0xc4b48a, { metalness: 0.35 }));
      spear.position.set(0.16, 0.75, 0.05);
      spear.rotation.z = -0.35;
      group.add(spear);
    }
    if (enemy.type === 'skirmisher') {
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.015, 5, 12, Math.PI), std(0x6a4a2c));
      bow.position.set(0.1, 0.7, 0.1);
      bow.rotation.y = Math.PI / 2;
      group.add(bow);
    }
    if (plumeColor) {
      const plume = new THREE.Mesh(GEO.plume, std(plumeColor));
      plume.position.y = 1.28;
      group.add(plume);
    }
    if (enemy.type === 'champion') {
      const hornL = new THREE.Mesh(GEO.horn, std(0xe6c36a, { metalness: 0.6 }));
      hornL.position.set(-0.1, 1.22, 0);
      hornL.rotation.z = 0.6;
      const hornR = hornL.clone();
      hornR.position.x = 0.1;
      hornR.rotation.z = -0.6;
      const cape = new THREE.Mesh(GEO.cape, std(0x4a1010, { side: THREE.DoubleSide }));
      cape.position.set(0, 0.7, -0.18);
      cape.scale.setScalar(1.2);
      group.add(hornL, hornR, cape);
    }
    return group;
  }

  function makeCavalry() {
    const group = new THREE.Group();
    const horse = new THREE.Mesh(GEO.horse, std(0x6a432c));
    horse.position.y = 0.42;
    horse.castShadow = true;
    group.add(horse);
    const legs = [
      [-0.1, 0.16, 0.28],
      [0.1, 0.16, 0.28],
      [-0.1, 0.16, -0.28],
      [0.1, 0.16, -0.28],
    ];
    for (const [x, y, z] of legs) {
      const leg = new THREE.Mesh(GEO.leg, std(0x4a301f));
      leg.position.set(x, y, z);
      group.add(leg);
    }
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.28), std(0x5a3824));
    neck.position.set(0, 0.58, 0.32);
    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.7), std(0x1c140f));
    mane.position.set(0, 0.6, 0.02);
    const rider = new THREE.Mesh(GEO.body, std(0x7d1f1f));
    rider.scale.setScalar(0.62);
    rider.position.set(0, 0.78, -0.05);
    rider.castShadow = true;
    const head = new THREE.Mesh(GEO.head, std(0xd2b48a));
    head.scale.setScalar(0.62);
    head.position.set(0, 1.12, -0.05);
    const helm = new THREE.Mesh(GEO.plume, std(0xc81e1e));
    helm.scale.setScalar(0.55);
    helm.position.set(0, 1.32, -0.05);
    group.add(neck, mane, rider, head, helm);
    return group;
  }

  function makeEnemy(enemy) {
    const group = enemy.type === 'cavalry' ? makeCavalry() : makeSoldier(enemy);
    inkOutline(group);
    const bar = new THREE.Group();
    const back = new THREE.Mesh(GEO.bar, new THREE.MeshBasicMaterial({ color: 0x1a1210 }));
    back.scale.set(0.8, 0.09, 1);
    const fill = new THREE.Mesh(GEO.bar, uniqueBasic(0xe0c36a));
    fill.position.z = 0.02;
    fill.scale.set(0.76, 0.055, 1);
    bar.add(back, fill);
    bar.position.y = enemy.boss ? 2.15 : enemy.type === 'cavalry' ? 1.45 : 1.45;
    group.add(bar);
    const flash = new THREE.Mesh(GEO.body, uniqueBasic(0xfff4dd, 0));
    flash.position.y = enemy.type === 'cavalry' ? 0.55 : 0.65;
    flash.scale.setScalar(1.2);
    group.add(flash);
    group.userData.bar = bar;
    group.userData.fill = fill;
    group.userData.flash = flash;
    return group;
  }

  function makeShot(kind) {
    if (kind === 'oil') {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), uniqueBasic(0xff6a1a));
      return mesh;
    }
    const color = kind === 'bolt' ? 0x2a2a28 : kind === 'arrow' ? 0xe7d7b0 : 0xd2c091;
    const mesh = new THREE.Mesh(GEO.spear, std(color, { metalness: 0.4, roughness: 0.35 }));
    const scale = kind === 'arrow' ? 0.45 : kind === 'bolt' ? 0.7 : 0.55;
    mesh.scale.setScalar(scale);
    mesh.userData.px = 0;
    mesh.userData.pz = 0;
    return mesh;
  }

  function makeEffect(effect) {
    if (effect.kind === 'popup') {
      const sprite = textSprite(effect.text, effect.color || '#f0d7a2');
      sprite.scale.set(1.8, 0.45, 1);
      return sprite;
    }
    if (effect.kind === 'splash') {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.25, 0.45, 24),
        uniqueBasic(0xff6a2a, 0.75),
      );
      mesh.material.side = THREE.DoubleSide;
      mesh.material.depthWrite = false;
      mesh.rotation.x = -Math.PI / 2;
      return mesh;
    }
    if (effect.kind === 'death') {
      const group = new THREE.Group();
      for (let i = 0; i < 5; i += 1) {
        const bit = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), uniqueBasic(effect.color || 0x9c3030));
        bit.userData.vx = Math.cos((i / 5) * Math.PI * 2) * 1.4;
        bit.userData.vz = Math.sin((i / 5) * Math.PI * 2) * 1.4;
        group.add(bit);
      }
      return group;
    }
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), uniqueBasic(0xfff1c9, 0.9));
    return spark;
  }

  function sync(store, items, create, update) {
    const seen = new Set();
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      seen.add(item.id);
      let object = store.get(item.id);
      if (!object) {
        object = create(item);
        store.set(item.id, object);
        dynamic.add(object);
      }
      update(object, item);
    }
    for (const [id, object] of store) {
      if (seen.has(id)) continue;
      dynamic.remove(object);
      disposeObject(object);
      store.delete(id);
    }
  }

  function updateArrows(mesh, path, offset, lift) {
    const count = mesh.userData.count;
    const spacing = path.length / count;
    for (let i = 0; i < count; i += 1) {
      const point = pointAlong(path, (i * spacing + offset) % path.length);
      const len = Math.hypot(point.dx, point.dz) || 1;
      dummy.position.set(point.x, lift, point.z);
      dummy.quaternion.setFromUnitVectors(shotDir.set(0, 0, 1), aimDir.set(point.dx / len, 0, point.dz / len));
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  function frame(state, dt) {
    clock.t += dt;
    waterUniforms.uTime.value = clock.t;
    if (state.status === 'menu' && !dragging && !reduceMotion) theta += dt * 0.045;
    applyCamera();

    if (trailRibbon) {
      const open = state.flankOpen;
      trailRibbon.material.color.setHex(
        graphicsVersion === 4 ? (open ? 0xc42318 : 0x1c140e) : (open ? 0xc46a3a : 0x6a553c),
      );
    }
    const flow = clock.t * (state.paused || state.status !== 'playing' ? 0.6 : 1.4 * state.speed);
    if (mainArrows) updateArrows(mainArrows, map.main, flow, 0.2);
    if (trailArrows) updateArrows(trailArrows, map.trail, state.flankOpen ? flow : clock.t * 0.25, 0.18);

    ships.forEach((ship, index) => {
      ship.position.y = ship.userData.baseY + Math.sin(clock.t * 0.8 + index) * 0.07;
      ship.rotation.z = Math.sin(clock.t * 0.6 + index) * 0.05;
    });
    steams.forEach((puff) => {
      const t = (clock.t * 0.28 + puff.userData.seed) % 1;
      const gate = pointAlong(map.main, map.main.cum[map.joinIndex] || 0);
      puff.position.set(gate.x + Math.sin(puff.userData.seed * 8) * 0.8, 0.25 + t * 1.7, gate.z + Math.cos(puff.userData.seed * 6) * 0.5);
      puff.scale.setScalar(0.55 + t * 1.3);
      puff.material.opacity = 0.24 * (1 - t);
    });
    if (campFire) {
      const s = 1 + Math.sin(clock.t * 9) * 0.12;
      campFire.scale.setScalar(s);
    }

    for (let i = 0; i < padMeshes.length; i += 1) {
      const mesh = padMeshes[i];
      const pad = map.pads[i];
      const occupied = state.towers.some((tower) => tower.pad === i);
      const hovered = pointerInside && api.hovered?.padIndex === i;
      const ink = graphicsVersion === 4;
      let color = occupied ? (ink ? 0x6a5344 : 0x8f877c) : (ink ? 0xf4ecd6 : 0xc4b7a4);
      if (state.selectedType && !occupied) {
        const score = coverageScore(pad.x, pad.z, TOWERS[state.selectedType].range, map.main)
          + coverageScore(pad.x, pad.z, TOWERS[state.selectedType].range, map.trail);
        color = score > 0 ? (ink ? 0xe7c56a : 0xd7c096) : (ink ? 0x9e2a22 : 0x8a4d42);
      }
      if (hovered) color = ink ? 0xfff6e4 : 0xf0e2c4;
      mesh.material.color.setHex(color);
      mesh.material.emissive.setHex(hovered ? (ink ? 0x9e2a22 : 0x3a2c18) : 0x000000);
    }

    sync(towerMeshes, state.towers, makeTower, (mesh, tower) => {
      const foot = Math.max(0, terrainHeight(tower.x, tower.z));
      mesh.position.set(tower.x, foot + (tower.hero ? 0.12 : 0.2), tower.z);
      const bands = mesh.userData.bands;
      if (bands) bands.forEach((band, index) => { band.visible = tower.level > index + 1; });
      const aim = mesh.userData.aim;
      if (aim && tower.aimX != null) {
        const desired = Math.atan2(tower.aimX - tower.x, tower.aimZ - tower.z);
        aim.rotation.y = dampAngle(aim.rotation.y, desired, dt * (state.speed || 1));
      }
      if (mesh.userData.flame) {
        const wobble = 1 + Math.sin(clock.t * 10 + tower.id) * 0.16;
        mesh.userData.flame.scale.y = wobble;
        mesh.userData.core.scale.y = 0.8 + wobble * 0.3;
      }
    });

    sync(enemyMeshes, state.enemies, makeEnemy, (mesh, enemy) => {
      mesh.position.set(enemy.x, 0.14, enemy.z);
      mesh.rotation.y = enemy.facing;
      mesh.scale.setScalar(enemy.scale);
      const ratio = Math.max(0, enemy.hp / enemy.maxHp);
      const fill = mesh.userData.fill;
      fill.scale.x = Math.max(0.02, 0.76 * ratio);
      fill.material.color.setHex(ratio < 0.35 ? 0xc4483a : 0xe0c36a);
      mesh.userData.bar.visible = enemy.boss || ratio < 0.995;
      mesh.userData.bar.lookAt(camera.position);
      const flash = mesh.userData.flash;
      flash.material.opacity = Math.max(enemy.flash * 2.4, enemy.invuln > 0 ? 0.45 : 0);
      mesh.position.y = 0.14 + Math.sin(clock.t * 7 + enemy.id) * 0.03;
    });

    sync(shotMeshes, state.projectiles, (proj) => makeShot(proj.kind), (mesh, proj) => {
      const k = Math.min(1, proj.flight / proj.duration);
      const lift = Math.sin(Math.min(1, k) * Math.PI) * (proj.kind === 'oil' ? 1.35 : 0.4);
      const prevX = mesh.userData.px ?? proj.x;
      const prevZ = mesh.userData.pz ?? proj.z;
      if (proj.kind !== 'oil') {
        shotDir.set(proj.x - prevX, lift * 0.15, proj.z - prevZ);
        if (shotDir.lengthSq() > 0.00001) {
          mesh.quaternion.setFromUnitVectors(aimDir.set(0, 1, 0), shotDir.normalize());
        }
      }
      mesh.position.set(proj.x, 0.75 + lift, proj.z);
      mesh.userData.px = proj.x;
      mesh.userData.pz = proj.z;
    });

    sync(effectMeshes, state.effects, makeEffect, (mesh, effect) => {
      const k = 1 - effect.life / effect.max;
      if (effect.kind === 'popup') {
        mesh.position.set(effect.x, 1.5 + k * 1.25, effect.z);
        mesh.material.opacity = 1 - k;
        return;
      }
      if (effect.kind === 'splash') {
        const radius = (effect.radius || 2) * (0.25 + k);
        mesh.position.set(effect.x, 0.22, effect.z);
        mesh.scale.setScalar(radius);
        mesh.material.opacity = 0.7 * (1 - k);
        return;
      }
      if (effect.kind === 'death') {
        mesh.position.set(effect.x, 0.2, effect.z);
        mesh.children.forEach((bit) => {
          bit.position.x = bit.userData.vx * k;
          bit.position.z = bit.userData.vz * k;
          bit.position.y = Math.sin(k * Math.PI) * 0.6;
        });
        return;
      }
      mesh.position.set(effect.x, 0.7, effect.z);
      mesh.scale.setScalar(1 + k);
      mesh.material.opacity = 1 - k;
    });

    links.clear();
    for (let i = 0; i < state.towers.length; i += 1) {
      for (let j = i + 1; j < state.towers.length; j += 1) {
        const a = state.towers[i];
        const b = state.towers[j];
        const dist = Math.hypot(a.x - b.x, a.z - b.z);
        if (dist > PHALANX_RADIUS || dist < 0.1) continue;
        const link = new THREE.Mesh(
          linkGeo,
          graphicsVersion === 4
            ? std(0xc42318)
            : std(0xe6c36a, { emissive: 0x8a6a2a, metalness: 0.4, roughness: 0.4 }),
        );
        link.position.set((a.x + b.x) / 2, 0.42, (a.z + b.z) / 2);
        link.scale.y = dist;
        aimDir.set(b.x - a.x, 0, b.z - a.z).normalize();
        link.quaternion.setFromUnitVectors(shotDir.set(0, 1, 0), aimDir);
        links.add(link);
      }
    }

    let ringX = null;
    let ringZ = null;
    let ringRange = 0;
    const selected = state.towers.find((tower) => tower.id === state.selectedTowerId);
    if (selected) {
      ringX = selected.x;
      ringZ = selected.z;
      ringRange = towerStats(state, selected).range;
      rangeRing.material.color.setHex(graphicsVersion === 4 ? 0xc42318 : 0xf0d7a2);
    } else if (state.selectedType && api.hovered?.padIndex != null) {
      const pad = map.pads[api.hovered.padIndex];
      ringX = pad.x;
      ringZ = pad.z;
      ringRange = TOWERS[state.selectedType].range;
      const score = coverageScore(pad.x, pad.z, ringRange, map.main) + coverageScore(pad.x, pad.z, ringRange, map.trail);
      rangeRing.material.color.setHex(
        score > 0 ? (graphicsVersion === 4 ? 0xc42318 : 0xf0d7a2) : 0xc4483a,
      );
    }
    rangeRing.visible = ringX != null;
    if (ringX != null) {
      rangeRing.position.set(ringX, 0.24, ringZ);
      rangeRing.scale.set(ringRange, ringRange, 1);
    }

    if (pointerInside && !dragging) updateHover();
    else if (!pointerInside) api.hovered = null;

    if (graphicsVersion === 1) renderer.render(scene, camera);
    else composer.render();
  }

  function updateHover() {
    raycaster.setFromCamera(pointer, camera);
    const targets = [...towerMeshes.values(), ...padMeshes];
    const hits = raycaster.intersectObjects(targets, true);
    api.hovered = null;
    for (let i = 0; i < hits.length; i += 1) {
      let object = hits[i].object;
      while (object) {
        if (object.userData?.kind === 'tower') {
          api.hovered = { towerId: object.userData.id };
          return;
        }
        if (object.userData?.kind === 'pad') {
          api.hovered = { padIndex: object.userData.index };
          return;
        }
        object = object.parent;
      }
    }
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    composer.setSize(width, height);
    bloomPass.resolution.set(width, height);
    inkPass.uniforms.resolution.value.copy(renderer.getDrawingBufferSize(new THREE.Vector2()));
  }

  window.addEventListener('resize', resize);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    dragButton = event.button;
    moved = 0;
    downX = event.clientX;
    downY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
  });
  window.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    pointerInside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!dragging) return;
    const dx = event.clientX - downX;
    const dy = event.clientY - downY;
    moved += Math.abs(dx) + Math.abs(dy);
    downX = event.clientX;
    downY = event.clientY;
    if (dragButton === 2 || event.shiftKey) {
      const forward = aimDir.set(Math.sin(theta), 0, Math.cos(theta)).normalize();
      const right = shotDir.set(forward.z, 0, -forward.x);
      target.addScaledVector(right, -dx * 0.02);
      target.addScaledVector(forward, dy * 0.02);
      target.x = Math.max(-10, Math.min(10, target.x));
      target.z = Math.max(-28, Math.min(26, target.z));
    } else if (dragButton === 0) {
      theta -= dx * 0.005;
      phi = Math.max(0.48, Math.min(1.2, phi - dy * 0.004));
    }
  });
  window.addEventListener('pointerup', (event) => {
    if (!dragging) return;
    dragging = false;
    if (event.button === 0 && moved < 6 && pointerInside && stateAllowsPick()) {
      updateHover();
      if (api.hovered?.towerId != null) onPick({ towerId: api.hovered.towerId });
      else if (api.hovered?.padIndex != null) onPick({ padIndex: api.hovered.padIndex });
      else onPick({ ground: true });
    }
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    radius = Math.max(16, Math.min(78, radius * Math.exp(event.deltaY * 0.001)));
  }, { passive: false });

  let pickGate = () => true;
  function stateAllowsPick() {
    return pickGate();
  }

  onLevel(() => {
    rebuildWorld();
    buildLabels();
    dropTowers();
  });

  onGraphicsVersion((next) => {
    const previous = graphicsVersion;
    graphicsVersion = next;
    const styleChanged = setInkStyle(next === 4);
    if (styleChanged) {
      dropDynamics();
      links.clear();
    }
    const lookChanged = (previous === 1) !== (next === 1) || styleChanged;
    if (lookChanged) {
      rebuildWorld();
      buildLabels();
    } else syncGrading();
    dropTowers();
  });

  const api = {
    hovered: null,
    get dragging() { return dragging; },
    frame,
    setPickGate(fn) { pickGate = fn; },
  };
  applyCamera();
  return api;
}
