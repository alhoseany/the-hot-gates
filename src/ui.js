import { HERO, LEVELS, STARTING_LIVES, TOWERS, WAVES, getLevel, waveSummary } from './data.js';
import { sellRefund, targetLabel, towerStats, upgradeCost } from './sim.js';
import { getGraphicsVersion } from './version.js';

const ORDER = ['hoplite', 'archer', 'oil', 'scorpion'];

export function createUI(root) {
  root.innerHTML = `
    <div id="vignette"></div>
    <div id="hud">
      <header>
        <div class="brand">
          <p class="eyebrow" id="era">Thermopylae · 480 BC</p>
          <h1 id="battle-title">The Hot Gates</h1>
        </div>
        <div class="meters">
          <p><span>Gold</span> <strong id="gold">0</strong></p>
          <p><span>Lives</span> <strong id="lives">0</strong></p>
          <p><span>Wave</span> <strong id="wave">–</strong></p>
        </div>
        <div class="tools">
          <p id="trail" class="trail">Mountain trail quiet</p>
          <div class="speeds" role="group" aria-label="Graphics version">
            <button type="button" data-version="1" title="Original">I</button>
            <button type="button" data-version="2" title="Painted world">II</button>
            <button type="button" data-version="3" title="Detailed towers">III</button>
            <button type="button" data-version="4" title="Ink print">IV</button>
          </div>
          <div class="speeds" role="group" aria-label="Speed">
            <button type="button" data-speed="1">1×</button>
            <button type="button" data-speed="2">2×</button>
            <button type="button" data-speed="3">3×</button>
          </div>
          <button type="button" id="pause" class="ghost">Pause</button>
          <button type="button" id="leave" class="ghost">Battles</button>
          <button type="button" id="mute" class="ghost">Sound</button>
          <button type="button" id="help-open" class="ghost">Help</button>
        </div>
      </header>
      <div id="story" class="story hidden"></div>
      <div id="toast" class="toast hidden"></div>
      <div id="boss" class="boss hidden">
        <span id="boss-name"></span>
        <div class="boss-track"><div id="boss-fill"></div></div>
      </div>
      <aside id="inspect" class="tablet inspect hidden">
        <p class="eyebrow" id="in-role"></p>
        <h2 id="in-name"></h2>
        <p id="in-blurb"></p>
        <dl class="stats">
          <div><dt>Damage</dt><dd id="in-dmg"></dd></div>
          <div><dt>Range</dt><dd id="in-range"></dd></div>
          <div><dt>Rate</dt><dd id="in-rate"></dd></div>
          <div><dt>Kills</dt><dd id="in-kills"></dd></div>
        </dl>
        <p id="in-phalanx" class="phalanx"></p>
        <div class="inspect-actions">
          <button type="button" id="in-target" class="ghost"></button>
          <button type="button" id="in-upgrade" class="primary"></button>
          <button type="button" id="in-sell" class="ghost danger"></button>
        </div>
      </aside>
      <p id="hint" class="hint">1–4 choose a tower · click a ring · Space sends the wave</p>
      <footer>
        <div id="cards" class="cards"></div>
        <div class="dispatch">
          <div>
            <p id="next-title" class="eyebrow">Next</p>
            <p id="next-body"></p>
          </div>
          <button type="button" id="send" class="primary send">Send wave</button>
        </div>
      </footer>
    </div>
    <div id="menu" class="overlay">
      <section class="tablet menu-card">
        <p class="eyebrow" id="menu-era">Five last stands</p>
        <h2 id="menu-title">The Hot Gates</h2>
        <div class="version-row">
          <div class="speeds" role="group" aria-label="Graphics version">
            <button type="button" data-version="1" title="Original">I</button>
            <button type="button" data-version="2" title="Painted world">II</button>
            <button type="button" data-version="3" title="Detailed towers">III</button>
            <button type="button" data-version="4" title="Ink print">IV</button>
          </div>
        </div>
        <p class="fine version-note">I original · II painted world · III detailed towers · IV ink print</p>
        <div id="levels" class="levels"></div>
        <p class="lede" id="level-lede"></p>
        <ul id="level-notes"></ul>
        <button type="button" id="begin" class="primary">Begin the defense</button>
        <p class="fine">Drag to look around. Right-drag to move. Scroll to zoom.</p>
      </section>
    </div>
    <div id="end" class="overlay hidden">
      <section class="tablet menu-card">
        <p class="eyebrow" id="end-kicker"></p>
        <h2 id="end-title"></h2>
        <p id="end-body"></p>
        <dl class="stats end-stats">
          <div><dt>Waves</dt><dd id="end-waves"></dd></div>
          <div><dt>Slain</dt><dd id="end-kills"></dd></div>
          <div><dt>Leaked</dt><dd id="end-leaks"></dd></div>
        </dl>
        <div id="end-levels" class="levels"></div>
        <button type="button" id="again" class="primary">Defend again</button>
      </section>
    </div>
    <div id="paused" class="overlay hidden">
      <section class="tablet pause-card">
        <h2>Paused</h2>
        <button type="button" id="resume" class="primary">Resume</button>
        <button type="button" id="leave-paused" class="ghost">Choose another battle</button>
      </section>
    </div>
    <div id="help" class="overlay hidden">
      <section class="tablet menu-card">
        <p class="eyebrow">Field notes</p>
        <h2>How to hold</h2>
        <ul>
          <li><strong>Hoplite</strong> — cheap spears. Place them near each other for Phalanx, up to +36% damage.</li>
          <li><strong>Archer</strong> — long reach down the road. Weak against shields.</li>
          <li><strong>Boiling oil</strong> — splash. Use it when the ranks are packed.</li>
          <li><strong>Scorpion</strong> — slow ballista that ignores most armor. The answer to shields, Immortals, and the champion.</li>
          <li>Leonidas already holds the last stretch. He is not for sale.</li>
          <li>Keys: 1–4 towers, Space send, U upgrade, X sell, R retarget, F speed, P pause, M mute, Esc back.</li>
          <li>I, II, III, and IV switch the look at any time. III is the detailed towers. IV is the ink print.</li>
          <li>Battles leaves the fight and returns to the story list.</li>
        </ul>
        <button type="button" id="help-close" class="primary">Return</button>
      </section>
    </div>
  `;

  const levelMarkup = LEVELS.map((level) => `
    <button type="button" class="level-pick" data-level="${level.id}">
      <strong>${level.title}</strong>
      <span>${level.eyebrow}</span>
    </button>
  `).join('');
  root.querySelector('#levels').innerHTML = levelMarkup;
  root.querySelector('#end-levels').innerHTML = levelMarkup;

  const cards = root.querySelector('#cards');
  cards.innerHTML = ORDER.map((type) => {
    const tower = TOWERS[type];
    return `
      <button type="button" class="card" data-type="${type}">
        <span class="emblem ${type}"></span>
        <span class="card-top"><span class="card-name">${tower.name}</span><span class="card-key">${tower.key}</span></span>
        <span class="card-cost">${tower.cost} gold</span>
        <span class="card-role">${tower.role}</span>
        <span class="card-desc">${tower.blurb}</span>
      </button>
    `;
  }).join('');

  const el = {
    hud: root.querySelector('#hud'),
    gold: root.querySelector('#gold'),
    lives: root.querySelector('#lives'),
    wave: root.querySelector('#wave'),
    trail: root.querySelector('#trail'),
    story: root.querySelector('#story'),
    toast: root.querySelector('#toast'),
    boss: root.querySelector('#boss'),
    bossName: root.querySelector('#boss-name'),
    bossFill: root.querySelector('#boss-fill'),
    inspect: root.querySelector('#inspect'),
    role: root.querySelector('#in-role'),
    name: root.querySelector('#in-name'),
    blurb: root.querySelector('#in-blurb'),
    dmg: root.querySelector('#in-dmg'),
    range: root.querySelector('#in-range'),
    rate: root.querySelector('#in-rate'),
    kills: root.querySelector('#in-kills'),
    phalanx: root.querySelector('#in-phalanx'),
    target: root.querySelector('#in-target'),
    upgrade: root.querySelector('#in-upgrade'),
    sell: root.querySelector('#in-sell'),
    hint: root.querySelector('#hint'),
    nextTitle: root.querySelector('#next-title'),
    nextBody: root.querySelector('#next-body'),
    send: root.querySelector('#send'),
    menu: root.querySelector('#menu'),
    end: root.querySelector('#end'),
    endKicker: root.querySelector('#end-kicker'),
    endTitle: root.querySelector('#end-title'),
    endBody: root.querySelector('#end-body'),
    endWaves: root.querySelector('#end-waves'),
    endKills: root.querySelector('#end-kills'),
    endLeaks: root.querySelector('#end-leaks'),
    paused: root.querySelector('#paused'),
    help: root.querySelector('#help'),
    pause: root.querySelector('#pause'),
    mute: root.querySelector('#mute'),
    speeds: [...root.querySelectorAll('[data-speed]')],
    versions: [...root.querySelectorAll('[data-version]')],
    levels: [...root.querySelectorAll('[data-level]')],
    era: root.querySelector('#era'),
    battleTitle: root.querySelector('#battle-title'),
    menuTitle: root.querySelector('#menu-title'),
    lede: root.querySelector('#level-lede'),
    notes: root.querySelector('#level-notes'),
    cards: [...root.querySelectorAll('.card')],
  };

  let handler = () => {};
  const emit = (type, value) => handler({ type, value });

  root.querySelector('#begin').addEventListener('click', () => emit('begin'));
  root.querySelector('#again').addEventListener('click', () => emit('restart'));
  root.querySelector('#resume').addEventListener('click', () => emit('pause'));
  root.querySelector('#leave').addEventListener('click', () => emit('leave'));
  root.querySelector('#leave-paused').addEventListener('click', () => emit('leave'));
  root.querySelector('#pause').addEventListener('click', () => emit('pause'));
  root.querySelector('#mute').addEventListener('click', () => emit('mute'));
  root.querySelector('#help-open').addEventListener('click', () => emit('help'));
  root.querySelector('#help-close').addEventListener('click', () => emit('help'));
  root.querySelector('#send').addEventListener('click', () => emit('send'));
  el.target.addEventListener('click', () => emit('target'));
  el.upgrade.addEventListener('click', () => emit('upgrade'));
  el.sell.addEventListener('click', () => emit('sell'));
  el.speeds.forEach((button) => {
    button.addEventListener('click', () => emit('speed', Number(button.dataset.speed)));
  });
  el.versions.forEach((button) => {
    button.addEventListener('click', () => emit('version', Number(button.dataset.version)));
  });
  el.levels.forEach((button) => {
    button.addEventListener('click', () => emit('level', button.dataset.level));
  });
  el.cards.forEach((button) => {
    button.addEventListener('click', () => emit('type', button.dataset.type));
  });

  function sync(state) {
    const playing = state.status === 'playing';
    el.hud.classList.toggle('hidden', state.status === 'menu');
    el.menu.classList.toggle('hidden', state.status !== 'menu');
    el.paused.classList.toggle('hidden', !(playing && state.paused && !state.help));
    el.help.classList.toggle('hidden', !state.help);
    el.end.classList.toggle('hidden', state.status !== 'victory' && state.status !== 'defeat');
    el.pause.textContent = state.paused ? 'Resume' : 'Pause';
    el.mute.textContent = state.muted ? 'Muted' : 'Sound';
    el.mute.classList.toggle('is-on', state.muted);
    el.speeds.forEach((button) => {
      button.classList.toggle('is-on', Number(button.dataset.speed) === state.speed);
    });
    const version = getGraphicsVersion();
    document.body.classList.toggle('look-ink', version === 4);
    el.versions.forEach((button) => {
      button.classList.toggle('is-on', Number(button.dataset.version) === version);
    });

    const level = getLevel();
    el.era.textContent = level.eyebrow;
    el.battleTitle.textContent = level.title;
    el.menuTitle.textContent = level.title;
    el.lede.textContent = level.lede;
    el.notes.innerHTML = level.notes.map((note) => `<li>${note}</li>`).join('');
    el.levels.forEach((button) => {
      button.classList.toggle('active', button.dataset.level === level.id);
    });

    el.gold.textContent = String(state.gold);
    el.lives.textContent = `${state.lives}/${STARTING_LIVES}`;
    el.lives.parentElement.classList.toggle('danger', state.lives <= 5);
    const shownWave = state.waveIndex < 0 ? 0 : state.waveIndex + 1;
    el.wave.textContent = `${shownWave}/${WAVES.length}`;
    el.trail.textContent = state.flankOpen ? level.trailOpen : level.trailQuiet;
    el.trail.classList.toggle('open', state.flankOpen);

    if (state.story) {
      el.story.classList.remove('hidden');
      el.story.innerHTML = `<strong>${state.story.title}</strong><span>${state.story.body}</span>`;
    } else el.story.classList.add('hidden');

    if (state.toast && !state.story) {
      el.toast.classList.remove('hidden');
      el.toast.textContent = state.toast.text;
    } else el.toast.classList.add('hidden');

    const boss = state.enemies.find((enemy) => enemy.boss && enemy.alive);
    el.boss.classList.toggle('hidden', !boss);
    if (boss) {
      el.bossName.textContent = boss.name;
      el.bossFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
    }

    const selected = state.towers.find((tower) => tower.id === state.selectedTowerId);
    el.inspect.classList.toggle('hidden', !selected || !playing);
    if (selected) {
      const stats = towerStats(state, selected);
      if (selected.hero) {
        el.role.textContent = level.heroTitle;
        el.name.textContent = HERO.name;
        el.blurb.textContent = 'He holds the last stretch. He cannot be bought, sold, or improved.';
        el.upgrade.classList.add('hidden');
        el.sell.classList.add('hidden');
      } else {
        const def = TOWERS[selected.type];
        el.role.textContent = `${def.role} · level ${selected.level}`;
        el.name.textContent = def.name;
        el.blurb.textContent = def.blurb;
        el.upgrade.classList.remove('hidden');
        el.sell.classList.remove('hidden');
        const cost = upgradeCost(selected);
        el.upgrade.textContent = cost == null ? 'Fully built' : `Upgrade · ${cost}`;
        el.upgrade.disabled = cost == null || state.gold < cost;
        el.sell.textContent = `Sell · ${sellRefund(selected)}`;
      }
      el.dmg.textContent = stats.damage.toFixed(1);
      el.range.textContent = stats.range.toFixed(1);
      el.rate.textContent = `${stats.dps.toFixed(1)} /s`;
      el.kills.textContent = String(selected.kills);
      el.phalanx.textContent = stats.allies
        ? `Phalanx +${Math.round(stats.phalanx * 100)}% from ${stats.allies} nearby`
        : 'No phalanx. Towers within a short march strengthen each other.';
      el.target.textContent = `Aim: ${targetLabel(selected.target)}`;
    }

    el.cards.forEach((button) => {
      const type = button.dataset.type;
      button.classList.toggle('active', state.selectedType === type);
      button.classList.toggle('broke', state.gold < TOWERS[type].cost);
    });

    const upcoming = WAVES[state.waveIndex + 1];
    if (state.phase === 'combat' && state.waveIndex >= 0) {
      const wave = WAVES[state.waveIndex];
      el.nextTitle.textContent = wave.name;
      el.nextBody.textContent = `${state.enemies.length} still on the road`;
      el.send.disabled = true;
      el.send.textContent = 'In battle';
    } else if (upcoming && playing) {
      el.nextTitle.textContent = `Next · ${upcoming.name}`;
      el.nextBody.textContent = waveSummary(upcoming).join(' · ');
      el.send.disabled = state.paused || state.help;
      el.send.textContent = `Send wave ${state.waveIndex + 2}`;
    } else {
      el.nextTitle.textContent = 'The pass';
      el.nextBody.textContent = playing ? 'The road is quiet.' : '';
      el.send.disabled = true;
      el.send.textContent = 'Send wave';
    }

    el.hint.classList.toggle('hidden', !playing || state.waveIndex >= 0);

    if (state.status === 'victory' || state.status === 'defeat') {
      const victory = state.status === 'victory';
      el.endKicker.textContent = victory ? level.victoryKicker : level.defeatKicker;
      el.endTitle.textContent = victory ? level.victoryTitle : level.defeatTitle;
      el.endBody.textContent = victory ? level.victoryBody : level.defeatBody;
      el.endWaves.textContent = victory ? `${WAVES.length}/${WAVES.length}` : `${Math.max(0, state.waveIndex + 1)}/${WAVES.length}`;
      el.endKills.textContent = String(state.killed);
      el.endLeaks.textContent = String(state.leaked);
    }
  }

  return {
    sync,
    on(fn) { handler = fn; },
  };
}
