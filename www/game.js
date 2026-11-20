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
    fireInterval: 0.16,       // seconds between main-gun shots (lower = faster)
    damage: 10,               // main-gun damage per bullet
    bulletSpeed: 720,
    magnetRadius: 34,         // how close you must fly to pull in XP crystals
  },

  slots: { weapons: 4, passives: 4 },   // your ship's signature weapon is a bonus slot on top
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
  common:   { name: 'COMMON',   color: '#5dff9e' },
  uncommon: { name: 'UNCOMMON', color: '#b26bff' },
  rare:     { name: 'RARE',     color: '#ffd23f' },
};

const FONT = '"Orbitron", "Segoe UI", system-ui, sans-serif';
const COL = {
  bg: '#05030f', player: '#3df5ff', playerDark: '#0b2a44', flame: '#ff4fd8',
  xp: '#5dff9e', enemyShot: '#ff3d8b', text: '#e8f7ff', dim: '#7d86a8', gold: '#ffd23f',
};

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
  initStars();
}

// Pre-rendered soft glow dots, one per colour (fast to draw many of them).
const glowCache = {};
function glowSprite(color) {
  if (glowCache[color]) return glowCache[color];
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, color);
  gr.addColorStop(0.3, color + '88');
  gr.addColorStop(1, color + '00');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return (glowCache[color] = c);
}
function glow(x, y, r, color, a) {
  ctx.globalAlpha = a;
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

// Enemy bullet sprite: pink glow + white core, so bullets are always readable.
const eShotSprite = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(0.18, '#ffffff');
  gr.addColorStop(0.28, COL.enemyShot);
  gr.addColorStop(0.55, COL.enemyShot + '55');
  gr.addColorStop(1, COL.enemyShot + '00');
  g.fillStyle = gr;
  g.fillRect(0, 0, 48, 48);
  return c;
})();

// ============================================================================
// Background stars
// ============================================================================
let stars = [];
const STAR_SPEED = [16, 38, 85], STAR_SIZE = [0.8, 1.2, 1.8], STAR_ALPHA = [0.35, 0.6, 0.95];
function initStars() {
  stars = [];
  for (let i = 0; i < 100; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, l: i % 3 });
}
let nebulaY = 0;
function updateStars(dt) {
  for (const s of stars) {
    s.y += STAR_SPEED[s.l] * dt;
    if (s.y > H) { s.y -= H; s.x = Math.random() * W; }
  }
  nebulaY += 8 * dt;
}
function drawStars() {
  ctx.globalCompositeOperation = 'lighter';
  const ny = nebulaY % (H * 2);
  glow(W * 0.2, ny - H * 0.5, 260, '#5b1d8f', 0.18);
  glow(W * 0.85, ny + H * 0.4, 230, '#0d4f6b', 0.18);
  glow(W * 0.6, ny - H * 1.4, 240, '#7a1550', 0.14);
  ctx.globalCompositeOperation = 'source-over';
  for (const s of stars) {
    ctx.globalAlpha = STAR_ALPHA[s.l];
    ctx.fillStyle = s.l === 2 ? '#bfefff' : '#ffffff';
    const sz = STAR_SIZE[s.l];
    ctx.fillRect(s.x, s.y, sz, s.l === 2 ? sz * 3 : sz);
  }
  ctx.globalAlpha = 1;
}

// ============================================================================
// Weapons (12). Each has a name, colour, symbol, one line of text per level,
// and update() which runs every frame while it's in your loadout.
// Shared modifiers from passives: S.mod.cd (cooldowns), .dmg, .area, .count,
// .speed (projectile speed), .pierce.
// ============================================================================
function shoot(b) { S.bullets.push(b); return b; }
const cd = base => base * S.mod.cd;
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
  spread: {
    name: 'Spread Shot', color: '#ffd23f', glyph: '✶', tier: 'common',
    levels: ['Fires a fan of 3 shots', '4 shots, wider', '5 shots, more damage', '6 shots, faster', '7 shots, max fan'],
    update(w, dt) {
      if ((w.t -= dt) > 0) return;
      w.t = cd(0.62 - 0.05 * w.lvl);
      const n = 2 + w.lvl + S.mod.count, spread = (16 + 9 * w.lvl) * Math.PI / 180;
      for (let i = 0; i < n; i++) gunShot(S.p.x, S.p.y - 10, UP - spread / 2 + spread * (i / (n - 1)), 560, 6 + 1.5 * w.lvl, this.color);
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
    levels: ['Two escort pods copy your main gun', 'Pods hit harder', 'Pods fire faster', 'Pods hit even harder', 'Pods at full power'],
    update(w, dt) {
      if ((w.t -= dt) > 0) return;
      w.t = S.p.fireInterval * S.mod.cd * (w.lvl >= 3 ? 1.0 : 1.3);
      const dmg = CFG.player.damage * (0.4 + 0.15 * w.lvl);
      for (const side of [-1, 1]) gunShot(S.p.x + side * 24, S.p.y - 4, UP, CFG.player.bulletSpeed, dmg, this.color);
    },
    draw(w) { for (const s of [-1, 1]) drawShip(S.p.x + s * 24, S.p.y + 4, 0.5, S.ship); },
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
    draw(w) {
      if (!w.pos) return;
      const sr = 6 * Math.sqrt(S.mod.area);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < w.pos.length; i += 2) glow(w.pos[i], w.pos[i + 1], sr * 3, this.color, 0.6);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#e8fff8';
      for (let i = 0; i < w.pos.length; i += 2) {
        const x = w.pos[i], y = w.pos[i + 1];
        path([x, y - sr, x + sr * 0.6, y, x, y + sr, x - sr * 0.6, y]);
        ctx.fill();
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
                kind: 'flak', fuse: 0.45, shards: 6 + 2 * w.lvl + 2 * S.mod.count, sdmg: 5 + 2.5 * w.lvl,
                slife: (0.3 + (w.lvl >= 4 ? 0.1 : 0)) * S.mod.area, color: this.color });
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
      w.t = cd(1.7 - 0.12 * w.lvl);
      const fire = delay => shoot({ x: S.p.x, y: S.p.y - 20 + delay, vx: 0, vy: -spd(260), r: 0,
        hw: (40 + 8 * w.lvl) * S.mod.area, dmg: 14 + 6 * w.lvl + (w.lvl >= 4 ? 8 : 0),
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
    draw(w) {
      if (!w.drones) return;
      for (const d of w.drones) {
        ctx.globalCompositeOperation = 'lighter';
        glow(d.x, d.y, 14, this.color, 0.4);
        ctx.globalCompositeOperation = 'source-over';
        path([d.x, d.y - 7, d.x + 5, d.y, d.x, d.y + 7, d.x - 5, d.y]);
        ctx.fillStyle = '#1a1f3a'; ctx.fill();
        ctx.strokeStyle = this.color; ctx.lineWidth = 1.5; ctx.stroke();
      }
    },
  },
};

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
  p.fireInterval = CFG.player.fireInterval * m.cd;
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
    p: { x: W / 2, y: H * 0.78, hp: 0, maxHp: 0, invuln: 0, fireT: 0,
         fireInterval: 0, magnet: 0, bubble: false, bubbleT: 0, repairT: 0 },
    weapons: {}, passives: {}, mod: null,
    bullets: [], ebullets: [], enemies: [], orbs: [], parts: [], novas: [], zaps: [], texts: [], laser: null,
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
  drone:  { hp: 20,   r: 12, xp: 1,  credits: 1, color: '#ff3d8b' },
  weaver: { hp: 14,   r: 11, xp: 1,  credits: 1, color: '#ff9d3d' },
  diver:  { hp: 26,   r: 12, xp: 2,  credits: 1, color: '#ff4040' },
  gunner: { hp: 120,  r: 20, xp: 6,  credits: 3, color: '#b45dff' },
  boss:   { hp: 2200, r: 34, xp: 30, credits: 0, color: '#ff2d6f' },   // boss bounty: CFG.boss
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
  sparks(x, y, '#ff8a3d', 12);
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
  if (p.invuln > 0) return false;
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
  compact(S.parts); compact(S.texts); compact(S.zaps);
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

  // --- main gun: always firing
  p.fireT -= dt;
  while (p.fireT <= 0) {
    p.fireT += p.fireInterval;
    gunShot(p.x, p.y - 16, UP, CFG.player.bulletSpeed, CFG.player.damage, COL.player);
  }

  // --- loadout weapons
  S.laser = null;
  for (const id in S.weapons) WEAPONS[id].update(S.weapons[id], dt);

  // --- spawning: small fry, plus a capital ship on a timer
  if (S.t >= S.nextBoss - 3 && S.warn <= 0 && !S.warned) { S.warn = 3; S.warned = true; buzz([60, 60, 60]); }
  if (S.t >= S.nextBoss) { spawnBoss(); S.nextBoss += CFG.boss.every; S.warned = false; }
  if ((S.spawnT -= dt) <= 0) {
    const k = clamp(S.t / CFG.spawn.rampSeconds, 0, 1);
    S.spawnT = lerp(CFG.spawn.startInterval, CFG.spawn.minInterval, k) * rand(0.7, 1.3) * (bossAlive() ? CFG.spawn.duringBossMul : 1);
    spawnPattern();
  }

  updateBullets(dt);

  // --- enemies
  for (const e of S.enemies) if (!e.dead) updateEnemy(e, dt);

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
    b.x += b.vx * dt;
    b.y += b.vy * dt;
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
  updateStars(S && S.state === 'play' ? dt * 1.6 : dt * 0.6);
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
// Drawing
// ============================================================================
function path(points) {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.closePath();
}

function drawShip(x, y, scale, ship, locked) {
  ship = ship || SHIPS.vesper;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  path(ship.shape);
  ctx.fillStyle = locked ? '#08070f' : '#0b1a33'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = locked ? '#ffffff30' : ship.color; ctx.stroke();
  if (!locked) {
    ctx.fillStyle = '#e8fbff';
    ctx.beginPath(); ctx.ellipse(0, -4, 2.2, 4, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawPlayer() {
  const p = S.p;
  const blink = p.invuln > 0 && Math.floor(p.invuln * 16) % 2 === 0;
  ctx.globalCompositeOperation = 'lighter';
  glow(p.x, p.y + 12, 12, COL.flame, 0.8);
  glow(p.x, p.y, 26, S.ship.color, 0.25);
  ctx.globalCompositeOperation = 'source-over';
  const f = rand(6, 12);
  ctx.fillStyle = '#ffb3f3';
  path([p.x - 3.5, p.y + 9, p.x + 3.5, p.y + 9, p.x, p.y + 9 + f]);
  ctx.fill();
  if (!blink) drawShip(p.x, p.y, 1, S.ship);
  for (const id in S.weapons) if (WEAPONS[id].draw) WEAPONS[id].draw(S.weapons[id]);
  // hitbox dot: this is the only part that can be hit
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(p.x, p.y, CFG.player.hitRadius - 1, 0, TAU); ctx.fill();
  ctx.strokeStyle = COL.flame; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(p.x, p.y, CFG.player.hitRadius + 0.5, 0, TAU); ctx.stroke();
  // Deflector Shield: full ring when ready, a filling arc while it recharges
  if (p.bubble) {
    ctx.strokeStyle = '#6bd6ff'; ctx.lineWidth = 2; ctx.globalAlpha = 0.55 + 0.2 * Math.sin(S.t * 5);
    ctx.beginPath(); ctx.arc(p.x, p.y, 19, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (ML('deflector')) {
    const f = clamp(1 - p.bubbleT / shieldRecharge(), 0, 1);
    ctx.strokeStyle = '#6bd6ff'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 19, UP, UP + TAU * f); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawEnemy(e) {
  const c = e.flash > 0 ? '#ffffff' : e.color;
  ctx.globalCompositeOperation = 'lighter';
  glow(e.x, e.y, e.r * 2.2, e.color, 0.3);
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = c;
  ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#1a0716';
  switch (e.type) {
    case 'drone':
      path([0, 12, 12, -6, 5, -2, 0, -10, -5, -2, -12, -6]); break;
    case 'weaver':
      path([0, 11, 6, 0, 13, -4, 6, -6, 0, -11, -6, -6, -13, -4, -6, 0]); break;
    case 'diver':
      if (e.mode === 1 && Math.floor(e.wait * 12) % 2) ctx.strokeStyle = '#ffffff';
      ctx.rotate(e.mode === 2 ? Math.atan2(e.vy, e.vx) - Math.PI / 2 : 0);
      path([0, 14, 7, -4, 3, -12, -3, -12, -7, -4]); break;
    case 'gunner': {
      const pts = [];
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; pts.push(Math.cos(a) * 20, Math.sin(a) * 20); }
      path(pts);
      break;
    }
    case 'boss':
      ctx.lineWidth = 2.5;
      path([0, 42, 16, 22, 44, 14, 38, -8, 18, -4, 12, -26, -12, -26, -18, -4, -38, -8, -44, 14, -16, 22]);
      break;
  }
  ctx.fill();
  ctx.stroke();
  if (e.type === 'gunner') {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff22'; ctx.fillRect(-18, -28, 36, 3);
    ctx.fillStyle = e.color; ctx.fillRect(-18, -28, 36 * Math.max(0, e.hp / e.maxHp), 3);
  } else if (e.type === 'boss') {
    ctx.strokeStyle = c; ctx.lineWidth = 1.5;
    path([0, 30, 10, 14, 0, -10, -10, 14]); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    glow(0, 6, 22 + 4 * Math.sin(e.age * 6), e.color, 0.9);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 6, 4, 0, TAU); ctx.fill();
  } else {
    ctx.fillStyle = c;
    ctx.fillRect(-1.5, -2, 3, 3);
  }
  ctx.restore();
}

function drawWorld() {
  // XP crystals
  ctx.globalCompositeOperation = 'lighter';
  for (const o of S.orbs) {
    const s = o.v >= 5 ? 6 : 3.5, pulse = 0.7 + 0.3 * Math.sin(o.age * 8);
    glow(o.x, o.y, s * 3, COL.xp, 0.5 * pulse);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = COL.xp;
  for (const o of S.orbs) {
    const s = o.v >= 5 ? 6 : 3.5;
    path([o.x, o.y - s, o.x + s * 0.7, o.y, o.x, o.y + s, o.x - s * 0.7, o.y]);
    ctx.fill();
  }

  for (const e of S.enemies) drawEnemy(e);

  // Player projectiles
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const b of S.bullets) {
    switch (b.kind) {
      case 'rocket':
        glow(b.x, b.y, 10, b.color, 0.8);
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.fillStyle = '#ffe0c8'; ctx.fillRect(-5, -1.5, 9, 3);
        ctx.restore();
        break;
      case 'rail':
        glow(b.x, b.y + 20, 22, b.color, 0.7);
        ctx.strokeStyle = b.color; ctx.lineWidth = 7; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y + 90); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y + 90); ctx.stroke();
        break;
      case 'flak':
        glow(b.x, b.y, 12, b.color, 0.8);
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, TAU); ctx.fill();
        break;
      case 'disc':
        glow(b.x, b.y, b.r * 2.4, b.color, 0.6);
        ctx.strokeStyle = b.color; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, b.spin, b.spin + Math.PI * 1.4); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.35, 0, TAU); ctx.fill();
        break;
      case 'wave':
        ctx.strokeStyle = b.color; ctx.lineWidth = 9; ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.moveTo(b.x - b.hw, b.y + 10); ctx.quadraticCurveTo(b.x, b.y - 14, b.x + b.hw, b.y + 10); ctx.stroke();
        ctx.strokeStyle = '#e0ecff'; ctx.lineWidth = 2.5; ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.moveTo(b.x - b.hw, b.y + 10); ctx.quadraticCurveTo(b.x, b.y - 14, b.x + b.hw, b.y + 10); ctx.stroke();
        break;
      default: {
        glow(b.x, b.y, 7, b.color, 0.6);
        const sp = Math.hypot(b.vx, b.vy) || 1, len = b.r > 2.6 ? 9 : 6;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx / sp * len, b.y - b.vy / sp * len); ctx.stroke();
      }
    }
  }
  // Laser beam
  if (S.laser) {
    const x = S.p.x, w = S.laser.w, bot = S.p.y - 14;
    ctx.globalAlpha = 0.35 + Math.random() * 0.15;
    ctx.fillStyle = S.laser.color;
    ctx.fillRect(x - w, 0, w * 2, bot);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - w * 0.25, 0, w * 0.5, bot);
    ctx.globalAlpha = 1;
    glow(x, bot, w * 2, S.laser.color, 0.9);
  }
  // Lightning
  for (const z of S.zaps) {
    ctx.globalAlpha = 1 - z.age / 0.18;
    ctx.strokeStyle = z.color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(z.x1, z.y1);
    for (let k = 1; k < 5; k++) {
      const t = k / 5;
      ctx.lineTo(lerp(z.x1, z.x2, t) + rand(-8, 8), lerp(z.y1, z.y2, t) + rand(-8, 8));
    }
    ctx.lineTo(z.x2, z.y2); ctx.stroke();
    glow(z.x2, z.y2, 14, z.color, 0.8);
  }
  // Novas
  for (const n of S.novas) {
    const life = n.small ? 0.3 : 0.55;
    ctx.globalAlpha = Math.max(0, 1 - n.age / life);
    ctx.strokeStyle = n.color;
    ctx.lineWidth = n.small ? 2 : 4;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, TAU); ctx.stroke();
  }
  // Particles
  for (const q of S.parts) {
    ctx.globalAlpha = 1 - q.age / q.life;
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  if (S.state !== 'over' && S.state !== 'title' && S.state !== 'hangar') drawPlayer();
  if (S.state === 'title') drawShip(W / 2, H * 0.52 + Math.sin(performance.now() / 500) * 4, 1.6, curShip());

  // Enemy bullets last, so they're never hidden behind anything
  for (const b of S.ebullets) ctx.drawImage(eShotSprite, b.x - 12, b.y - 12, 24, 24);

  // Floating text
  for (const t of S.texts) {
    ctx.globalAlpha = Math.min(1, 2 * (1.2 - t.age));
    smallText(t.txt, t.x, t.y, t.size, t.color, 800);
  }
  ctx.globalAlpha = 1;
}

function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

const PAUSE_BTN = { x: W - 44, y: 8, w: 40, h: 40 };

function drawSlot(x, y, def, lvl, max, builtin) {
  const s = 22;
  roundRect(x, y, s, s, 4);
  if (def) {
    const tc = TIER[def.tier].color;
    ctx.fillStyle = builtin ? tc + '30' : '#0e0a24cc'; ctx.fill();
    ctx.strokeStyle = tc; ctx.lineWidth = builtin ? 2 : 1.2; ctx.stroke();
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = def.color;
    ctx.fillText(def.glyph, x + s / 2, y + s / 2 + 1);
    ctx.font = `800 8px ${FONT}`;
    ctx.fillStyle = lvl >= max ? COL.gold : COL.text;
    ctx.textAlign = 'right';
    ctx.fillText(lvl >= max ? 'M' : String(lvl), x + s + 2, y + s - 1);
  } else {
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#ffffff33'; ctx.lineWidth = 1; ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawHud() {
  const p = S.p;
  // XP bar across the very top
  const need = xpNeed(S.level);
  ctx.fillStyle = '#ffffff14';
  ctx.fillRect(0, 0, W, 6);
  ctx.fillStyle = COL.xp;
  ctx.fillRect(0, 0, W * clamp(S.xp / need, 0, 1), 6);

  ctx.textBaseline = 'middle';
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = COL.text;
  ctx.textAlign = 'left';
  ctx.fillText(`LV ${S.level}`, 8, 22);
  ctx.textAlign = 'center';
  ctx.fillText(fmtTime(S.t), W / 2, 22);
  ctx.textAlign = 'right';
  ctx.font = `800 12px ${FONT}`;
  ctx.fillStyle = COL.gold;
  ctx.fillText(`${Math.floor(S.credits)} CR`, W - 48, 22);
  ctx.font = `500 10px ${FONT}`;
  ctx.fillStyle = COL.dim;
  ctx.textAlign = 'center';
  ctx.fillText(`${S.kills} KILLS`, W / 2, 38);

  // hull pips, top right under the credits
  for (let i = 0; i < p.maxHp; i++) {
    const x = W - 14 - (p.maxHp - 1 - i) * 12, y = 40;
    path([x, y - 5, x + 5, y, x, y + 5, x - 5, y]);
    if (i < p.hp) { ctx.fillStyle = COL.player; ctx.fill(); }
    else { ctx.strokeStyle = '#3df5ff55'; ctx.lineWidth = 1; ctx.stroke(); }
  }

  // Loadout: ship's signature weapon (bold), then 4 weapon slots; 4 passive slots below
  const sig = S.ship.weapon, wIds = slotWeapons(), pIds = Object.keys(S.passives);
  drawSlot(8, 36, WEAPONS[sig], S.weapons[sig].lvl, CFG.maxLevel, true);
  for (let i = 0; i < CFG.slots.weapons; i++) {
    const id = wIds[i];
    drawSlot(40 + i * 27, 36, id && WEAPONS[id], id && S.weapons[id].lvl, CFG.maxLevel);
  }
  for (let i = 0; i < CFG.slots.passives; i++) {
    const id = pIds[i];
    drawSlot(40 + i * 27, 63, id && PASSIVES[id], id && S.passives[id].lvl, id && passiveMax(id));
  }

  // pause button
  if (S.state === 'play') {
    ctx.fillStyle = '#ffffff99';
    ctx.fillRect(PAUSE_BTN.x + 13, PAUSE_BTN.y + 10, 5, 16);
    ctx.fillRect(PAUSE_BTN.x + 23, PAUSE_BTN.y + 10, 5, 16);
  }

  // Boss warning + health bar
  if (S.warn > 0 && Math.floor(S.warn * 4) % 2 === 0) {
    neonText('WARNING', W / 2, H * 0.36, 30, '#ff2d6f');
    smallText('CAPITAL SHIP INBOUND', W / 2, H * 0.36 + 30, 12, COL.text, 700);
  }
  const boss = S.enemies.find(e => e.type === 'boss' && !e.dead);
  if (boss) {
    const y = H - 16;
    smallText('CAPITAL SHIP', W / 2, y - 10, 9, '#ff8fb0', 800);
    ctx.fillStyle = '#ffffff1a'; ctx.fillRect(20, y, W - 40, 5);
    ctx.fillStyle = '#ff2d6f'; ctx.fillRect(20, y, (W - 40) * Math.max(0, boss.hp / boss.maxHp), 5);
  }
}

function neonText(text, x, y, size, color, weight) {
  ctx.font = `${weight || 900} ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.6;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * 0.85;
  ctx.fillText(text, x, y);
  ctx.globalAlpha = a;
}

function smallText(text, x, y, size, color, weight) {
  ctx.font = `${weight || 500} ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function wrapLines(text, maxW) {
  const words = text.split(' '), lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function dim(a) { ctx.fillStyle = `rgba(5,3,15,${a})`; ctx.fillRect(0, 0, W, H); }

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// --- Tap targets: menus register buttons while drawing; taps are matched to them.
let uiButtons = [];
function addButton(id, rect, action, enabled) { uiButtons.push({ id, rect, action, enabled: enabled !== false }); }
function drawButton(id, x, y, w, h, label, color, action, enabled) {
  const on = enabled !== false, pressed = S.uiPress === id && on;
  roundRect(x, y, w, h, 10);
  ctx.fillStyle = pressed ? color + '55' : on ? color + '1f' : '#ffffff08';
  ctx.fill();
  ctx.lineWidth = pressed ? 2.5 : 1.5;
  ctx.strokeStyle = on ? color : '#ffffff33';
  ctx.stroke();
  smallText(label, x + w / 2, y + h / 2 + 1, 14, on ? COL.text : COL.dim, 800);
  addButton(id, { x, y, w, h }, action, on);
}

function drawLevelUp() {
  dim(0.8);
  const n = S.choices.length, ch = 88, gap = 12, total = n * ch + (n - 1) * gap;
  const y0 = Math.max(170, H * 0.5 - total / 2);
  const titleY = y0 - 78;
  neonText('LEVEL UP', W / 2, titleY, 34, COL.xp);
  smallText(`LEVEL ${S.choiceLevel}: CHOOSE ONE`, W / 2, titleY + 32, 11, COL.text, 700);
  smallText(`WEAPONS ${slotWeapons().length}/${CFG.slots.weapons}   ·   PASSIVES ${Object.keys(S.passives).length}/${CFG.slots.passives}`,
            W / 2, titleY + 52, 9, COL.dim, 700);

  S.choices.forEach((c, i) => {
    const r = { x: 20, y: y0 + i * (ch + gap), w: W - 40, h: ch }, info = choiceInfo(c), pressed = S.uiPress === 'card' + i;
    addButton('card' + i, r, () => choose(i));
    roundRect(r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = pressed ? info.color + '44' : '#0e0a24ee';
    ctx.fill();
    ctx.lineWidth = pressed ? 3 : 1.5;
    ctx.strokeStyle = info.color;
    ctx.stroke();
    const ix = r.x + 38, iy = r.y + r.h / 2;
    ctx.globalCompositeOperation = 'lighter';
    glow(ix, iy, 34, info.color, 0.35);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = info.color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ix, iy, 22, 0, TAU); ctx.stroke();
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillStyle = info.icon || info.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(info.glyph, ix, iy + 1);
    const tx = r.x + 74, tw = r.w - 86;
    ctx.font = `800 8.5px ${FONT}`;
    ctx.fillStyle = info.color;
    if (info.tier) { ctx.textAlign = 'right'; ctx.fillText(info.tier, r.x + r.w - 12, r.y + 18); }
    ctx.textAlign = 'left';
    ctx.fillText(info.tag, tx, r.y + 18);
    ctx.font = `800 14px ${FONT}`;
    ctx.fillStyle = COL.text;
    ctx.fillText(info.title, tx, r.y + 36);
    ctx.font = '400 12px system-ui, sans-serif';
    ctx.fillStyle = '#b8c2e0';
    wrapLines(info.desc, tw).slice(0, 2).forEach((ln, k) => ctx.fillText(ln, tx, r.y + 56 + k * 15));
  });
  const by = y0 + total + 18;
  if (ML('reroll') > 0) drawButton('reroll', W / 2 - 80, by, 160, 40, `REROLL (${S.rerolls})`, COL.gold, reroll, S.rerolls > 0);
  if (S.uiLock > 0) dim(0.25);
}

function drawTitle() {
  dim(0.35);
  const cy = H * 0.22;
  neonText('STARBURN', W / 2, cy, 44, '#ff4fd8');
  smallText('SHOOT  ·  SALVAGE  ·  EVOLVE', W / 2, cy + 38, 11, COL.player, 700);
  const lines = ['Drag anywhere to fly. You fire on your own.', 'Grab green crystals to level up.', 'Only the white dot can be hit.'];
  lines.forEach((l, i) => smallText(l, W / 2, cy + 80 + i * 20, 12, COL.text, 400));
  const sh = curShip(), wp = WEAPONS[sh.weapon];
  smallText(sh.name, W / 2, H * 0.52 + 36, 14, sh.color, 800);
  smallText(`${wp.name} · ${TIER[wp.tier].name}`, W / 2, H * 0.52 + 54, 10, TIER[wp.tier].color, 700);
  const by = H * 0.7;
  drawButton('launch', 40, by, W - 80, 54, 'LAUNCH', COL.xp, startGame);
  drawButton('hangar', 40, by + 66, W - 80, 46, `HANGAR  ·  ${META.bank} CR`, COL.gold, openHangar);
  if (META.best > 0) smallText(`BEST TIME  ${fmtTime(META.best)}`, W / 2, by + 136, 11, COL.dim, 700);
}

let hangarTab = 'ships';
function openHangar() { newGame('hangar'); S.uiLock = 0.15; }

// Purchases need two taps: the first arms it ("TAP AGAIN"), the second buys.
function confirmBuy(id, fn) {
  if (S.armed && S.armed.id === id) { S.armed = null; fn(); }
  else { S.armed = { id, t: 2.5 }; buzz(10); }
}
const isArmed = id => S.armed && S.armed.id === id;

function drawHangar() {
  dim(0.5);
  neonText('HANGAR', W / 2, 34, 28, COL.gold);
  smallText(`${META.bank} CR`, W / 2, 62, 14, COL.gold, 800);
  const tw = (W - 44) / 2;
  drawTab('tabShips', 16, 80, tw, 34, 'SHIPS', 'ships');
  drawTab('tabUps', 28 + tw, 80, tw, 34, 'UPGRADES', 'upgrades');
  if (hangarTab === 'ships') drawShipGrid(126, H - 76);
  else drawUpgradeList(126, H - 76);
  drawButton('back', 16, H - 64, tw, 48, 'BACK', COL.player, () => { newGame('title'); });
  drawButton('launch', 28 + tw, H - 64, tw, 48, 'LAUNCH', COL.xp, startGame);
}

function drawTab(id, x, y, w, h, label, tab) {
  const on = hangarTab === tab;
  roundRect(x, y, w, h, 8);
  ctx.fillStyle = on ? COL.gold + '30' : '#0e0a24cc'; ctx.fill();
  ctx.strokeStyle = on ? COL.gold : '#ffffff26'; ctx.lineWidth = on ? 2 : 1; ctx.stroke();
  smallText(label, x + w / 2, y + h / 2 + 1, 12, on ? COL.text : COL.dim, 800);
  addButton(id, { x, y, w, h }, () => { hangarTab = tab; S.armed = null; });
}

function drawShipGrid(top, bottom) {
  const ids = Object.keys(SHIPS), cols = 3, gap = 8;
  const cw = (W - 24 - gap * (cols - 1)) / cols;
  const chh = clamp((bottom - top - gap * 3) / 4, 80, 130);
  ids.forEach((id, i) => {
    const ship = SHIPS[id], wp = WEAPONS[ship.weapon], tc = TIER[wp.tier].color;
    const owned = !!META.ships[id], sel = META.ship === id, cost = shipCost(id), afford = META.bank >= cost;
    const r = { x: 12 + (i % cols) * (cw + gap), y: top + Math.floor(i / cols) * (chh + gap), w: cw, h: chh };
    const flash = S.flash && S.flash.id === id, cx = r.x + r.w / 2;
    roundRect(r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = flash ? tc + '55' : sel ? tc + '22' : S.uiPress === 's' + i ? '#ffffff14' : '#0e0a24dd';
    ctx.fill();
    ctx.strokeStyle = owned ? tc : tc + '55';
    ctx.lineWidth = sel ? 3 : 1;
    ctx.stroke();
    if (owned) {
      ctx.globalCompositeOperation = 'lighter';
      glow(cx, r.y + chh * 0.32, 24, ship.color, sel ? 0.5 : 0.25);
      ctx.globalCompositeOperation = 'source-over';
    }
    drawShip(cx, r.y + chh * 0.32, 1.15, ship, !owned);
    smallText(ship.name, cx, r.y + chh * 0.62, 10.5, owned ? COL.text : COL.dim, 800);
    smallText(wp.name, cx, r.y + chh * 0.75, 8.5, tc, 700);
    let label, lc;
    if (owned) { label = sel ? 'SELECTED' : 'OWNED'; lc = sel ? COL.xp : COL.dim; }
    else if (isArmed(id)) { label = 'TAP AGAIN'; lc = Math.floor(performance.now() / 200) % 2 ? COL.gold : COL.text; }
    else { label = `${cost} CR`; lc = afford ? COL.gold : '#a0607a'; }
    smallText(label, cx, r.y + chh * 0.89, 9.5, lc, 800);
    addButton('s' + i, r, () => {
      if (owned) { META.ship = id; saveMeta(); S.armed = null; buzz(10); }
      else if (!afford) buzz(20);
      else confirmBuy(id, () => {
        META.bank -= cost; META.ships[id] = true; META.ship = id; saveMeta();
        S.flash = { id, t: 0.4 }; buzz(40);
      });
    });
  });
}

function drawUpgradeList(top, bottom) {
  const rowH = clamp((bottom - top) / HANGAR.length, 44, 62);
  HANGAR.forEach((h, i) => {
    const y = top + i * rowH, lv = ML(h.id), maxed = lv >= h.max, cost = hangarCost(h), afford = !maxed && META.bank >= cost;
    const r = { x: 12, y: y + 2, w: W - 24, h: rowH - 6 };
    const flash = S.flash && S.flash.id === h.id;
    roundRect(r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = flash ? COL.gold + '55' : S.uiPress === 'h' + i ? '#ffffff18' : '#0e0a24dd';
    ctx.fill();
    ctx.strokeStyle = afford ? COL.gold + 'aa' : '#ffffff22'; ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `800 11.5px ${FONT}`; ctx.fillStyle = COL.text;
    ctx.fillText(h.name, r.x + 10, r.y + r.h * 0.34);
    ctx.font = '400 11px system-ui, sans-serif'; ctx.fillStyle = '#b8c2e0';
    ctx.fillText(typeof h.desc === 'function' ? h.desc(lv) : h.desc, r.x + 10, r.y + r.h * 0.72);
    const pipW = Math.min(7, 60 / h.max - 2);
    for (let k = 0; k < h.max; k++) {
      ctx.fillStyle = k < lv ? COL.gold : '#ffffff22';
      ctx.fillRect(r.x + r.w - 80 - h.max * (pipW + 2) + k * (pipW + 2), r.y + r.h * 0.34 - 3, pipW, 6);
    }
    ctx.textAlign = 'right'; ctx.font = `800 12px ${FONT}`;
    const armed = isArmed(h.id);
    ctx.fillStyle = maxed ? COL.dim : armed ? (Math.floor(performance.now() / 200) % 2 ? COL.gold : COL.text) : afford ? COL.gold : '#a0607a';
    ctx.fillText(maxed ? 'MAX' : armed ? 'TAP AGAIN' : `${cost} CR`, r.x + r.w - 10, r.y + r.h / 2 + 1);
    addButton('h' + i, r, () => (afford ? confirmBuy(h.id, () => buyHangar(h)) : buzz(20)), !maxed);
  });
}

function drawPaused() {
  dim(0.7);
  neonText('PAUSED', W / 2, H * 0.36, 36, COL.player);
  drawButton('resume', 50, H * 0.48, W - 100, 52, 'RESUME', COL.xp, resume);
  drawButton('quit', 50, H * 0.48 + 66, W - 100, 44, 'END RUN', COL.flame, () => gameOver(true));
}
function resume() { S.state = 'play'; input.dx = input.dy = 0; }

function drawGameOver() {
  dim(0.6);
  const cy = H * 0.24;
  neonText(S.quit ? 'RUN ENDED' : 'SHIP LOST', W / 2, cy, 36, COL.flame);
  const rows = [
    ['SURVIVED', fmtTime(S.t)],
    ['LEVEL', String(S.level)],
    ['KILLS', String(S.kills)],
    ['BEST', fmtTime(META.best)],
  ];
  rows.forEach(([k, v], i) => {
    const y = cy + 60 + i * 28;
    ctx.font = `700 12px ${FONT}`; ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillStyle = COL.dim; ctx.fillText(k, W / 2 - 100, y);
    ctx.textAlign = 'right'; ctx.fillStyle = COL.text; ctx.fillText(v, W / 2 + 100, y);
  });
  const cyy = cy + 60 + 4 * 28 + 14;
  neonText(`+${S.earned} CR`, W / 2, cyy, 26, COL.gold);
  smallText(`BOUNTY COLLECTED  ·  BANK ${META.bank} CR`, W / 2, cyy + 26, 10, COL.text, 700);
  if (S.newBest) smallText('NEW BEST TIME!', W / 2, cyy + 46, 12, COL.xp, 800);
  const by = H * 0.72;
  const on = S.uiLock <= 0;
  drawButton('again', 40, by, W - 80, 54, 'FLY AGAIN', COL.xp, startGame, on);
  drawButton('hangar', 40, by + 66, W - 80, 46, 'HANGAR', COL.gold, openHangar, on);
}

function render() {
  uiButtons = [];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = COL.bg;
  ctx.fillRect(0, 0, cv.width, cv.height);
  let sx = 0, sy = 0;
  if (S && S.shake > 0) { sx = rand(-1, 1) * S.shake * 10; sy = rand(-1, 1) * S.shake * 10; }
  ctx.setTransform(SCALE, 0, 0, SCALE, sx * SCALE, sy * SCALE);
  drawStars();
  if (!S) return;
  drawWorld();
  if (S.state !== 'title' && S.state !== 'hangar') drawHud();
  if (S.state === 'title') drawTitle();
  else if (S.state === 'hangar') drawHangar();
  else if (S.state === 'levelup') drawLevelUp();
  else if (S.state === 'paused') drawPaused();
  else if (S.state === 'over') drawGameOver();
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
  if (e.pointerId === input.id) input.id = null;
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

// ============================================================================
// Boot
// ============================================================================
window.addEventListener('resize', resize);
resize();
newGame('title');
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;   // after a hiccup, don't teleport everything
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for testing from the browser console: STARBURN.S, STARBURN.giveXp(20)
window.STARBURN = { get S() { return S; }, CFG, META, WEAPONS, PASSIVES, SHIPS, giveXp(n) { if (S) S.xp += n; }, choose, startGame, openHangar };
