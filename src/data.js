/** Shared balance, the active battle, and terrain. */

import { EXTRA_LEVELS } from './levels.js';

export const STARTING_GOLD = 200;
export const STARTING_LIVES = 20;
export const PHALANX_RADIUS = 5.2;
export const MAX_TOWER_LEVEL = 3;

export const TOWERS = {
  hoplite: {
    name: 'Hoplite',
    key: '1',
    cost: 50,
    range: 4.6,
    damage: 8,
    cooldown: 0.68,
    armorPierce: 0.12,
    projectile: 'spear',
    projectileSpeed: 16,
    blurb: 'Reliable spear. Stronger in a line.',
    role: 'Line',
  },
  archer: {
    name: 'Archer',
    key: '2',
    cost: 75,
    range: 6.35,
    damage: 5,
    cooldown: 0.44,
    armorPierce: 0,
    projectile: 'arrow',
    projectileSpeed: 22,
    blurb: 'Long reach along the road.',
    role: 'Range',
  },
  oil: {
    name: 'Boiling Oil',
    key: '3',
    cost: 100,
    range: 4.45,
    damage: 12,
    cooldown: 1.05,
    armorPierce: 0,
    splash: 2.2,
    splashFalloff: 0.5,
    projectile: 'oil',
    projectileSpeed: 11,
    blurb: 'Splashes packed ranks.',
    role: 'Splash',
  },
  scorpion: {
    name: 'Scorpion',
    key: '4',
    cost: 130,
    range: 8.3,
    damage: 32,
    cooldown: 1.55,
    armorPierce: 0.7,
    projectile: 'bolt',
    projectileSpeed: 28,
    blurb: 'Ballista. Punches armor.',
    role: 'Pierce',
  },
};

export let HERO = {
  name: 'Leonidas',
  range: 4.7,
  damage: 12,
  cooldown: 1.22,
  armorPierce: 0.2,
  projectile: 'spear',
  projectileSpeed: 17,
};

export const ENEMIES = {
  infantry: {
    name: 'Infantry',
    hp: 32,
    speed: 2.05,
    armor: 0,
    reward: 6,
    leak: 1,
    scale: 1,
    color: 0x9c3030,
  },
  skirmisher: {
    name: 'Skirmisher',
    hp: 18,
    speed: 3.2,
    armor: 0,
    reward: 5,
    leak: 1,
    scale: 0.86,
    color: 0xc2a05a,
  },
  shield: {
    name: 'Shield Bearer',
    hp: 64,
    speed: 1.46,
    armor: 5,
    reward: 10,
    leak: 1,
    scale: 1.06,
    color: 0x8d9284,
  },
  immortal: {
    name: 'Immortal',
    hp: 92,
    speed: 1.66,
    armor: 4,
    reward: 15,
    leak: 2,
    scale: 1.12,
    color: 0x6a2a78,
    revive: 0.5,
  },
  cavalry: {
    name: 'Cavalry',
    hp: 48,
    speed: 3.75,
    armor: 2,
    reward: 11,
    leak: 2,
    scale: 1.18,
    color: 0x6a432c,
  },
  champion: {
    name: "Xerxes' Champion",
    hp: 1280,
    speed: 1.22,
    armor: 9,
    reward: 90,
    leak: 6,
    scale: 1.72,
    color: 0x1a120e,
    boss: true,
  },
};

const JOIN = { x: 1.15, z: 2.8 };

const mainControl = [
  { x: 2.1, z: 27.2 },
  { x: 2.6, z: 21.4 },
  { x: 0.35, z: 16.6 },
  { x: 2.7, z: 11.8 },
  { x: 3.15, z: 7.0 },
  { ...JOIN },
  { x: 2.7, z: -1.6 },
  { x: 0.9, z: -6.6 },
  { x: -0.45, z: -11.4 },
  { x: 2.15, z: -16.4 },
  { x: 3.05, z: -21.2 },
  { x: 0.9, z: -26.0 },
  { x: 0.15, z: -30.2 },
];

const approachControl = [
  { x: -15.2, z: 6.8 },
  { x: -11.0, z: 5.2 },
  { x: -6.8, z: 4.0 },
  { x: -3.0, z: 3.3 },
];

const thermopylaeWaves = [
  {
    name: 'Scouts',
    groups: [{ type: 'infantry', count: 8, interval: 1.0 }],
  },
  {
    name: 'The Column',
    groups: [{ type: 'infantry', count: 12, interval: 0.78 }],
  },
  {
    name: 'Mixed Ranks',
    groups: [
      { type: 'infantry', count: 8, interval: 0.72 },
      { type: 'skirmisher', count: 6, interval: 0.55 },
    ],
  },
  {
    name: 'Skirmishers',
    groups: [
      { type: 'skirmisher', count: 8, interval: 0.42 },
      { type: 'infantry', count: 8, interval: 0.7 },
    ],
  },
  {
    name: 'The Crowd',
    tip: 'Oil covers a crowd. A spear does not.',
    groups: [{ type: 'skirmisher', count: 16, interval: 0.36 }],
  },
  {
    name: 'Shields',
    tip: 'Shields shrug off arrows. A scorpion bolt punches through.',
    groups: [
      { type: 'shield', count: 6, interval: 0.95 },
      { type: 'infantry', count: 6, interval: 0.65 },
    ],
  },
  {
    name: 'The Immortals',
    tip: 'Immortals rise once. Kill them twice.',
    groups: [
      { type: 'immortal', count: 4, interval: 1.15 },
      { type: 'infantry', count: 8, interval: 0.6 },
    ],
  },
  {
    name: 'Cavalry Probe',
    groups: [
      { type: 'cavalry', count: 6, interval: 0.72 },
      { type: 'skirmisher', count: 6, interval: 0.45 },
    ],
  },
  {
    name: 'The Grind',
    groups: [
      { type: 'shield', count: 6, interval: 0.8 },
      { type: 'immortal', count: 4, interval: 1.05 },
    ],
  },
  {
    name: 'Before the Trail',
    groups: [
      { type: 'infantry', count: 8, interval: 0.55 },
      { type: 'cavalry', count: 5, interval: 0.7 },
      { type: 'immortal', count: 3, interval: 1.1 },
    ],
  },
  {
    name: 'The Mountain Path',
    betrayal: true,
    intro:
      'A local guide has shown the Persians the goat trail over the mountain. The pass is no longer the only road.',
    groups: [
      { type: 'infantry', count: 8, interval: 0.58, path: 'flank', at: 0 },
      { type: 'skirmisher', count: 6, interval: 0.42, path: 'flank', at: 1.6 },
      { type: 'shield', count: 5, interval: 0.85, path: 'main', at: 0.8 },
    ],
  },
  {
    name: 'Two Fronts',
    groups: [
      { type: 'cavalry', count: 6, interval: 0.62, path: 'flank', at: 0 },
      { type: 'immortal', count: 5, interval: 1.0, path: 'main', at: 0.4 },
      { type: 'skirmisher', count: 8, interval: 0.38, path: 'main', at: 2.2 },
    ],
  },
  {
    name: 'Encirclement',
    groups: [
      { type: 'shield', count: 5, interval: 0.75, path: 'flank', at: 0 },
      { type: 'infantry', count: 8, interval: 0.5, path: 'flank', at: 1.2 },
      { type: 'cavalry', count: 5, interval: 0.65, path: 'main', at: 0.3 },
      { type: 'immortal', count: 4, interval: 1.05, path: 'main', at: 2 },
    ],
  },
  {
    name: "Immortals' Return",
    groups: [
      { type: 'immortal', count: 6, interval: 0.9, path: 'main', at: 0 },
      { type: 'skirmisher', count: 8, interval: 0.36, path: 'flank', at: 0.5 },
      { type: 'cavalry', count: 4, interval: 0.7, path: 'flank', at: 2.4 },
    ],
  },
  {
    name: 'The Host',
    groups: [
      { type: 'cavalry', count: 7, interval: 0.55, path: 'main', at: 0 },
      { type: 'cavalry', count: 5, interval: 0.6, path: 'flank', at: 0.4 },
      { type: 'shield', count: 6, interval: 0.7, path: 'main', at: 2 },
      { type: 'immortal', count: 4, interval: 0.95, path: 'flank', at: 1.5 },
    ],
  },
  {
    name: "Xerxes' Champion",
    tip: 'The champion is armored. Meet him with scorpions and a finished line.',
    groups: [
      { type: 'immortal', count: 4, interval: 0.95, path: 'main', at: 0 },
      { type: 'cavalry', count: 5, interval: 0.58, path: 'flank', at: 0.3 },
      { type: 'skirmisher', count: 8, interval: 0.36, path: 'flank', at: 1.4 },
      { type: 'champion', count: 1, interval: 1, path: 'main', at: 7.5 },
      { type: 'shield', count: 4, interval: 0.75, path: 'main', at: 8.2 },
    ],
  },
];

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0 || 1)));
  return t * t * (3 - 2 * t);
}

function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise(x, z) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const n00 = hash(x0, z0);
  const n10 = hash(x0 + 1, z0);
  const n01 = hash(x0, z0 + 1);
  const n11 = hash(x0 + 1, z0 + 1);
  return n00 * (1 - sx) * (1 - sz) + n10 * sx * (1 - sz) + n01 * (1 - sx) * sz + n11 * sx * sz;
}

function fbm(x, z) {
  let a = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < 4; i += 1) {
    a += amp * noise(x * f, z * f);
    f *= 2;
    amp *= 0.5;
  }
  return a;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function roundPath(points, radius = 1.15, samples = 5) {
  if (points.length < 3) return points.map((p) => ({ x: p.x, z: p.z }));
  const out = [{ x: points[0].x, z: points[0].z }];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const inLen = Math.hypot(curr.x - prev.x, curr.z - prev.z) || 1;
    const outLen = Math.hypot(next.x - curr.x, next.z - curr.z) || 1;
    const d = Math.min(radius, inLen * 0.45, outLen * 0.45);
    const a = {
      x: curr.x - ((curr.x - prev.x) / inLen) * d,
      z: curr.z - ((curr.z - prev.z) / inLen) * d,
    };
    const b = {
      x: curr.x + ((next.x - curr.x) / outLen) * d,
      z: curr.z + ((next.z - curr.z) / outLen) * d,
    };
    out.push(a);
    for (let s = 1; s <= samples; s += 1) {
      const t = s / (samples + 1);
      const u = 1 - t;
      out.push({
        x: u * u * a.x + 2 * u * t * curr.x + t * t * b.x,
        z: u * u * a.z + 2 * u * t * curr.z + t * t * b.z,
      });
    }
    out.push(b);
  }
  out.push({ x: points[points.length - 1].x, z: points[points.length - 1].z });
  return out;
}

function densify(points, step = 0.48) {
  if (!points.length) return [];
  const out = [{ x: points[0].x, z: points[0].z }];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(len / step));
    for (let s = 1; s <= n; s += 1) {
      const t = s / n;
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  return out;
}

function annotate(points) {
  const lens = [];
  const cum = [0];
  for (let i = 0; i < points.length - 1; i += 1) {
    const len = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].z - points[i].z);
    lens.push(len);
    cum.push(cum[i] + len);
  }
  return { points, lens, cum, length: cum[cum.length - 1] || 0 };
}

export function pointAlong(path, distance) {
  const length = path.length || 1;
  let d = distance;
  if (d < 0) d = 0;
  if (d > length) d = length;
  let i = 0;
  while (i < path.lens.length - 1 && path.cum[i + 1] < d) i += 1;
  const segLen = path.lens[i] || 1;
  const t = Math.min(1, Math.max(0, (d - path.cum[i]) / segLen));
  const a = path.points[i];
  const b = path.points[Math.min(path.points.length - 1, i + 1)];
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    dx: b.x - a.x,
    dz: b.z - a.z,
  };
}

function closestIndex(points, p) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const d = (points[i].x - p.x) ** 2 + (points[i].z - p.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function distToPath(x, z, points) {
  let min = Infinity;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const len2 = abx * abx + abz * abz || 1;
    let t = ((x - a.x) * abx + (z - a.z) * abz) / len2;
    t = Math.max(0, Math.min(1, t));
    const dx = x - (a.x + abx * t);
    const dz = z - (a.z + abz * t);
    const d = Math.hypot(dx, dz);
    if (d < min) min = d;
  }
  return min;
}

export function coverageScore(x, z, range, path) {
  let n = 0;
  const pts = path.points;
  for (let i = 0; i < pts.length; i += 2) {
    if (Math.hypot(pts[i].x - x, pts[i].z - z) <= range) n += 1;
  }
  return n;
}

function buildMap(spec) {
  const main = annotate(densify(roundPath(spec.mainControl, 1.2, 5), 0.48));
  const joinIndex = closestIndex(main.points, spec.join);
  const bounds = spec.bounds;
  const trailBounds = spec.trailBounds;
  const approach = densify(roundPath(spec.approachControl, 1.1, 4), 0.48);
  const trail = annotate(densify(approach.concat([main.points[joinIndex]]), 0.48));
  const flank = annotate(densify(approach.concat(main.points.slice(joinIndex)), 0.48));
  const pads = [];
  if (spec.pads) {
    for (const pad of spec.pads) pads.push({ x: pad.x, z: pad.z, trail: !!pad.trail });
  }
  const joinFraction = main.cum[joinIndex] / main.length;
  if (!spec.pads) {
  const spots = [
    { f: 0.06, side: 1 },
    { f: 0.18, side: -1 },
    { f: 0.2, side: 1 },
    { f: 0.36, side: -1 },
    { f: joinFraction, side: -1 },
    { f: joinFraction + 0.012, side: 1 },
    { f: 0.62, side: 1 },
    { f: 0.76, side: -1 },
    { f: 0.9, side: 1 },
  ];

  for (const spot of spots) {
    const p = pointAlong(main, main.length * Math.min(0.97, Math.max(0.03, spot.f)));
    const len = Math.hypot(p.dx, p.dz) || 1;
    const nx = -p.dz / len;
    const nz = p.dx / len;
    for (const dist of [2.45, 2.9, 3.3]) {
      const x = p.x + nx * spot.side * dist;
      const z = p.z + nz * spot.side * dist;
        if (x > bounds.maxX || x < bounds.minX || z > bounds.maxZ || z < bounds.minZ) continue;
      if (pads.some((o) => Math.hypot(o.x - x, o.z - z) < 3.5)) break;
      if (coverageScore(x, z, 4.7, main) < 3) continue;
      pads.push({ x: round2(x), z: round2(z), trail: false });
      break;
    }
  }
  }

  const trailPath = trail;
  if (!spec.pads) {
  for (const f of [0.42, 0.72]) {
    const p = pointAlong(trailPath, trailPath.length * f);
    const len = Math.hypot(p.dx, p.dz) || 1;
    const nx = -p.dz / len;
    const nz = p.dx / len;
    const candidates = [
      { x: p.x - 2.15, z: p.z },
      { x: p.x + nx * 2.2, z: p.z + nz * 2.2 },
      { x: p.x - nx * 2.2, z: p.z - nz * 2.2 },
    ];
    for (const c of candidates) {
      if (c.x > trailBounds.maxX || c.x < trailBounds.minX || c.z > trailBounds.maxZ || c.z < trailBounds.minZ) continue;
      if (pads.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < 3.1)) break;
      if (coverageScore(c.x, c.z, 7.6, trailPath) < 3 && coverageScore(c.x, c.z, 7.6, main) < 3) continue;
      pads.push({ x: round2(c.x), z: round2(c.z), trail: true });
      break;
    }
  }
  }

  let hero = spec.heroSpot ? { x: spec.heroSpot.x, z: spec.heroSpot.z } : { x: 0, z: -16 };
  const gate = pointAlong(main, main.length * 0.9);
  const glen = Math.hypot(gate.dx, gate.dz) || 1;
  const gnx = -gate.dz / glen;
  const gnz = gate.dx / glen;
  if (!spec.heroSpot) outer: for (const dist of [2.25, 2.8]) {
    for (const sign of [-1, 1]) {
      const x = gate.x + gnx * sign * dist;
      const z = gate.z + gnz * sign * dist;
      if (x < bounds.minX - 1 || x > bounds.maxX + 1) continue;
      if (coverageScore(x, z, (spec.hero || HERO).range, main) >= 4) {
        hero = { x: round2(x), z: round2(z) };
        break outer;
      }
    }
  }

  return {
    main,
    flank,
    trail,
    pads,
    joinIndex,
    join: main.points[joinIndex],
    hero,
    hotGate: main.points[joinIndex],
    theme: spec.theme || 'coast',
    labels: spec.labels,
    view: spec.view || null,
  };
}

const thermopylaeSpec = {
  theme: 'coast',
  join: JOIN,
  mainControl,
  approachControl,
  hero: HERO,
  bounds: { minX: -3.95, maxX: 5.55, minZ: -31.2, maxZ: 29.2 },
  trailBounds: { minX: -13.2, maxX: -0.9, minZ: -2, maxZ: 10 },
  labels: {
    attack: 'Persia',
    camp: 'Greek camp',
    trail: 'Goat trail',
    landmark: 'Hot Gates',
  },
};

const thermopylae = {
  id: 'thermopylae',
  title: 'The Hot Gates',
  eyebrow: 'Thermopylae · 480 BC',
  lede: '480 BC. The mountains stand to the west and the sea to the east. The only road into Greece runs between them.',
  notes: [
    'Hoplites built near each other form a phalanx.',
    'The goat trail to the west is quiet. It may not stay that way.',
  ],
  briefingTitle: 'Hold the Hot Gates',
  briefing: 'Place towers on the stone rings. Hoplites hold a line, archers cover the road, oil breaks a crowd, and the scorpion punches armor. The mountain trail to the west is quiet. It may not stay that way.',
  trailQuiet: 'Mountain trail quiet',
  trailOpen: 'Mountain trail open',
  heroTitle: 'King of Sparta',
  hero: HERO,
  waves: thermopylaeWaves,
  labels: thermopylaeSpec.labels,
  victoryKicker: 'The third day',
  victoryTitle: 'The gate holds',
  victoryBody: 'The Persian host breaks on the narrow road. Greece has time to fight another day.',
  defeatKicker: 'The road is open',
  defeatTitle: 'The pass is lost',
  defeatBody: 'The camp is overrun. Past this gate, the cities of Greece lie open.',
  spec: thermopylaeSpec,
};

export const LEVELS = [thermopylae, ...EXTRA_LEVELS];

const levelListeners = new Set();
let active = thermopylae;

function storedLevelId() {
  try {
    return localStorage.getItem('hot-gates-level');
  } catch {
    return null;
  }
}

export let map = buildMap(thermopylaeSpec);
export let WAVES = thermopylaeWaves;

export function getLevel() {
  return active;
}

export function selectLevel(id) {
  const next = LEVELS.find((level) => level.id === id) || LEVELS[0];
  if (next.id === active.id && map) return active;
  active = next;
  HERO = next.hero;
  WAVES = next.waves;
  map = buildMap(next.spec || next);
  try {
    localStorage.setItem('hot-gates-level', active.id);
  } catch {
    /* private mode or node */
  }
  levelListeners.forEach((listener) => listener(active));
  return active;
}

export function onLevel(listener) {
  levelListeners.add(listener);
  return () => levelListeners.delete(listener);
}

export function labelFor(type) {
  return active.names?.[type] || ENEMIES[type].name;
}

const savedId = storedLevelId();
if (savedId && savedId !== 'thermopylae') selectLevel(savedId);

function carveOf(dMain, dTrail) {
  return Math.min(smoothstep(1.02, 3.5, dMain), smoothstep(0.82, 2.35, dTrail));
}

function coastHeight(x, z, dMain, dTrail) {
  if (x > 8.3) return -0.62;
  const west = smoothstep(-1.6, -14.5, x);
  const ridge = fbm(x * 0.16, z * 0.16);
  let mountain = west * (1.5 + ridge * 4.4 + smoothstep(-7, -15, x) * 2.2);
  const endRamp = Math.max(smoothstep(31.4, 38, z), smoothstep(-31.6, -38, z));
  mountain += endRamp * 3.2;
  let h = mountain * carveOf(dMain, dTrail);
  if (x > 5.7) {
    const shore = smoothstep(5.7, 8.3, x);
    h = h * (1 - shore) + -0.62 * shore;
  }
  return h;
}

function islandHeight(x, z) {
  const island = Math.hypot(x, z);
  const onMole = x > 7 && x < 22 && Math.abs(z) < 2.4;
  if (onMole) return 0.08;
  if (island > 9.4) return -0.72;
  const wall = Math.abs(island - 6.3);
  if (wall < 0.85) return 1.05;
  return 0.22 + fbm(x * 0.3, z * 0.3) * 0.12;
}

function wallsHeight(x, z) {
  if (z > 26 || z < -26) return -0.58;
  if (x < -2) return 0.45 + fbm(x * 0.22, z * 0.22) * 0.7;
  if (x > 4) return 0.02 + fbm(x * 0.08, z * 0.08) * 0.1;
  const wall = Math.abs(x + 0.4);
  if (wall < 0.55) return 1.35;
  return 0.12;
}

function plainHeight(x, z) {
  if (z < -12.5) return -0.42;
  const hill = Math.hypot(x - 0.4, z - 18);
  if (hill < 6.5) return (1 - hill / 6.5) ** 2 * 4.4;
  return 0.03 + fbm(x * 0.16, z * 0.16) * 0.16;
}

function mesaHeight(x, z) {
  const summit = (x / 8.2) ** 2 + (z / 10.4) ** 2;
  const onRamp = x < -5.2 && x > -18.8 && Math.abs(z) < 2.45;
  if (onRamp) return 0.05;
  if (x > 17.4) return -0.62;
  if (summit < 1) return 0.07 + fbm(x * 0.4, z * 0.4) * 0.06;
  const drop = smoothstep(1, 1.16, summit);
  const desert = -2.25 + fbm(x * 0.11, z * 0.11) * 0.28;
  return 0.12 * (1 - drop) + desert * drop;
}

export function terrainHeight(x, z) {
  const dMain = distToPath(x, z, map.main.points);
  const dTrail = distToPath(x, z, map.trail.points);
  if (dMain < 1.02 || dTrail < 0.82) return 0;
  const theme = map.theme || 'coast';
  let h = coastHeight(x, z, dMain, dTrail);
  if (theme === 'island') h = islandHeight(x, z, dMain, dTrail);
  else if (theme === 'walls') h = wallsHeight(x, z, dMain, dTrail);
  else if (theme === 'plain') h = plainHeight(x, z, dMain, dTrail);
  else if (theme === 'mesa') h = mesaHeight(x, z);
  for (let i = 0; i < map.pads.length; i += 1) {
    const pad = map.pads[i];
    const pd = Math.hypot(x - pad.x, z - pad.z);
    if (pd < 1.7) h *= smoothstep(0.5, 1.7, pd);
  }
  if (Math.hypot(x - map.hero.x, z - map.hero.z) < 1.15) h *= 0.15;
  return h;
}

function rgb(hex) {
  return {
    r: ((hex >> 16) & 255) / 255,
    g: ((hex >> 8) & 255) / 255,
    b: (hex & 255) / 255,
  };
}

function mix(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

export function terrainColor(x, z, h, version = 2) {
  const n = noise(x * 0.9, z * 0.9);
  const broad = noise(x * 0.18 + 3.2, z * 0.18);
  const dMain = distToPath(x, z, map.main.points);
  if (version <= 1) {
    if (map.theme === 'mesa') {
      if (x > 17 && h < -0.3) return mix(rgb(0x2a625e), rgb(0x1c4844), n);
      if (h < -1) return mix(rgb(0xb07a52), rgb(0x8a5438), n);
      if (h < -0.3) return mix(rgb(0xe6c898), rgb(0xc4a06a), n);
      return mix(rgb(0xf0e2c8), rgb(0xd2b48a), n);
    }
    if (h < -0.28) return mix(rgb(0x143844), rgb(0x1c5160), n);
    if (x > 5.45 && h < 0.08) return mix(rgb(0xd2c4a0), rgb(0xb5a47a), n);
    if (dMain < 1.55 && h < 0.35) return mix(rgb(0x8d7349), rgb(0x6e5738), n);
    if (h > 2.4) return mix(rgb(0x918c84), rgb(0x6e6962), n);
    if (h > 0.75) return mix(rgb(0x6a655c), rgb(0x596454), n);
    return mix(rgb(0x7d8a49), rgb(0x66703c), n);
  }
  if (version >= 4) {
    const theme = map.theme || 'coast';
    if (theme === 'mesa') {
      if (x > 17) return mix(rgb(0x1e5c58), rgb(0x3a8a80), n);
      if (h < -1) return mix(rgb(0xc45a32), rgb(0x8a4030), n);
      if (h < -0.3) return mix(rgb(0xf0d7a4), rgb(0xd4a86a), broad);
      return mix(rgb(0xf6ead4), rgb(0xe0b56a), n);
    }
    if (h < -0.2) return mix(rgb(0x12356e), rgb(0x1c5ea8), n);
    if (theme === 'plain') {
      if (h > 0.35) return mix(rgb(0xf0e2c0), rgb(0xc4a36a), n);
      return mix(rgb(0xc46a32), rgb(0x6e8f38), broad);
    }
    if (theme === 'walls') {
      if (x < -0.5 && h > 0.35) return mix(rgb(0xf6ead4), rgb(0xd8c4a6), n);
      if (dMain < 1.35) return mix(rgb(0xe6d2a4), rgb(0x8d5a32), n);
      return mix(rgb(0x8fbf4a), rgb(0x3e6e32), broad);
    }
    if (theme === 'island') {
      if (dMain < 1.25) return mix(rgb(0xf6e2b0), rgb(0xe0a040), n);
      return mix(rgb(0xe8c45a), rgb(0x2f8a4a), broad);
    }
    if (x > 5.15 && h < 0.16) return mix(rgb(0xf2d06a), rgb(0xe07a32), n);
    if (dMain < 1.25 && h < 0.35) return mix(rgb(0xf0d7a0), rgb(0xc47a28), n);
    if (h > 2.2) return mix(rgb(0xf7f4ee), rgb(0x8a847c), n);
    if (h > 0.7) return mix(rgb(0x3e4a40), rgb(0x1e3328), n);
    return mix(rgb(0x2f9a48), rgb(0xd4a017), broad * 0.45);
  }
  if (map.theme === 'mesa') {
    if (x > 17 && h < -0.3) return mix(rgb(0x246862), rgb(0x3c8880), n);
    if (h < -1.05) return mix(rgb(0xc48458), rgb(0x8a5434), n);
    if (h < -0.35) return mix(rgb(0xe8c98a), rgb(0xc49a58), broad);
    return mix(rgb(0xf3e6cc), rgb(0xd8b888), n);
  }
  if (map.theme === 'plain') {
    if (h > 0.35) return mix(rgb(0xc2ae86), rgb(0x8d7a52), n);
    return mix(rgb(0x8fb24a), rgb(0x5e7a34), broad);
  }
  if (map.theme === 'walls') {
    if (h < -0.2) return mix(rgb(0x123848), rgb(0x1c5870), n);
    if (x < -0.5 && h > 0.35) return mix(rgb(0x8c8278), rgb(0x5a534c), n);
    if (dMain < 1.35) return mix(rgb(0xc4b08a), rgb(0x8a6844), n);
    return mix(rgb(0xa8b85a), rgb(0x6e8438), broad);
  }
  if (map.theme === 'island') {
    if (h < -0.2) return mix(rgb(0x0b4a5e), rgb(0x187888), n);
    if (dMain < 1.25) return mix(rgb(0xedd4a4), rgb(0xc6a56c), n);
    return mix(rgb(0xd8c48c), rgb(0x7ea044), broad);
  }
  if (h < -0.28) return mix(rgb(0x0b3544), rgb(0x186070), n);
  if (x > 5.15 && h < 0.16) {
    const wet = smoothstep(5.15, 7.6, x);
    const sand = mix(rgb(0xf0d7aa), rgb(0xc6a56e), n);
    return mix(sand, rgb(0x8d6a45), wet * 0.45);
  }
  if (dMain < 1.2 && h < 0.28) return mix(rgb(0xb48a52), rgb(0x6a4c30), n);
  if (h > 3.4) return mix(rgb(0x9a948c), rgb(0x5e5954), n);
  if (h > 1.7) return mix(rgb(0x534c45), rgb(0x322e2a), broad);
  if (h > 0.5) return mix(rgb(0x463f38), rgb(0x2c3a28), n);
  const grass = mix(rgb(0x86a63c), rgb(0x5a7634), n);
  const olive = mix(rgb(0x9aa64a), rgb(0x6e7840), broad);
  return mix(grass, olive, smoothstep(0.42, 0.75, broad));
}

export function waveSummary(wave) {
  const counts = new Map();
  for (const group of wave.groups) {
    const key = `${group.type}|${group.path || 'main'}`;
    counts.set(key, (counts.get(key) || 0) + group.count);
  }
  const parts = [];
  for (const [key, count] of counts) {
    const [type, path] = key.split('|');
    const name = labelFor(type);
    const label = count === 1 ? name : `${name}s`;
    parts.push(`${count} ${label}${path === 'flank' ? ' on the trail' : ''}`);
  }
  return parts;
}
