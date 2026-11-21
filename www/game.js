// VOID SURVIVORS: a vertical shooter where kills drop XP and level-ups build your loadout.
// (Internal names, the app id and the save key still say "starburn" so saves carry over.)
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
    handling: 1100,           // how fast (units/s) a ship can chase your finger; each ship multiplies this
  },

  // loadout slots come from the stage (STAGES[n].slots): 2+2 on stage 1, +1 of each per stage, 6+6 by stage 5.
  // One run is a campaign: your loadout carries from stage to stage.
  headStart: 8,               // starting directly on a later stage gives this many instant level-ups per skipped stage
  bountyRate: 0.6,            // fraction of each kill's bounty you actually collect (keeps the Hangar economy sane)
  ultLevel: 10,               // level that offers a choice of ultimate (double-tap to fire)
  ultCooldownMul: 1,          // 0.5 = ultimates recharge twice as fast
  ultCutin: 1.8,              // seconds the game freezes for the ultimate's splash screen (0 = no splash)
  ultUpgradeEvery: 10,        // every 10th pilot level (20, 30, 40...) the cards are ultimate upgrades instead
  ultAmplifyMax: 4,           // how many times Amplify can be taken
  ultChargeMax: 3,            // how many times Quick Charge can be taken
  ultChargeCut: 0.15,         // each Quick Charge recharges 15% faster
  ultGhost: 2.0,              // hidden invincibility after the ultimate fires (no blinking)
  ultImpact: 0.35,            // seconds of slow-motion "impact frame" right after the ultimate fires
  miniBossHpMul: 1.25,        // mini-bosses get this much extra health on top of bossHpMul
  bossPowerScale: 0.6,        // bosses get tougher as your firepower grows: health x (your firepower ^ this).
                              // Firepower = damage x fire rate x multishot x crits, 1.0 for a fresh ship.
                              // 0 = off, 1 = fights always take the same time whatever your upgrades.
  signatureCooldown: 0.8,     // a ship's own weapon fires 20% faster than the same weapon picked up later (1 = no bonus)
  rarityWeights: { common: 4, uncommon: 2, rare: 1 },   // common is 2x as likely as uncommon, which is 2x rare
  shipCost: { common: 300, uncommon: 900, rare: 2000 }, // credits to unlock a ship, by its weapon's tier
  shipUnlockStage: { common: 1, uncommon: 2, rare: 3 }, // beat a boss on this stage (or later) to earn a ship of that tier
  upgradeCostMul: 3,          // multiplies every Hangar upgrade price
  deflectorRecharge: [0, 40, 32, 25, 19, 14],            // Deflector Shield recharge seconds per Hangar level
  maxLevel: 5,                // max level for weapons and most passives
  upgradeChoices: 3,
  postLevelUpInvuln: 0.8,     // grace after picking an upgrade (finger needs to find the ship)

  xp: {
    gainRate: 0.5,            // fraction of each gem's XP you actually get (0.5 = half)
    orbFallSpeed: 55,         // crystals drift down; miss them and they're gone
    pullSpeed: 440,           // how fast crystals fly to you once inside the magnet
    needBase: 6,              // XP for level 2
    needPerLevel: 3,          // extra XP needed per level
    needCurve: 0.35,          // extra XP that grows with level squared
  },

  spawn: {
    graceTime: 1.5,           // quiet seconds at the start
    startInterval: 1.6,       // seconds between enemy groups at the start
    minInterval: 0.5,         // ...and once fully ramped up
    rampSeconds: 280,         // how long it takes to reach full intensity
    duringBossMul: 2.5,       // fewer small enemies while a boss is up
  },

  bossHpMul: 1.0,             // scales every boss's health (doubled from 0.5)
  finalBossSize: 1.3,         // final bosses are this much bigger than their base size (hitbox and drawing)
  stageScale: {               // how much harder each stage after the first gets
    enemyHp: 0.5,             // +50% enemy health per stage (your loadout carries over, so the hive has to keep up)
    hpGrowth: 0.2,            // enemy health also climbs 20% faster during each stage, per stage
    bossHp: 1.0,              // +100% mini-boss health per stage (5x by stage 5)
    finalHp: 1.0,             // +100% final-boss health per stage
    bulletSpeed: 0.07,        // +7% enemy bullet speed per stage
    spawn: 0.1,               // 10% shorter gaps between enemy waves per stage
    fire: 0.15,               // enemies fire 15% more often per stage
    credits: 0,               // extra bounty per stage (0: later stages already have far more to kill)
  },
  rush: {                     // the secret Boss Rush stage
    first: 12,                // first boss arrives at 0:12
    gap: 60,                  // then one every minute, whether or not the last one is dead
    swarmMul: 1.6,            // longer gaps between regular enemy waves
  },
  level: {
    length: 420,              // 7:00: the clock stops and the final boss arrives
    miniBosses: [105, 210, 315],  // mini-bosses at 1:45, 3:30 and 5:15
    warnTime: 3,              // seconds of WARNING before each boss
  },

  enemyHpGrowthPerMin: 0.45,  // enemies get +45% of their starting HP per minute survived (was 35%)
  enemyBulletSpeed: 150,
  enemyBulletSpeedMax: 1.7,   // enemy bullets speed up through the level, up to 1.7x
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
// Sound hooks (audio.js). Safe no-ops if audio isn't available.
const snd = (name, arg) => { if (typeof sfx === 'function') sfx(name, arg); };
const music = (cmd, id) => { if (typeof musicStart !== 'function') return; cmd === 'start' ? musicStart(id) : musicStop(); };
function buzz(ms) { if (META.audio && META.audio.vibe === false) return; try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

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
  m.shipLv = m.shipLv || {};       // Hangar upgrade levels, per ship
  m.unlocked = m.unlocked || (m.clears ? 2 : 1);   // highest stage you can pick
  m.secret = !!m.secret;                            // the secret Boss Rush (beat stage 5 at full health)
  if (m.lv.shield) {          // the old cheap "Launch Shield" is gone: refund what was spent on it
    for (let k = 0; k < m.lv.shield; k++) m.bank += Math.round(40 * Math.pow(1.8, k));
    delete m.lv.shield;
  }
  if (!m.best) { try { m.best = parseFloat(localStorage.getItem('starburn.best')) || 0; } catch (e) { m.best = 0; } }
  return m;
}
function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(META)); } catch (e) {} }
const META = loadMeta();
// ML(id): the selected ship's Hangar level for an upgrade (each ship has its own).
const shipLevels = () => META.shipLv[META.ship] || (META.shipLv[META.ship] = {});
const ML = id => shipLevels()[id] || 0;

// Per-ship stat upgrades: how much each Hangar level adds, and how it's shown.
const STAT_UP = { hull: 1, dmg: 0.06, rate: 0.05, magnet: 0.12, handling: 0.08 };
const STAT_BASE = { hull: 'hp', dmg: 'dmg', rate: 'rate', magnet: 'magnet', handling: 'handling' };
function shipStat(stat, lvl, ship) {
  ship = ship || curShip();
  const base = ship.stats[STAT_BASE[stat]];
  return stat === 'hull' ? base + lvl : base * (1 + STAT_UP[stat] * lvl);
}
const fmtStat = (stat, v) => (stat === 'hull' ? String(v) : Math.round(v * 100) + '%');
function statDesc(label, stat) {
  return (l, maxed) => maxed ? `${label} ${fmtStat(stat, shipStat(stat, l))}`
    : `${label} ${fmtStat(stat, shipStat(stat, l))} → ${fmtStat(stat, shipStat(stat, l + 1))}`;
}

// Hangar upgrades. Every ship has its own levels; the credit bank is shared.
const HANGAR = [
  { id: 'hull',    name: 'Hull Plating',       desc: statDesc('Hull', 'hull'),            max: 3,  base: 60, growth: 2.2 },
  { id: 'dmg',     name: 'Weapon Calibration', desc: statDesc('Power', 'dmg'),            max: 10, base: 20, growth: 1.35 },
  { id: 'rate',    name: 'Trigger Tuning',     desc: statDesc('Fire rate', 'rate'),       max: 10, base: 20, growth: 1.35 },
  { id: 'magnet',  name: 'Magnet Coils',       desc: statDesc('Pickup range', 'magnet'),  max: 5,  base: 15, growth: 1.4 },
  { id: 'handling', name: 'Thrusters',         desc: statDesc('Handling', 'handling'),    max: 5,  base: 20, growth: 1.4 },
  { id: 'xp',      name: 'Flight Recorder',    desc: '+6% XP',                       max: 5,  base: 25, growth: 1.45 },
  { id: 'credits', name: 'Salvage Rights',     desc: '+10% credits from bounties',   max: 5,  base: 30, growth: 1.5 },
  { id: 'reroll',  name: 'Reroll Chip',        desc: '+1 reroll of level-up cards per run', max: 3, base: 80, growth: 2 },
  { id: 'revive',  name: 'Second Wind',        desc: 'Survive one fatal hit per run', max: 1, base: 400, growth: 1 },
  { id: 'deflector', name: 'Deflector Shield', max: 5, base: 500, growth: 1.6,
    desc: l => { const r = CFG.deflectorRecharge;
      return l === 0 ? `Blocks one hit, recharges in ${r[1]}s` : l >= 5 ? `Blocks one hit, recharges in ${r[5]}s`
                     : `Faster recharge: ${r[l]}s → ${r[l + 1]}s`; } },
];
const hangarCost = h => Math.round(h.base * Math.pow(h.growth, ML(h.id)) * CFG.upgradeCostMul);

// One-time switch to per-ship upgrades: refund everything bought under the old shared Hangar.
if (!META.v || META.v < 2) {
  let refund = 0;
  for (const h of HANGAR) for (let k = 0; k < (META.lv[h.id] || 0); k++) refund += Math.round(h.base * Math.pow(h.growth, k));
  META.lv = {};
  META.v = 2;
  META.bank += refund;
  if (refund) META.notice = `Upgrades are now per ship: ${refund} CR refunded!`;
  saveMeta();
}

function buyHangar(h) {
  const lv = ML(h.id), cost = hangarCost(h);
  if (lv >= h.max || META.bank < cost) { buzz(20); return; }
  META.bank -= cost;
  shipLevels()[h.id] = lv + 1;
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
  if (S) { S.p.x = S.p.tx = clamp(S.p.x, 12, W - 12); S.p.y = S.p.ty = clamp(S.p.y, 100, H - 20); }
  if (typeof artResize === 'function') artResize();
}

// ============================================================================
// Weapons (12). Each has a name, colour, symbol, one line of text per level,
// and update() which runs every frame while it's in your loadout.
// Shared modifiers from passives: S.mod.cd (cooldowns), .dmg, .area, .count,
// .speed (projectile speed), .pierce.
// ============================================================================
function shoot(b) { S.bullets.push(b); return b; }
const cd = base => base * S.mod.cd * (S.sig ? CFG.signatureCooldown : 1) * (S.overdrive > 0 ? ultOverdriveMul(ultLv()) : 1) * (S.warp > 0 && ultPerk('haste') ? 0.6 : 1);
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
                    r: r || 3, dmg, kind: 'main', color, pierce: S.mod.pierce + (S.overdrive > 0 && ultPerk('pierce') ? 2 : 0) });
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
// Ultimates: picked at level 10, upgraded every 10th level after (Amplify, Quick Charge or a perk). L = Amplify power.
const ULTS = {
  nuke:      { name: 'Megaton',       glyph: '☢', word: 'KA-BOOM!',   cooldown: 75, color: '#ffd60a',
               perks: { fallout: ['Fallout', 'The sky keeps burning: 40 damage per second to every enemy for 6s'], chain: ['Chain Reaction', 'Enemies it kills explode and hurt their neighbours'] },
               desc: 'Hits every enemy on screen for huge damage and wipes all bullets',
               up: L => `${400 + 200 * (L - 1)} damage to everything`,
               fire(L) { for (const e of S.enemies) if (!e.dead && e.y > -10) { hitEnemy(e, 400 + 200 * (L - 1), true); if (e.dead && ultPerk('chain')) explode(e.x, e.y, 60, 120); }
                         if (ultPerk('fallout')) S.fallout = 6;
                         for (const b of S.ebullets) b.dead = true; S.shake = 1; S.whiteout = 0.35;
                         S.mushroom = { x: S.p.x, y: Math.max(140, S.p.y - 220), t: 0 }; } },
  overdrive: { name: 'Overdrive',     glyph: '⚡', word: 'OVERDRIVE!', cooldown: 60, color: '#2ec5ff',
               perks: { pierce: ['Piercing Rounds', 'Gun shots pierce 2 extra enemies during Overdrive'], vacuum: ['Vacuum', 'Magnet range x6 while Overdrive runs'] },
               desc: 'All weapons fire 3x faster for 8 seconds',
               up: L => `${8 + 2 * (L - 1)}s, weapons ${Math.round(1 / ultOverdriveMul(L) * 10) / 10}x faster`,
               fire(L) { S.overdrive = 8 + 2 * (L - 1); for (const id in S.weapons) S.weapons[id].t = 0; } },
  warp:      { name: 'Time Warp',     glyph: '⌛', word: 'TIME WARP!', cooldown: 60, color: '#7de0ff',
               perks: { freeze: ['Deep Freeze', 'Enemies and bullets nearly stop (10% speed instead of 25%)'], haste: ['Time Thief', 'Your weapons fire 40% faster during the warp'] },
               desc: 'Enemies and their bullets crawl at quarter speed for 7 seconds',
               up: L => `${7 + 1.5 * (L - 1)}s of slow time`,
               fire(L) { S.warp = 7 + 1.5 * (L - 1); } },
  barrage:   { name: 'Missile Storm', glyph: '➹', word: 'WHOOSH!',    cooldown: 50, color: '#ff8c1a',
               perks: { cluster: ['Cluster Warheads', 'Missiles hit 60% harder with wider blasts'], encore: ['Encore', 'A second storm launches 3 seconds later'] },
               desc: 'Launches 32 homing missiles over two seconds',
               up: L => `${32 + 10 * (L - 1)} missiles, ${40 + 10 * (L - 1)} damage each`,
               fire(L) { const k = ultPerk('cluster') ? 1.6 : 1; S.barrage = { left: 32 + 10 * (L - 1), t: 0, dmg: (40 + 10 * (L - 1)) * k, aoe: 30 * k };
                         if (ultPerk('encore') && !S.encoring) S.encore = 3; } },
  phase:     { name: 'Phase Ram',     glyph: '◈', word: 'PHASE RAM!', cooldown: 50, color: '#ff3fa4',
               perks: { finale: ['Grand Finale', 'Ends with a huge shockwave: 300 damage around you'], wide: ['Battering Ram', 'Ram and bullet-eating radius doubled'] },
               desc: 'Untouchable for 6 seconds: ram enemies and eat bullets',
               up: L => `${6 + 1.5 * (L - 1)}s, ram damage x${(1 + 0.4 * (L - 1)).toFixed(1)}`,
               fire(L) { S.phase = 6 + 1.5 * (L - 1); } },
  hole:      { name: 'Black Hole',    glyph: '◉', word: 'VWOOMP!',    cooldown: 65, color: '#a45cff',
               perks: { twin: ['Twin Singularity', 'Opens two black holes'], supernova: ['Supernova', 'Collapses in a 400-damage blast'] },
               desc: 'A black hole sucks in enemies and bullets for 6 seconds',
               up: L => `${6 + (L - 1)}s, pull radius ${170 + 25 * (L - 1)}`,
               fire(L) { const mk = x => ({ x, y: Math.max(130, S.p.y - 200), t: 6 + (L - 1), R: 170 + 25 * (L - 1), dmg: 160 * (1 + 0.4 * (L - 1)) });
                         S.holes = ultPerk('twin') ? [mk(clamp(S.p.x - 90, 60, W - 60)), mk(clamp(S.p.x + 90, 60, W - 60))] : [mk(S.p.x)]; } },
};
const ultOverdriveMul = L => Math.max(0.2, 0.33 - 0.03 * (L - 1));
const ultLv = () => (S && S.ult && S.ult.power) || 1;                  // effect strength (1 + Amplify picks)
const ultPerk = k => !!(S && S.ult && S.ult.perks && S.ult.perks[k]);
const ultCooldown = id => {
  const ch = S && S.ult && S.ult.id === id ? S.ult.charge || 0 : 0;
  return Math.round(ULTS[id].cooldown * CFG.ultCooldownMul * Math.pow(1 - CFG.ultChargeCut, ch));
};
// The ultimate upgrade cards offered every 10th level
function ultUpgradeChoices() {
  const u = S.ult, out = [];
  if ((u.power || 1) <= CFG.ultAmplifyMax) out.push({ kind: 'uup', id: 'power' });
  if ((u.charge || 0) < CFG.ultChargeMax) out.push({ kind: 'uup', id: 'charge' });
  for (const k in ULTS[u.id].perks) if (!u.perks[k]) out.push({ kind: 'uup', id: k });
  return shuffle(out).slice(0, CFG.upgradeChoices);
}
function ultUpInfo(id) {
  const u = S.ult, U = ULTS[u.id];
  if (id === 'power') return ['Amplify', U.up(ultLv() + 1), '▲', `POWER ${ultLv()} → ${ultLv() + 1}`];
  if (id === 'charge') { const now = ultCooldown(u.id); return ['Quick Charge', `Recharges ${Math.round(CFG.ultChargeCut * 100)}% faster: ${now}s → ${Math.round(now * (1 - CFG.ultChargeCut))}s`, '↻', `RECHARGE ${(u.charge || 0) + 1}/${CFG.ultChargeMax}`]; }
  const p = U.perks[id];
  return [p[0], p[1], '★', 'UNIQUE PERK'];
}
function applyUltUpgrade(id) {
  const u = S.ult;
  if (id === 'power') u.power = (u.power || 1) + 1;
  else if (id === 'charge') u.charge = (u.charge || 0) + 1;
  else u.perks[id] = true;
  u.lv = (u.lv || 1) + 1; u.cd = 0;
  S.ultLvUp = { name: ULTS[u.id].name.toUpperCase(), lv: u.lv, color: ULTS[u.id].color, t: 0 };
}

// Double-tap: the game freezes for a dramatic cut-in, then the ultimate fires.
function activateUlt() {
  if (!S.ult || S.ult.cd > 0 || S.state !== 'play') return;
  S.ult.cd = ultCooldown(S.ult.id);
  if (CFG.ultCutin > 0) {
    S.state = 'cutin'; S.cutin = { t: 0, dur: CFG.ultCutin, id: S.ult.id }; S.uiLock = 99;
    snd('cutin'); buzz([30, 40, 30]);
  } else fireUlt(S.ult.id);
}
function fireUlt(id) {
  const u = ULTS[id], L = ultLv();
  u.fire(L);
  snd('ult', id);
  burst(W / 2, S.p.y - 90, 70 + 8 * L, u.word, u.color);
  S.ultFx = { t: 0, id, color: u.color, x: S.p.x, y: S.p.y, L };      // shockwaves, flash, speed lines (drawn in art.js)
  S.impact = CFG.ultImpact;                                             // a beat of slow motion
  S.p.ghost = CFG.ultGhost;                                             // secret: a moment of invincibility, no blinking
  S.shake = Math.max(S.shake, 0.7);
  for (let i = 0; i < 3; i++) S.novas.push({ x: S.p.x, y: S.p.y, r: 0, max: 220 + i * 110, dmg: 0, age: 0, hit: null, color: i === 1 ? PAPER : u.color });
  sparks(S.p.x, S.p.y, u.color, 40); sparks(S.p.x, S.p.y, COL.gold, 20);
  buzz([40, 30, 120]);
}
function ultLevelUpFx() {          // fanfare once you're back in the action after picking an ultimate upgrade
  const l = S.ultLvUp; S.ultLvUp = null;
  burst(W / 2, S.p.y - 120, 74, `${l.name} LV ${l.lv}!`, l.color);
  S.ultLvFlash = 1.6; snd('ultup'); buzz([30, 30, 30, 30, 60]);
}
function finishCutin() {
  const id = S.cutin.id;
  S.state = 'play'; S.cutin = null; S.uiLock = 0; input.dx = input.dy = 0;
  fireUlt(id);
}

function updateUlts(dt) {
  if (S.ult) S.ult.cd = Math.max(0, S.ult.cd - dt);
  if (S.ultFx && (S.ultFx.t += dt) > 1.4) S.ultFx = null;
  if (S.mushroom && (S.mushroom.t += dt) > 1.6) S.mushroom = null;
  S.ultLvFlash = Math.max(0, (S.ultLvFlash || 0) - dt);
  S.overdrive = Math.max(0, (S.overdrive || 0) - dt);
  S.warp = Math.max(0, (S.warp || 0) - dt);
  S.phase = Math.max(0, (S.phase || 0) - dt);
  S.whiteout = Math.max(0, (S.whiteout || 0) - dt);
  const p = S.p;
  if (S.barrage && (S.barrage.t -= dt) <= 0) {
    S.barrage.t = 0.06;
    const side = S.barrage.left % 2 ? 1 : -1;
    shoot({ x: p.x + side * 12, y: p.y, vx: side * rand(150, 260), vy: rand(-60, 40), r: 4, dmg: S.barrage.dmg || 40, aoe: S.barrage.aoe || 30,
            kind: 'rocket', life: 3.5, target: null, retarget: 0, color: '#ff8c1a' });
    if (--S.barrage.left <= 0) S.barrage = null;
  }
  if (S.encore > 0 && (S.encore -= dt) <= 0) { S.encoring = true; ULTS.barrage.fire(ultLv()); S.encoring = false; burst(W / 2, p.y - 90, 60, 'ENCORE!', '#ff8c1a'); snd('ult', 'barrage'); }
  if (S.fallout > 0) {
    S.fallout -= dt;
    for (const e of S.enemies) if (!e.dead && e.y > -10) hitEnemy(e, 40 * ultLv() * dt, true);
  }
  if (S.phase <= 0 && S.phaseOn) {                // Phase Ram just ended
    S.phaseOn = false;
    if (ultPerk('finale')) { S.novas.push({ x: p.x, y: p.y, r: 0, max: 170, dmg: 300 * ultLv(), age: 0, hit: new Set(), color: '#ff3fa4' }); burst(p.x, p.y - 40, 60, 'FINALE!', '#ff3fa4'); S.shake = 0.5; snd('ult', 'phase'); }
  }
  if (S.phase > 0) {
    S.phaseOn = true;
    const pr = ultPerk('wide') ? 48 : 24;
    for (const e of S.enemies) if (!e.dead && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < (e.r + pr) ** 2) hitEnemy(e, 220 * (1 + 0.4 * (ultLv() - 1)) * dt, true);
    clearBulletsNear(p.x, p.y, pr + 2);
  }
  if (S.holes) for (const h of S.holes) {
    h.t -= dt;
    const R = h.R || 170;
    for (const e of S.enemies) {
      if (e.dead) continue;
      const dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1;
      if (d < R && !e.boss) { const pull = (60 + 200 * (1 - d / R)) * dt; e.x += dx / d * pull; e.y += dy / d * pull; if (e.bx !== undefined) e.bx += dx / d * pull; }
      if (d < 40 + e.r) hitEnemy(e, (h.dmg || 160) * dt, true);
    }
    for (const b of S.ebullets) {
      const dx = h.x - b.x, dy = h.y - b.y, d = Math.hypot(dx, dy) || 1;
      if (d < 22) b.dead = true;
      else if (d < R) { b.vx += dx / d * 600 * dt; b.vy += dy / d * 600 * dt; }
    }
    if (h.t <= 0 && !h.done) {
      h.done = true;
      if (ultPerk('supernova')) { S.novas.push({ x: h.x, y: h.y, r: 0, max: h.R * 0.7, dmg: 400 * ultLv(), age: 0, hit: new Set(), color: '#a45cff' }); burst(h.x, h.y, 70, 'SUPERNOVA!', '#a45cff'); S.shake = 0.6; snd('ult', 'hole'); }
    }
  }
  if (S.holes && S.holes.every(h => h.done)) S.holes = null;
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
// Ships (12). Each fires its signature weapon (bonus slot) and has its own base
// stats: hull, power (damage), fire rate, pickup range and handling.
// ============================================================================
const st = (hp, dmg, rate, magnet, handling) => ({ hp, dmg, rate, magnet, handling });
const SHIPS = {
  vesper:  { name: 'VESPER',  weapon: 'cannon',  role: 'All-rounder',        stats: st(3, 1.00, 1.00, 1.00, 1.00), color: '#3df5ff', shape: [0,-16, 5,-4, 14,8, 5,6, 0,10, -5,6, -14,8, -5,-4] },
  trident: { name: 'TRIDENT', weapon: 'wing',    role: 'Fast trigger',       stats: st(3, 0.90, 1.15, 1.00, 1.00), color: '#5dc8ff', shape: [0,-17, 3,-6, 9,-12, 10,2, 15,6, 6,8, 0,11, -6,8, -15,6, -10,2, -9,-12, -3,-6] },
  hornet:  { name: 'HORNET',  weapon: 'rockets', role: 'Heavy hitter',       stats: st(3, 1.10, 0.95, 1.00, 1.00), color: '#ff8a3d', shape: [0,-14, 6,-6, 16,-2, 12,6, 4,4, 0,13, -4,4, -12,6, -16,-2, -6,-6] },
  bulwark: { name: 'BULWARK', weapon: 'flak',    role: 'Tank, slow to turn', stats: st(5, 1.00, 0.90, 1.00, 0.70), color: '#ff6b6b', shape: [-5,-15, 5,-15, 8,-6, 15,-4, 15,8, 6,10, -6,10, -15,8, -15,-4, -8,-6] },
  halo:    { name: 'HALO',    weapon: 'disc',    role: 'Scavenger',          stats: st(3, 1.00, 1.00, 1.35, 1.00), color: '#b8ff5d', shape: [0,-16, 8,-10, 13,-1, 11,8, 0,12, -11,8, -13,-1, -8,-10] },
  tide:    { name: 'TIDE',    weapon: 'wave',    role: 'Crowd control',      stats: st(3, 0.95, 1.00, 1.00, 0.95), color: '#5d9dff', shape: [0,-15, 6,-2, 16,6, 16,11, 6,6, 0,9, -6,6, -16,11, -16,6, -6,-2] },
  hive:    { name: 'HIVE',    weapon: 'drone',   role: 'Commander',          stats: st(3, 1.00, 1.00, 1.20, 0.90), color: '#d6dcff', shape: [0,-15, 10,-8, 10,6, 0,12, -10,6, -10,-8] },
  lance:   { name: 'LANCE',   weapon: 'laser',   role: 'Glass cannon',       stats: st(2, 1.25, 1.00, 1.00, 1.15), color: '#c86bff', shape: [0,-20, 3,-6, 8,6, 3,5, 0,10, -3,5, -8,6, -3,-6] },
  corona:  { name: 'CORONA',  weapon: 'orbit',   role: 'Brawler',            stats: st(4, 0.95, 1.00, 1.00, 1.10), color: '#62ffd0', shape: [0,-15, 4,-8, 12,-8, 15,0, 12,8, 4,8, 0,12, -4,8, -12,8, -15,0, -12,-8, -4,-8] },
  tempest: { name: 'TEMPEST', weapon: 'chain',   role: 'Storm caller',       stats: st(3, 1.00, 1.10, 1.00, 1.00), color: '#8fb8ff', shape: [0,-16, 4,-6, 14,-10, 9,0, 16,6, 5,6, 0,11, -5,6, -16,6, -9,0, -14,-10, -4,-6] },
  needle:  { name: 'NEEDLE',  weapon: 'rail',    role: 'Sniper',             stats: st(2, 1.30, 0.95, 1.00, 1.20), color: '#ff5df0', shape: [0,-22, 2,-8, 10,4, 10,8, 2,6, 0,10, -2,6, -10,8, -10,4, -2,-8] },
  pulsar:  { name: 'PULSAR',  weapon: 'nova',    role: 'Close-range bruiser', stats: st(4, 1.05, 1.00, 1.00, 0.85), color: '#fff36b', shape: [0,-16, 4,-5, 15,-3, 6,4, 9,12, 0,7, -9,12, -6,4, -15,-3, -4,-5] },
};
const shipTier = id => WEAPONS[SHIPS[id].weapon].tier;
const shipCost = id => (id === 'vesper' ? 0 : CFG.shipCost[shipTier(id)]);
const curShip = () => SHIPS[META.ship] || SHIPS.vesper;
// The Hangar grows one ship at a time, cheapest first: each run you finish unlocks the next one,
// which stays a silhouette (ship and pilot) until you buy it with credits.
const SHIP_ORDER = Object.keys(SHIPS).map((id, i) => [id, i]).sort((a, b) => shipCost(a[0]) - shipCost(b[0]) || a[1] - b[1]).map(a => a[0]);
if (META.revealed === undefined) {            // older saves: everything you own, plus the next one
  let last = 0; SHIP_ORDER.forEach((id, i) => { if (META.ships[id]) last = i; });
  const fresh = !META.best && !META.clears && !META.bank;
  META.revealed = fresh ? 1 : Math.min(SHIP_ORDER.length, last + 2); saveMeta();
}
const shipRevealed = id => !!META.ships[id] || SHIP_ORDER.indexOf(id) < META.revealed;
// One ship per run, when it ends or clears a stage. You must have beaten a boss on a late enough stage:
// common ships need a stage 1 boss, uncommon a stage 2 boss, rare a stage 3 boss (CFG.shipUnlockStage).
function revealPilot() {
  if (S.revealDone || !(S.bossStage > 0)) return;
  while (META.revealed < SHIP_ORDER.length && META.ships[SHIP_ORDER[META.revealed]]) META.revealed++;
  if (META.revealed >= SHIP_ORDER.length) return;
  const next = SHIP_ORDER[META.revealed], need = CFG.shipUnlockStage[shipTier(next)] || 1;
  if (S.bossStage < need) { S.revealNeed = { stage: need, tier: shipTier(next) }; return; }   // not yet: the results say what to beat
  S.revealDone = true; S.revealNeed = null;
  S.newPilot = next; META.revealed++;
}
// The reveal cinematic between the end of a run and the results: warning flash, silhouette, "UNLOCKED!"
const REVEAL = { warn: 0.9, sweep: 2.0, unlock: 3.3, end: 5.0, skip: 1.2 };
function startReveal() {
  if (!S.newPilot) return;
  S.reveal = { t: 0, id: S.newPilot, next: S.state, cues: 0 };
  S.state = 'reveal';
}
function updateReveal(dt) {
  const r = S.reveal; r.t += dt;
  S.shake = Math.max(0, S.shake - dt); updateParticles(dt);
  const cue = (n, at, name, b) => { if (r.cues < n && r.t >= at) { r.cues = n; snd(name); if (b) buzz(b); } };
  cue(1, REVEAL.warn, 'revealWarn', [40, 60, 40]);
  cue(2, REVEAL.sweep, 'revealSweep', 60);
  cue(3, REVEAL.unlock, 'revealUnlock', [30, 30, 90]);
  if (r.t >= REVEAL.unlock && r.t < REVEAL.unlock + 0.05) S.shake = 0.45;
  if (r.t >= REVEAL.end) endReveal();
}
function endReveal() {
  if (S.state !== 'reveal') return;
  S.state = S.reveal.next; S.uiLock = 0.5;
}

// All modifiers in one place: hangar upgrades + passives.
function recalcMods() {
  const m = {
    dmg: shipStat('dmg', ML('dmg')) + 0.12 * PL('power') + (PL('multi') >= 2 ? 0.05 : 0) + (PL('multi') >= 4 ? 0.05 : 0),
    cd: (1 / shipStat('rate', ML('rate'))) * Math.pow(0.9, PL('rapid')),
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
  p.magnet = CFG.player.magnetRadius * (shipStat('magnet', ML('magnet')) + 0.3 * PL('tractor'));
  p.maxHp = shipStat('hull', ML('hull')) + PL('plating');
  p.handling = CFG.player.handling * shipStat('handling', ML('handling'));
}

// ============================================================================
// Game state
// ============================================================================
let S = null;
function xpNeed(level) {
  const l = level - 1;
  return Math.round(CFG.xp.needBase + CFG.xp.needPerLevel * l + CFG.xp.needCurve * l * l);
}

function newGame(state, stage) {
  if (state !== 'play') music('stop');
  if (state && state !== 'title' && META.notice) { META.notice = null; saveMeta(); }   // one-time message seen
  S = {
    state: state || 'play',     // title | hangar | play | levelup | paused | over | won
    t: 0, kills: 0, level: 1, xp: 0, shake: 0, credits: 0,
    p: { x: W / 2, y: H * 0.78, tx: W / 2, ty: H * 0.78, hp: 0, maxHp: 0, invuln: 0, magnet: 0, handling: 1000,
         bubble: false, bubbleT: 0, repairT: 0 },
    weapons: {}, passives: {}, mod: null,
    bullets: [], ebullets: [], enemies: [], orbs: [], parts: [], novas: [], zaps: [], texts: [], bursts: [], laser: null,
    gibs: [], splats: [],
    ult: null, overdrive: 0, warp: 0, phase: 0, holes: null, barrage: null, whiteout: 0,
    spawnT: CFG.spawn.graceTime, ev: 0, warned: false, warn: 0, warnName: '', queenUp: false, victoryT: 0,
    pending: 0, choices: null, choiceLevel: 0, uiLock: 0, uiPress: null, flash: null,
    rerolls: ML('reroll'), revives: ML('revive'),
    stage: clamp(stage || META.lastStage || 1, 1, maxStage()), intro: 0, fireMul: 1,
    runT: 0, banked: 0, startStage: clamp(stage || 1, 1, maxStage()),
  };
  S.fireMul = 1 + CFG.stageScale.fire * stageD();
  recalcMods();
  S.p.hp = S.p.maxHp;
  S.p.bubble = ML('deflector') > 0;
  S.ship = curShip();
  S.shipId = SHIPS[META.ship] ? META.ship : 'vesper';
  S.weapons[S.ship.weapon] = { lvl: 1, t: 0, on: 0, builtin: true };
  input.dx = input.dy = 0;
}

// ============================================================================
// Enemies
// ============================================================================
// ============================================================================
// Stages. Each: 7 minutes, its own 3 mini-bosses, its own
// enemies, final boss, music, look, wave mix and loadout slots.
// foes: which creature fills each role (drone / weaver / diver / gunner) on that stage.
// ============================================================================
const STAGES = [null,
  { name: 'HIVE FLEET', sub: 'Break through the swarm', music: 'level1', final: 'queen', slots: [2, 2],
    minis: ['brute', 'mother', 'stalker'],
    foes: { drone: 'drone', weaver: 'weaver', diver: 'diver', gunner: 'gunner' }, waves: { single: 3, line: 3, snake: 2, divers: 1.5, gunner: 1.2 } },
  { name: 'WARP ZONE', sub: 'Reality bends at lightspeed', music: 'level2', final: 'wyrm', slots: [3, 3],
    minis: ['manta', 'oculus', 'static'],
    foes: { drone: 'blinker', weaver: 'phaseel', diver: 'streak', gunner: 'prism' }, waves: { single: 2, line: 3, snake: 2, divers: 3, gunner: 1.3 } },
  { name: 'THE DEEP', sub: 'Something ancient is waiting below', music: 'level3', final: 'maw', slots: [4, 4],
    minis: ['nautilus', 'siren', 'gulper'],
    foes: { drone: 'jelly', weaver: 'eel', diver: 'piranha', gunner: 'urchin' }, waves: { single: 2, line: 2, snake: 4, divers: 1.5, gunner: 1.6 } },
  { name: 'INSIDE THE LEVIATHAN', sub: 'Fly down its throat. Stop its heart.', music: 'level4', final: 'heart', slots: [5, 5],
    minis: ['bladder', 'parasite', 'phagocyte'],
    foes: { drone: 'fluke', weaver: 'tapeworm', diver: 'leech', gunner: 'polyp' }, waves: { single: 4, line: 3, snake: 2, divers: 2, gunner: 2 } },
  { name: 'PRISMATIC VOID', sub: 'Beyond reality. Something divine and wrong.', music: 'level5', final: 'seraph', slots: [6, 6],
    minis: ['knight', 'choir', 'reflection'],
    foes: { drone: 'shard', weaver: 'halo', diver: 'mirror', gunner: 'cherub' }, waves: { single: 3, line: 3, snake: 3, divers: 3, gunner: 2 } },
  { name: 'BOSS RUSH', sub: 'Every horror you ever killed. One minute apart.', music: 'level1', final: 'seraph', slots: [6, 6], rush: true,
    minis: [], foes: { drone: ['drone', 'blinker', 'jelly', 'fluke', 'shard'], weaver: ['weaver', 'phaseel', 'eel', 'tapeworm', 'halo'],
                       diver: ['diver', 'streak', 'piranha', 'leech', 'mirror'], gunner: ['gunner', 'prism', 'urchin', 'polyp', 'cherub'] },
    waves: { single: 3, line: 3, snake: 3, divers: 3, gunner: 1.5 } },
];
const STAGE_COUNT = 5;                         // the campaign; STAGES[6] is the secret Boss Rush
const SECRET_STAGE = 6;
const maxStage = () => (META.secret ? SECRET_STAGE : STAGE_COUNT);
const isRush = () => !!(S && stageDef().rush);
// Boss Rush: every mini-boss and final boss in campaign order, one minute apart
const RUSH = [];
for (let i = 1; i <= STAGE_COUNT; i++) { for (const m of STAGES[i].minis) RUSH.push({ type: m, stage: i }); RUSH.push({ type: STAGES[i].final, stage: i }); }
const stageLen = () => (isRush() ? CFG.rush.first + (RUSH.length - 1) * CFG.rush.gap : CFG.level.length);
const stageDef = () => STAGES[(S && S.stage) || 1];
const stageD = () => Math.min(STAGE_COUNT, (S && S.stage) || 1) - 1;   // 0 on stage 1 ... 4 on stage 5 (and the Boss Rush)
const slotCount = () => { const sl = stageDef().slots; return { weapons: sl[0], passives: sl[1] }; };

// The enemies. r = hit size. Bosses don't leave the screen.
const ENEMY = {
  drone:   { name: 'Larva',          hp: 20,   r: 14, xp: 1,  credits: 1,   color: '#eaa0ad', blood: 'G' },
  weaver:  { name: 'Lamprey',        hp: 14,   r: 13, xp: 1,  credits: 1,   color: '#e2607f', blood: 'P' },
  diver:   { name: 'Flayer',         hp: 26,   r: 14, xp: 2,  credits: 1,   color: '#9b4dcc', blood: 'G' },
  gunner:  { name: 'Bloater',        hp: 120,  r: 24, xp: 6,  credits: 3,   color: '#cfc04a', blood: 'G' },
  brute:   { name: 'BROOD BRUTE',    hp: 2200, r: 44, xp: 25, credits: 40,  color: '#6d3a8f', blood: 'P', boss: true },
  mother:  { name: 'SPORE MOTHER',   hp: 3600, r: 48, xp: 30, credits: 60,  color: '#62b39a', blood: 'G', boss: true },
  stalker: { name: 'SCYTHE WRAITH',  hp: 5200, r: 42, xp: 35, credits: 80,  color: '#d8ccb4', blood: 'P', boss: true },
  // stage 2-5 mini-bosses (1st / 2nd / 3rd of each stage use the same base health as the stage 1 trio)
  manta:     { name: 'RIFT MANTA',      hp: 2200, r: 44, xp: 25, credits: 40, color: '#5b6bd6', blood: 'P', boss: true },
  oculus:    { name: 'FLUX OCULUS',     hp: 3600, r: 40, xp: 30, credits: 60, color: '#c86bff', blood: 'P', boss: true },
  static:    { name: 'STATIC WRAITH',   hp: 5200, r: 40, xp: 35, credits: 80, color: '#9be8ff', blood: 'P', boss: true },
  nautilus:  { name: 'DREAD NAUTILUS',  hp: 2200, r: 46, xp: 25, credits: 40, color: '#3f8f8a', blood: 'G', boss: true },
  siren:     { name: 'SIREN BLOOM',     hp: 3600, r: 46, xp: 30, credits: 60, color: '#9fd6c8', blood: 'G', boss: true },
  gulper:    { name: 'GULPER KING',     hp: 5200, r: 42, xp: 35, credits: 80, color: '#c8d0e0', blood: 'P', boss: true },
  bladder:   { name: 'BILE BLADDER',    hp: 2200, r: 46, xp: 25, credits: 40, color: '#8a2a3a', blood: 'G', boss: true },
  parasite:  { name: 'PARASITE KING',   hp: 3600, r: 42, xp: 30, credits: 60, color: '#d47a8a', blood: 'PG', boss: true },
  phagocyte: { name: 'PHAGOCYTE',       hp: 5200, r: 44, xp: 35, credits: 80, color: '#e8d8c0', blood: 'G', boss: true },
  knight:    { name: 'PRISM KNIGHT',    hp: 2200, r: 42, xp: 25, credits: 40, color: '#a88aff', blood: 'PG', boss: true },
  choir:     { name: 'HALO CHOIR',      hp: 3600, r: 46, xp: 30, credits: 60, color: '#ffd0f0', blood: 'PG', boss: true },
  reflection:{ name: 'THE REFLECTION',  hp: 5200, r: 40, xp: 35, credits: 80, color: '#e0f0ff', blood: 'PG', boss: true },
  queen:   { name: 'HIVE QUEEN',     hp: 11000, r: 66, xp: 0,  credits: 300, color: '#b0203a', blood: 'PG', boss: true, final: true },
  wyrm:    { name: 'WARP WYRM',      hp: 9000,  r: 40, xp: 0,  credits: 300, color: '#7a3cff', blood: 'P',  boss: true, final: true },
  maw:     { name: 'ABYSSAL MAW',    hp: 10000, r: 56, xp: 0,  credits: 300, color: '#2f6f7a', blood: 'G',  boss: true, final: true },
  heart:   { name: 'LEVIATHAN HEART', hp: 10000, r: 60, xp: 0, credits: 300, color: '#c2283e', blood: 'P',  boss: true, final: true },
  seraph:  { name: 'SERAPH OF THE VOID', hp: 12000, r: 58, xp: 0, credits: 500, color: '#f3ead2', blood: 'PG', boss: true, final: true },
};
// Each stage's own small enemies. They fill the same four roles as the stage 1 bugs
// (role = how they move and shoot), each with its own look, name and a twist.
const FOE = {
  drone:    { name: 'Larva',        color: '#eaa0ad', blood: 'G' },
  weaver:   { name: 'Lamprey',      color: '#e2607f', blood: 'P' },
  diver:    { name: 'Flayer',       color: '#9b4dcc', blood: 'G' },
  gunner:   { name: 'Bloater',      color: '#cfc04a', blood: 'G' },
  blinker:  { name: 'Blink Mite',   color: '#7de0ff', blood: 'P' },   // stage 2: teleports sideways once
  phaseel:  { name: 'Phase Eel',    color: '#c86bff', blood: 'P' },   // sharp zig-zags
  streak:   { name: 'Warp Streak',  color: '#ff5df0', blood: 'P' },   // faster, quicker dive
  prism:    { name: 'Prism Node',   color: '#5d9dff', blood: 'P' },   // rotating cross bursts
  jelly:    { name: 'Drift Jelly',  color: '#9fe8e0', blood: 'G' },   // stage 3: bobs, spits wobbling bubbles
  eel:      { name: 'Gulper Eel',   color: '#4fb3a0', blood: 'G' },   // wide slow swim, bubble shots
  piranha:  { name: 'Bone Piranha', color: '#e8a0c8', blood: 'P' },   // dives twice
  urchin:   { name: 'Spine Urchin', color: '#7aa0d6', blood: 'G' },   // slow rings of big bubbles
  fluke:    { name: 'Blood Fluke',  color: '#e88a8a', blood: 'P' },   // stage 4: drifts toward you
  tapeworm: { name: 'Tapeworm',     color: '#e8d0a0', blood: 'G' },   // long, spits sideways too
  leech:    { name: 'Leech',        color: '#7a3050', blood: 'P' },   // its dive homes in
  polyp:    { name: 'Polyp',        color: '#e0b060', blood: 'PG' },  // aimed fans and rings
  shard:    { name: 'Eye Shard',    color: '#b8a8ff', blood: 'PG' },  // stage 5: spinning, 3-way shots
  halo:     { name: 'Halo Chain',   color: '#ffd66a', blood: 'P' },   // rings that loop as they fall
  mirror:   { name: 'Mirror Blade', color: '#8affe0', blood: 'PG' },  // fires a fan as it dives
  cherub:   { name: 'Hollow Cherub', color: '#ffe0e8', blood: 'PG' }, // wide aimed fans
};
const BLOOD = { P: '#9b3fd6', G: '#c4cf1f' };      // purple ichor and acid-yellow-green bile (kept away from the gem mint)
const bloodOf = e => { const b = e.blood || ENEMY[e.type].blood || 'G'; return BLOOD[b.length > 1 ? pick(b.split('')) : b]; };
const LEVEL_EVENTS = () => isRush()
  ? RUSH.map((r, i) => ({ t: CFG.rush.first + i * CFG.rush.gap, type: r.type, stage: r.stage, last: i === RUSH.length - 1 }))
  : [...CFG.level.miniBosses.map((t, i) => ({ t, type: stageDef().minis[i] })), { t: CFG.level.length, type: stageDef().final, last: true }];
const enemyName = type => ENEMY[type].name;

// How much stronger your guns are than a fresh ship's (Hangar Power/Fire rate + passives).
function firepower() {
  const m = S.mod || { dmg: 1, cd: 1, count: 0, crit: 0 };
  return m.dmg * (1 / m.cd) * (1 + 0.35 * m.count) * (1 + (m.crit || 0));
}
function spawnEnemy(type, x, y, extra) {
  const d = ENEMY[type], st = stageDef(), k = stageD(), sc = CFG.stageScale;
  const bossK = d.boss ? Math.pow(Math.max(1, firepower()), CFG.bossPowerScale) : 1;
  const hp = bossK * (d.final ? d.hp * CFG.bossHpMul * (1 + sc.finalHp * k)       // bosses have fixed health per stage
           : d.boss ? d.hp * CFG.bossHpMul * CFG.miniBossHpMul * (1 + sc.bossHp * k)
           : d.hp * (1 + CFG.enemyHpGrowthPerMin * (1 + sc.hpGrowth * k) * S.t / 60) * (1 + sc.enemyHp * k));
  const fk = (st.foes || {})[type] || type, look = Array.isArray(fk) ? pick(fk) : fk;
  const foe = !d.boss && FOE[look], color = foe ? foe.color : d.color;
  const e = Object.assign({ type, x, y, hp, maxHp: hp, r: d.final ? d.r * CFG.finalBossSize : d.r,
                            look: foe ? look : type, blood: foe ? foe.blood : d.blood, xp: d.xp, credits: d.credits * (1 + sc.credits * k), color, boss: !!d.boss, final: !!d.final && (!st.rush || !!(extra && extra.last)),
                            name: foe ? foe.name : d.name,
                            age: 0, flash: 0, mode: 0, fireT: rand(0.8, 2.0), vx: 0, vy: 0 }, extra);
  S.enemies.push(e);
  return e;
}
function countType(t) { let n = 0; for (const e of S.enemies) if (e.type === t && !e.dead) n++; return n; }
const bossAlive = () => S.enemies.some(e => e.boss && !e.dead);

function spawnPattern() {
  const t = S.t;
  const wv = stageDef().waves, early = S.stage > 1 ? 0.5 : 1;   // later stages bring the nasty stuff sooner
  const options = [
    ['single', wv.single],
    ['line', t > 10 * early ? wv.line : 0],
    ['snake', t > 20 * early ? wv.snake : 0],
    ['divers', t > 45 * early ? wv.divers : 0],
    ['gunner', t > 60 * early && countType('gunner') < 1 + Math.floor(t / 150) + Math.floor(stageD() / 2) ? wv.gunner : 0],
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

function spawnBoss(type, last) {
  spawnEnemy(type, W / 2, -ENEMY[type].r * (ENEMY[type].final ? CFG.finalBossSize : 1) - 20, { ty: ENEMY[type].final ? 170 : 125, sway: 0, spin: 0, shotT: 1.5,
    spinT: 0.6, ringT: 2.5, spawnT: 3, patT: 4, phase: 1, volley: 0, ring: 0, beatT: 1, beat: 0, warpT: 6, blink: 0,
    laneT: 2, segT: 1.6, lureT: 5, lure: 0, jawT: 4, jaw: 0, featherT: 1, rainT: 0, trail: [], last: !!last });
}

// --- Boss brains. All enter from the top first (mode 0).
function bossEnter(e, dt) {
  if (e.mode !== 0) return false;
  e.y += 55 * dt;
  if (e.y >= e.ty) e.mode = 1;
  return true;
}
function bossBrute(e, dt) {         // 1st mini-boss · aimed fans, side sprays, calls in mites
  if (bossEnter(e, dt)) return;
  const angry = e.hp < e.maxHp / 2;
  e.sway += dt;
  e.x = W / 2 + Math.sin(e.sway * 0.5) * (W / 2 - 70);
  if ((e.shotT -= dt) <= 0) {
    e.shotT = angry ? 1.0 : 1.4;
    e.volley++;
    const a = aimAt(e), n = angry ? 9 : 7;
    for (let k = 0; k < n; k++) enemyShot(e.x, e.y + 30, a + (k - (n - 1) / 2) * 0.13, 1.0);
    if (e.volley % 3 === 0) for (const side of [-1, 1]) for (let j = 0; j < 3; j++) enemyShot(e.x + side * 30, e.y + 10, Math.PI / 2 + side * (0.3 + j * 0.25), 0.8);
  }
  if ((e.spawnT -= dt) <= 0) { e.spawnT = 5; for (let i = 0; i < 3; i++) spawnEnemy('drone', e.x + (i - 1) * 40, e.y + 20, { vy: 110, fireT: rand(1, 2) }); }
}
function bossMother(e, dt) {        // 2nd mini-boss · alternating spore rings, a spiral when hurt, wriggler broods
  if (bossEnter(e, dt)) return;
  e.sway += dt;
  e.x = W / 2 + Math.sin(e.sway * 0.3) * (W / 2 - 80);
  e.y = e.ty + Math.sin(e.sway * 0.8) * 12;
  if ((e.shotT -= dt) <= 0) {
    e.shotT = 1.7; e.ring++;
    const n = 16, off = e.ring % 2 ? Math.PI / n : 0;
    for (let k = 0; k < n; k++) enemyShot(e.x, e.y, off + (k / n) * TAU, 0.6);
  }
  if (e.hp < e.maxHp * 0.5 && (e.spinT -= dt) <= 0) {
    e.spinT = 0.14; e.spin += 0.45;
    enemyShot(e.x, e.y + 20, e.spin, 0.8); enemyShot(e.x, e.y + 20, e.spin + Math.PI, 0.8);
  }
  if ((e.spawnT -= dt) <= 0) {
    e.spawnT = 7;
    const bx = clamp(e.x, 80, W - 80);
    for (let i = 0; i < 4; i++) spawnEnemy('weaver', bx, e.y - i * 28, { bx, ph: 0, amp: 60, vy: 120, fireT: rand(2, 4) });
  }
}
function bossStalker(e, dt) {       // 3rd mini-boss · sweeping scythe streams, then dashes over you and slashes
  if (bossEnter(e, dt)) return;
  e.patT -= dt;
  if (e.mode === 1) {
    e.x += (W / 2 + Math.sin(e.age * 0.7) * 90 - e.x) * Math.min(1, dt * 2);
    if ((e.shotT -= dt) <= 0) {
      e.shotT = 0.09; e.spin += 0.13;
      const sweep = Math.sin(e.spin) * 0.9;
      enemyShot(e.x - 30, e.y + 12, Math.PI / 2 + sweep, 0.9);
      enemyShot(e.x + 30, e.y + 12, Math.PI / 2 - sweep, 0.9);
    }
    if (e.patT <= 0) { e.mode = 2; e.patT = 2.2; e.dashX = clamp(S.p.x, 50, W - 50); e.volley = 0; e.shotT = 0.2; }
  } else {
    e.x += (e.dashX - e.x) * Math.min(1, dt * 5);
    if (Math.abs(e.dashX - e.x) < 8 && e.volley < 3 && (e.shotT -= dt) <= 0) {
      e.shotT = 0.35; e.volley++;
      const a = aimAt(e);
      for (let k = -3; k <= 3; k++) enemyShot(e.x, e.y + 24, a + k * 0.1, 1.25);
    }
    if (e.patT <= 0) { e.mode = 1; e.patT = e.hp < e.maxHp / 2 ? 3.2 : 4.2; }
  }
}
function bossQueen(e, dt) {         // stage 1 final boss · three phases, each angrier
  if (bossEnter(e, dt)) return;
  const f = e.hp / e.maxHp, phase = f > 0.66 ? 1 : f > 0.33 ? 2 : 3;
  if (phase !== e.phase) {
    e.phase = phase;
    burst(e.x, e.y + 50, 64, phase === 2 ? 'SKREEE!' : 'RAAARGH!', COL.red);
    S.shake = 0.5; buzz(120);
    for (const b of S.ebullets) b.dead = true;
  }
  e.sway += dt;
  e.x = W / 2 + Math.sin(e.sway * 0.35) * (W / 2 - 90);
  const fast = phase === 3 ? 0.7 : 1;
  if ((e.spinT -= dt) <= 0) {                     // spiral arms
    e.spinT = 0.13 * fast; e.spin += phase === 1 ? 0.22 : -0.28;
    const arms = phase === 1 ? 3 : 4;
    for (let k = 0; k < arms; k++) enemyShot(e.x, e.y + 30, e.spin + (k * TAU) / arms, 0.7);
  }
  if ((e.shotT -= dt) <= 0) {                     // aimed claw volleys
    e.shotT = 1.6 * fast;
    const a = aimAt(e);
    for (const side of [-1, 1]) for (let k = -1; k <= 1; k++) enemyShot(e.x + side * 48, e.y + 34, a + k * 0.12, 1.15);
  }
  if (phase >= 2 && (e.ringT -= dt) <= 0) {      // rings
    e.ringT = 2.6 * fast;
    const n = 22, off = Math.random() * TAU;
    for (let k = 0; k < n; k++) enemyShot(e.x, e.y + 20, off + (k / n) * TAU, 0.65);
  }
  if ((e.spawnT -= dt) <= 0) {                    // brood
    e.spawnT = phase === 1 ? 8 : 6;
    const kind = phase === 1 ? 'drone' : 'diver';
    for (let i = 0; i < (phase === 3 ? 3 : 2); i++) spawnEnemy(kind, rand(40, W - 40), -20, kind === 'diver' ? { ty: rand(80, 200) } : { vy: 100 });
  }
}
function phaseShift(e, phase, word, color) {          // shared drama when a boss gets angrier
  if (phase === e.phase) return;
  e.phase = phase;
  burst(e.x, e.y + 40, 64, word, color || COL.red);
  S.shake = 0.5; buzz(120);
  for (const b of S.ebullets) b.dead = true;
}

// STAGE 2 · WARP WYRM: a serpent that swims a figure-eight, drops warp-lane curtains,
// shoots from its body, and teleports (with a ring blast) when it reappears.
function bossWyrm(e, dt) {
  if (e.x > -500) { e.trail.unshift([e.x, e.y]); if (e.trail.length > 150) e.trail.pop(); }
  if (bossEnter(e, dt)) return;
  const f = e.hp / e.maxHp, phase = f > 0.66 ? 1 : f > 0.33 ? 2 : 3;
  phaseShift(e, phase, phase === 2 ? 'SKRRAAAH!' : 'VRRRAAAOOOM!', '#c86bff');
  if (e.blink > 0) {                                           // mid-warp: gone from the battlefield
    if ((e.blink -= dt) <= 0) {
      e.x = rand(70, W - 70); e.y = rand(120, 230); e.trail = [];
      burst(e.x, e.y, 54, 'VWORP!', '#c86bff');
      for (let k = 0; k < 18; k++) enemyShot(e.x, e.y, (k / 18) * TAU, 0.8);
      if (phase === 3) for (let k = 0; k < 18; k++) enemyShot(e.x, e.y, ((k + 0.5) / 18) * TAU, 0.55);   // a second, slower ring
    }
    return;
  }
  e.sway += dt;
  e.x += (W / 2 + Math.sin(e.sway * 0.9) * (W / 2 - 70) - e.x) * Math.min(1, dt * 2);
  e.y += (175 + Math.sin(e.sway * 1.8) * 55 - e.y) * Math.min(1, dt * 2);
  if ((e.warpT -= dt) <= 0) { e.warpT = [0, 7, 5, 3.6][phase]; e.blink = 0.7; e.x = -999; e.y = -999; return; }
  if ((e.laneT -= dt) <= 0) {                                  // a curtain with gaps to slip through
    e.laneT = [0, 3.2, 2.4, 2.0][phase];
    const gap = rand(50, W - 50), slant = phase >= 2 && e.volley++ % 2 ? rand(-0.35, 0.35) : 0;
    for (let x = 12; x < W; x += 20) if (Math.abs(x - gap) > 34) enemyShot(x, -6, Math.PI / 2 + slant, 0.7);
  }
  if ((e.segT -= dt) <= 0) {                                   // every few body segments spit at you
    e.segT = [0, 1.7, 1.1, 0.8][phase];
    for (let i = 14; i < e.trail.length; i += 22) { const [x, y] = e.trail[i]; enemyShot(x, y, Math.atan2(S.p.y - y, S.p.x - x), 0.9); }
  }
}

// STAGE 3 · ABYSSAL MAW: an anglerfish horror. Wobbling bubble volleys, a lure that
// flashes then fires a beam of shots at you, and a ring of teeth when the jaw opens.
function bossMaw(e, dt) {
  if (bossEnter(e, dt)) return;
  const f = e.hp / e.maxHp, phase = f > 0.66 ? 1 : f > 0.33 ? 2 : 3;
  phaseShift(e, phase, phase === 2 ? 'GRRRLLBLUB!' : 'BLUOOOORGH!!', '#2f6f7a');
  e.sway += dt;
  e.x = W / 2 + Math.sin(e.sway * 0.35) * (W / 2 - 90);
  e.y = e.ty + Math.sin(e.sway * 0.9) * 10;
  e.jaw = Math.max(0, e.jaw - dt * 1.5);
  if ((e.shotT -= dt) <= 0) {                                  // bubbles drift and sway
    e.shotT = [0, 1.4, 1.0, 0.8][phase];
    const n = [0, 5, 7, 9][phase];
    for (let k = 0; k < n; k++) enemyShot(e.x + (k - (n - 1) / 2) * 14, e.y + 40, Math.PI / 2 + (k - (n - 1) / 2) * 0.22, 0.45, { r: 7, wob: 46, wf: 2.6 + k * 0.3 });
  }
  if (e.lure > 0) {                                            // the lure flashes, then fires its beam
    e.lure -= dt;
    if (e.lure < 0.5 && (e.spinT -= dt) <= 0) {
      e.spinT = 0.035;
      enemyShot(e.x + Math.sin(e.age * 2) * 26, e.y + e.r * 1.43, e.lureA, 1.45);
    }
  } else if ((e.lureT -= dt) <= 0) {
    e.lureT = [0, 6, 4.5, 3.4][phase]; e.lure = 1.5; e.spinT = 0;
    e.lureA = Math.atan2(S.p.y - (e.y + e.r * 1.43), S.p.x - e.x);
  }
  if ((e.jawT -= dt) <= 0) {                                   // jaw snaps: a ring of teeth
    e.jawT = [0, 4.5, 3.4, 2.8][phase]; e.jaw = 1;
    const n = 20, off = Math.random() * TAU;
    for (let k = 0; k < n; k++) enemyShot(e.x, e.y + 30, off + (k / n) * TAU, 0.7);
    if (phase === 3) for (let k = 0; k < n; k++) enemyShot(e.x, e.y + 30, off + ((k + 0.5) / n) * TAU, 0.45);   // teeth behind the teeth
  }
  if (phase >= 2 && (e.spawnT -= dt) <= 0) {
    e.spawnT = phase === 3 ? 4.5 : 6;
    const bx = clamp(e.x, 80, W - 80);
    for (let i = 0; i < 3; i++) spawnEnemy('weaver', bx, e.y - i * 28, { bx, ph: 0, amp: 70, vy: 120, fireT: rand(2, 4) });
  }
}

// STAGE 4 · LEVIATHAN HEART: every heartbeat is a ring of shots; it beats faster
// as it weakens; its arteries spray streams; it pumps out blood-cell larvae.
function bossHeart(e, dt) {
  if (bossEnter(e, dt)) return;
  const f = e.hp / e.maxHp, phase = f > 0.66 ? 1 : f > 0.33 ? 2 : 3;
  phaseShift(e, phase, phase === 2 ? 'THU-THUMP!' : 'BA-BOOM!!', '#c2283e');
  e.sway += dt;
  e.x = W / 2 + Math.sin(e.sway * 0.4) * (W / 2 - 110);
  e.beat = Math.max(0, e.beat - dt * 3);
  if ((e.beatT -= dt) <= 0) {
    e.beatT = [0, 1.1, 0.85, 0.65][phase]; e.beat = 1; e.volley++;
    const n = 12 + phase * 4, off = e.volley * 0.17;
    for (let k = 0; k < n; k++) enemyShot(e.x, e.y + 10, off + (k / n) * TAU, 0.6);
    if (e.volley % 3 === 0) { const a = aimAt(e); for (let k = -2; k <= 2; k++) enemyShot(e.x, e.y + 40, a + k * 0.12, 1.05); }
    if (phase === 3 && e.volley % 2 === 0) for (let k = 0; k < n; k++) enemyShot(e.x, e.y + 10, off + ((k + 0.5) / n) * TAU, 0.9);
  }
  if (phase >= 2 && (e.spinT -= dt) <= 0) {                    // arteries spray
    e.spinT = 0.11; e.spin += 0.3;
    enemyShot(e.x - 40, e.y - 30, e.spin, 0.8); enemyShot(e.x + 40, e.y - 30, Math.PI - e.spin, 0.8);
  }
  if ((e.spawnT -= dt) <= 0) {
    e.spawnT = phase === 3 ? 4.5 : 7;
    for (let i = 0; i < 3; i++) spawnEnemy('drone', e.x + (i - 1) * 50, e.y + 50, { vy: 120, fireT: rand(1, 2) });
  }
}

// STAGE 5 · SERAPH OF THE VOID: the final boss. Three phases, each a different nightmare:
// feather fans and slow halos, then rotating prism beams, then everything at once.
function bossSeraph(e, dt) {
  if (bossEnter(e, dt)) return;
  const f = e.hp / e.maxHp, phase = f > 0.66 ? 1 : f > 0.33 ? 2 : 3;
  phaseShift(e, phase, phase === 2 ? 'KNEEL.' : 'I AM ENDLESS!', phase === 2 ? COL.gold : COL.red);
  e.sway += dt;
  e.x = W / 2 + Math.sin(e.sway * 0.3) * (W / 2 - 100);
  e.y = e.ty + Math.sin(e.sway * 0.7) * 12;
  if (phase === 1) {
    if ((e.featherT -= dt) <= 0) {                             // feather fans: aimed, then wide
      e.featherT = 1.2; e.volley++;
      const a = aimAt(e), wide = e.volley % 2 === 0, n = wide ? 13 : 7, step = wide ? 0.2 : 0.09;
      for (let k = 0; k < n; k++) enemyShot(e.x, e.y + 20, a + (k - (n - 1) / 2) * step, wide ? 0.7 : 1.05);
    }
    if ((e.ringT -= dt) <= 0) { e.ringT = 3; const n = 24, off = Math.random() * TAU; for (let k = 0; k < n; k++) enemyShot(e.x, e.y, off + (k / n) * TAU, 0.5); }
  } else if (phase === 2) {
    e.spin += dt * 0.45;                                       // four rotating prism beams
    if ((e.spinT -= dt) <= 0) { e.spinT = 0.075; for (let k = 0; k < 4; k++) enemyShot(e.x, e.y, e.spin + (k * TAU) / 4, 1.2); }
    if ((e.ringT -= dt) <= 0) { e.ringT = 2.4; const n = 20, off = Math.random() * TAU; for (let k = 0; k < n; k++) enemyShot(e.x, e.y, off + (k / n) * TAU, 0.6); }
    if ((e.featherT -= dt) <= 0) { e.featherT = 2; const a = aimAt(e); for (let k = -2; k <= 2; k++) enemyShot(e.x, e.y + 20, a + k * 0.1, 1.15); }
  } else {
    e.spin += dt * 0.6;                                        // desperation: twin counter-spirals and a feather rain
    if ((e.spinT -= dt) <= 0) {
      e.spinT = 0.1;
      for (let k = 0; k < 5; k++) { enemyShot(e.x, e.y, e.spin + (k * TAU) / 5, 0.75); enemyShot(e.x, e.y, -e.spin * 1.3 + (k * TAU) / 5, 0.6); }
    }
    if ((e.rainT -= dt) <= 0) { e.rainT = 0.16; enemyShot(rand(10, W - 10), -6, Math.PI / 2 + rand(-0.15, 0.15), 0.65); }
    if ((e.featherT -= dt) <= 0) { e.featherT = 1.1; const a = aimAt(e); for (let k = -3; k <= 3; k++) enemyShot(e.x, e.y + 20, a + k * 0.08, 1.2); }
  }
}

// ---- Stage 2-5 mini-bosses: each stage has its own three. All have an angry second half.
const ring = (x, y, n, sp, off, extra) => { for (let k = 0; k < n; k++) enemyShot(x, y, (off || 0) + (k / n) * TAU, sp, extra); };
const fan = (x, y, a, n, step, sp, extra) => { for (let k = 0; k < n; k++) enemyShot(x, y, a + (k - (n - 1) / 2) * step, sp, extra); };
const tick = (e, key, every) => { if ((e[key] = (e[key] === undefined ? every : e[key]) - S.dtNow) <= 0) { e[key] = every; return true; } return false; };
const angryOf = e => e.hp < e.maxHp / 2;
function bossGlide(e, speed, margin, bob) {
  e.sway += S.dtNow;
  e.x = W / 2 + Math.sin(e.sway * speed) * (W / 2 - margin);
  e.y = e.ty + Math.sin(e.sway * 0.9) * (bob || 0);
}

// STAGE 2
function bossManta(e, dt) {        // RIFT MANTA: glides, drops curtains, wingtip streams, warps when hurt
  if (bossEnter(e, dt)) return;
  const angry = angryOf(e); bossGlide(e, 0.45, 70, 8);
  if (tick(e, 'laneT', angry ? 2.4 : 3.2)) { const gap = rand(50, W - 50); for (let x = 12; x < W; x += 22) if (Math.abs(x - gap) > 36) enemyShot(x, -6, Math.PI / 2, 0.65); }
  if (tick(e, 'spinT', angry ? 0.1 : 0.16)) { e.spin += 0.18; for (const sd of [-1, 1]) enemyShot(e.x + sd * 50, e.y + 6, Math.PI / 2 + sd * Math.sin(e.spin) * 0.7, 0.9); }
  if (angry && tick(e, 'warpT', 5)) { burst(e.x, e.y, 50, 'VWORP!', e.color); e.sway += rand(1.5, 3); bossGlide(e, 0.45, 70, 8); ring(e.x, e.y, 16, 0.75); }
}
function bossOculus(e, dt) {       // FLUX OCULUS: a giant eye; orbiting crystals shoot at you, it spirals when hurt
  if (bossEnter(e, dt)) return;
  const angry = angryOf(e); bossGlide(e, 0.3, 90, 14);
  e.spin += dt * (angry ? 1.3 : 0.9);
  const n = angry ? 5 : 3;
  if (tick(e, 'shotT', angry ? 0.9 : 1.3)) for (let k = 0; k < n; k++) {
    const a = e.spin + (k / n) * TAU, ox = e.x + Math.cos(a) * 62, oy = e.y + Math.sin(a) * 62;
    enemyShot(ox, oy, Math.atan2(S.p.y - oy, S.p.x - ox), 1.0);
  }
  if (tick(e, 'ringT', 2.6)) ring(e.x, e.y, 18, 0.6, Math.random());
  if (angry && tick(e, 'beamT', 0.12)) { e.ang = (e.ang || 0) + 0.25; enemyShot(e.x, e.y, e.ang, 0.85); enemyShot(e.x, e.y, e.ang + Math.PI, 0.85); }
}
function bossStatic(e, dt) {       // STATIC WRAITH: flickers between spots and fires from its ghost copies too
  if (bossEnter(e, dt)) return;
  const angry = angryOf(e);
  if (!e.ghosts) e.ghosts = [];
  if (tick(e, 'warpT', angry ? 2.2 : 3)) {
    sparks(e.x, e.y, e.color, 20);
    e.ghosts = [[e.x, e.y]]; if (angry) e.ghosts.push([W - e.x, e.y + 30]);
    e.x = rand(70, W - 70); e.y = rand(100, 200); e.flick = 0.25;
  }
  e.flick = Math.max(0, (e.flick || 0) - dt);
  if (tick(e, 'shotT', angry ? 0.8 : 1.1)) {
    const a = aimAt(e); fan(e.x, e.y + 20, a, 5, 0.12, 1.1);
    for (const [gx, gy] of e.ghosts) fan(gx, gy, Math.atan2(S.p.y - gy, S.p.x - gx), 3, 0.2, 0.8);
  }
  if (tick(e, 'laneT', 2.8)) for (let x = 20; x < W; x += 40) enemyShot(x + rand(-8, 8), -6, Math.PI / 2, 0.7, { r: 5 });   // static rain
}
// STAGE 3
function bossNautilus(e, dt) {     // DREAD NAUTILUS: a spiral shell that spits spiral arms and slow ink blobs
  if (bossEnter(e, dt)) return;
  const angry = angryOf(e); bossGlide(e, 0.35, 80, 10);
  if (tick(e, 'spinT', angry ? 0.09 : 0.13)) { e.spin += 0.31; enemyShot(e.x, e.y, e.spin, 0.7); if (angry) enemyShot(e.x, e.y, -e.spin + 1, 0.7); }
  if (tick(e, 'shotT', angry ? 2 : 2.8)) fan(e.x, e.y + 30, aimAt(e), 3, 0.35, 0.45, { r: 10, wob: 20, wf: 2 });   // ink blobs
  if (tick(e, 'spawnT', 7)) for (let i = 0; i < 3; i++) spawnEnemy('drone', e.x + (i - 1) * 40, e.y + 20, { vy: 100 });
}
function bossSiren(e, dt) {        // SIREN BLOOM: sings waves of swaying bubbles, calls jellies, a lure-burst when hurt
  if (bossEnter(e, dt)) return;
  const angry = angryOf(e); bossGlide(e, 0.25, 100, 8);
  if (tick(e, 'shotT', angry ? 0.5 : 0.7)) { e.volley++; for (let k = -2; k <= 2; k++) enemyShot(e.x + k * 22, e.y + 30, Math.PI / 2, 0.5, { r: 6, wob: 55, wf: 2.2, age: e.volley * 0.7 }); }
  if (tick(e, 'spawnT', angry ? 5 : 7)) for (let i = 0; i < 2; i++) spawnEnemy('drone', rand(40, W - 40), -20, { vy: 80 });
  if (angry && tick(e, 'ringT', 3)) { ring(e.x, e.y, 14, 0.5, Math.random(), { acc: 1.2, vmax: 260 }); }
}
function bossGulper(e, dt) {       // GULPER KING: lunges down at you jaws first, fans of teeth on the way back
  if (bossEnter(e, dt)) return;
  const angry = angryOf(e);
  e.patT -= dt;
  if (e.mode === 1) {
    e.x += (W / 2 + Math.sin(e.age * 0.6) * 100 - e.x) * Math.min(1, dt * 2);
    e.y += (e.ty - e.y) * Math.min(1, dt * 3);
    if (tick(e, 'shotT', angry ? 1 : 1.4)) fan(e.x, e.y + 30, aimAt(e), angry ? 9 : 7, 0.14, 0.9);
    if (e.patT <= 0) { e.mode = 2; e.patT = 1.1; e.dashX = clamp(S.p.x, 50, W - 50); e.dashY = Math.min(S.p.y - 120, H * 0.55); burst(e.x, e.y + 40, 40, 'GULP!', e.color); }
  } else {
    e.x += (e.dashX - e.x) * Math.min(1, dt * 4); e.y += (e.dashY - e.y) * Math.min(1, dt * 4);
    if (e.patT <= 0) { e.mode = 1; e.patT = angry ? 3 : 4.5; ring(e.x, e.y, angry ? 20 : 14, 0.7); }
  }
}
// STAGE 4
function bossBladder(e, dt) {      // BILE BLADDER: swells up, then bursts lobbed acid and accelerating rings
  if (bossEnter(e, dt)) return;
  const angry = angryOf(e); bossGlide(e, 0.4, 80, 6);
  e.swell = Math.min(1, (e.swell || 0) + dt / (angry ? 2 : 3));
  if (e.swell >= 1) {
    e.swell = 0; S.shake = Math.max(S.shake, 0.25); burst(e.x, e.y + 30, 44, 'BLORP!', '#c4cf1f');
    for (let k = 0; k < (angry ? 14 : 10); k++) enemyShot(e.x, e.y, -Math.PI / 2 + rand(-1.1, 1.1), rand(0.9, 1.5), { grav: 220, r: 6 });
    ring(e.x, e.y, angry ? 20 : 14, 0.35, Math.random(), { acc: 1.5, vmax: 240 });
  }
  if (tick(e, 'shotT', 1.6)) fan(e.x, e.y + 30, aimAt(e), 3, 0.1, 1.0);
}
function bossParasite(e, dt) {     // PARASITE KING: whipping tail-arms of bullets, sheds flukes
  if (bossEnter(e, dt)) return;
  const angry = angryOf(e); bossGlide(e, 0.3, 90, 10);
  e.spin += dt * (angry ? 1.6 : 1.1) * (Math.sin(e.age * 0.4) > 0 ? 1 : -1);
  if (tick(e, 'spinT', angry ? 0.11 : 0.15)) { const arms = angry ? 4 : 3; for (let k = 0; k < arms; k++) enemyShot(e.x, e.y + 10, e.spin + (k / arms) * TAU, 0.75); }
  if (tick(e, 'spawnT', angry ? 4.5 : 6.5)) for (let i = 0; i < 3; i++) spawnEnemy('drone', e.x + (i - 1) * 40, e.y + 30, { vy: 95 });
  if (tick(e, 'shotT', 2.2)) fan(e.x, e.y + 30, aimAt(e), 5, 0.1, 1.1);
}
function bossPhagocyte(e, dt) {    // PHAGOCYTE: an immune cell that hunts you, engulfs and bursts
  if (bossEnter(e, dt)) return;
  const angry = angryOf(e);
  e.patT -= dt;
  if (e.mode === 1) {
    e.x += (clamp(S.p.x, 60, W - 60) - e.x) * Math.min(1, dt * 0.8);
    e.y += (e.ty - e.y) * Math.min(1, dt * 2);
    if (tick(e, 'shotT', angry ? 0.18 : 0.26)) { e.spin += 0.5; enemyShot(e.x, e.y, e.spin, 0.55, { acc: 0.9, vmax: 230 }); }
    if (e.patT <= 0) { e.mode = 2; e.patT = 1.3; e.dashX = clamp(S.p.x, 50, W - 50); e.dashY = Math.min(S.p.y - 110, H * 0.6); }
  } else {
    e.x += (e.dashX - e.x) * Math.min(1, dt * 3.5); e.y += (e.dashY - e.y) * Math.min(1, dt * 3.5);
    if (e.patT <= 0) { e.mode = 1; e.patT = angry ? 3.2 : 4.6; burst(e.x, e.y, 44, 'SPLURCH!', e.color); ring(e.x, e.y, angry ? 24 : 16, 0.8); }
  }
}
// STAGE 5
function bossKnight(e, dt) {       // PRISM KNIGHT: sword sweeps leave arcs of glass, then a lunge
  if (bossEnter(e, dt)) return;
  const angry = angryOf(e); bossGlide(e, 0.4, 80, 6);
  if (tick(e, 'patT', angry ? 1.6 : 2.2)) { e.swing = 0.6; e.swDir = e.swDir === 1 ? -1 : 1; }
  if (e.swing > 0) {
    e.swing -= dt;
    if (tick(e, 'spinT', 0.03)) { const a = Math.PI / 2 + e.swDir * (e.swing / 0.6 - 0.5) * 2.4; enemyShot(e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40, a, 0.75); if (angry) enemyShot(e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40, a, 1.1); }
  }
  if (tick(e, 'shotT', angry ? 1.4 : 2)) fan(e.x, e.y + 20, aimAt(e), 3, 0.06, 1.35);
}
function bossChoir(e, dt) {        // HALO CHOIR: three masks sing in turn; all together when hurt
  if (bossEnter(e, dt)) return;
  const angry = angryOf(e); bossGlide(e, 0.25, 100, 12);
  if (tick(e, 'shotT', angry ? 0.45 : 0.6)) {
    e.volley++;
    const sing = angry ? [0, 1, 2] : [e.volley % 3];
    for (const i of sing) {
      const mx = e.x + (i - 1) * 42, my = e.y + (i === 1 ? -10 : 8);
      if (i === 1) ring(mx, my, 12, 0.6, e.volley * 0.2); else fan(mx, my, Math.atan2(S.p.y - my, S.p.x - mx), 3, 0.15, 0.95);
    }
  }
  if (tick(e, 'ringT', 4)) ring(e.x, e.y, 30, 0.45, 0, { acc: 0.7, vmax: 200 });
}
function bossReflection(e, dt) {   // THE REFLECTION: mirrors your moves and fires your own aim back at you
  if (bossEnter(e, dt)) return;
  const angry = angryOf(e);
  e.x += (clamp(W - S.p.x, 50, W - 50) - e.x) * Math.min(1, dt * 2.5);
  e.y = e.ty + Math.sin(e.age) * 14;
  if (tick(e, 'shotT', angry ? 0.5 : 0.75)) { enemyShot(e.x, e.y + 20, aimAt(e), 1.2); enemyShot(W - e.x, e.y + 20, Math.atan2(S.p.y - e.y, S.p.x - (W - e.x)), 1.2, { r: 5 }); }
  if (tick(e, 'laneT', angry ? 2.2 : 3)) { const gap = W - clamp(S.p.x, 40, W - 40); for (let x = 12; x < W; x += 22) if (Math.abs(x - gap) > 34) enemyShot(x, -6, Math.PI / 2, 0.6); }
  if (angry && tick(e, 'ringT', 2.5)) ring(e.x, e.y, 16, 0.7, Math.random());
}
const BOSS_BRAIN = { brute: bossBrute, mother: bossMother, stalker: bossStalker, queen: bossQueen,
                     manta: bossManta, oculus: bossOculus, static: bossStatic, nautilus: bossNautilus, siren: bossSiren, gulper: bossGulper,
                     bladder: bossBladder, parasite: bossParasite, phagocyte: bossPhagocyte, knight: bossKnight, choir: bossChoir, reflection: bossReflection,
                     wyrm: bossWyrm, maw: bossMaw, heart: bossHeart, seraph: bossSeraph };

function enemyShot(x, y, angle, speedMul, extra) {
  const sp = CFG.enemyBulletSpeed * Math.min(CFG.enemyBulletSpeedMax, 1 + S.t / stageLen()) * (1 + CFG.stageScale.bulletSpeed * stageD()) * (speedMul || 1);
  const b = { x, y, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp, r: 4 };
  S.ebullets.push(extra ? Object.assign(b, extra, { age: 0 }) : b);
}
function aimAt(e) { return Math.atan2(S.p.y - e.y, S.p.x - e.x); }

function updateEnemy(e, dt) {
  const p = S.p;
  S.dtNow = dt;
  e.age += dt;
  e.flash = Math.max(0, e.flash - dt);
  switch (e.type) {
    case 'drone': {
      const lk = e.look;
      e.y += e.vy * (lk === 'blinker' ? 1.2 : lk === 'jelly' ? 0.75 : 1) * dt;
      if (lk === 'blinker' && !e.blinked && e.y > (e.by || (e.by = rand(70, 220)))) {        // warps sideways once
        e.blinked = 1; sparks(e.x, e.y, e.color, 6);
        e.x = clamp(e.x + (Math.random() < 0.5 ? -1 : 1) * rand(60, 110), 20, W - 20); sparks(e.x, e.y, e.color, 6);
        e.fireT = Math.min(e.fireT, 0.35);
      }
      if (lk === 'jelly') { if (e.x0 === undefined) e.x0 = e.x; e.x = clamp(e.x0 + Math.sin(e.age * 1.6 + e.x0) * 26, 14, W - 14); }
      if (lk === 'fluke') e.x += clamp(p.x - e.x, -1, 1) * 38 * dt;                          // drifts toward you
      if ((e.fireT -= dt * S.fireMul) <= 0 && e.y > 10 && e.y < H * 0.65) {
        e.fireT = rand(1.6, 2.8);
        const a = aimAt(e);
        if (lk === 'jelly') enemyShot(e.x, e.y + 8, a, 0.7, { r: 6, wob: 34, wf: 3 });
        else if (lk === 'shard') { e.fireT += 0.8; for (let k = -1; k <= 1; k++) enemyShot(e.x, e.y + 8, a + k * 0.22, 0.95); }
        else enemyShot(e.x, e.y + 8, a + rand(-0.08, 0.08));
      }
      break;
    }
    case 'weaver': {
      const lk = e.look;
      e.y += e.vy * (lk === 'eel' ? 0.8 : 1) * dt;
      e.x = weaverX(e, e.age);
      if (lk === 'halo') e.y += Math.cos(e.age * 2.4 + e.ph) * e.amp * 2.4 * dt;                      // loops as it falls
      if ((e.fireT -= dt * S.fireMul) <= 0 && e.y > 10 && e.y < H * 0.6) {
        e.fireT = rand(2.5, 4);
        if (lk === 'eel') enemyShot(e.x, e.y + 8, Math.PI / 2, 0.75, { r: 6, wob: 30, wf: 2.6 });
        else if (lk === 'tapeworm') { enemyShot(e.x, e.y + 8, Math.PI / 2); enemyShot(e.x, e.y, 0.35, 0.7); enemyShot(e.x, e.y, Math.PI - 0.35, 0.7); }
        else if (lk === 'halo') enemyShot(e.x, e.y + 8, aimAt(e), 0.9);
        else enemyShot(e.x, e.y + 8, Math.PI / 2);
      }
      break;
    }
    case 'diver': {
      const lk = e.look, dash = lk === 'streak' ? 470 : lk === 'leech' ? 300 : 360;
      if (e.mode === 0) { e.y += 140 * dt; if (e.y >= e.ty) { e.mode = 1; e.wait = lk === 'streak' ? 0.45 : 0.7; } }
      else if (e.mode === 1) {
        if ((e.wait -= dt) <= 0) {
          const a = aimAt(e); e.vx = Math.cos(a) * dash; e.vy = Math.sin(a) * dash; e.mode = 2; e.dashT = 0;
          if (lk === 'mirror') for (let k = -2; k <= 2; k++) enemyShot(e.x, e.y, a + k * 0.28, 0.8);   // a fan of glass
        }
      } else {
        e.dashT += dt;
        if (lk === 'leech' && e.dashT < 1.3) {                                                        // its dive homes in
          const want = aimAt(e), cur = Math.atan2(e.vy, e.vx);
          let d = want - cur; d = Math.atan2(Math.sin(d), Math.cos(d));
          const na = cur + clamp(d, -2.2 * dt, 2.2 * dt); e.vx = Math.cos(na) * dash; e.vy = Math.sin(na) * dash;
        }
        if (lk === 'piranha' && !e.second && e.dashT > 0.55 && e.y < H - 60) { e.second = 1; e.mode = 1; e.wait = 0.35; }   // bites twice
        e.x += e.vx * dt; e.y += e.vy * dt;
      }
      break;
    }
    case 'gunner':
      if (e.mode === 0) { e.y += 70 * dt; if (e.y >= e.ty) e.mode = 1; }
      else if (e.mode === 1) {
        e.x += e.vx * dt;
        if (e.x < 30) { e.x = 30; e.vx = Math.abs(e.vx); }
        if (e.x > W - 30) { e.x = W - 30; e.vx = -Math.abs(e.vx); }
        if ((e.fireT -= dt * S.fireMul) <= 0) gunnerFire(e);
        if (e.age > 14) e.mode = 2;
      } else e.y += 80 * dt;
      break;
    default:
      if (BOSS_BRAIN[e.type]) BOSS_BRAIN[e.type](e, dt);
      break;
  }
  if (!e.boss && (e.y > H + 40 || e.x < -60 || e.x > W + 60)) e.dead = true;   // escaped: no XP, no bounty

  // Ramming the player hurts both of you.
  const dx = e.x - p.x, dy = e.y - p.y, rr = e.r + 6;
  if (!e.dead && dx * dx + dy * dy < rr * rr) {
    if (damagePlayer()) hitEnemy(e, 60, false);
  }
}

function weaverX(e, t) {           // where a worm is sideways at time t (its body follows the same path)
  if (e.bx === undefined) return e.x;
  const ph = t * 2.4 + e.ph, lk = e.look;
  const x = lk === 'phaseel' ? e.bx + (2 / Math.PI) * Math.asin(Math.sin(ph * 1.3)) * e.amp   // sharp zig-zag
          : lk === 'eel' ? e.bx + Math.sin(ph * 0.6) * e.amp * 1.5                           // wide, slow swim
          : e.bx + Math.sin(ph) * e.amp;
  return clamp(x, 10, W - 10);
}
function gunnerFire(e) {            // each stage's big shooter has its own pattern
  const n = 10 + 2 * Math.floor(S.t / 120), off = Math.random() * TAU, a = aimAt(e);
  e.fireT = 2.2; e.volley = (e.volley || 0) + 1;
  switch (e.look) {
    case 'prism':                   // rotating crosses, quicker
      e.fireT = 1.3;
      for (let i = 0; i < 8; i++) enemyShot(e.x, e.y, e.volley * 0.21 + (i / 8) * TAU, 0.85);
      break;
    case 'urchin':                  // slow rings of big wobbling bubbles
      e.fireT = 2.6;
      for (let i = 0; i < n - 2; i++) enemyShot(e.x, e.y, off + (i / (n - 2)) * TAU, 0.5, { r: 6, wob: 20, wf: 2 + (i % 3) });
      break;
    case 'polyp':                   // aimed fans, a ring every other volley
      e.fireT = 1.8;
      for (let k = -3; k <= 3; k++) enemyShot(e.x, e.y + 10, a + k * 0.13, 0.9);
      if (e.volley % 2 === 0) for (let i = 0; i < n; i++) enemyShot(e.x, e.y, off + (i / n) * TAU, 0.6);
      break;
    case 'cherub':                  // wide aimed fans that alternate with tight ones
      e.fireT = 1.6;
      { const wide = e.volley % 2, m = wide ? 11 : 5, step = wide ? 0.2 : 0.07;
        for (let k = 0; k < m; k++) enemyShot(e.x, e.y + 10, a + (k - (m - 1) / 2) * step, wide ? 0.7 : 1.1); }
      break;
    default:
      for (let i = 0; i < n; i++) enemyShot(e.x, e.y, off + (i / n) * TAU, 0.8);
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
  const big = e.boss;
  if (big) { S.bossKills = (S.bossKills || 0) + 1; S.bossStage = Math.max(S.bossStage || 0, Math.min(STAGE_COUNT, S.stage)); }
  comicKill(e, big);
  snd(big ? 'bossDie' : 'kill', e.r);
  sparks(e.x, e.y, e.color, big ? 80 : e.type === 'gunner' ? 30 : 14);
  sparks(e.x, e.y, '#ffffff', big ? 30 : 5);
  if (big) {
    S.shake = 0.6; buzz(200);
    S.novas.push({ x: e.x, y: e.y, r: 0, max: 140, dmg: 0, age: 0, hit: null, color: e.color });
    for (const b of S.ebullets) b.dead = true;   // boss down: clear the screen
    if (e.final) {                               // stage clear! the rest of the swarm dies with it
      S.victoryT = 2.8; S.p.invuln = 99;
      for (const o of S.enemies) if (!o.dead && o !== e) killEnemy(o);
    }
  }
  // Bounty
  const c = e.credits * S.mod.credit * CFG.bountyRate;
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
  if (p.invuln > 0 || S.phase > 0 || p.ghost > 0) return false;
  if (p.bubble) {                       // Deflector Shield soaks one hit, then recharges
    p.bubble = false; p.bubbleT = shieldRecharge(); p.invuln = 0.6; snd('shield');
    sparks(p.x, p.y, '#6bd6ff', 18); buzz(40);
    clearBulletsNear(p.x, p.y, 40);
    return true;
  }
  p.hp--;
  snd('hit');
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
const SPLATS_SMALL = ['SPLAT!', 'SPLUT!', 'GLORP!'], SPLATS_MED = ['SPLORCH!', 'SQUELCH!', 'SPLAT!'];
function burst(x, y, size, word, color, splat) {
  if (S.bursts.length > 14) return;
  S.bursts.push({ x, y, size, word, age: 0, life: word ? 0.75 : 0.3, rot: rand(-0.3, 0.3), color: color || COL.gold,
                  spikes: word ? 12 : 9, splat: !!splat, seed: Math.random() * 10 });
}
function comicKill(e, big) {
  const blood = bloodOf(e), wet = Math.random() < 0.5;   // half the words are splats
  if (big) burst(e.x, e.y, e.final ? 130 : 95, e.final ? (e.type === 'seraph' ? 'SHATTER!!' : 'KA-SPLAT!!') : wet ? 'SPLOOORCH!' : 'KA-BOOM!', wet ? blood : COL.gold, wet);
  else if (e.type === 'gunner') burst(e.x, e.y, 46, wet ? pick(SPLATS_MED) : pick(WORDS_MED), wet ? blood : COL.gold, wet);
  else if (Math.random() < 0.18 && S.bursts.filter(b => b.word).length < 3) burst(e.x, e.y, 30, wet ? pick(SPLATS_SMALL) : pick(WORDS_SMALL), wet ? blood : COL.gold, wet);
  else burst(e.x, e.y, e.r * 1.4, null, blood, true);
  gore(e, blood, big);
}
// Blood: a spray of droplets that slow down and shrink, plus a stain that drifts off with the background.
function gore(e, color, big) {
  const n = big ? 34 : e.type === 'gunner' ? 16 : 9;
  for (let i = 0; i < n && S.gibs.length < 260; i++) {
    const a = Math.random() * TAU, sp = rand(40, big ? 260 : 170);
    S.gibs.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(1.4, big ? 4.5 : 3), age: 0, life: rand(0.35, 0.8), color });
  }
  if (S.splats.length >= 28) S.splats.shift();
  S.splats.push({ x: e.x, y: e.y, r: e.r * (big ? 1.4 : 1.1), seed: Math.random() * 10, age: 0, life: big ? 5 : 2.6, color });
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
  for (const g of S.gibs) { g.age += dt; g.x += g.vx * dt; g.y += g.vy * dt; g.vx *= 0.92; g.vy *= 0.92; if (g.age > g.life) g.dead = true; }
  for (const sp of S.splats) { sp.age += dt; sp.y += 30 * dt; if (sp.age > sp.life || sp.y > H + 60) sp.dead = true; }
  compact(S.gibs); compact(S.splats);
  compact(S.parts); compact(S.texts); compact(S.zaps); compact(S.bursts);
}

function bankCredits() {              // credits are banked at every stage clear, so a later death can't lose them
  const earned = Math.floor(S.credits) - S.banked;
  S.banked += earned; META.bank += earned;
  return earned;
}
function levelComplete() {
  S.won = true;
  S.state = 'won';
  S.uiLock = 1.0; S.laser = null;
  music('stop'); snd('victory');
  S.earned = bankCredits();
  S.newBest = S.runT > META.best;
  if (S.newBest) META.best = S.runT;
  META.clears = (META.clears || 0) + 1;
  META.unlocked = Math.min(STAGE_COUNT, Math.max(META.unlocked || 1, S.stage + 1));
  META.cleared = META.cleared || {};
  META.cleared[S.stage] = true;
  if (S.stage === STAGE_COUNT) META.beatGame = true;
  if (S.stage === STAGE_COUNT && S.p.hp >= S.p.maxHp && !META.secret) { META.secret = true; S.secretFound = true; }   // flawless finale
  if (S.stage === STAGE_COUNT && META.secret) S.secretOpen = true;
  revealPilot();
  saveMeta();
  startReveal();
}

function gameOver(quit) {
  S.state = 'over';
  S.quit = quit;
  music('stop');
  snd(S.won ? 'victory' : quit ? 'click' : 'gameover');
  S.uiLock = 1.0;
  S.laser = null;
  if (!quit) { sparks(S.p.x, S.p.y, COL.player, 60); sparks(S.p.x, S.p.y, COL.flame, 40); }
  S.earned = bankCredits();
  S.newBest = S.runT > META.best;
  if (S.newBest) META.best = S.runT;
  revealPilot();
  saveMeta();
  startReveal();
}

// Carry the whole run into the next stage: loadout, levels, pilot level and ultimate all stay.
// You're healed, your ultimate is recharged, and you get one more slot of each kind.
function nextStage() {
  if (S.stage >= STAGE_COUNT && !(S.stage === STAGE_COUNT && META.secret)) return;
  S.stage++;
  Object.assign(S, {
    state: 'play', won: false, t: 0, ev: 0, warned: false, warn: 0, queenUp: false, victoryT: 0,
    spawnT: CFG.spawn.graceTime, intro: 3.2, uiLock: 0, choices: null, shake: 0,
    bullets: [], ebullets: [], enemies: [], orbs: [], parts: [], novas: [], zaps: [], texts: [], bursts: [], gibs: [], splats: [],
    laser: null, holes: null, barrage: null, overdrive: 0, warp: 0, phase: 0, whiteout: 0, rushStage: 0, encore: 0, fallout: 0,
    secretFound: false, secretOpen: false,
  });
  S.fireMul = 1 + CFG.stageScale.fire * stageD();
  recalcMods();
  const p = S.p;
  p.hp = p.maxHp; p.invuln = 2; p.x = p.tx = W / 2; p.y = p.ty = H * 0.78;
  if (ML('deflector')) p.bubble = true;
  if (S.ult) S.ult.cd = 0;
  input.dx = input.dy = 0;
  META.lastStage = S.stage; saveMeta();
  music('start', stageDef().music);
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
  if (S.ult && S.choiceLevel > CFG.ultLevel && S.choiceLevel % CFG.ultUpgradeEvery === 0) {
    const ups = ultUpgradeChoices();
    if (ups.length) return ups;            // everything maxed: normal cards instead
  }
  const ups = [], newW = [], newP = [];
  for (const id in S.weapons) if (S.weapons[id].lvl < CFG.maxLevel) ups.push({ kind: 'wup', id });
  for (const id in S.passives) if (S.passives[id].lvl < passiveMax(id)) ups.push({ kind: 'pup', id });
  if (slotWeapons().length < slotCount().weapons)
    for (const id in WEAPONS) if (!S.weapons[id]) newW.push({ kind: 'wnew', id });
  if (Object.keys(S.passives).length < slotCount().passives)
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
             tier: 'ULTIMATE', tag: `DOUBLE-TAP · ${ultCooldown(c.id)}s · UPGRADE EVERY ${CFG.ultUpgradeEvery} LEVELS` };
  }
  if (c.kind === 'uup') {
    const [title, desc, glyph, tag] = ultUpInfo(c.id), u = ULTS[S.ult.id];
    return { title, desc, glyph, color: TIER.ult.color, icon: u.color, tier: `${u.name.toUpperCase()} LV ${(S.ult.lv || 1) + 1}`, tag };
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
  if (c.kind === 'wnew') return Object.assign(base, { desc: d.levels[0], tag: `NEW WEAPON · ${nW + 1}/${slotCount().weapons}` });
  if (c.kind === 'pnew') return Object.assign(base, { desc: d.levels[0], tag: `NEW PASSIVE · ${nP + 1}/${slotCount().passives}` });
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
  snd('levelup');
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
  const d = WEAPONS[c.id] || PASSIVES[c.id];
  snd('pick', c.kind === 'ult' || c.kind === 'uup' ? 'ult' : d ? d.tier : 'common');
  const p = S.p;
  switch (c.kind) {
    case 'wnew': S.weapons[c.id] = { lvl: 1, t: 0, on: 0 }; break;
    case 'wup':  S.weapons[c.id].lvl++; break;
    case 'pnew': S.passives[c.id] = { lvl: 1 }; break;
    case 'pup':  S.passives[c.id].lvl++; break;
    case 'ult':  S.ult = { id: c.id, cd: 0, lv: 1, power: 1, charge: 0, perks: {} }; S.ultHint = 5; break;
    case 'uup':  applyUltUpgrade(c.id); break;
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
    if (S.ultLvUp) ultLevelUpFx();
  }
}

// ============================================================================
// Main update
// ============================================================================
function gameUpdate(dt) {
  const p = S.p;
  S.t += dt; S.runT += dt;
  S.shake = Math.max(0, S.shake - dt);
  S.warn = Math.max(0, S.warn - dt);

  // --- movement: finger drag is relative, so your finger never covers the ship
  const kx = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
  const ky = (keys.arrowdown || keys.s ? 1 : 0) - (keys.arrowup || keys.w ? 1 : 0);
  // Your finger moves a target point; the ship chases it at its handling speed.
  p.tx = clamp(p.tx + kx * CFG.player.keySpeed * dt + input.dx * CFG.player.dragSensitivity, 12, W - 12);
  p.ty = clamp(p.ty + ky * CFG.player.keySpeed * dt + input.dy * CFG.player.dragSensitivity, 100, H - 20);
  input.dx = input.dy = 0;
  {
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), step = p.handling * dt;
    if (d <= step) { p.x = p.tx; p.y = p.ty; } else { p.x += (dx / d) * step; p.y += (dy / d) * step; }
  }
  p.invuln = Math.max(0, p.invuln - dt);
  p.ghost = Math.max(0, (p.ghost || 0) - dt);

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
    const w = S.weapons[id], before = w.t;
    WEAPONS[id].update(w, dt);
    if (w.t > before + 1e-6) snd(id);    // the weapon just fired a volley
  }
  S.sig = false;

  // --- the stage: 3 mini-bosses on the clock, then the final boss when time runs out
  const events = LEVEL_EVENTS();
  if (S.ev < events.length) {
    const ev = events[S.ev];
    if (!S.warned && S.t >= ev.t - CFG.level.warnTime) {
      S.warn = CFG.level.warnTime; S.warned = true; S.warnName = enemyName(ev.type); buzz([60, 60, 60]); snd('warning');
    }
    if (S.t >= ev.t) {
      spawnBoss(ev.type, ev.last); S.ev++; S.warned = false;
      if (ev.last) S.queenUp = true;
      if (isRush() && ev.stage !== S.rushStage) { S.rushStage = ev.stage; music('start', STAGES[ev.stage].music); }   // its home stage's music and sky
    }
  }
  if (S.victoryT > 0 && (S.victoryT -= dt) <= 0) { levelComplete(); return; }
  // --- the swarm (stops once the Queen arrives: she brings her own)
  if (!S.queenUp && (S.spawnT -= dt) <= 0) {
    const k = clamp(S.t / CFG.spawn.rampSeconds, 0, 1);
    S.spawnT = lerp(CFG.spawn.startInterval, CFG.spawn.minInterval, k) * rand(0.7, 1.3) * (bossAlive() ? CFG.spawn.duringBossMul : 1)
             * (1 - CFG.stageScale.spawn * stageD()) * (isRush() ? CFG.rush.swarmMul : 1);
    spawnPattern();
  }

  updateBullets(dt);
  updateUlts(dt);
  S.ultHint = Math.max(0, (S.ultHint || 0) - dt);

  // --- enemies (Time Warp slows them and their bullets)
  const edt = S.warp > 0 ? dt * (ultPerk('freeze') ? 0.1 : 0.25) : dt;
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
    if (b.wob) { b.age += edt; b.x += Math.cos(b.age * b.wf) * b.wob * edt; }
    if (b.grav) b.vy += b.grav * edt;                                            // lobbed shots arc down
    if (b.acc && b.vx * b.vx + b.vy * b.vy < b.vmax * b.vmax) { const k = 1 + b.acc * edt; b.vx *= k; b.vy *= k; }   // slow, then fast
    if (b.y < (b.grav ? -200 : -20) || b.y > H + 20 || b.x < -20 || b.x > W + 20) { b.dead = true; continue; }
    const dx = b.x - p.x, dy = b.y - p.y, d2 = dx * dx + dy * dy;
    if (d2 < (CFG.player.hitRadius + b.r * 0.6) ** 2 && p.invuln <= 0 && !(p.ghost > 0)) {
      b.dead = true;
      damagePlayer();
    }
  }

  // --- XP crystals: drift down, get pulled in when you're close
  for (const o of S.orbs) {
    o.age += dt;
    const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy);
    if (d < p.magnet * (S.overdrive > 0 && ultPerk('vacuum') ? 6 : 1)) {
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
      S.xp += o.v * S.mod.xp * CFG.xp.gainRate;
      snd('gem');
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
  if (typeof audioUpdate === 'function') audioUpdate();
  artUpdate(S && S.state === 'play' ? dt * 1.6 : dt * 0.6);
  if (!S) return;
  if (S.flash && (S.flash.t -= dt) <= 0) S.flash = null;
  if (S.armed && (S.armed.t -= dt) <= 0) S.armed = null;
  if (typeof uiTick === 'function') uiTick(dt);
  if (S.state === 'cutin') { S.cutin.t += dt; if (S.cutin.t >= S.cutin.dur) finishCutin(); return; }
  if (S.state === 'reveal') { updateReveal(dt); return; }
  if (S.state === 'play') {
    let gdt = dt;
    if (S.impact > 0) { S.impact -= dt; gdt = dt * lerp(1, 0.15, clamp(S.impact / CFG.ultImpact, 0, 1)); }   // ultimate impact frame
    gameUpdate(gdt); S.intro = Math.max(0, S.intro - dt);
  }
  else {
    S.uiLock -= dt;
    if (S.state === 'over' || S.state === 'won') { S.shake = Math.max(0, S.shake - dt); updateParticles(dt); }
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

// --- Settings (an overlay on the title or pause screen) ---------------------------
function openSettings() { S.settings = { page: 'main' }; S.uiLock = 0.15; }
function closeSettings() { saveMeta(); S.settings = null; S.uiLock = 0.15; }
function resetProgress() {             // wipes the save but keeps your sound settings, then restarts the game
  const keep = { audio: META.audio };
  try { localStorage.removeItem('starburn.best'); localStorage.setItem(META_KEY, JSON.stringify(keep)); } catch (e) {}
  location.reload();
}
function sliderAt(pt) { for (const sl of uiSliders) if (inRect(pt, sl.rect)) return sl; return null; }
function dragSlider(sl, pt) { sl.set(clamp((pt.x - sl.x0) / (sl.x1 - sl.x0), 0, 1)); }

function openHangar() { newGame('hangar'); S.uiLock = 0.15; }
function openStages() { newGame('stages'); S.uiLock = 0.15; }
function resume() { S.state = 'play'; input.dx = input.dy = 0; }

function startGame(stage) {
  stage = stage === SECRET_STAGE && META.secret ? SECRET_STAGE : clamp(stage || META.lastStage || 1, 1, Math.min(STAGE_COUNT, META.unlocked || 1));
  META.lastStage = stage; saveMeta();
  newGame('play', stage);
  S.intro = 3.2;
  music('start', stageDef().music);
  if (stage > 1) {                      // skipping ahead: a head start instead of a carried loadout
    S.pending = CFG.headStart * (stage - 1);
    S.level = 1 + S.pending;
    openLevelUp();
  }
  try { const el = document.documentElement; el.requestFullscreen && el.requestFullscreen().catch(() => {}); } catch (e) {}
}

window.addEventListener('pointerdown', e => {
  if (typeof audioUnlock === 'function') audioUnlock();   // browsers only allow sound after a tap
  if (!S) return;
  const pt = toWorld(e);
  if (S.state === 'play') {
    if (inRect(pt, PAUSE_BTN)) { S.state = 'paused'; S.uiLock = 0.2; return; }
    input.id = e.pointerId; input.lx = e.clientX; input.ly = e.clientY;
    input.downT = performance.now(); input.downX = e.clientX; input.downY = e.clientY;
  } else {
    input.sx = e.clientX; input.sy = e.clientY;      // for swipes (the ship wheel)
    const sl = S.settings && sliderAt(pt);
    if (sl) { input.slider = sl; input.sx = undefined; dragSlider(sl, pt); S.uiPress = null; e.preventDefault(); return; }
    if (S.uiLock <= 0) { const b = buttonAt(pt); S.uiPress = b ? b.id : null; }
  }
  e.preventDefault();
}, { passive: false });

window.addEventListener('pointermove', e => {
  if (input.slider) { dragSlider(input.slider, toWorld(e)); e.preventDefault(); return; }
  if (e.pointerId !== input.id || !S || S.state !== 'play') return;
  const r = cv.getBoundingClientRect(), k = W / r.width;
  input.dx += (e.clientX - input.lx) * k;
  input.dy += (e.clientY - input.ly) * k;
  input.lx = e.clientX; input.ly = e.clientY;
  e.preventDefault();
}, { passive: false });

window.addEventListener('pointerup', e => {
  if (input.slider) { input.slider = null; saveMeta(); snd('click'); return; }
  if (e.pointerId === input.id) {
    input.id = null;
    // A quick tap (short, barely moved). Two of them close together = ultimate.
    const now = performance.now();
    if (S && S.state === 'play' && now - input.downT < 250 && Math.hypot(e.clientX - input.downX, e.clientY - input.downY) < 20) {
      if (now - (input.lastTap || 0) < 380) { activateUlt(); input.lastTap = 0; }
      else input.lastTap = now;
    }
  }
  if (S && S.state !== 'play' && input.sx !== undefined) {
    const dx = e.clientX - input.sx, dy = e.clientY - input.sy;
    input.sx = undefined;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3 && typeof uiSwipe === 'function' && uiSwipe(dx < 0 ? 1 : -1)) { S.uiPress = null; return; }
  }
  if (!S || S.state === 'play' || S.uiPress == null) return;
  const id = S.uiPress;
  S.uiPress = null;
  const b = buttonAt(toWorld(e));
  if (b && b.id === id && S.uiLock <= 0) { snd('click'); b.action(); }
});
window.addEventListener('pointercancel', e => { if (e.pointerId === input.id) input.id = null; if (S) S.uiPress = null; });

window.addEventListener('keydown', e => {
  if (typeof audioUnlock === 'function') audioUnlock();
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (!S) return;
  if (S.state === 'hangar' && (k === 'arrowleft' || k === 'arrowright') && typeof uiSwipe === 'function') uiSwipe(k === 'arrowleft' ? -1 : 1);
  if (k === 'escape' && S.settings) { closeSettings(); return; }
  if (S.settings) return;
  if ((k === 'escape' || k === 'p') && (S.state === 'play' || S.state === 'paused')) { if (S.state === 'play') S.state = 'paused'; else resume(); }
  if (k === 'e' && S.state === 'play') activateUlt();
  if (S.state === 'levelup' && S.uiLock <= 0) {
    if (['1', '2', '3'].includes(k)) choose(+k - 1);
    if (k === 'r') reroll();
  }
  if ((k === 'enter' || k === ' ') && (S.state === 'title' || S.state === 'hangar')) openStages();
  else if ((k === 'enter' || k === ' ') && S.state === 'stages') startGame(S.stage);
  else if ((k === 'enter' || k === ' ') && S.state === 'won' && S.uiLock <= 0 && (S.stage < STAGE_COUNT || S.secretOpen)) nextStage();
  else if ((k === 'enter' || k === ' ') && S.state === 'reveal' && S.reveal.t > REVEAL.skip) endReveal();
  else if ((k === 'enter' || k === ' ') && (S.state === 'over' || S.state === 'won') && S.uiLock <= 0) openStages();
  if (k === 'h' && (S.state === 'title' || ((S.state === 'over' || S.state === 'won') && S.uiLock <= 0))) openHangar();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && S && S.state === 'play') S.state = 'paused'; });
document.addEventListener('contextmenu', e => e.preventDefault());

// Handy for testing from the browser console: STARBURN.S, STARBURN.giveXp(20)
window.STARBURN = { get S() { return S; }, CFG, META, ENEMY_DEF: ENEMY, STAGES, openStages, nextStage, WEAPONS, PASSIVES, SHIPS, ULTS, giveXp(n) { if (S) S.xp += n; },
  choose, startGame, openHangar, activateUlt,
  step(dt, n) { for (let i = 0; i < n; i++) update(dt); } };   // fast-forward for testing
