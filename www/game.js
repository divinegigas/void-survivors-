// STARBURN: a vertical shooter where kills drop XP and level-ups build your loadout.
// Everything lives in this one file. The TUNING block at the top is the place
// to tweak how the game feels; you rarely need to touch anything below it.
'use strict';

// ============================================================================
// TUNING: change these numbers, save, reload. That's the whole loop.
// ============================================================================
const CFG = {
  worldWidth: 360,            // the game is always 360 "units" wide; height fits the screen

  player: {
    hp: 3,                    // hits you can take
    hitRadius: 4,             // the tiny white dot is your real hitbox (bullet-hell style)
    dragSensitivity: 1.3,     // 1 = ship moves exactly as far as your finger
    keySpeed: 260,            // arrow keys / WASD speed (for testing on a computer)
    invulnTime: 1.2,          // seconds of blinking safety after a hit
    fireInterval: 0.16,       // Wing Cannons: seconds between pod shots (lower = faster)
    damage: 10,               // Wing Cannons: pod bullet base damage
    bulletSpeed: 720,
    magnetRadius: 34,         // how close you must fly to pull in XP crystals
  },

  slots: { weapons: 4, passives: 4 },
  ultLevel: 10,               // level that offers a choice of ultimate (double-tap to fire)
  ultCooldownMul: 1,          // 0.5 = ultimates recharge twice as fast
  signatureCooldown: 0.8,     // a ship's own weapon fires 20% faster than the same weapon picked up later (1 = no bonus)   // your ship's signature weapon is a bonus slot on top
  rarityWeights: { common: 4, uncommon: 2, rare: 1 },   // common is 2x as likely as uncommon, which is 2x rare
  shipCost: { common: 150, uncommon: 450, rare: 1000 }, // credits to unlock a ship, by its weapon's tier
  deflectorRecharge: [0, 40, 32, 25, 19, 14],            // Deflector Shield recharge seconds per Hangar level
  maxLevel: 5,                // max level for weapons and most passives
  upgradeChoices: 3,
  postLevelUpInvuln: 0.8,     // grace after picking an upgrade (finger needs to find the ship)

  xp: {
    orbFallSpeed: 55,         // crystals drift down; miss them and they're gone
    pullSpeed: 440,           // how fast crystals fly to you once inside the magnet
    needBase: 6,              // XP for level 2
    needPerLevel: 4,          // extra XP needed per level
    needCurve: 0.5,           // extra XP that grows with level squared
  },

  spawn: {
    graceTime: 1.5,           // quiet seconds at the start
    startInterval: 1.6,       // seconds between enemy groups at the start
    minInterval: 0.5,         // ...and once fully ramped up
    rampSeconds: 360,         // how long it takes to reach full intensity
    duringBossMul: 2.5,       // fewer small enemies while a boss is up
  },

  boss: {
    first: 120,               // seconds until the first capital ship
    every: 150,               // seconds between capital ships after that
    creditsBase: 25,          // bounty for the first boss...
    creditsPerBoss: 15,       // ...plus this much for each later one
  },

  enemyHpGrowthPerMin: 0.35,  // enemies get +35% HP per minute survived
  enemyBulletSpeed: 150,
  enemyBulletSpeedGrowth: 600,// bullet speed +100% after this many seconds
};

// ============================================================================
// Small helpers
// ============================================================================
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pickOut(arr) { return arr.splice(Math.floor(Math.random() * arr.length), 1)[0]; }
function compact(arr) {          // remove dead things without allocating a new array
  let j = 0;
  for (let i = 0; i < arr.length; i++) if (!arr[i].dead) arr[j++] = arr[i];
  arr.length = j;
}
function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

const TIER = {
  common:   { name: 'COMMON',   color: '#3ddc4a' },
  uncommon: { name: 'UNCOMMON', color: '#a45cff' },
  rare:     { name: 'RARE',     color: '#ffd60a' },
  ult:      { name: 'ULTIMATE', color: '#ff3b3b' },
};

// Pop-art palette (art.js has the full drawing style).
const COL = {
  ink: '#14101f', paper: '#fff8e7', player: '#2ec5ff', flame: '#ff3fa4', red: '#ff3b3b',
  xp: '#3ddc4a', enemyShot: '#ff3fa4', text: '#fff8e7', dim: '#9d97c4', gold: '#ffd60a',
};
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ============================================================================
// Saved progress (credits bank, hangar upgrades, best time). Lives on the phone.
// ============================================================================
const META_KEY = 'starburn.meta.v1';
function loadMeta() {
  let m = null;
  try { m = JSON.parse(localStorage.getItem(META_KEY)); } catch (e) {}
  if (!m || typeof m !== 'object') m = {};
  m.bank = m.bank || 0;
  m.lv = m.lv || {};
  m.ship = m.ship || 'vesper';
  m.ships = m.ships || { vesper: true };
  if (m.lv.shield) {          // the old cheap "Launch Shield" is gone: refund what was spent on it
    for (let k = 0; k < m.lv.shield; k++) m.bank += Math.round(40 * Math.pow(1.8, k));
    delete m.lv.shield;
  }
  if (!m.best) { try { m.best = parseFloat(localStorage.getItem('starburn.best')) || 0; } catch (e) { m.best = 0; } }
  return m;
}
function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(META)); } catch (e) {} }
const META = loadMeta();
const ML = id => META.lv[id] || 0;

// Permanent upgrades bought in the Hangar between runs.
const HANGAR = [
  { id: 'hull',    name: 'Reinforced Hull',    desc: '+1 starting hull',             max: 3,  base: 60, growth: 2.2 },
  { id: 'dmg',     name: 'Weapon Calibration', desc: '+5% damage',                   max: 10, base: 20, growth: 1.35 },
  { id: 'rate',    name: 'Trigger Tuning',     desc: '+4% fire rate',                max: 10, base: 20, growth: 1.35 },
  { id: 'magnet',  name: 'Magnet Coils',       desc: '+10% crystal pickup range',    max: 5,  base: 15, growth: 1.4 },
  { id: 'xp',      name: 'Flight Recorder',    desc: '+6% XP',                       max: 5,  base: 25, growth: 1.45 },
  { id: 'credits', name: 'Salvage Rights',     desc: '+10% credits from bounties',   max: 5,  base: 30, growth: 1.5 },
  { id: 'reroll',  name: 'Reroll Chip',        desc: '+1 reroll of level-up cards per run', max: 3, base: 80, growth: 2 },
  { id: 'revive',  name: 'Second Wind',        desc: 'Survive one fatal hit per run', max: 1, base: 400, growth: 1 },
  { id: 'deflector', name: 'Deflector Shield', max: 5, base: 500, growth: 1.6,
    desc: l => { const r = CFG.deflectorRecharge;
      return l === 0 ? `Blocks one hit, recharges in ${r[1]}s` : l >= 5 ? `Blocks one hit, recharges in ${r[5]}s`
                     : `Faster recharge: ${r[l]}s → ${r[l + 1]}s`; } },
];
const hangarCost = h => Math.round(h.base * Math.pow(h.growth, ML(h.id)));

function buyHangar(h) {
  const lv = ML(h.id), cost = hangarCost(h);
  if (lv >= h.max || META.bank < cost) { buzz(20); return; }
  META.bank -= cost;
  META.lv[h.id] = lv + 1;
  saveMeta();
  S.flash = { id: h.id, t: 0.35 };
  buzz(25);
}

// ============================================================================
// Canvas + sizing
// ============================================================================
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const wrap = document.getElementById('wrap');
const W = CFG.worldWidth;
let H = 640, SCALE = 1;

function resize() {
  const vw = wrap.clientWidth || window.innerWidth;
  const vh = wrap.clientHeight || window.innerHeight;
  const cw = Math.min(vw, Math.round(vh * 0.62));   // keep a phone shape on wide screens
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.style.width = cw + 'px';
  cv.style.height = vh + 'px';
  cv.width = Math.round(cw * dpr);
  cv.height = Math.round(vh * dpr);
  SCALE = cv.width / W;
  H = cv.height / SCALE;
  if (S) { S.p.x = clamp(S.p.x, 12, W - 12); S.p.y = clamp(S.p.y, 100, H - 20); }
  if (typeof artResize === 'function') artResize();
}

// ============================================================================
// Weapons (12). Each has a name, colour, symbol, one line of text per level,
// and update() which runs every frame while it's in your loadout.
// Shared modifiers from passives: S.mod.cd (cooldowns), .dmg, .area, .count,
// .speed (projectile speed), .pierce.
// ============================================================================
function shoot(b) { S.bullets.push(b); return b; }
const cd = base => base * S.mod.cd * (S.sig ? CFG.signatureCooldown : 1) * (S.overdrive > 0 ? 0.33 : 1);
const spd = v => v * S.mod.speed;
function nearestEnemy(x, y, maxDist, skip) {
  let best = null, bd = maxDist * maxDist;
  for (const e of S.enemies) {
    if (e.dead || e.y < -10 || (skip && skip.has(e))) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function gunShot(x, y, angle, speed, dmg, color, r) {
  const b = shoot({ x, y, vx: Math.cos(angle) * spd(speed), vy: Math.sin(angle) * spd(speed),
                    r: r || 3, dmg, kind: 'main', color, pierce: S.mod.pierce });
  if (b.pierce > 0) b.hits = new Set();
  return b;
}
const UP = -Math.PI / 2;

const WEAPONS = {
  cannon: {
    name: 'Autocannon', color: '#fff8e7', glyph: '❚', tier: 'common',
    levels: ['Rapid-fire forward cannon', 'More damage', 'Twin barrels', 'Faster fire', 'Triple barrels'],
    update(w, dt) {
      if ((w.t -= dt) > 0) return;
      w.t = cd(w.lvl >= 4 ? 0.13 : 0.16);
      const n = Math.min(5, (w.lvl >= 5 ? 3 : w.lvl >= 3 ? 2 : 1) + S.mod.count), dmg = 8 + 2 * w.lvl;
      for (let i = 0; i < n; i++) gunShot(S.p.x + (i - (n - 1) / 2) * 8, S.p.y - 16, UP, CFG.player.bulletSpeed, dmg, '#ffd60a');
    },
  },

  spread: {
    name: 'Spread Shot', color: '#ffd23f', glyph: '✶', tier: 'common',
    levels: ['Fires a fan of 3 shots', '4 shots, wider', '5 shots, more damage', '6 shots, faster', '7 shots, max fan'],
    update(w, dt) {
      if ((w.t -= dt) > 0) return;
      w.t = cd(0.62 - 0.05 * w.lvl);
      const n = 2 + w.lvl + S.mod.count, spread = (16 + 9 * w.lvl) * Math.PI / 180;
      for (let i = 0; i < n; i++) gunShot(S.p.x, S.p.y - 10, UP - spread / 2 + spread * (i / (n - 1)), 560, 7.5 + 1.5 * w.lvl, this.color);
    },
  },

  rockets: {
    name: 'Homing Rockets', color: '#ff8a3d', glyph: '➶', tier: 'common',
    levels: ['Seeker missiles hunt enemies down', '2 rockets per salvo', 'Bigger blasts, faster reload', '3 rockets per salvo', 'Heavy warheads'],
    update(w, dt) {
      if ((w.t -= dt) > 0) return;
      w.t = cd(1.45 - 0.12 * w.lvl);
      const n = 1 + Math.floor(w.lvl / 2) + S.mod.count;
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        shoot({ x: S.p.x + side * 10, y: S.p.y, vx: side * rand(120, 200), vy: rand(20, 60),
                r: 4, dmg: 20 + 8 * w.lvl, aoe: (22 + 3 * w.lvl) * S.mod.area, kind: 'rocket',
                life: 3.5, target: null, retarget: 0, color: this.color });
      }
    },
  },

  laser: {
    name: 'Pulse Laser', color: '#c86bff', glyph: '┃', tier: 'uncommon',
    levels: ['Periodic beam burns everything above you', 'Wider beam', 'Longer pulses', 'More damage, faster recharge', 'Mega beam'],
    update(w, dt) {
      if (w.on > 0) {
        w.on -= dt;
        const width = (8 + 3 * w.lvl) * S.mod.area, dps = 70 + 30 * w.lvl;
        S.laser = { w: width, color: this.color };
        for (const e of S.enemies) {
          if (!e.dead && e.y < S.p.y && Math.abs(e.x - S.p.x) < width / 2 + e.r) hitEnemy(e, dps * dt, true);
        }
      } else if ((w.t -= dt) <= 0) {
        w.t = cd(2.7 - 0.22 * w.lvl);
        w.on = 0.7 + 0.12 * w.lvl;
      }
    },
  },

  wing: {
    name: 'Wing Cannons', color: '#3df5ff', glyph: '⇈', tier: 'common',
    levels: ['Two escort pods with rapid-fire cannons', 'Pods hit harder', 'Pods fire faster', 'Pods hit even harder', 'Pods at full power'],
    update(w, dt) {
      if ((w.t -= dt) > 0) return;
      w.t = cd(CFG.player.fireInterval * (w.lvl >= 3 ? 1.0 : 1.3));
      const dmg = CFG.player.damage * (0.4 + 0.15 * w.lvl);
      for (const side of [-1, 1]) gunShot(S.p.x + side * 24, S.p.y - 4, UP, CFG.player.bulletSpeed, dmg, this.color);
    },
  },

  nova: {
    name: 'Nova Burst', color: '#fff36b', glyph: '✺', tier: 'rare',
    levels: ['Shockwave every few seconds; erases bullets', 'Bigger blast', 'More often', 'More damage', 'Huge, frequent blasts'],
    update(w, dt) {
      if ((w.t -= dt) > 0) return;
      w.t = cd(6.5 - 0.7 * w.lvl);
      S.novas.push({ x: S.p.x, y: S.p.y, r: 0, max: (70 + 18 * w.lvl) * S.mod.area, dmg: 35 + 20 * w.lvl,
                     age: 0, hit: new Set(), color: this.color });
    },
  },

  orbit: {
    name: 'Orbit Shards', color: '#62ffd0', glyph: '❂', tier: 'uncommon',
    levels: ['2 blades circle your ship and block bullets', '3 blades', 'Faster spin, more damage', '4 blades', '5 blades, max damage'],
    update(w, dt) {
      w.a = (w.a || 0) + dt * (2.6 + 0.25 * w.lvl);
      const n = Math.min(8, 1 + Math.ceil(w.lvl * 0.8) + S.mod.count);
      const R = 40 * S.mod.area, sr = 6 * Math.sqrt(S.mod.area), dmg = 10 + 5 * w.lvl;
      w.pos = [];
      for (let i = 0; i < n; i++) {
        const a = w.a + (i / n) * TAU, x = S.p.x + Math.cos(a) * R, y = S.p.y + Math.sin(a) * R;
        w.pos.push(x, y);
        for (const e of S.enemies) {
          if (e.dead || (e.orbT && e.orbT > S.t)) continue;
          if ((e.x - x) ** 2 + (e.y - y) ** 2 < (sr + e.r) ** 2) { e.orbT = S.t + 0.3; hitEnemy(e, dmg, false); }
        }
        for (const b of S.ebullets) if ((b.x - x) ** 2 + (b.y - y) ** 2 < (sr + b.r) ** 2) b.dead = true;
      }
    },
  },

  chain: {
    name: 'Arc Lightning', color: '#8fb8ff', glyph: 'ϟ', tier: 'rare',
    levels: ['Zaps the nearest enemy, jumps to 2 more', 'Jumps to 3 more', 'More damage, faster', 'Jumps to 5 more', 'Storm: jumps to 7 more'],
    update(w, dt) {
      if ((w.t -= dt) > 0) return;
      const jumps = [0, 2, 3, 3, 5, 7][w.lvl] + S.mod.count, dmg = 16 + 7 * w.lvl;
      let from = S.p, range = 300;
      const hit = new Set();
      for (let j = 0; j <= jumps; j++) {
        const e = nearestEnemy(from.x, from.y, range, hit);
        if (!e) break;
        hit.add(e);
        S.zaps.push({ x1: from.x, y1: from.y, x2: e.x, y2: e.y, age: 0, color: this.color });
        hitEnemy(e, dmg, false);
        from = { x: e.x, y: e.y };
        range = 110 * S.mod.area;
      }
      w.t = hit.size ? cd(1.4 - 0.1 * w.lvl) : 0.2;   // nothing to zap: check again soon
    },
  },

  rail: {
    name: 'Railgun', color: '#ff5df0', glyph: '↟', tier: 'rare',
    levels: ['Slow, huge shot that pierces everything', 'More damage', 'Faster reload', 'Much more damage', 'Twin rails'],
    update(w, dt) {
      if ((w.t -= dt) > 0) return;
      w.t = cd(2.1 - 0.2 * w.lvl);
      const xs = w.lvl >= 5 ? [-8, 8] : [0];
      for (const ox of xs) {
        shoot({ x: S.p.x + ox, y: S.p.y - 16, vx: 0, vy: -spd(1500), r: 5, dmg: 60 + 30 * w.lvl + (w.lvl >= 4 ? 40 : 0),
                kind: 'rail', pierce: 999, hits: new Set(), color: this.color });
      }
      S.shake = Math.max(S.shake, 0.05);
    },
  },

  flak: {
    name: 'Flak Burst', color: '#ff6b6b', glyph: '✹', tier: 'common',
    levels: ['Shells that burst into shrapnel', 'More shrapnel', 'Faster reload', 'Bigger bursts', 'Twin shells'],
    update(w, dt) {
      if ((w.t -= dt) > 0) return;
      w.t = cd(1.15 - 0.08 * w.lvl);
      const angles = w.lvl >= 5 ? [UP - 0.25, UP + 0.25] : [UP];
      for (const a of angles) {
        shoot({ x: S.p.x, y: S.p.y - 12, vx: Math.cos(a) * spd(420), vy: Math.sin(a) * spd(420), r: 5, dmg: 10,
                kind: 'flak', fuse: 0.45, shards: 6 + 2 * w.lvl + 2 * S.mod.count, sdmg: 7 + 2.5 * w.lvl,
                slife: (0.45 + (w.lvl >= 4 ? 0.1 : 0)) * S.mod.area, color: this.color });
      }
    },
  },

  disc: {
    name: 'Ricochet Disc', color: '#b8ff5d', glyph: '◐', tier: 'common',
    levels: ['Disc that bounces off the screen edges', 'Lasts longer, more damage', '2 discs', 'Bigger discs', '3 discs'],
    update(w, dt) {
      if ((w.t -= dt) > 0) return;
      w.t = cd(2.4 - 0.2 * w.lvl);
      const n = 1 + Math.floor(w.lvl / 2) + S.mod.count;
      for (let i = 0; i < n; i++) {
        const a = UP + rand(-0.9, 0.9);
        shoot({ x: S.p.x, y: S.p.y - 10, vx: Math.cos(a) * spd(320), vy: Math.sin(a) * spd(320),
                r: (7 + (w.lvl >= 4 ? 3 : 0)) * S.mod.area, dmg: 10 + 5 * w.lvl, kind: 'disc',
                life: 3 + 0.4 * w.lvl, pierce: 999, hits: new Set(), hitReset: 0.25, spin: 0, color: this.color });
      }
    },
  },

  wave: {
    name: 'Plasma Wave', color: '#5d9dff', glyph: '⌒', tier: 'uncommon',
    levels: ['Wide, slow wave that pierces everything', 'Wider wave', 'Faster waves', 'More damage', 'Double waves'],
    update(w, dt) {
      if ((w.t -= dt) > 0) return;
      w.t = cd(1.9 - 0.12 * w.lvl);
      const fire = delay => shoot({ x: S.p.x, y: S.p.y - 20 + delay, vx: 0, vy: -spd(260), r: 0,
        hw: (40 + 8 * w.lvl) * S.mod.area, dmg: 9 + 5 * w.lvl + (w.lvl >= 4 ? 8 : 0),
        kind: 'wave', pierce: 999, hits: new Set(), color: this.color });
      fire(0);
      if (w.lvl >= 5) fire(40);
    },
  },

  drone: {
    name: 'Hunter Drones', color: '#d6dcff', glyph: '◇', tier: 'uncommon',
    levels: ['A drone that shoots at nearby enemies', 'Faster drone fire', '2 drones', 'More damage', '3 drones'],
    update(w, dt) {
      const n = Math.min(4, 1 + Math.floor((w.lvl - 1) / 2) + S.mod.count);
      w.drones = w.drones || [];
      while (w.drones.length < n) w.drones.push({ x: S.p.x, y: S.p.y, t: Math.random() * 0.3 });
      const offs = [[-42, -26], [42, -26], [-58, 14], [58, 14]];
      w.drones.forEach((d, i) => {
        const tx = S.p.x + offs[i][0], ty = S.p.y + offs[i][1] + Math.sin(S.t * 3 + i) * 4;
        d.x += (tx - d.x) * Math.min(1, dt * 6);
        d.y += (ty - d.y) * Math.min(1, dt * 6);
        if ((d.t -= dt) > 0) return;
        const e = nearestEnemy(d.x, d.y, 320);
        if (!e) { d.t = 0.1; return; }
        d.t = cd(0.5 - (w.lvl >= 2 ? 0.1 : 0));
        gunShot(d.x, d.y, Math.atan2(e.y - d.y, e.x - d.x), 520, 7 + 2.5 * w.lvl + (w.lvl >= 4 ? 4 : 0), this.color, 2.5);
      });
    },
  },
};

// ============================================================================
// Ultimates: offered at CFG.ultLevel. Double-tap the screen to fire; long cooldown.
// ============================================================================
const ULTS = {
  nuke:      { name: 'Megaton',       glyph: '☢', word: 'KA-BOOM!',   cooldown: 75,
               desc: 'Hits every enemy on screen for huge damage and wipes all bullets',
               fire() { for (const e of S.enemies) if (!e.dead && e.y > -10) hitEnemy(e, 400, true);
                        for (const b of S.ebullets) b.dead = true; S.shake = 0.8; S.whiteout = 0.35; } },
  overdrive: { name: 'Overdrive',     glyph: '⚡', word: 'OVERDRIVE!', cooldown: 60,
               desc: 'All weapons fire 3x faster for 8 seconds',
               fire() { S.overdrive = 8; for (const id in S.weapons) S.weapons[id].t = 0; } },
  warp:      { name: 'Time Warp',     glyph: '⌛', word: 'TIME WARP!', cooldown: 60,
               desc: 'Enemies and their bullets crawl at quarter speed for 7 seconds',
               fire() { S.warp = 7; } },
  barrage:   { name: 'Missile Storm', glyph: '➹', word: 'WHOOSH!',    cooldown: 50,
               desc: 'Launches 32 homing missiles over two seconds',
               fire() { S.barrage = { left: 32, t: 0 }; } },
  phase:     { name: 'Phase Ram',     glyph: '◈', word: 'PHASE RAM!', cooldown: 50,
               desc: 'Untouchable for 6 seconds: ram enemies and eat bullets',
               fire() { S.phase = 6; } },
  hole:      { name: 'Black Hole',    glyph: '◉', word: 'VWOOMP!',    cooldown: 65,
               desc: 'A black hole sucks in enemies and bullets for 6 seconds',
               fire() { S.hole = { x: S.p.x, y: Math.max(130, S.p.y - 200), t: 6 }; } },
};
const ultCooldown = id => ULTS[id].cooldown * CFG.ultCooldownMul;

function activateUlt() {
  if (!S.ult || S.ult.cd > 0 || S.state !== 'play') return;
  const u = ULTS[S.ult.id];
  S.ult.cd = ultCooldown(S.ult.id);
  u.fire();
  burst(W / 2, S.p.y - 90, 70, u.word, COL.gold);
  buzz([40, 30, 80]);
}

function updateUlts(dt) {
  if (S.ult) S.ult.cd = Math.max(0, S.ult.cd - dt);
  S.overdrive = Math.max(0, (S.overdrive || 0) - dt);
  S.warp = Math.max(0, (S.warp || 0) - dt);
  S.phase = Math.max(0, (S.phase || 0) - dt);
  S.whiteout = Math.max(0, (S.whiteout || 0) - dt);
  const p = S.p;
  if (S.barrage && (S.barrage.t -= dt) <= 0) {
    S.barrage.t = 0.06;
    const side = S.barrage.left % 2 ? 1 : -1;
    shoot({ x: p.x + side * 12, y: p.y, vx: side * rand(150, 260), vy: rand(-60, 40), r: 4, dmg: 40, aoe: 30,
            kind: 'rocket', life: 3.5, target: null, retarget: 0, color: '#ff8c1a' });
    if (--S.barrage.left <= 0) S.barrage = null;
  }
  if (S.phase > 0) {
    for (const e of S.enemies) if (!e.dead && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < (e.r + 24) ** 2) hitEnemy(e, 220 * dt, true);
    clearBulletsNear(p.x, p.y, 26);
  }
  const h = S.hole;
  if (h) {
    h.t -= dt;
    const R = 170;
    for (const e of S.enemies) {
      if (e.dead) continue;
      const dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1;
      if (d < R && e.type !== 'boss') { const pull = (60 + 200 * (1 - d / R)) * dt; e.x += dx / d * pull; e.y += dy / d * pull; if (e.bx !== undefined) e.bx += dx / d * pull; }
      if (d < 40 + e.r) hitEnemy(e, 160 * dt, true);
    }
    for (const b of S.ebullets) {
      const dx = h.x - b.x, dy = h.y - b.y, d = Math.hypot(dx, dy) || 1;
      if (d < 22) b.dead = true;
      else if (d < R) { b.vx += dx / d * 600 * dt; b.vy += dy / d * 600 * dt; }
    }
    if (h.t <= 0) S.hole = null;
  }
}

// ============================================================================
// Passives (12). levels[i] describes what level i+1 gives.
// ============================================================================
const PASSIVES = {
  rapid:    { name: 'Rapid Fire',         glyph: '»', color: '#3df5ff', tier: 'common', levels: Array(5).fill('-10% weapon cooldowns') },
  power:    { name: 'Power Core',         glyph: '▲', color: '#ff5d5d', tier: 'common', levels: Array(5).fill('+12% damage') },
  area:     { name: 'Blast Amplifier',    glyph: '◎', color: '#ffb35d', tier: 'uncommon', levels: Array(5).fill('+15% blast radius and weapon size') },
  multi:    { name: 'Multishot',          glyph: '⁂', color: '#ffd23f', tier: 'rare',
              levels: ['+1 projectile for most weapons', '+5% damage', '+2 projectiles', '+5% damage', '+3 projectiles'] },
  velocity: { name: 'Velocity Rounds',    glyph: '➤', color: '#9dffef', tier: 'uncommon',
              levels: ['+15% projectile speed', '+15% projectile speed', '+15% speed, bullets pierce 1 enemy', '+15% projectile speed', '+15% speed, bullets pierce 2 enemies'] },
  crit:     { name: 'Targeting Computer', glyph: '⌖', color: '#ffe45d', tier: 'rare', levels: Array(5).fill('+7% chance of double damage') },
  reactive: { name: 'Reactive Armor',     glyph: '✸', color: '#ff9d5d', tier: 'uncommon',
              levels: ['Getting hit blasts nearby enemies and bullets away', 'Bigger blast', 'Longer safety blink after a hit', 'Bigger, stronger blast', 'Massive blast'] },
  plating:  { name: 'Hull Plating',       glyph: '⬢', color: '#b9c4ff', tier: 'common', max: 3, levels: Array(3).fill('+1 max hull (and repair 1)') },
  repair:   { name: 'Nano Repair',        glyph: '✚', color: '#5dff9e', tier: 'rare',
              levels: ['Repair 1 hull every 45s', 'Every 38s', 'Every 31s', 'Every 24s', 'Every 17s'] },
  tractor:  { name: 'Tractor Beam',       glyph: '⊕', color: '#5dff9e', tier: 'common', levels: Array(5).fill('+30% crystal pickup range') },
  datacore: { name: 'Data Core',          glyph: '◈', color: '#c86bff', tier: 'common', levels: Array(5).fill('+10% XP') },
  bounty:   { name: 'Bounty Hunter',      glyph: '$', color: '#ffd23f', tier: 'uncommon', levels: Array(5).fill('+20% credits from kills') },
};
const passiveMax = id => PASSIVES[id].max || CFG.maxLevel;
const PL = id => (S.passives[id] ? S.passives[id].lvl : 0);
const shieldRecharge = () => CFG.deflectorRecharge[ML('deflector')];
const repairEvery = () => 52 - 7 * PL('repair');

// ============================================================================
// Ships (12): one per weapon. Each starts with its signature weapon in a bonus
// slot, on top of the basic forward cannon every ship has. Unlock in the Hangar.
// ============================================================================
const SHIPS = {
  vesper:   { name: 'VESPER',   weapon: 'spread',  color: '#3df5ff', shape: [0,-16, 5,-4, 14,8, 5,6, 0,10, -5,6, -14,8, -5,-4] },
  trident:  { name: 'TRIDENT',  weapon: 'wing',    color: '#5dc8ff', shape: [0,-17, 3,-6, 9,-12, 10,2, 15,6, 6,8, 0,11, -6,8, -15,6, -10,2, -9,-12, -3,-6] },
  hornet:   { name: 'HORNET',   weapon: 'rockets', color: '#ff8a3d', shape: [0,-14, 6,-6, 16,-2, 12,6, 4,4, 0,13, -4,4, -12,6, -16,-2, -6,-6] },
  bulwark:  { name: 'BULWARK',  weapon: 'flak',    color: '#ff6b6b', shape: [-5,-15, 5,-15, 8,-6, 15,-4, 15,8, 6,10, -6,10, -15,8, -15,-4, -8,-6] },
  halo:     { name: 'HALO',     weapon: 'disc',    color: '#b8ff5d', shape: [0,-16, 8,-10, 13,-1, 11,8, 0,12, -11,8, -13,-1, -8,-10] },
  tide:     { name: 'TIDE',     weapon: 'wave',    color: '#5d9dff', shape: [0,-15, 6,-2, 16,6, 16,11, 6,6, 0,9, -6,6, -16,11, -16,6, -6,-2] },
  hive:     { name: 'HIVE',     weapon: 'drone',   color: '#d6dcff', shape: [0,-15, 10,-8, 10,6, 0,12, -10,6, -10,-8] },
  lance:    { name: 'LANCE',    weapon: 'laser',   color: '#c86bff', shape: [0,-20, 3,-6, 8,6, 3,5, 0,10, -3,5, -8,6, -3,-6] },
  corona:   { name: 'CORONA',   weapon: 'orbit',   color: '#62ffd0', shape: [0,-15, 4,-8, 12,-8, 15,0, 12,8, 4,8, 0,12, -4,8, -12,8, -15,0, -12,-8, -4,-8] },
  tempest:  { name: 'TEMPEST',  weapon: 'chain',   color: '#8fb8ff', shape: [0,-16, 4,-6, 14,-10, 9,0, 16,6, 5,6, 0,11, -5,6, -16,6, -9,0, -14,-10, -4,-6] },
  needle:   { name: 'NEEDLE',   weapon: 'rail',    color: '#ff5df0', shape: [0,-22, 2,-8, 10,4, 10,8, 2,6, 0,10, -2,6, -10,8, -10,4, -2,-8] },
  pulsar:   { name: 'PULSAR',   weapon: 'nova',    color: '#fff36b', shape: [0,-16, 4,-5, 15,-3, 6,4, 9,12, 0,7, -9,12, -6,4, -15,-3, -4,-5] },
};
const shipTier = id => WEAPONS[SHIPS[id].weapon].tier;
const shipCost = id => (id === 'vesper' ? 0 : CFG.shipCost[shipTier(id)]);
const curShip = () => SHIPS[META.ship] || SHIPS.vesper;

// All modifiers in one place: hangar upgrades + passives.
function recalcMods() {
  const m = {
    dmg: 1 + 0.05 * ML('dmg') + 0.12 * PL('power') + (PL('multi') >= 2 ? 0.05 : 0) + (PL('multi') >= 4 ? 0.05 : 0),
    cd: Math.pow(0.96, ML('rate')) * Math.pow(0.9, PL('rapid')),
    area: 1 + 0.15 * PL('area'),
    count: [0, 1, 1, 2, 2, 3][PL('multi')],
    speed: 1 + 0.15 * PL('velocity'),
    pierce: PL('velocity') >= 5 ? 2 : PL('velocity') >= 3 ? 1 : 0,
    crit: 0.07 * PL('crit'),
    xp: 1 + 0.06 * ML('xp') + 0.1 * PL('datacore'),
    credit: 1 + 0.1 * ML('credits') + 0.2 * PL('bounty'),
  };
  S.mod = m;
  const p = S.p;
  p.magnet = CFG.player.magnetRadius * (1 + 0.1 * ML('magnet') + 0.3 * PL('tractor'));
  p.maxHp = CFG.player.hp + ML('hull') + PL('plating');
}

// ============================================================================
// Game state
// ============================================================================
let S = null;
function xpNeed(level) {
  const l = level - 1;
  return Math.round(CFG.xp.needBase + CFG.xp.needPerLevel * l + CFG.xp.needCurve * l * l);
}

function newGame(state) {
  S = {
    state: state || 'play',     // title | hangar | play | levelup | paused | over
    t: 0, kills: 0, level: 1, xp: 0, shake: 0, credits: 0,
    p: { x: W / 2, y: H * 0.78, hp: 0, maxHp: 0, invuln: 0, magnet: 0, bubble: false, bubbleT: 0, repairT: 0 },
    weapons: {}, passives: {}, mod: null,
    bullets: [], ebullets: [], enemies: [], orbs: [], parts: [], novas: [], zaps: [], texts: [], bursts: [], laser: null,
    ult: null, overdrive: 0, warp: 0, phase: 0, hole: null, barrage: null, whiteout: 0,
    spawnT: CFG.spawn.graceTime, nextBoss: CFG.boss.first, bossCount: 0, warn: 0,
    pending: 0, choices: null, choiceLevel: 0, uiLock: 0, uiPress: null, flash: null,
    rerolls: ML('reroll'), revives: ML('revive'),
  };
  recalcMods();
  S.p.hp = S.p.maxHp;
  S.p.bubble = ML('deflector') > 0;
  S.ship = curShip();
  S.weapons[S.ship.weapon] = { lvl: 1, t: 0, on: 0, builtin: true };
  input.dx = input.dy = 0;
}

// ============================================================================
// Enemies
// ============================================================================
const ENEMY = {
  drone:  { hp: 20,   r: 12, xp: 1,  credits: 1, color: '#ff3b3b' },
  weaver: { hp: 14,   r: 11, xp: 1,  credits: 1, color: '#ff8c1a' },
  diver:  { hp: 26,   r: 12, xp: 2,  credits: 1, color: '#ff3fa4' },
  gunner: { hp: 120,  r: 20, xp: 6,  credits: 3, color: '#8f5cff' },
  boss:   { hp: 2200, r: 34, xp: 30, credits: 0, color: '#e8233a' },   // boss bounty: CFG.boss
};

function spawnEnemy(type, x, y, extra) {
  const d = ENEMY[type];
  const hp = d.hp * (1 + CFG.enemyHpGrowthPerMin * S.t / 60);
  const e = Object.assign({ type, x, y, hp, maxHp: hp, r: d.r, xp: d.xp, credits: d.credits, color: d.color,
                            age: 0, flash: 0, mode: 0, fireT: rand(0.8, 2.0), vx: 0, vy: 0 }, extra);
  S.enemies.push(e);
  return e;
}
function countType(t) { let n = 0; for (const e of S.enemies) if (e.type === t && !e.dead) n++; return n; }
const bossAlive = () => S.enemies.some(e => e.type === 'boss' && !e.dead);

function spawnPattern() {
  const t = S.t;
  const options = [
    ['single', 3],
    ['line', t > 10 ? 3 : 0],
    ['snake', t > 20 ? 2 : 0],
    ['divers', t > 45 ? 1.5 : 0],
    ['gunner', t > 60 && countType('gunner') < 1 + Math.floor(t / 150) ? 1.2 : 0],
  ];
  let total = 0;
  for (const o of options) total += o[1];
  let r = Math.random() * total, pick = 'single';
  for (const o of options) { if ((r -= o[1]) <= 0) { pick = o[0]; break; } }

  switch (pick) {
    case 'single':
      spawnEnemy('drone', rand(30, W - 30), -20, { vy: rand(70, 100) });
      break;
    case 'line': {
      const n = 3 + Math.floor(Math.random() * 3), gap = (W - 60) / (n - 1);
      for (let i = 0; i < n; i++) spawnEnemy('drone', 30 + i * gap, -20 - Math.abs(i - (n - 1) / 2) * 18, { vy: 80 });
      break;
    }
    case 'snake': {
      const bx = rand(80, W - 80), ph = Math.random() * TAU;
      for (let i = 0; i < 5; i++) spawnEnemy('weaver', bx, -20 - i * 30, { bx, ph, amp: rand(40, 70), vy: 110, fireT: rand(2, 4) });
      break;
    }
    case 'divers':
      for (let i = 0; i < 2; i++) spawnEnemy('diver', rand(40, W - 40), -20, { ty: rand(60, 170) });
      break;
    case 'gunner':
      spawnEnemy('gunner', rand(60, W - 60), -30, { ty: rand(90, 160), vx: Math.random() < 0.5 ? -40 : 40, fireT: 1.5 });
      break;
  }
}

function spawnBoss() {
  const credits = CFG.boss.creditsBase + CFG.boss.creditsPerBoss * S.bossCount;
  S.bossCount++;
  spawnEnemy('boss', W / 2, -50, { credits, pat: 0, patT: 1.5, shotT: 0, spin: 0, sway: 0 });
}

function enemyShot(x, y, angle, speedMul) {
  const sp = CFG.enemyBulletSpeed * (1 + S.t / CFG.enemyBulletSpeedGrowth) * (speedMul || 1);
  S.ebullets.push({ x, y, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp, r: 4 });
}
function aimAt(e) { return Math.atan2(S.p.y - e.y, S.p.x - e.x); }

function updateEnemy(e, dt) {
  const p = S.p;
  e.age += dt;
  e.flash = Math.max(0, e.flash - dt);
  switch (e.type) {
    case 'drone':
      e.y += e.vy * dt;
      if ((e.fireT -= dt) <= 0 && e.y > 10 && e.y < H * 0.65) { e.fireT = rand(1.6, 2.8); enemyShot(e.x, e.y + 8, aimAt(e) + rand(-0.08, 0.08)); }
      break;
    case 'weaver':
      e.y += e.vy * dt;
      e.x = e.bx + Math.sin(e.age * 2.4 + e.ph) * e.amp;
      if ((e.fireT -= dt) <= 0 && e.y > 10 && e.y < H * 0.6) { e.fireT = rand(2.5, 4); enemyShot(e.x, e.y + 8, Math.PI / 2); }
      break;
    case 'diver':
      if (e.mode === 0) { e.y += 140 * dt; if (e.y >= e.ty) { e.mode = 1; e.wait = 0.7; } }
      else if (e.mode === 1) {
        if ((e.wait -= dt) <= 0) { const a = aimAt(e); e.vx = Math.cos(a) * 360; e.vy = Math.sin(a) * 360; e.mode = 2; }
      } else { e.x += e.vx * dt; e.y += e.vy * dt; }
      break;
    case 'gunner':
      if (e.mode === 0) { e.y += 70 * dt; if (e.y >= e.ty) e.mode = 1; }
      else if (e.mode === 1) {
        e.x += e.vx * dt;
        if (e.x < 30) { e.x = 30; e.vx = Math.abs(e.vx); }
        if (e.x > W - 30) { e.x = W - 30; e.vx = -Math.abs(e.vx); }
        if ((e.fireT -= dt) <= 0) {
          e.fireT = 2.2;
          const n = 10 + 2 * Math.floor(S.t / 120), off = Math.random() * TAU;
          for (let i = 0; i < n; i++) enemyShot(e.x, e.y, off + (i / n) * TAU, 0.8);
        }
        if (e.age > 14) e.mode = 2;
      } else e.y += 80 * dt;
      break;
    case 'boss':
      // Enters, then sways side to side cycling: spiral, rest, aimed fans, rest, rings, rest.
      if (e.mode === 0) { e.y += 45 * dt; if (e.y >= 120) e.mode = 1; }
      else {
        e.sway += dt;
        e.x = W / 2 + Math.sin(e.sway * 0.45) * (W / 2 - 60);
        if ((e.patT -= dt) <= 0) { e.pat = (e.pat + 1) % 6; e.patT = e.pat % 2 ? 1.0 : 3.6; e.shotT = 0.3; }
        if (e.pat % 2 === 0 && (e.shotT -= dt) <= 0) {
          const kind = e.pat / 2;
          if (kind === 0) {
            e.shotT = 0.1; e.spin += 0.32;
            for (let k = 0; k < 3; k++) enemyShot(e.x, e.y + 10, e.spin + k * TAU / 3, 0.75);
          } else if (kind === 1) {
            e.shotT = 0.6;
            const a = aimAt(e);
            for (let k = -2; k <= 2; k++) enemyShot(e.x, e.y + 20, a + k * 0.16, 1.1);
          } else {
            e.shotT = 1.1;
            const n = 18, off = Math.random() * TAU;
            for (let k = 0; k < n; k++) enemyShot(e.x, e.y, off + (k / n) * TAU, 0.7);
          }
        }
      }
      break;
  }
  if (e.y > H + 40 || e.x < -60 || e.x > W + 60) e.dead = true;   // escaped: no XP, no bounty

  // Ramming the player hurts both of you.
  const dx = e.x - p.x, dy = e.y - p.y, rr = e.r + 6;
  if (!e.dead && dx * dx + dy * dy < rr * rr) {
    if (damagePlayer()) hitEnemy(e, 60, false);
  }
}

function hitEnemy(e, dmg, quiet) {
  if (e.dead) return;
  let d = dmg * S.mod.dmg;
  if (S.mod.crit && Math.random() < S.mod.crit) { d *= 2; if (!quiet) sparks(e.x, e.y, '#ffe45d', 3); }
  e.hp -= d;
  e.flash = 0.06;
  if (!quiet) sparks(e.x, e.y + e.r * 0.5, e.color, 2);
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  e.dead = true;
  S.kills++;
  const big = e.type === 'boss';
  comicKill(e, big);
  sparks(e.x, e.y, e.color, big ? 80 : e.type === 'gunner' ? 30 : 14);
  sparks(e.x, e.y, '#ffffff', big ? 30 : 5);
  if (big) {
    S.shake = 0.6; buzz(200);
    S.novas.push({ x: e.x, y: e.y, r: 0, max: 140, dmg: 0, age: 0, hit: null, color: e.color });
    for (const b of S.ebullets) b.dead = true;   // boss down: clear the screen
  }
  // Bounty
  const c = e.credits * S.mod.credit;
  S.credits += c;
  if (e.credits >= 3) floatText(e.x, e.y - e.r - 6, `+${Math.floor(c)} CR`, COL.gold, big ? 18 : 11);
  // Drop XP: big crystals worth 5 for chunky enemies, the rest as 1s.
  let v = e.xp;
  while (v > 0) {
    const val = v >= 5 ? 5 : 1;
    v -= val;
    const a = Math.random() * TAU, sp = rand(30, big ? 160 : 110);
    S.orbs.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, v: val, age: 0 });
  }
}

function explode(x, y, radius, dmg) {
  for (const e of S.enemies) {
    if (e.dead) continue;
    const dx = e.x - x, dy = e.y - y, rr = radius + e.r;
    if (dx * dx + dy * dy < rr * rr) hitEnemy(e, dmg, true);
  }
  sparks(x, y, '#ff8c1a', 8);
  burst(x, y, radius * 0.9, null, '#ff8c1a');
  S.novas.push({ x, y, r: 0, max: radius, dmg: 0, age: 0, hit: null, color: '#ff8a3d', small: true });
}

function flakBurst(b) {
  for (let i = 0; i < b.shards; i++) {
    const a = (i / b.shards) * TAU + rand(-0.1, 0.1), sp = spd(320) * rand(0.85, 1.15);
    shoot({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 2.5, dmg: b.sdmg,
            kind: 'main', life: b.slife, color: b.color });
  }
  sparks(b.x, b.y, b.color, 6);
}

// ============================================================================
// Player damage, particles, floating text
// ============================================================================
function damagePlayer() {
  const p = S.p;
  if (p.invuln > 0 || S.phase > 0) return false;
  if (p.bubble) {                       // Deflector Shield soaks one hit, then recharges
    p.bubble = false; p.bubbleT = shieldRecharge(); p.invuln = 0.6;
    sparks(p.x, p.y, '#6bd6ff', 18); buzz(40);
    clearBulletsNear(p.x, p.y, 40);
    return true;
  }
  p.hp--;
  p.invuln = CFG.player.invulnTime * (PL('reactive') >= 3 ? 1.5 : 1);
  if (PL('reactive')) {                 // Reactive Armor: blast on hit
    const l = PL('reactive'), r = 60 + 15 * l + (l >= 5 ? 40 : 0);
    S.novas.push({ x: p.x, y: p.y, r: 0, max: r, dmg: 30 + 20 * l, age: 0, hit: new Set(), color: PASSIVES.reactive.color });
  }
  S.shake = 0.4;
  buzz(p.hp > 0 ? 90 : 300);
  sparks(p.x, p.y, COL.player, 20);
  burst(p.x, p.y - 26, 30, pick(['OOF!', 'WHAM!', 'ARGH!']), COL.red);
  clearBulletsNear(p.x, p.y, 70);       // mercy
  if (p.hp <= 0) {
    if (S.revives > 0) {                // Second Wind
      S.revives--; p.hp = 1; p.invuln = 2.5;
      for (const b of S.ebullets) b.dead = true;
      S.novas.push({ x: p.x, y: p.y, r: 0, max: 200, dmg: 0, age: 0, hit: null, color: '#ffffff' });
      floatText(p.x, p.y - 30, 'SECOND WIND', COL.text, 14);
    } else gameOver(false);
  }
  return true;
}
function clearBulletsNear(x, y, r) {
  for (const b of S.ebullets) { const dx = b.x - x, dy = b.y - y; if (dx * dx + dy * dy < r * r) b.dead = true; }
}

function sparks(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    if (S.parts.length > 600) return;
    const a = Math.random() * TAU, sp = rand(40, 220);
    S.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.25, 0.6), age: 0, color, size: rand(1.2, 2.6) });
  }
}
// Comic-book starbursts. word = null for a plain blast.
const WORDS_SMALL = ['POP!', 'ZAP!', 'BAM!', 'POW!'], WORDS_MED = ['BLAM!', 'KRAK!', 'KA-POW!', 'WHAM!'];
function burst(x, y, size, word, color) {
  if (S.bursts.length > 14) return;
  S.bursts.push({ x, y, size, word, age: 0, life: word ? 0.75 : 0.3, rot: rand(-0.3, 0.3), color: color || COL.gold, spikes: word ? 12 : 9 });
}
function comicKill(e, big) {
  if (big) burst(e.x, e.y, 95, 'KA-BOOM!', COL.gold);
  else if (e.type === 'gunner') burst(e.x, e.y, 46, pick(WORDS_MED), COL.gold);
  else if (Math.random() < 0.15 && S.bursts.filter(b => b.word).length < 3) burst(e.x, e.y, 30, pick(WORDS_SMALL), COL.gold);
  else burst(e.x, e.y, e.r * 1.5, null, e.color);
}
function floatText(x, y, txt, color, size) { S.texts.push({ x, y, txt, color, size, age: 0 }); }

function updateParticles(dt) {
  for (const q of S.parts) {
    q.age += dt;
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vx *= 0.94; q.vy *= 0.94;
    if (q.age >= q.life) q.dead = true;
  }
  for (const t of S.texts) { t.age += dt; t.y -= 25 * dt; if (t.age > 1.2) t.dead = true; }
  for (const z of S.zaps) { z.age += dt; if (z.age > 0.18) z.dead = true; }
  for (const b of S.bursts) { b.age += dt; if (b.age > b.life) b.dead = true; }
  compact(S.parts); compact(S.texts); compact(S.zaps); compact(S.bursts);
}

function gameOver(quit) {
  S.state = 'over';
  S.quit = quit;
  S.uiLock = 1.0;
  S.laser = null;
  if (!quit) { sparks(S.p.x, S.p.y, COL.player, 60); sparks(S.p.x, S.p.y, COL.flame, 40); }
  S.earned = Math.floor(S.credits);
  META.bank += S.earned;
  S.newBest = S.t > META.best;
  if (S.newBest) META.best = S.t;
  saveMeta();
}

// ============================================================================
// Level-ups: each card is a coin flip between "upgrade something you own"
// and "add a new system" (while you have a free slot).
// ============================================================================
const slotWeapons = () => Object.keys(S.weapons).filter(id => !S.weapons[id].builtin);
function pickWeighted(arr) {      // rarer things show up less often
  const wts = arr.map(c => CFG.rarityWeights[(WEAPONS[c.id] || PASSIVES[c.id]).tier]);
  let r = Math.random() * wts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < arr.length; i++) if ((r -= wts[i]) <= 0) return arr.splice(i, 1)[0];
  return arr.pop();
}
function buildChoices() {
  if (S.choiceLevel === CFG.ultLevel && !S.ult) {
    return shuffle(Object.keys(ULTS)).slice(0, CFG.upgradeChoices).map(id => ({ kind: 'ult', id }));
  }
  const ups = [], newW = [], newP = [];
  for (const id in S.weapons) if (S.weapons[id].lvl < CFG.maxLevel) ups.push({ kind: 'wup', id });
  for (const id in S.passives) if (S.passives[id].lvl < passiveMax(id)) ups.push({ kind: 'pup', id });
  if (slotWeapons().length < CFG.slots.weapons)
    for (const id in WEAPONS) if (!S.weapons[id]) newW.push({ kind: 'wnew', id });
  if (Object.keys(S.passives).length < CFG.slots.passives)
    for (const id in PASSIVES) if (!S.passives[id]) newP.push({ kind: 'pnew', id });

  const out = [];
  for (let i = 0; i < CFG.upgradeChoices; i++) {
    const hasNew = newW.length + newP.length > 0;
    if (!ups.length && !hasNew) break;
    const wantNew = hasNew && (!ups.length || Math.random() < 0.5);
    if (wantNew) {
      const src = newW.length && newP.length ? (Math.random() < 0.5 ? newW : newP) : (newW.length ? newW : newP);
      out.push(pickWeighted(src));
    } else out.push(pickOut(ups));
  }
  // Everything maxed and slots full: fillers.
  if (out.length < CFG.upgradeChoices) out.push({ kind: 'fill', id: 'cache' });
  if (out.length < CFG.upgradeChoices && S.p.hp < S.p.maxHp) out.push({ kind: 'fill', id: 'repair' });
  return out;
}

function choiceInfo(c) {
  if (c.kind === 'ult') {
    const u = ULTS[c.id];
    return { title: u.name, desc: u.desc, glyph: u.glyph, color: TIER.ult.color, icon: COL.paper,
             tier: 'ULTIMATE', tag: `DOUBLE-TAP · ${ultCooldown(c.id)}s RECHARGE` };
  }
  const nW = slotWeapons().length, nP = Object.keys(S.passives).length;
  if (c.kind === 'fill') {
    return c.id === 'repair'
      ? { title: 'Field Repair', desc: 'Restore 1 hull point', glyph: '✚', color: COL.xp, tag: 'BONUS' }
      : { title: 'Salvage Cache', desc: '+15 credits', glyph: '$', color: COL.gold, tag: 'BONUS' };
  }
  const isW = c.kind === 'wup' || c.kind === 'wnew';
  const d = isW ? WEAPONS[c.id] : PASSIVES[c.id], t = TIER[d.tier];
  const base = { title: d.name, glyph: d.glyph, color: t.color, icon: d.color, tier: t.name };
  if (c.kind === 'wnew') return Object.assign(base, { desc: d.levels[0], tag: `NEW WEAPON · ${nW + 1}/${CFG.slots.weapons}` });
  if (c.kind === 'pnew') return Object.assign(base, { desc: d.levels[0], tag: `NEW PASSIVE · ${nP + 1}/${CFG.slots.passives}` });
  const lvl = isW ? S.weapons[c.id].lvl : S.passives[c.id].lvl;
  const sig = isW && S.weapons[c.id].builtin ? 'SHIP ' : '';
  return Object.assign(base, { desc: d.levels[lvl], tag: `${sig}${isW ? 'WEAPON' : 'PASSIVE'} · LV ${lvl} → ${lvl + 1}` });
}

function openLevelUp() {
  S.state = 'levelup';
  S.choiceLevel = S.level - S.pending + 1;
  S.choices = buildChoices();
  S.uiLock = 0.4;      // ignore taps briefly so a lifted finger doesn't pick by accident
  S.uiPress = null;
  buzz(30);
}

function reroll() {
  if (S.rerolls <= 0) return;
  S.rerolls--;
  S.choices = buildChoices();
  S.uiLock = 0.2;
}

function choose(i) {
  const c = S.choices && S.choices[i];
  if (!c) return;
  const p = S.p;
  switch (c.kind) {
    case 'wnew': S.weapons[c.id] = { lvl: 1, t: 0, on: 0 }; break;
    case 'wup':  S.weapons[c.id].lvl++; break;
    case 'pnew': S.passives[c.id] = { lvl: 1 }; break;
    case 'pup':  S.passives[c.id].lvl++; break;
    case 'ult':  S.ult = { id: c.id, cd: 0 }; S.ultHint = 5; break;
    case 'fill': if (c.id === 'repair') p.hp = Math.min(p.maxHp, p.hp + 1); else S.credits += 15; break;
  }
  const before = p.maxHp;
  recalcMods();
  if (p.maxHp > before) p.hp += p.maxHp - before;       // Hull Plating repairs too
  if (c.id === 'repair' && c.kind === 'pnew') p.repairT = repairEvery();
  S.pending--;
  if (S.pending > 0) openLevelUp();
  else {
    S.state = 'play';
    S.choices = null;
    p.invuln = Math.max(p.invuln, CFG.postLevelUpInvuln);
    input.dx = input.dy = 0;
  }
}

// ============================================================================
// Main update
// ============================================================================
function gameUpdate(dt) {
  const p = S.p;
  S.t += dt;
  S.shake = Math.max(0, S.shake - dt);
  S.warn = Math.max(0, S.warn - dt);

  // --- movement: finger drag is relative, so your finger never covers the ship
  const kx = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
  const ky = (keys.arrowdown || keys.s ? 1 : 0) - (keys.arrowup || keys.w ? 1 : 0);
  p.x += kx * CFG.player.keySpeed * dt + input.dx * CFG.player.dragSensitivity;
  p.y += ky * CFG.player.keySpeed * dt + input.dy * CFG.player.dragSensitivity;
  input.dx = input.dy = 0;
  p.x = clamp(p.x, 12, W - 12);
  p.y = clamp(p.y, 100, H - 20);
  p.invuln = Math.max(0, p.invuln - dt);

  // --- passive timers
  if (ML('deflector') && !p.bubble && (p.bubbleT -= dt) <= 0) { p.bubble = true; buzz(15); }
  if (S.passives.repair && (p.repairT -= dt) <= 0) {
    p.repairT = repairEvery();
    if (p.hp < p.maxHp) { p.hp++; floatText(p.x, p.y - 26, '+1 HULL', COL.xp, 11); }
  }

  // --- weapons: no basic cannon, every ship relies on its signature weapon + what it picks up
  S.laser = null;
  for (const id in S.weapons) {
    S.sig = !!S.weapons[id].builtin;     // signature weapon gets CFG.signatureCooldown
    WEAPONS[id].update(S.weapons[id], dt);
  }
  S.sig = false;

  // --- spawning: small fry, plus a capital ship on a timer
  if (S.t >= S.nextBoss - 3 && S.warn <= 0 && !S.warned) { S.warn = 3; S.warned = true; buzz([60, 60, 60]); }
  if (S.t >= S.nextBoss) { spawnBoss(); S.nextBoss += CFG.boss.every; S.warned = false; }
  if ((S.spawnT -= dt) <= 0) {
    const k = clamp(S.t / CFG.spawn.rampSeconds, 0, 1);
    S.spawnT = lerp(CFG.spawn.startInterval, CFG.spawn.minInterval, k) * rand(0.7, 1.3) * (bossAlive() ? CFG.spawn.duringBossMul : 1);
    spawnPattern();
  }

  updateBullets(dt);
  updateUlts(dt);
  S.ultHint = Math.max(0, (S.ultHint || 0) - dt);

  // --- enemies (Time Warp slows them and their bullets)
  const edt = S.warp > 0 ? dt * 0.25 : dt;
  for (const e of S.enemies) if (!e.dead) updateEnemy(e, edt);

  // --- novas (shockwaves): damage once per enemy, erase enemy bullets
  for (const n of S.novas) {
    n.age += dt;
    n.r = n.max * Math.min(1, n.age / (n.small ? 0.15 : 0.35));
    if (n.hit) {
      for (const e of S.enemies) {
        if (e.dead || n.hit.has(e)) continue;
        const dx = e.x - n.x, dy = e.y - n.y;
        if (dx * dx + dy * dy < (n.r + e.r) ** 2) { n.hit.add(e); hitEnemy(e, n.dmg, false); }
      }
      clearBulletsNear(n.x, n.y, n.r);
    }
    if (n.age > (n.small ? 0.3 : 0.55)) n.dead = true;
  }

  // --- enemy bullets
  for (const b of S.ebullets) {
    if (b.dead) continue;
    b.x += b.vx * edt;
    b.y += b.vy * edt;
    if (b.y < -20 || b.y > H + 20 || b.x < -20 || b.x > W + 20) { b.dead = true; continue; }
    const dx = b.x - p.x, dy = b.y - p.y, d2 = dx * dx + dy * dy;
    if (d2 < (CFG.player.hitRadius + b.r * 0.6) ** 2 && p.invuln <= 0) {
      b.dead = true;
      damagePlayer();
    }
  }

  // --- XP crystals: drift down, get pulled in when you're close
  for (const o of S.orbs) {
    o.age += dt;
    const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy);
    if (d < p.magnet) {
      const pull = CFG.xp.pullSpeed * dt;
      o.x += (dx / d) * Math.min(pull, d);
      o.y += (dy / d) * Math.min(pull, d);
    } else {
      o.vx *= Math.pow(0.02, dt);
      o.vy *= Math.pow(0.02, dt);
      o.x += o.vx * dt;
      o.y += (o.vy + CFG.xp.orbFallSpeed) * dt;
    }
    if (d < 12) {
      o.dead = true;
      S.xp += o.v * S.mod.xp;
      sparks(o.x, o.y, COL.xp, 2);
    } else if (o.y > H + 10) o.dead = true;
  }

  updateParticles(dt);
  compact(S.bullets); compact(S.ebullets); compact(S.enemies); compact(S.orbs); compact(S.novas);

  // --- level up?
  if (S.state === 'play') {
    while (S.xp >= xpNeed(S.level)) { S.xp -= xpNeed(S.level); S.level++; S.pending++; }
    if (S.pending > 0) openLevelUp();
  }
}

function updateBullets(dt) {
  for (const b of S.bullets) {
    if (b.dead) continue;
    if (b.life !== undefined && (b.life -= dt) <= 0) { b.dead = true; continue; }

    if (b.kind === 'rocket') {
      if ((b.retarget -= dt) <= 0 && (!b.target || b.target.dead)) { b.retarget = 0.15; b.target = nearestEnemy(b.x, b.y, 2000); }
      let ang = Math.atan2(b.vy, b.vx);
      const want = b.target && !b.target.dead ? Math.atan2(b.target.y - b.y, b.target.x - b.x) : UP;
      let diff = want - ang;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      ang += clamp(diff, -6 * dt, 6 * dt);
      const sp = Math.min(spd(460), Math.hypot(b.vx, b.vy) + 700 * dt);
      b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
      if (Math.random() < 0.6) S.parts.push({ x: b.x, y: b.y, vx: rand(-15, 15), vy: rand(-15, 15), life: 0.3, age: 0, color: '#ff8a3d', size: 1.6 });
    } else if (b.kind === 'flak') {
      if ((b.fuse -= dt) <= 0) { flakBurst(b); b.dead = true; continue; }
    } else if (b.kind === 'disc') {
      b.spin += dt * 14;
      if ((b.hitReset -= dt) <= 0) { b.hitReset = 0.25; b.hits.clear(); }
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.kind === 'disc') {           // bounce off every edge
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
      if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
      if (b.y > H - b.r) { b.y = H - b.r; b.vy = -Math.abs(b.vy); }
    } else if (b.y < -40 || b.y > H + 20 || b.x < -20 || b.x > W + 20) { b.dead = true; continue; }

    for (const e of S.enemies) {
      if (e.dead) continue;
      let touching;
      if (b.kind === 'wave') touching = Math.abs(e.x - b.x) < b.hw + e.r * 0.5 && Math.abs(e.y - b.y) < 8 + e.r;
      else { const dx = b.x - e.x, dy = b.y - e.y, rr = b.r + e.r; touching = dx * dx + dy * dy < rr * rr; }
      if (!touching) continue;
      if (b.hits) { if (b.hits.has(e)) continue; b.hits.add(e); }
      if (b.kind === 'rocket') { explode(b.x, b.y, b.aoe, b.dmg); b.dead = true; break; }
      if (b.kind === 'flak') { hitEnemy(e, b.dmg, false); flakBurst(b); b.dead = true; break; }
      hitEnemy(e, b.dmg, b.kind === 'disc' || b.kind === 'wave');
      if (b.pierce > 0) b.pierce--;
      else { b.dead = true; break; }
    }
  }
}

function update(dt) {
  artUpdate(S && S.state === 'play' ? dt * 1.6 : dt * 0.6);
  if (!S) return;
  if (S.flash && (S.flash.t -= dt) <= 0) S.flash = null;
  if (S.armed && (S.armed.t -= dt) <= 0) S.armed = null;
  if (S.state === 'play') gameUpdate(dt);
  else {
    S.uiLock -= dt;
    if (S.state === 'over') { S.shake = Math.max(0, S.shake - dt); updateParticles(dt); }
  }
}

// ============================================================================
// Input: touch / mouse drag, plus keyboard for testing on a computer
// ============================================================================
const input = { dx: 0, dy: 0, id: null, lx: 0, ly: 0 };
const keys = {};

function toWorld(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
function inRect(pt, r) { return pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h; }
function buttonAt(pt) {
  for (let i = uiButtons.length - 1; i >= 0; i--) if (uiButtons[i].enabled && inRect(pt, uiButtons[i].rect)) return uiButtons[i];
  return null;
}

function openHangar() { newGame('hangar'); S.uiLock = 0.15; }
function resume() { S.state = 'play'; input.dx = input.dy = 0; }

function startGame() {
  newGame('play');
  try { const el = document.documentElement; el.requestFullscreen && el.requestFullscreen().catch(() => {}); } catch (e) {}
}

window.addEventListener('pointerdown', e => {
  if (!S) return;
  const pt = toWorld(e);
  if (S.state === 'play') {
    if (inRect(pt, PAUSE_BTN)) { S.state = 'paused'; S.uiLock = 0.2; return; }
    input.id = e.pointerId; input.lx = e.clientX; input.ly = e.clientY;
    input.downT = performance.now(); input.downX = e.clientX; input.downY = e.clientY;
  } else if (S.uiLock <= 0) {
    const b = buttonAt(pt);
    S.uiPress = b ? b.id : null;
  }
  e.preventDefault();
}, { passive: false });

window.addEventListener('pointermove', e => {
  if (e.pointerId !== input.id || !S || S.state !== 'play') return;
  const r = cv.getBoundingClientRect(), k = W / r.width;
  input.dx += (e.clientX - input.lx) * k;
  input.dy += (e.clientY - input.ly) * k;
  input.lx = e.clientX; input.ly = e.clientY;
  e.preventDefault();
}, { passive: false });

window.addEventListener('pointerup', e => {
  if (e.pointerId === input.id) {
    input.id = null;
    // A quick tap (short, barely moved). Two of them close together = ultimate.
    const now = performance.now();
    if (S && S.state === 'play' && now - input.downT < 250 && Math.hypot(e.clientX - input.downX, e.clientY - input.downY) < 20) {
      if (now - (input.lastTap || 0) < 380) { activateUlt(); input.lastTap = 0; }
      else input.lastTap = now;
    }
  }
  if (!S || S.state === 'play' || S.uiPress == null) return;
  const id = S.uiPress;
  S.uiPress = null;
  const b = buttonAt(toWorld(e));
  if (b && b.id === id && S.uiLock <= 0) b.action();
});
window.addEventListener('pointercancel', e => { if (e.pointerId === input.id) input.id = null; if (S) S.uiPress = null; });

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (!S) return;
  if ((k === 'escape' || k === 'p') && (S.state === 'play' || S.state === 'paused')) { if (S.state === 'play') S.state = 'paused'; else resume(); }
  if (k === 'e' && S.state === 'play') activateUlt();
  if (S.state === 'levelup' && S.uiLock <= 0) {
    if (['1', '2', '3'].includes(k)) choose(+k - 1);
    if (k === 'r') reroll();
  }
  if ((k === 'enter' || k === ' ') && (S.state === 'title' || S.state === 'hangar' || (S.state === 'over' && S.uiLock <= 0))) startGame();
  if (k === 'h' && (S.state === 'title' || (S.state === 'over' && S.uiLock <= 0))) openHangar();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && S && S.state === 'play') S.state = 'paused'; });
document.addEventListener('contextmenu', e => e.preventDefault());

// Handy for testing from the browser console: STARBURN.S, STARBURN.giveXp(20)
window.STARBURN = { get S() { return S; }, CFG, META, WEAPONS, PASSIVES, SHIPS, ULTS, giveXp(n) { if (S) S.xp += n; },
  choose, startGame, openHangar, activateUlt,
  step(dt, n) { for (let i = 0; i < n; i++) update(dt); } };   // fast-forward for testing
