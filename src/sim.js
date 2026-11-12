import {
  ENEMIES,
  HERO,
  MAX_TOWER_LEVEL,
  PHALANX_RADIUS,
  STARTING_GOLD,
  STARTING_LIVES,
  TOWERS,
  WAVES,
  getLevel,
  labelFor,
  map,
} from './data.js';

export function createGame() {
  return {
    status: 'menu',
    paused: false,
    help: false,
    muted: false,
    speed: 1,
    gold: STARTING_GOLD,
    lives: STARTING_LIVES,
    maxLives: STARTING_LIVES,
    waveIndex: -1,
    phase: 'build',
    spawnQueue: [],
    spawnIndex: 0,
    spawnClock: 0,
    towers: [],
    enemies: [],
    projectiles: [],
    effects: [],
    selectedType: null,
    selectedTowerId: null,
    killed: 0,
    leaked: 0,
    built: 0,
    time: 0,
    story: null,
    toast: null,
    flankOpen: false,
    nextId: 1,
    sfx: [],
  };
}

export function startGame(previous) {
  const state = createGame();
  state.status = 'playing';
  state.muted = previous?.muted ?? false;
  const level = getLevel();
  state.story = {
    title: level.briefingTitle,
    body: level.briefing,
    life: 9,
  };
  const hero = {
    id: state.nextId++,
    type: 'hero',
    hero: true,
    name: HERO.name,
    pad: -1,
    x: map.hero.x,
    z: map.hero.z,
    level: 1,
    cooldown: 0.4,
    kills: 0,
    invested: 0,
    target: 'first',
    aimX: null,
    aimZ: null,
  };
  state.towers.push(hero);
  return state;
}

function sfx(state, name) {
  if (state.sfx.length < 12) state.sfx.push(name);
}

export function towerStats(state, tower) {
  if (tower.hero) {
    return {
      damage: HERO.damage,
      range: HERO.range,
      cooldown: HERO.cooldown,
      splash: 0,
      splashFalloff: 1,
      armorPierce: HERO.armorPierce,
      projectile: HERO.projectile,
      projectileSpeed: HERO.projectileSpeed,
      phalanx: 0,
      allies: 0,
      dps: HERO.damage / HERO.cooldown,
    };
  }
  const def = TOWERS[tower.type];
  const steps = tower.level - 1;
  let damage = def.damage * 1.3 ** steps;
  const range = def.range * (1 + 0.07 * steps);
  const cooldown = def.cooldown * 0.92 ** steps;
  const splash = def.splash ? def.splash * (1 + 0.05 * steps) : 0;
  let allies = 0;
  for (let i = 0; i < state.towers.length; i += 1) {
    const other = state.towers[i];
    if (other.id === tower.id) continue;
    if (Math.hypot(other.x - tower.x, other.z - tower.z) <= PHALANX_RADIUS) allies += 1;
  }
  const phalanx = Math.min(0.36, allies * 0.12);
  damage *= 1 + phalanx;
  return {
    damage,
    range,
    cooldown,
    splash,
    splashFalloff: def.splashFalloff ?? 1,
    armorPierce: def.armorPierce,
    projectile: def.projectile,
    projectileSpeed: def.projectileSpeed,
    phalanx,
    allies,
    dps: damage / cooldown,
  };
}

export function upgradeCost(tower) {
  if (!tower || tower.hero || tower.level >= MAX_TOWER_LEVEL) return null;
  const base = TOWERS[tower.type].cost;
  return Math.round(base * (tower.level === 1 ? 0.8 : 1.25));
}

export function sellRefund(tower) {
  if (!tower || tower.hero) return 0;
  return Math.floor(tower.invested * 0.65);
}

export function selectType(state, type) {
  if (state.status !== 'playing') return;
  state.selectedType = state.selectedType === type ? null : type;
  state.selectedTowerId = null;
}

export function selectTower(state, id) {
  if (state.status !== 'playing') return;
  state.selectedTowerId = id;
  state.selectedType = null;
}

export function clearTowerSelection(state) {
  state.selectedTowerId = null;
}

export function clearSelection(state) {
  state.selectedTowerId = null;
  state.selectedType = null;
}

function padTower(state, padIndex) {
  return state.towers.find((tower) => tower.pad === padIndex) || null;
}

export function handlePad(state, padIndex) {
  if (state.status !== 'playing' || state.paused || state.help) return;
  const existing = padTower(state, padIndex);
  if (existing) {
    selectTower(state, existing.id);
    return;
  }
  if (!state.selectedType) {
    state.selectedTowerId = null;
    return;
  }
  placeTower(state, padIndex, state.selectedType);
}

export function placeTower(state, padIndex, type) {
  if (state.status !== 'playing' || state.paused || state.help) return false;
  const def = TOWERS[type];
  const pad = map.pads[padIndex];
  if (!def || !pad) return false;
  if (padTower(state, padIndex)) return false;
  if (state.gold < def.cost) {
    state.toast = { text: 'Not enough gold', life: 1.2 };
    sfx(state, 'deny');
    return false;
  }
  state.gold -= def.cost;
  state.built += 1;
  state.towers.push({
    id: state.nextId++,
    type,
    hero: false,
    name: def.name,
    pad: padIndex,
    x: pad.x,
    z: pad.z,
    level: 1,
    cooldown: 0.25,
    kills: 0,
    invested: def.cost,
    target: 'first',
    aimX: null,
    aimZ: null,
  });
  sfx(state, 'place');
  return true;
}

export function upgradeTower(state, id = state.selectedTowerId) {
  if (state.status !== 'playing' || state.paused || state.help) return false;
  const tower = state.towers.find((item) => item.id === id);
  const cost = upgradeCost(tower);
  if (!tower || cost == null) return false;
  if (state.gold < cost) {
    state.toast = { text: 'Not enough gold', life: 1.2 };
    sfx(state, 'deny');
    return false;
  }
  state.gold -= cost;
  tower.invested += cost;
  tower.level += 1;
  sfx(state, 'upgrade');
  return true;
}

export function sellTower(state, id = state.selectedTowerId) {
  if (state.status !== 'playing' || state.paused || state.help) return false;
  const tower = state.towers.find((item) => item.id === id);
  if (!tower || tower.hero) return false;
  const refund = sellRefund(tower);
  state.gold += refund;
  state.towers = state.towers.filter((item) => item.id !== id);
  if (state.selectedTowerId === id) state.selectedTowerId = null;
  state.toast = { text: `Sold for ${refund}`, life: 1.3 };
  sfx(state, 'sell');
  return true;
}

const TARGETS = ['first', 'strong', 'close', 'last'];

export function cycleTarget(state, id = state.selectedTowerId) {
  const tower = state.towers.find((item) => item.id === id);
  if (!tower) return;
  const index = TARGETS.indexOf(tower.target);
  tower.target = TARGETS[(index + 1) % TARGETS.length];
  sfx(state, 'click');
}

export function targetLabel(mode) {
  if (mode === 'strong') return 'Strongest';
  if (mode === 'close') return 'Nearest';
  if (mode === 'last') return 'Last';
  return 'First';
}

export function sendWave(state) {
  if (state.status !== 'playing' || state.paused || state.help) return false;
  if (state.phase !== 'build') return false;
  const next = state.waveIndex + 1;
  if (next >= WAVES.length) return false;
  const wave = WAVES[next];
  state.waveIndex = next;
  state.phase = 'combat';
  state.spawnClock = 0;
  state.spawnIndex = 0;
  state.spawnQueue = queueWave(wave);
  if (wave.betrayal) {
    state.flankOpen = true;
    state.story = { title: wave.name, body: wave.intro, life: 7.5 };
    sfx(state, 'betrayal');
  } else if (wave.tip) {
    state.story = { title: wave.name, body: wave.tip, life: 4.2 };
    sfx(state, 'wave');
  } else {
    state.toast = { text: `Wave ${next + 1} — ${wave.name}`, life: 2.2 };
    sfx(state, 'wave');
  }
  return true;
}

function queueWave(wave) {
  const events = [];
  let sequential = 0;
  for (const group of wave.groups) {
    const start = group.at != null ? group.at : sequential;
    for (let i = 0; i < group.count; i += 1) {
      events.push({
        time: 0.45 + start + i * group.interval,
        type: group.type,
        path: group.path || 'main',
      });
    }
    if (group.at == null) sequential = start + group.count * group.interval + 0.85;
  }
  events.sort((a, b) => a.time - b.time);
  return events;
}

export function setSpeed(state, speed) {
  if (speed === 1 || speed === 2 || speed === 3) state.speed = speed;
}

export function update(state, dt) {
  if (state.status !== 'playing') return;
  const steps = Math.max(1, Math.ceil(dt / 0.05));
  const h = dt / steps;
  for (let i = 0; i < steps; i += 1) step(state, h);
}

function step(state, dt) {
  if (state.status !== 'playing') return;
  state.time += dt;
  state._hitSfx = false;

  if (state.phase === 'combat') {
    state.spawnClock += dt;
    while (
      state.status === 'playing' &&
      state.spawnIndex < state.spawnQueue.length &&
      state.spawnQueue[state.spawnIndex].time <= state.spawnClock
    ) {
      const event = state.spawnQueue[state.spawnIndex];
      state.spawnIndex += 1;
      spawnEnemy(state, event.type, event.path);
    }
  }

  for (let i = 0; i < state.enemies.length; i += 1) {
    const enemy = state.enemies[i];
    if (!enemy.alive) continue;
    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.invuln = Math.max(0, enemy.invuln - dt);
    moveEnemy(state, enemy, dt);
    if (state.status !== 'playing') return;
  }

  let shot = false;
  for (let i = 0; i < state.towers.length; i += 1) {
    const tower = state.towers[i];
    tower.cooldown -= dt;
    const stats = towerStats(state, tower);
    const target = pickTarget(state, tower, stats.range);
    if (!target) continue;
    tower.aimX = target.x;
    tower.aimZ = target.z;
    if (tower.cooldown > 0) continue;
    fire(state, tower, target, stats);
    if (!shot) {
      sfx(state, stats.projectile === 'oil' ? 'oil' : 'shot');
      shot = true;
    }
  }

  for (let i = 0; i < state.projectiles.length; i += 1) {
    const proj = state.projectiles[i];
    if (!proj.alive) continue;
    fly(state, proj, dt);
    if (state.status !== 'playing') return;
  }

  state.enemies = state.enemies.filter((enemy) => enemy.alive);
  state.projectiles = state.projectiles.filter((proj) => proj.alive);

  if (state.story) {
    state.story.life -= dt;
    if (state.story.life <= 0) state.story = null;
  }
  if (state.toast) {
    state.toast.life -= dt;
    if (state.toast.life <= 0) state.toast = null;
  }
  for (let i = 0; i < state.effects.length; i += 1) state.effects[i].life -= dt;
  state.effects = state.effects.filter((effect) => effect.life > 0);

  const spawning = state.spawnIndex < state.spawnQueue.length;
  if (state.phase === 'combat' && !spawning && state.enemies.length === 0) {
    const waveNo = state.waveIndex + 1;
    const bonus = 8 + waveNo * 5;
    state.gold += bonus;
    if (waveNo >= WAVES.length) {
      state.status = 'victory';
      state.phase = 'done';
      sfx(state, 'victory');
    } else {
      state.phase = 'build';
      state.toast = { text: `Road clear  +${bonus} gold`, life: 2.3 };
      sfx(state, 'bonus');
    }
  }
}

function spawnEnemy(state, type, pathName) {
  const def = ENEMIES[type];
  const waveScale = 1 + Math.max(0, state.waveIndex) * 0.062;
  const path = pathName === 'flank' ? map.flank : map.main;
  const bossHp = def.boss && getLevel().bossHp ? getLevel().bossHp : def.hp;
  const hp = Math.round((def.boss ? bossHp : def.hp) * (def.boss ? 1 : waveScale));
  const id = state.nextId++;
  const enemy = {
    id,
    type,
    name: labelFor(type),
    boss: !!def.boss,
    path,
    pathName,
    seg: 0,
    t: 0,
    lane: ((id * 17) % 5 - 2) * 0.12,
    x: path.points[0].x,
    z: path.points[0].z,
    hp,
    maxHp: hp,
    armor: def.armor,
    speed: def.speed * (0.96 + (id % 5) * 0.016),
    reward: Math.round(def.reward * (1 + Math.max(0, state.waveIndex) * 0.03)),
    leak: def.leak,
    reviveRatio: def.revive || 0,
    revived: false,
    alive: true,
    flash: 0,
    invuln: 0,
    color: def.color,
    scale: def.scale,
    remaining: path.length,
    traveled: 0,
    facing: 0,
  };
  placeEnemy(enemy);
  state.enemies.push(enemy);
}

function moveEnemy(state, enemy, dt) {
  let left = enemy.speed * dt;
  let guard = 0;
  while (left > 0 && guard < 10) {
    guard += 1;
    if (enemy.seg >= enemy.path.lens.length) {
      leakEnemy(state, enemy);
      return;
    }
    const segLen = enemy.path.lens[enemy.seg];
    if (segLen < 1e-5) {
      enemy.seg += 1;
      enemy.t = 0;
      continue;
    }
    const room = (1 - enemy.t) * segLen;
    if (left < room) {
      enemy.t += left / segLen;
      left = 0;
    } else {
      left -= room;
      enemy.seg += 1;
      enemy.t = 0;
      if (enemy.seg >= enemy.path.lens.length) {
        leakEnemy(state, enemy);
        return;
      }
    }
  }
  placeEnemy(enemy);
}

function placeEnemy(enemy) {
  const pts = enemy.path.points;
  const a = pts[enemy.seg];
  const b = pts[Math.min(pts.length - 1, enemy.seg + 1)];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  enemy.facing = Math.atan2(dx, dz);
  const px = -dz / len;
  const pz = dx / len;
  enemy.x = a.x + dx * enemy.t + px * enemy.lane;
  enemy.z = a.z + dz * enemy.t + pz * enemy.lane;
  const segLen = enemy.path.lens[enemy.seg] || 0;
  enemy.traveled = enemy.path.cum[enemy.seg] + segLen * enemy.t;
  enemy.remaining = Math.max(0, enemy.path.length - enemy.traveled);
}

function leakEnemy(state, enemy) {
  if (!enemy.alive) return;
  enemy.alive = false;
  state.lives -= enemy.leak;
  state.leaked += 1;
  sfx(state, 'leak');
  pushEffect(state, {
    kind: 'popup',
    text: `-${enemy.leak} life`,
    x: enemy.x,
    z: enemy.z,
    life: 1,
    max: 1,
    color: '#ff6b5a',
  });
  if (state.lives <= 0) {
    state.lives = 0;
    state.status = 'defeat';
    state.phase = 'done';
    sfx(state, 'defeat');
  }
}

function pickTarget(state, tower, range) {
  let best = null;
  let bestScore = 0;
  for (let i = 0; i < state.enemies.length; i += 1) {
    const enemy = state.enemies[i];
    if (!enemy.alive) continue;
    const dist = Math.hypot(enemy.x - tower.x, enemy.z - tower.z);
    if (dist > range) continue;
    let score = -enemy.remaining;
    if (tower.target === 'last') score = enemy.remaining;
    else if (tower.target === 'strong') score = enemy.hp;
    else if (tower.target === 'close') score = -dist;
    if (!best || score > bestScore) {
      best = enemy;
      bestScore = score;
    }
  }
  return best;
}

function fire(state, tower, target, stats) {
  tower.cooldown = stats.cooldown;
  const dist = Math.hypot(target.x - tower.x, target.z - tower.z);
  state.projectiles.push({
    id: state.nextId++,
    alive: true,
    x: tower.x,
    z: tower.z,
    sx: tower.x,
    sz: tower.z,
    targetId: target.id,
    damage: stats.damage,
    armorPierce: stats.armorPierce,
    speed: stats.projectileSpeed,
    splash: stats.splash,
    splashFalloff: stats.splashFalloff,
    kind: stats.projectile,
    towerId: tower.id,
    flight: 0,
    duration: Math.max(0.12, dist / stats.projectileSpeed),
  });
}

function fly(state, proj, dt) {
  const target = state.enemies.find((enemy) => enemy.id === proj.targetId && enemy.alive);
  if (!target) {
    proj.alive = false;
    return;
  }
  const dx = target.x - proj.x;
  const dz = target.z - proj.z;
  const dist = Math.hypot(dx, dz);
  const stepDist = proj.speed * dt;
  proj.flight += dt;
  if (dist <= stepDist + 0.22) {
    proj.x = target.x;
    proj.z = target.z;
    impact(state, proj);
    return;
  }
  proj.x += (dx / dist) * stepDist;
  proj.z += (dz / dist) * stepDist;
}

function impact(state, proj) {
  proj.alive = false;
  pushEffect(state, {
    kind: proj.splash ? 'splash' : 'hit',
    x: proj.x,
    z: proj.z,
    life: proj.splash ? 0.38 : 0.14,
    max: proj.splash ? 0.38 : 0.14,
    color: proj.splash ? '#ff7a32' : '#f2e2c2',
    radius: proj.splash || 0.4,
  });
  if (proj.splash) {
    for (let i = 0; i < state.enemies.length; i += 1) {
      const enemy = state.enemies[i];
      if (!enemy.alive) continue;
      const d = Math.hypot(enemy.x - proj.x, enemy.z - proj.z);
      if (d > proj.splash) continue;
      const t = d / proj.splash;
      const raw = proj.damage * (1 - t * (1 - proj.splashFalloff));
      damageEnemy(state, enemy, applyArmor(raw, enemy, proj.armorPierce), proj.towerId);
      if (state.status !== 'playing') return;
    }
    return;
  }
  const primary = state.enemies.find((enemy) => enemy.id === proj.targetId && enemy.alive);
  if (!primary) return;
  damageEnemy(state, primary, applyArmor(proj.damage, primary, proj.armorPierce), proj.towerId);
}

function applyArmor(amount, enemy, pierce) {
  const armor = enemy.armor * (1 - pierce);
  return Math.max(1, amount - armor);
}

function damageEnemy(state, enemy, amount, towerId) {
  if (!enemy.alive || enemy.invuln > 0) return;
  enemy.hp -= amount;
  enemy.flash = 0.14;
  if (enemy.hp > 0) return;
  if (enemy.reviveRatio && !enemy.revived) {
    enemy.revived = true;
    enemy.hp = enemy.maxHp * enemy.reviveRatio;
    enemy.invuln = 0.45;
    enemy.flash = 0.5;
    sfx(state, 'revive');
    pushEffect(state, {
      kind: 'popup',
      text: 'Rises',
      x: enemy.x,
      z: enemy.z,
      life: 0.85,
      max: 0.85,
      color: '#e6c36a',
    });
    return;
  }
  enemy.alive = false;
  state.gold += enemy.reward;
  state.killed += 1;
  const tower = state.towers.find((item) => item.id === towerId);
  if (tower) tower.kills += 1;
  if (enemy.boss) sfx(state, 'bossdown');
  else if (!state._hitSfx) {
    sfx(state, 'hit');
    state._hitSfx = true;
  }
  pushEffect(state, {
    kind: 'popup',
    text: `+${enemy.reward}`,
    x: enemy.x,
    z: enemy.z,
    life: 0.8,
    max: 0.8,
    color: '#f0d7a2',
  });
  pushEffect(state, {
    kind: 'death',
    x: enemy.x,
    z: enemy.z,
    life: 0.4,
    max: 0.4,
    color: enemy.color,
  });
}

function pushEffect(state, effect) {
  if (state.effects.length >= 36) return;
  state.effects.push({ id: state.nextId++, ...effect });
}
