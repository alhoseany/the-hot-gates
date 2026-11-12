import { map, terrainHeight, coverageScore, TOWERS, HERO, LEVELS, selectLevel } from '../src/data.js';
import {
  startGame,
  update,
  selectType,
  handlePad,
  upgradeTower,
  sendWave,
} from '../src/sim.js';

const failures = [];

function assert(cond, message) {
  if (!cond) failures.push(message);
}

for (const level of LEVELS) {
  selectLevel(level.id);
  const length = map.main.length;
  const minLength = level.id === 'thermopylae' ? 58 : 40;
  if (length < minLength || length > 95) failures.push(`${level.id} path length ${length.toFixed(1)}`);
  if (map.pads.length < 8) failures.push(`${level.id} only ${map.pads.length} pads`);
  for (const p of map.main.points) {
    const h = Math.abs(terrainHeight(p.x, p.z));
    if (h > 0.08) failures.push(`${level.id} path height ${h.toFixed(3)} at ${p.x},${p.z}`);
  }
  for (const pad of map.pads) {
    const h = Math.abs(terrainHeight(pad.x, pad.z));
    if (h > 0.2) failures.push(`${level.id} pad height ${h.toFixed(2)} at ${pad.x},${pad.z}`);
  }
}
selectLevel('thermopylae');

assert(map.main.length > 58 && map.main.length < 95, `main path length ${map.main.length.toFixed(1)} is out of range`);
assert(map.pads.length >= 10, `only ${map.pads.length} pads`);

let maxPathHeight = 0;
for (const p of map.main.points) {
  maxPathHeight = Math.max(maxPathHeight, Math.abs(terrainHeight(p.x, p.z)));
}
assert(maxPathHeight < 0.08, `path terrain height ${maxPathHeight.toFixed(3)}`);

let weakPads = 0;
for (const pad of map.pads) {
  const mainScore = coverageScore(pad.x, pad.z, TOWERS.hoplite.range, map.main);
  const trailScore = coverageScore(pad.x, pad.z, 7.6, map.trail);
  const h = Math.abs(terrainHeight(pad.x, pad.z));
  if (h > 0.12) failures.push(`pad ${pad.x},${pad.z} terrain ${h.toFixed(2)}`);
  if (!pad.trail && mainScore < 3) weakPads += 1;
  if (pad.trail && trailScore < 2 && mainScore < 2) {
    failures.push(`trail pad ${pad.x},${pad.z} covers nothing`);
  }
}
assert(weakPads === 0, `${weakPads} road pads have weak hoplite coverage`);

const heroScore = coverageScore(map.hero.x, map.hero.z, HERO.range, map.main);
assert(heroScore >= 4, `hero coverage ${heroScore}`);

function runUntil(state, pred, limit = 80000) {
  let steps = 0;
  while (!pred(state) && steps < limit) {
    update(state, 0.05);
    steps += 1;
  }
  return steps < limit;
}

function buy(state, type) {
  const order = map.pads
    .map((pad, index) => ({
      index,
      trail: pad.trail,
      score:
        coverageScore(pad.x, pad.z, TOWERS[type].range, map.main) +
        (state.flankOpen ? coverageScore(pad.x, pad.z, TOWERS[type].range, map.flank) * 0.85 : 0) +
        (pad.trail && state.flankOpen ? 6 : 0),
    }))
    .filter((pad) => !state.towers.some((tower) => tower.pad === pad.index))
    .sort((a, b) => b.score - a.score);
  const choice = order.find((pad) => pad.score > 0);
  if (!choice) return false;
  selectType(state, type);
  if (state.selectedType !== type) selectType(state, type);
  const before = state.towers.length;
  handlePad(state, choice.index);
  return state.towers.length > before;
}

function spend(state) {
  const count = (type) => state.towers.filter((tower) => tower.type === type).length;
  const next = state.waveIndex + 1;
  const priority = (tower) => (tower.type === 'scorpion' ? 0 : tower.type === 'oil' ? 1 : tower.type === 'hoplite' ? 2 : 3);
  for (let n = 0; n < 12; n += 1) {
    const scorpion = state.towers.find((tower) => tower.type === 'scorpion' && tower.level < 2);
    if (next >= 5 && scorpion && upgradeTower(state, scorpion.id)) continue;

    let type = null;
    if (next >= 4 && count('oil') < 1 && state.gold >= TOWERS.oil.cost) type = 'oil';
    else if (next >= 2 && count('scorpion') < 2 && state.gold >= TOWERS.scorpion.cost) type = 'scorpion';
    else if (next >= 7 && count('scorpion') < 3 && state.gold >= TOWERS.scorpion.cost) type = 'scorpion';
    else if (count('archer') < 3 && state.gold >= TOWERS.archer.cost) type = 'archer';
    else if (count('hoplite') < 2 && state.gold >= TOWERS.hoplite.cost) type = 'hoplite';
    else if (next >= 5 && count('oil') < 2 && state.gold >= TOWERS.oil.cost) type = 'oil';
    else if (count('archer') < 4 && state.gold >= TOWERS.archer.cost) type = 'archer';

    if (!type && next >= 2 && count('scorpion') < 2 && state.gold >= TOWERS.scorpion.cost - 40) break;
    if (type && buy(state, type)) continue;

    const real = state.towers.filter((tower) => !tower.hero);
    if (real.length >= 5) {
      const up = real
        .filter((tower) => tower.level < 3)
        .sort((a, b) => priority(a) - priority(b) || a.level - b.level || b.kills - a.kills)[0];
      if (up && upgradeTower(state, up.id)) continue;
    }
    break;
  }
}

const early = startGame();
selectType(early, 'archer');
const archerPads = map.pads
  .map((pad, index) => ({ index, score: coverageScore(pad.x, pad.z, TOWERS.archer.range, map.main), trail: pad.trail }))
  .filter((pad) => !pad.trail)
  .sort((a, b) => b.score - a.score);
handlePad(early, archerPads[0].index);
handlePad(early, archerPads[1].index);
selectType(early, 'hoplite');
const hopPad = map.pads
  .map((pad, index) => ({ index, score: coverageScore(pad.x, pad.z, TOWERS.hoplite.range, map.main), trail: pad.trail }))
  .filter((pad) => !pad.trail && !early.towers.some((tower) => tower.pad === pad.index))
  .sort((a, b) => b.score - a.score)[0];
handlePad(early, hopPad.index);
assert(early.towers.length === 4, `opening towers ${early.towers.length}`);
sendWave(early);
const finishedEarly = runUntil(early, (s) => s.phase === 'build' || s.status !== 'playing');
assert(finishedEarly, 'wave 1 did not finish');
assert(early.status === 'playing', `wave 1 status ${early.status}`);
assert(early.lives >= 18, `opening leaked too much, lives ${early.lives}`);

const idle = startGame();
let idleGuard = 0;
while (idle.status === 'playing' && idle.waveIndex < 4 && idleGuard < 6) {
  if (!sendWave(idle)) break;
  runUntil(idle, (s) => s.phase === 'build' || s.status !== 'playing');
  idleGuard += 1;
}
assert(idle.status === 'defeat', `empty defense status ${idle.status} wave ${idle.waveIndex + 1} lives ${idle.lives}`);

const bot = startGame();
const log = [];
while (bot.status === 'playing' && bot.waveIndex < 16) {
  spend(bot);
  if (!sendWave(bot)) break;
  const ok = runUntil(bot, (s) => s.phase === 'build' || s.status !== 'playing', 120000);
  if (!ok) {
    failures.push('bot timed out');
    break;
  }
  log.push(
    `wave ${bot.waveIndex + 1} ${bot.status} lives ${bot.lives} gold ${bot.gold} towers ${bot.towers.length - 1} kills ${bot.killed}`,
  );
  if (bot.status !== 'playing') break;
}

console.log(`path ${map.main.length.toFixed(1)} pads ${map.pads.length} trail ${map.pads.filter((p) => p.trail).length}`);
console.log(`hero ${map.hero.x},${map.hero.z} score ${heroScore}`);
console.log(log.join('\n'));
console.log(
  `bot ${bot.status} lives ${bot.lives} gold ${bot.gold} kills ${bot.killed} leaks ${bot.leaked} wave ${bot.waveIndex + 1}`,
);

assert(bot.status === 'victory', `bot did not win (${bot.status}, lives ${bot.lives}, wave ${bot.waveIndex + 1})`);
assert(bot.lives >= 6, `bot won with only ${bot.lives} lives`);
assert(bot.lives <= 18, `bot won too cleanly with ${bot.lives} lives`);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('sim check passed');
