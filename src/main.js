import './style.css';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import {
  clearSelection,
  clearTowerSelection,
  createGame,
  cycleTarget,
  handlePad,
  selectTower,
  selectType,
  sellTower,
  sendWave,
  setSpeed,
  startGame,
  update,
  upgradeTower,
} from './sim.js';
import { createUI } from './ui.js';
import { selectLevel } from './data.js';
import { setGraphicsVersion } from './version.js';

const canvas = document.querySelector('#view');
const ui = createUI(document.querySelector('#ui'));
const audio = createAudio();

function showBootError(error) {
  console.error(error);
  const box = document.createElement('p');
  box.id = 'boot-error';
  box.textContent = 'The battlefield could not be drawn in this browser. WebGL needs to be enabled.';
  box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:20;margin:0;padding:12px 14px;background:#3a1410;color:#f6ead8;pointer-events:auto';
  document.body.appendChild(box);
}

let state = createGame();

function drain() {
  if (!state.sfx.length) return;
  if (state.muted) {
    state.sfx.length = 0;
    return;
  }
  for (const name of state.sfx) audio.play(name);
  state.sfx.length = 0;
}

function begin() {
  const muted = state.muted;
  state = startGame({ muted });
  audio.setMuted(muted);
  audio.unlock();
}

function leaveBattle() {
  const muted = state.muted;
  state = createGame();
  state.muted = muted;
  audio.setMuted(muted);
}

let renderer;
try {
  renderer = createRenderer(canvas, {
    onPick(pick) {
      audio.unlock();
      if (state.status !== 'playing' || state.paused || state.help) return;
      if (pick.towerId != null) selectTower(state, pick.towerId);
      else if (pick.padIndex != null) handlePad(state, pick.padIndex);
      else clearTowerSelection(state);
      drain();
    },
  });
} catch (error) {
  showBootError(error);
}

if (renderer) {

renderer.setPickGate(() => state.status === 'playing' && !state.paused && !state.help);

ui.on((event) => {
  audio.unlock();
  if (event.type === 'begin' || event.type === 'restart') begin();
  else if (event.type === 'pause' && state.status === 'playing') state.paused = !state.paused;
  else if (event.type === 'mute') {
    state.muted = !state.muted;
    audio.setMuted(state.muted);
    if (!state.muted) audio.play('click');
  } else if (event.type === 'help') state.help = !state.help;
  else if (event.type === 'speed') setSpeed(state, event.value);
  else if (event.type === 'version') setGraphicsVersion(event.value);
  else if (event.type === 'level') selectLevel(event.value);
  else if (event.type === 'leave') leaveBattle();
  else if (event.type === 'type') selectType(state, event.value);
  else if (event.type === 'send') sendWave(state);
  else if (event.type === 'upgrade') upgradeTower(state);
  else if (event.type === 'sell') sellTower(state);
  else if (event.type === 'target') cycleTarget(state);
  drain();
});

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'Space') event.preventDefault();
  audio.unlock();
  if (event.code === 'Escape') {
    if (state.help) state.help = false;
    else if (state.selectedTowerId || state.selectedType) clearSelection(state);
    else if (state.status === 'playing') state.paused = !state.paused;
  } else if (state.status !== 'playing') {
    if (event.code === 'KeyM') {
      state.muted = !state.muted;
      audio.setMuted(state.muted);
    }
  } else if (!state.help) {
    if (event.code === 'Digit1') selectType(state, 'hoplite');
    else if (event.code === 'Digit2') selectType(state, 'archer');
    else if (event.code === 'Digit3') selectType(state, 'oil');
    else if (event.code === 'Digit4') selectType(state, 'scorpion');
    else if (event.code === 'Space') sendWave(state);
    else if (event.code === 'KeyU') upgradeTower(state);
    else if (event.code === 'KeyX') sellTower(state);
    else if (event.code === 'KeyR') cycleTarget(state);
    else if (event.code === 'KeyF') setSpeed(state, state.speed === 1 ? 2 : state.speed === 2 ? 3 : 1);
    else if (event.code === 'KeyP') state.paused = !state.paused;
    else if (event.code === 'KeyM') {
      state.muted = !state.muted;
      audio.setMuted(state.muted);
    }
  }
  drain();
});

let last = performance.now();
function frame(now) {
  const realDt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.status === 'playing' && !state.paused && !state.help) {
    update(state, realDt * state.speed);
    drain();
  }
  renderer.frame(state, realDt);
  ui.sync(state);
  const hovering = renderer.hovered;
  canvas.style.cursor = renderer.dragging ? 'grabbing' : hovering ? 'pointer' : 'default';
  requestAnimationFrame(frame);
}

ui.sync(state);
requestAnimationFrame(frame);
}
