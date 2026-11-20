// STARBURN: a vertical shooter where kills drop XP and level-ups give upgrades.
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
    magnetRadius: 34,         // how close you must fly to pull in XP orbs
  },

  xp: {
    orbFallSpeed: 55,         // orbs drift down; miss them and they're gone
    pullSpeed: 440,           // how fast orbs fly to you once inside the magnet
    needBase: 6,              // XP for level 2
    needPerLevel: 4,          // extra XP needed per level
    needCurve: 0.5,           // extra XP that grows with level squared
  },

  spawn: {
    graceTime: 1.5,           // quiet seconds at the start
    startInterval: 1.6,       // seconds between enemy groups at the start
    minInterval: 0.5,         // ...and once fully ramped up
    rampSeconds: 360,         // how long it takes to reach full intensity
  },

  enemyHpGrowthPerMin: 0.35,  // enemies get +35% HP per minute survived
  enemyBulletSpeed: 150,
  enemyBulletSpeedGrowth: 600,// bullet speed +100% after this many seconds

  weaponEveryNLevels: 3,      // every 3rd level offers a new weapon system
  weaponMaxLevel: 5,
  shieldDuration: 10,         // seconds the "Shield" upgrade protects you
  postLevelUpInvuln: 0.8,     // grace after picking an upgrade (finger needs to find the ship)
  upgradeChoices: 3,
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
function compact(arr) {          // remove dead things without allocating a new array
  let j = 0;
  for (let i = 0; i < arr.length; i++) if (!arr[i].dead) arr[j++] = arr[i];
  arr.length = j;
}
function store(key, val) {
  try {
    if (val === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, val);
  } catch (e) { /* storage blocked: fine, we just don't remember */ }
  return null;
}
function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

const FONT = '"Orbitron", "Segoe UI", system-ui, sans-serif';
const COL = {
  bg: '#05030f', player: '#3df5ff', playerDark: '#0b2a44', flame: '#ff4fd8',
  xp: '#5dff9e', enemyShot: '#ff3d8b', text: '#e8f7ff', dim: '#7d86a8',
};

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
  if (S) { S.p.x = clamp(S.p.x, 12, W - 12); S.p.y = clamp(S.p.y, 60, H - 20); }
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
// Weapons: each one has a name, a colour, a line of text per level, and an
// update() that runs every frame while you own it.
// ============================================================================
function shoot(b) { S.bullets.push(b); }

const WEAPONS = {
  spread: {
    name: 'Spread Shot', code: 'SPR', color: '#ffd23f', glyph: '✶',
    levels: ['Fires a fan of 3 shots', '4 shots, wider', '5 shots, more damage', '6 shots, faster', '7 shots, max fan'],
    update(w, dt) {
      w.t -= dt;
      if (w.t > 0) return;
      w.t = 0.62 - 0.05 * w.lvl;
      const n = 2 + w.lvl, spread = (16 + 9 * w.lvl) * Math.PI / 180;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 - spread / 2 + spread * (i / (n - 1));
        shoot({ x: S.p.x, y: S.p.y - 10, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560,
                r: 3, dmg: 6 + 1.5 * w.lvl, kind: 'spread', color: this.color });
      }
    },
  },

  rockets: {
    name: 'Homing Rockets', code: 'RKT', color: '#ff8a3d', glyph: '➶',
    levels: ['Seeker missiles hunt enemies down', '2 rockets per salvo', 'Bigger blasts, faster reload', '3 rockets per salvo', 'Heavy warheads'],
    update(w, dt) {
      w.t -= dt;
      if (w.t > 0) return;
      w.t = 1.45 - 0.12 * w.lvl;
      const n = 1 + Math.floor(w.lvl / 2);
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        shoot({ x: S.p.x + side * 10, y: S.p.y, vx: side * rand(120, 200), vy: rand(20, 60),
                r: 4, dmg: 20 + 8 * w.lvl, aoe: 22 + 3 * w.lvl, kind: 'rocket',
                life: 3.5, target: null, retarget: 0, color: this.color });
      }
    },
  },

  laser: {
    name: 'Pulse Laser', code: 'LSR', color: '#c86bff', glyph: '│',
    levels: ['Periodic beam burns everything above you', 'Wider beam', 'Longer pulses', 'More damage, faster recharge', 'Mega beam'],
    update(w, dt) {
      if (w.on > 0) {
        w.on -= dt;
        const width = 8 + 3 * w.lvl, dps = 70 + 30 * w.lvl;
        S.laser = { w: width, color: this.color };
        for (const e of S.enemies) {
          if (!e.dead && e.y < S.p.y && Math.abs(e.x - S.p.x) < width / 2 + e.r) hitEnemy(e, dps * dt, true);
        }
      } else {
        w.t -= dt;
        if (w.t <= 0) { w.t = 2.7 - 0.22 * w.lvl; w.on = 0.7 + 0.12 * w.lvl; }
      }
    },
  },

  wing: {
    name: 'Wing Cannons', code: 'WNG', color: '#3df5ff', glyph: '⇈',
    levels: ['Two escort pods copy your main gun', 'Pods hit harder', 'Pods fire faster', 'Pods hit even harder', 'Pods at full power'],
    update(w, dt) {
      w.t -= dt;
      if (w.t > 0) return;
      w.t = S.p.fireInterval * (w.lvl >= 3 ? 1.0 : 1.3);
      const dmg = CFG.player.damage * (0.4 + 0.15 * w.lvl);
      for (const side of [-1, 1]) {
        shoot({ x: S.p.x + side * 24, y: S.p.y - 4, vx: 0, vy: -CFG.player.bulletSpeed,
                r: 3, dmg, kind: 'main', color: this.color });
      }
    },
  },

  nova: {
    name: 'Nova Burst', code: 'NOV', color: '#fff36b', glyph: '✺',
    levels: ['Shockwave every few seconds; erases bullets', 'Bigger blast', 'More often', 'More damage', 'Huge, frequent blasts'],
    update(w, dt) {
      w.t -= dt;
      if (w.t > 0) return;
      w.t = 6.5 - 0.7 * w.lvl;
      S.novas.push({ x: S.p.x, y: S.p.y, r: 0, max: 70 + 18 * w.lvl, dmg: 35 + 20 * w.lvl,
                     age: 0, hit: new Set(), color: this.color });
    },
  },
};

// The simple upgrades offered on normal level-ups.
const BASIC = [
  { id: 'rapid',  name: 'Rapid Fire',    glyph: '»', color: '#3df5ff', desc: '+18% fire rate',
    apply() { S.p.fireInterval = Math.max(0.05, S.p.fireInterval * 0.85); } },
  { id: 'power',  name: 'Power Core',    glyph: '▲', color: '#ff5d5d', desc: '+20% damage, all weapons',
    apply() { S.p.dmgMul += 0.2; } },
  { id: 'shield', name: 'Shield',        glyph: '◯', color: '#6bd6ff', desc: () => `Block all damage for ${CFG.shieldDuration}s`,
    apply() { S.p.shield = CFG.shieldDuration; } },
  { id: 'magnet', name: 'Tractor Beam',  glyph: '⊕', color: COL.xp, desc: '+40% XP pickup range',
    apply() { S.p.magnet *= 1.4; } },
  { id: 'repair', name: 'Hull Repair',   glyph: '✚', color: '#5dff9e', desc: 'Restore 1 hull point',
    cond: () => S.p.hp < S.p.maxHp, apply() { S.p.hp = Math.min(S.p.maxHp, S.p.hp + 1); } },
  { id: 'armor',  name: 'Hull Plating',  glyph: '⬢', color: '#b9c4ff', desc: '+1 max hull',
    cond: () => S.p.maxHp < 6, apply() { S.p.maxHp++; S.p.hp++; } },
];

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
    state: state || 'play',     // title | play | levelup | paused | over
    t: 0, kills: 0, level: 1, xp: 0, shake: 0,
    p: {
      x: W / 2, y: H * 0.78, hp: CFG.player.hp, maxHp: CFG.player.hp,
      invuln: 0, shield: 0, fireT: 0, fireInterval: CFG.player.fireInterval,
      dmgMul: 1, magnet: CFG.player.magnetRadius,
    },
    weapons: {},
    bullets: [], ebullets: [], enemies: [], orbs: [], parts: [], novas: [], laser: null,
    spawnT: CFG.spawn.graceTime,
    pending: 0, choices: null, choiceLevel: 0, menuLock: 0, menuPress: -1, overLock: 0,
    best: parseFloat(store('starburn.best')) || 0,
  };
  input.dx = input.dy = 0;
}

// ============================================================================
// Enemies
// ============================================================================
const ENEMY = {
  drone:  { hp: 20,  r: 12, xp: 1, color: '#ff3d8b' },
  weaver: { hp: 14,  r: 11, xp: 1, color: '#ff9d3d' },
  diver:  { hp: 26,  r: 12, xp: 2, color: '#ff4040' },
  gunner: { hp: 120, r: 20, xp: 6, color: '#b45dff' },
};

function spawnEnemy(type, x, y, extra) {
  const d = ENEMY[type];
  const hp = d.hp * (1 + CFG.enemyHpGrowthPerMin * S.t / 60);
  const e = Object.assign({ type, x, y, hp, maxHp: hp, r: d.r, xp: d.xp, color: d.color,
                            age: 0, flash: 0, mode: 0, fireT: rand(0.8, 2.0), vx: 0, vy: 0 }, extra);
  S.enemies.push(e);
  return e;
}
function countType(t) { let n = 0; for (const e of S.enemies) if (e.type === t && !e.dead) n++; return n; }

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
      spawnEnemy('gunner', rand(60, W - 60), -30, { ty: rand(80, 150), vx: Math.random() < 0.5 ? -40 : 40, fireT: 1.5 });
      break;
  }
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
      e.fireT -= dt;
      if (e.fireT <= 0 && e.y > 10 && e.y < H * 0.65) { e.fireT = rand(1.6, 2.8); enemyShot(e.x, e.y + 8, aimAt(e) + rand(-0.08, 0.08)); }
      break;
    case 'weaver':
      e.y += e.vy * dt;
      e.x = e.bx + Math.sin(e.age * 2.4 + e.ph) * e.amp;
      e.fireT -= dt;
      if (e.fireT <= 0 && e.y > 10 && e.y < H * 0.6) { e.fireT = rand(2.5, 4); enemyShot(e.x, e.y + 8, Math.PI / 2); }
      break;
    case 'diver':
      if (e.mode === 0) { e.y += 140 * dt; if (e.y >= e.ty) { e.mode = 1; e.wait = 0.7; } }
      else if (e.mode === 1) {
        e.wait -= dt;
        if (e.wait <= 0) { const a = aimAt(e); e.vx = Math.cos(a) * 360; e.vy = Math.sin(a) * 360; e.mode = 2; }
      } else { e.x += e.vx * dt; e.y += e.vy * dt; }
      break;
    case 'gunner':
      if (e.mode === 0) { e.y += 70 * dt; if (e.y >= e.ty) e.mode = 1; }
      else if (e.mode === 1) {
        e.x += e.vx * dt;
        if (e.x < 30) { e.x = 30; e.vx = Math.abs(e.vx); }
        if (e.x > W - 30) { e.x = W - 30; e.vx = -Math.abs(e.vx); }
        e.fireT -= dt;
        if (e.fireT <= 0) {
          e.fireT = 2.2;
          const n = 10 + 2 * Math.floor(S.t / 120), off = Math.random() * TAU;
          for (let i = 0; i < n; i++) enemyShot(e.x, e.y, off + (i / n) * TAU, 0.8);
        }
        if (e.age > 14) e.mode = 2;
      } else e.y += 80 * dt;
      break;
  }
  if (e.y > H + 40 || e.x < -60 || e.x > W + 60) e.dead = true;   // escaped: no XP

  // Ramming the player hurts both of you.
  const dx = e.x - p.x, dy = e.y - p.y, rr = e.r + 6;
  if (!e.dead && dx * dx + dy * dy < rr * rr) {
    if (damagePlayer()) hitEnemy(e, 60, false);
  }
}

function hitEnemy(e, dmg, quiet) {
  if (e.dead) return;
  e.hp -= dmg * S.p.dmgMul;
  e.flash = 0.06;
  if (!quiet) sparks(e.x, e.y + e.r * 0.5, e.color, 2);
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  e.dead = true;
  S.kills++;
  sparks(e.x, e.y, e.color, e.type === 'gunner' ? 30 : 14);
  sparks(e.x, e.y, '#ffffff', 5);
  // Drop XP: big orbs worth 5 for chunky enemies, the rest as 1s.
  let v = e.xp;
  while (v > 0) {
    const val = v >= 5 ? 5 : 1;
    v -= val;
    const a = Math.random() * TAU, sp = rand(30, 110);
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

// ============================================================================
// Player damage, particles
// ============================================================================
function damagePlayer() {
  const p = S.p;
  if (p.invuln > 0 || p.shield > 0) return false;
  p.hp--;
  p.invuln = CFG.player.invulnTime;
  S.shake = 0.4;
  buzz(p.hp > 0 ? 90 : 300);
  sparks(p.x, p.y, COL.player, 20);
  // Mercy: wipe enemy bullets right around you.
  for (const b of S.ebullets) { const dx = b.x - p.x, dy = b.y - p.y; if (dx * dx + dy * dy < 70 * 70) b.dead = true; }
  if (p.hp <= 0) gameOver();
  return true;
}

function sparks(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    if (S.parts.length > 500) return;
    const a = Math.random() * TAU, sp = rand(40, 220);
    S.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.25, 0.6), age: 0, color, size: rand(1.2, 2.6) });
  }
}

function updateParticles(dt) {
  for (const q of S.parts) {
    q.age += dt;
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vx *= 0.94; q.vy *= 0.94;
    if (q.age >= q.life) q.dead = true;
  }
  compact(S.parts);
}

function gameOver() {
  S.state = 'over';
  S.overLock = 1.0;
  S.laser = null;
  sparks(S.p.x, S.p.y, COL.player, 60);
  sparks(S.p.x, S.p.y, COL.flame, 40);
  S.newBest = S.t > S.best;
  if (S.newBest) { S.best = S.t; store('starburn.best', String(S.t)); }
}

// ============================================================================
// Level-ups
// ============================================================================
function buildChoices(level) {
  const owned = Object.keys(S.weapons);
  const unowned = Object.keys(WEAPONS).filter(id => !S.weapons[id]);
  if (level % CFG.weaponEveryNLevels === 0 && unowned.length) {
    return shuffle(unowned).slice(0, CFG.upgradeChoices).map(id => ({ kind: 'weapon', id }));
  }
  const pool = [];
  for (const u of BASIC) if (!u.cond || u.cond()) pool.push({ kind: 'basic', u });
  for (const id of owned) if (S.weapons[id].lvl < CFG.weaponMaxLevel) pool.push({ kind: 'wup', id });
  return shuffle(pool).slice(0, CFG.upgradeChoices);
}

function choiceInfo(c) {
  if (c.kind === 'basic') {
    return { title: c.u.name, desc: typeof c.u.desc === 'function' ? c.u.desc() : c.u.desc, glyph: c.u.glyph, color: c.u.color, tag: 'UPGRADE' };
  }
  const w = WEAPONS[c.id];
  if (c.kind === 'weapon') return { title: w.name, desc: w.levels[0], glyph: w.glyph, color: w.color, tag: 'NEW WEAPON' };
  const lvl = S.weapons[c.id].lvl;
  return { title: `${w.name}  ${lvl}→${lvl + 1}`, desc: w.levels[lvl], glyph: w.glyph, color: w.color, tag: 'WEAPON UPGRADE' };
}

function openLevelUp() {
  S.state = 'levelup';
  S.choiceLevel = S.level - S.pending + 1;
  S.choices = buildChoices(S.choiceLevel);
  S.menuLock = 0.4;      // ignore taps briefly so a lifted finger doesn't pick by accident
  S.menuPress = -1;
  buzz(30);
}

function choose(i) {
  const c = S.choices && S.choices[i];
  if (!c) return;
  if (c.kind === 'basic') c.u.apply();
  else if (c.kind === 'weapon') S.weapons[c.id] = { lvl: 1, t: 0, on: 0 };
  else S.weapons[c.id].lvl++;
  S.pending--;
  if (S.pending > 0) openLevelUp();
  else {
    S.state = 'play';
    S.choices = null;
    S.p.invuln = Math.max(S.p.invuln, CFG.postLevelUpInvuln);
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

  // --- movement: finger drag is relative, so your finger never covers the ship
  const kx = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
  const ky = (keys.arrowdown || keys.s ? 1 : 0) - (keys.arrowup || keys.w ? 1 : 0);
  p.x += kx * CFG.player.keySpeed * dt + input.dx * CFG.player.dragSensitivity;
  p.y += ky * CFG.player.keySpeed * dt + input.dy * CFG.player.dragSensitivity;
  input.dx = input.dy = 0;
  p.x = clamp(p.x, 12, W - 12);
  p.y = clamp(p.y, 60, H - 20);
  p.invuln = Math.max(0, p.invuln - dt);
  p.shield = Math.max(0, p.shield - dt);

  // --- main gun: always firing
  p.fireT -= dt;
  while (p.fireT <= 0) {
    p.fireT += p.fireInterval;
    shoot({ x: p.x, y: p.y - 16, vx: 0, vy: -CFG.player.bulletSpeed, r: 3, dmg: CFG.player.damage, kind: 'main', color: COL.player });
  }

  // --- extra weapons
  S.laser = null;
  for (const id in S.weapons) WEAPONS[id].update(S.weapons[id], dt);

  // --- spawning
  S.spawnT -= dt;
  if (S.spawnT <= 0) {
    const k = clamp(S.t / CFG.spawn.rampSeconds, 0, 1);
    S.spawnT = lerp(CFG.spawn.startInterval, CFG.spawn.minInterval, k) * rand(0.7, 1.3);
    spawnPattern();
  }

  // --- player bullets
  for (const b of S.bullets) {
    if (b.kind === 'rocket') {
      b.life -= dt;
      b.retarget -= dt;
      if ((!b.target || b.target.dead) && b.retarget <= 0) {
        b.retarget = 0.15;
        let best = null, bd = Infinity;
        for (const e of S.enemies) {
          if (e.dead || e.y < -10) continue;
          const d = (e.x - b.x) ** 2 + (e.y - b.y) ** 2;
          if (d < bd) { bd = d; best = e; }
        }
        b.target = best;
      }
      // steer toward the target, speeding up as it goes
      let ang = Math.atan2(b.vy, b.vx);
      const want = b.target && !b.target.dead ? Math.atan2(b.target.y - b.y, b.target.x - b.x) : -Math.PI / 2;
      let diff = want - ang;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      ang += clamp(diff, -6 * dt, 6 * dt);
      const sp = Math.min(460, Math.hypot(b.vx, b.vy) + 700 * dt);
      b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
      if (Math.random() < 0.6) S.parts.push({ x: b.x, y: b.y, vx: rand(-15, 15), vy: rand(-15, 15), life: 0.3, age: 0, color: '#ff8a3d', size: 1.6 });
      if (b.life <= 0) b.dead = true;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y < -20 || b.y > H + 20 || b.x < -20 || b.x > W + 20) { b.dead = true; continue; }
    for (const e of S.enemies) {
      if (e.dead) continue;
      const dx = b.x - e.x, dy = b.y - e.y, rr = b.r + e.r;
      if (dx * dx + dy * dy < rr * rr) {
        if (b.kind === 'rocket') explode(b.x, b.y, b.aoe, b.dmg);
        else hitEnemy(e, b.dmg, false);
        b.dead = true;
        break;
      }
    }
  }

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
      for (const b of S.ebullets) {
        const dx = b.x - n.x, dy = b.y - n.y;
        if (dx * dx + dy * dy < n.r * n.r) b.dead = true;
      }
    }
    if (n.age > (n.small ? 0.3 : 0.55)) n.dead = true;
  }

  // --- enemy bullets
  const shieldR = 20;
  for (const b of S.ebullets) {
    if (b.dead) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y < -20 || b.y > H + 20 || b.x < -20 || b.x > W + 20) { b.dead = true; continue; }
    const dx = b.x - p.x, dy = b.y - p.y, d2 = dx * dx + dy * dy;
    if (p.shield > 0) {
      if (d2 < (shieldR + b.r) ** 2) { b.dead = true; sparks(b.x, b.y, '#6bd6ff', 3); }
    } else if (d2 < (CFG.player.hitRadius + b.r * 0.6) ** 2 && p.invuln <= 0) {
      b.dead = true;
      damagePlayer();
    }
  }

  // --- XP orbs: drift down, get pulled in when you're close
  for (const o of S.orbs) {
    o.age += dt;
    const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy);
    if (d < p.magnet) {
      const pull = CFG.xp.pullSpeed * dt;
      o.x += (dx / d) * Math.min(pull, d);
      o.y += (dy / d) * Math.min(pull, d);
    } else {
      o.vx *= Math.pow(0.02, dt);  // initial burst slows down quickly
      o.vy *= Math.pow(0.02, dt);
      o.x += o.vx * dt;
      o.y += (o.vy + CFG.xp.orbFallSpeed) * dt;
    }
    if (d < 12) {
      o.dead = true;
      S.xp += o.v;
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

function update(dt) {
  updateStars(S && S.state === 'play' ? dt * 1.6 : dt * 0.6);
  if (!S) return;
  if (S.state === 'play') gameUpdate(dt);
  else if (S.state === 'levelup') S.menuLock -= dt;
  else if (S.state === 'over') { S.overLock -= dt; S.shake = Math.max(0, S.shake - dt); updateParticles(dt); }
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

function drawShip(x, y, scale, body, edge) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  path([0, -16, 5, -4, 14, 8, 5, 6, 0, 10, -5, 6, -14, 8, -5, -4]);
  ctx.fillStyle = body; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = edge; ctx.stroke();
  ctx.fillStyle = '#c8fbff';
  ctx.beginPath(); ctx.ellipse(0, -4, 2.2, 4, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawPlayer() {
  const p = S.p;
  const blink = p.invuln > 0 && Math.floor(p.invuln * 16) % 2 === 0;
  ctx.globalCompositeOperation = 'lighter';
  glow(p.x, p.y + 12, 12, COL.flame, 0.8);
  glow(p.x, p.y, 26, COL.player, 0.25);
  ctx.globalCompositeOperation = 'source-over';
  const f = rand(6, 12);
  ctx.fillStyle = '#ffb3f3';
  path([p.x - 3.5, p.y + 9, p.x + 3.5, p.y + 9, p.x, p.y + 9 + f]);
  ctx.fill();
  if (!blink) drawShip(p.x, p.y, 1, COL.playerDark, COL.player);
  if (S.weapons.wing) for (const s of [-1, 1]) drawShip(p.x + s * 24, p.y + 4, 0.5, COL.playerDark, WEAPONS.wing.color);
  // hitbox dot: this is the only part that can be hit
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(p.x, p.y, CFG.player.hitRadius - 1, 0, TAU); ctx.fill();
  ctx.strokeStyle = COL.flame; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(p.x, p.y, CFG.player.hitRadius + 0.5, 0, TAU); ctx.stroke();
  if (p.shield > 0) {
    const a = p.shield < 2 ? (Math.floor(p.shield * 8) % 2 ? 0.25 : 0.7) : 0.6;
    ctx.strokeStyle = '#6bd6ff'; ctx.lineWidth = 2; ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, 23, -Math.PI / 2, -Math.PI / 2 + TAU * (p.shield / CFG.shieldDuration)); ctx.stroke();
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
  }
  ctx.fill();
  ctx.stroke();
  if (e.type === 'gunner') {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
    // health bar
    ctx.fillStyle = '#ffffff22'; ctx.fillRect(-18, -28, 36, 3);
    ctx.fillStyle = e.color; ctx.fillRect(-18, -28, 36 * Math.max(0, e.hp / e.maxHp), 3);
  } else {
    ctx.fillStyle = c;
    ctx.fillRect(-1.5, -2, 3, 3);
  }
  ctx.restore();
}

function drawWorld() {
  // XP orbs
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

  // Player bullets
  ctx.globalCompositeOperation = 'lighter';
  for (const b of S.bullets) {
    if (b.kind === 'rocket') {
      glow(b.x, b.y, 10, b.color, 0.8);
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.fillStyle = '#ffe0c8'; ctx.fillRect(-5, -1.5, 9, 3);
      ctx.restore();
    } else {
      glow(b.x, b.y, 7, b.color, 0.6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - 1.2, b.y - 6, 2.4, 10);
    }
  }
  // Laser beam
  if (S.laser) {
    const x = S.p.x, w = S.laser.w, top = 0, bot = S.p.y - 14;
    ctx.globalAlpha = 0.35 + Math.random() * 0.15;
    ctx.fillStyle = S.laser.color;
    ctx.fillRect(x - w, top, w * 2, bot - top);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - w * 0.25, top, w * 0.5, bot - top);
    ctx.globalAlpha = 1;
    glow(x, bot, w * 2, S.laser.color, 0.9);
  }
  // Novas
  for (const n of S.novas) {
    const life = n.small ? 0.3 : 0.55;
    ctx.globalAlpha = Math.max(0, 1 - n.age / life);
    ctx.strokeStyle = n.color;
    ctx.lineWidth = n.small ? 2 : 4;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Particles
  for (const q of S.parts) {
    ctx.globalAlpha = 1 - q.age / q.life;
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  if (S.state !== 'over') drawPlayer();

  // Enemy bullets last, so they're never hidden behind anything
  for (const b of S.ebullets) ctx.drawImage(eShotSprite, b.x - 12, b.y - 12, 24, 24);
}

function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

const PAUSE_BTN = { x: W - 44, y: 10, w: 40, h: 40 };

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
  ctx.fillText(`LV ${S.level}`, 10, 22);
  ctx.textAlign = 'center';
  ctx.fillText(fmtTime(S.t), W / 2, 22);
  ctx.font = `500 10px ${FONT}`;
  ctx.fillStyle = COL.dim;
  ctx.fillText(`${S.kills} KILLS`, W / 2, 37);

  // hull pips
  for (let i = 0; i < p.maxHp; i++) {
    const x = 14 + i * 14, y = 38;
    path([x, y - 5, x + 5, y, x, y + 5, x - 5, y]);
    if (i < p.hp) { ctx.fillStyle = COL.player; ctx.fill(); }
    else { ctx.strokeStyle = '#3df5ff55'; ctx.lineWidth = 1; ctx.stroke(); }
  }

  // owned weapons
  ctx.textAlign = 'left';
  ctx.font = `700 9px ${FONT}`;
  let wy = 54;
  for (const id in S.weapons) {
    const w = WEAPONS[id];
    ctx.fillStyle = w.color;
    ctx.fillText(`${w.code} ${'■'.repeat(S.weapons[id].lvl)}`, 8, wy);
    wy += 12;
  }

  // pause button
  if (S.state === 'play') {
    ctx.fillStyle = '#ffffff99';
    ctx.fillRect(PAUSE_BTN.x + 13, PAUSE_BTN.y + 8, 5, 16);
    ctx.fillRect(PAUSE_BTN.x + 23, PAUSE_BTN.y + 8, 5, 16);
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
  ctx.globalAlpha = 0.85;
  ctx.fillText(text, x, y);
  ctx.globalAlpha = 1;
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

function cardRects() {
  const n = S.choices.length, ch = 88, gap = 14, total = n * ch + (n - 1) * gap;
  const y0 = Math.max(150, H * 0.52 - total / 2);
  const out = [];
  for (let i = 0; i < n; i++) out.push({ x: 20, y: y0 + i * (ch + gap), w: W - 40, h: ch });
  return out;
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawLevelUp() {
  dim(0.78);
  const rects = cardRects();
  const isWeapon = S.choices[0] && S.choices[0].kind === 'weapon';
  const titleY = rects[0].y - 74;
  neonText('LEVEL UP', W / 2, titleY, 34, isWeapon ? '#ffd23f' : COL.xp);
  smallText(isWeapon ? 'NEW WEAPON SYSTEM: CHOOSE ONE' : `LEVEL ${S.choiceLevel}: CHOOSE ONE`, W / 2, titleY + 34, 11, COL.text, 700);

  S.choices.forEach((c, i) => {
    const r = rects[i], info = choiceInfo(c), pressed = S.menuPress === i;
    roundRect(r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = pressed ? info.color + '44' : '#0e0a24ee';
    ctx.fill();
    ctx.lineWidth = pressed ? 3 : 1.5;
    ctx.strokeStyle = info.color;
    ctx.stroke();
    // icon
    const ix = r.x + 38, iy = r.y + r.h / 2;
    ctx.globalCompositeOperation = 'lighter';
    glow(ix, iy, 34, info.color, 0.35);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = info.color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ix, iy, 22, 0, TAU); ctx.stroke();
    ctx.font = `700 22px system-ui, sans-serif`;
    ctx.fillStyle = info.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(info.glyph, ix, iy + 1);
    // text
    const tx = r.x + 74, tw = r.w - 86;
    ctx.textAlign = 'left';
    ctx.font = `700 9px ${FONT}`;
    ctx.fillStyle = info.color;
    ctx.fillText(info.tag, tx, r.y + 18);
    ctx.font = `800 14px ${FONT}`;
    ctx.fillStyle = COL.text;
    ctx.fillText(info.title, tx, r.y + 36);
    ctx.font = `400 12px system-ui, sans-serif`;
    ctx.fillStyle = '#b8c2e0';
    wrapLines(info.desc, tw).slice(0, 2).forEach((ln, k) => ctx.fillText(ln, tx, r.y + 56 + k * 15));
  });
  if (S.menuLock > 0) { ctx.globalAlpha = 0.5; dim(0.3); ctx.globalAlpha = 1; }
}

function drawTitle() {
  dim(0.35);
  const cy = H * 0.34;
  neonText('STARBURN', W / 2, cy, 44, '#ff4fd8');
  smallText('SHOOT  ·  SALVAGE  ·  EVOLVE', W / 2, cy + 38, 11, COL.player, 700);
  const lines = [
    'Drag anywhere to fly.',
    'Your ship fires on its own.',
    'Fly over green crystals to level up.',
    'Only the white dot can be hit.',
  ];
  lines.forEach((l, i) => smallText(l, W / 2, cy + 90 + i * 22, 13, COL.text, 400));
  const a = 0.55 + 0.45 * Math.sin(performance.now() / 300);
  ctx.globalAlpha = a;
  neonText('TAP TO LAUNCH', W / 2, H * 0.74, 18, COL.xp, 800);
  ctx.globalAlpha = 1;
  if (S.best > 0) smallText(`BEST TIME  ${fmtTime(S.best)}`, W / 2, H * 0.74 + 34, 11, COL.dim, 700);
}

function drawPaused() {
  dim(0.7);
  neonText('PAUSED', W / 2, H * 0.42, 36, COL.player);
  smallText('Tap to resume', W / 2, H * 0.42 + 44, 13, COL.text, 400);
}

function drawGameOver() {
  dim(0.6);
  const cy = H * 0.32;
  neonText('SHIP LOST', W / 2, cy, 36, COL.flame);
  const rows = [
    ['SURVIVED', fmtTime(S.t)],
    ['LEVEL', String(S.level)],
    ['KILLS', String(S.kills)],
    ['BEST', fmtTime(S.best)],
  ];
  rows.forEach(([k, v], i) => {
    const y = cy + 66 + i * 30;
    ctx.font = `700 12px ${FONT}`; ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillStyle = COL.dim; ctx.fillText(k, W / 2 - 100, y);
    ctx.textAlign = 'right'; ctx.fillStyle = COL.text; ctx.fillText(v, W / 2 + 100, y);
  });
  if (S.newBest) smallText('NEW BEST TIME!', W / 2, cy + 66 + 4 * 30 + 6, 13, '#ffd23f', 800);
  if (S.overLock <= 0) {
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(performance.now() / 300);
    neonText('TAP TO FLY AGAIN', W / 2, H * 0.78, 17, COL.xp, 800);
    ctx.globalAlpha = 1;
  }
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = COL.bg;
  ctx.fillRect(0, 0, cv.width, cv.height);
  let sx = 0, sy = 0;
  if (S && S.shake > 0) { sx = rand(-1, 1) * S.shake * 10; sy = rand(-1, 1) * S.shake * 10; }
  ctx.setTransform(SCALE, 0, 0, SCALE, sx * SCALE, sy * SCALE);
  drawStars();
  if (!S) return;
  drawWorld();
  if (S.state !== 'title') drawHud();
  if (S.state === 'title') drawTitle();
  else if (S.state === 'levelup') drawLevelUp();
  else if (S.state === 'paused') drawPaused();
  else if (S.state === 'over') drawGameOver();
}

// ============================================================================
// Input: touch / mouse drag, plus keyboard for testing on a computer
// ============================================================================
const input = { dx: 0, dy: 0, id: null, lx: 0, ly: 0, armed: false };
const keys = {};

function toWorld(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
function inRect(pt, r) { return pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h; }
function cardAt(pt) {
  if (!S.choices) return -1;
  const rs = cardRects();
  for (let i = 0; i < rs.length; i++) if (inRect(pt, rs[i])) return i;
  return -1;
}

function startGame() {
  newGame('play');
  try { const el = document.documentElement; el.requestFullscreen && el.requestFullscreen().catch(() => {}); } catch (e) {}
}

window.addEventListener('pointerdown', e => {
  if (!S) return;
  const pt = toWorld(e);
  if (S.state === 'play') {
    if (inRect(pt, PAUSE_BTN)) { S.state = 'paused'; return; }
    input.id = e.pointerId; input.lx = e.clientX; input.ly = e.clientY;
  } else if (S.state === 'levelup') {
    if (S.menuLock <= 0) S.menuPress = cardAt(pt);
  } else {
    input.armed = true;
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

function pointerEnd(e) {
  if (e.pointerId === input.id) input.id = null;
  if (!S) return;
  if (S.state === 'levelup') {
    const i = S.menuPress;
    S.menuPress = -1;
    if (i >= 0 && S.menuLock <= 0 && cardAt(toWorld(e)) === i) choose(i);
  } else if (input.armed) {
    input.armed = false;
    if (S.state === 'title') startGame();
    else if (S.state === 'paused') { S.state = 'play'; input.dx = input.dy = 0; }
    else if (S.state === 'over' && S.overLock <= 0) startGame();
  }
}
window.addEventListener('pointerup', pointerEnd);
window.addEventListener('pointercancel', e => { if (e.pointerId === input.id) input.id = null; input.armed = false; if (S) S.menuPress = -1; });

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (!S) return;
  if ((k === 'escape' || k === 'p') && (S.state === 'play' || S.state === 'paused')) S.state = S.state === 'play' ? 'paused' : 'play';
  if (S.state === 'levelup' && S.menuLock <= 0 && ['1', '2', '3'].includes(k)) choose(+k - 1);
  if ((k === 'enter' || k === ' ') && (S.state === 'title' || (S.state === 'over' && S.overLock <= 0))) startGame();
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
window.STARBURN = { get S() { return S; }, CFG, giveXp(n) { if (S) S.xp += n; } };
