// STARBURN art: the pop-art comic look. Every bit of drawing, the menus, and
// the main loop live here; game.js holds the rules.
// Style: thick ink outlines, flat colour with a hard cel shadow full of
// halftone dots, comic lettering, starburst sound effects.
'use strict';

const INK = COL.ink, PAPER = COL.paper;
const FONT_D = '"Bangers", Impact, "Arial Black", sans-serif';           // display lettering
const FONT_B = '"Comic Neue", "Trebuchet MS", "Segoe UI", sans-serif';    // small print
const SHADE = 'rgba(20,16,31,0.36)';
const BG = { base: '#1d1648', dotA: '#2c2270', dotB: '#3b1f66' };
const GEM = '#8dffbf';   // XP gem mint (brighter than the UI green so it pops off the purple sky)
const GEM_GLOW = (() => {      // soft mint glow drawn behind every gem
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(141,255,191,0.75)'); gr.addColorStop(0.35, 'rgba(93,255,160,0.35)'); gr.addColorStop(1, 'rgba(93,255,160,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return c;
})();

// Make the browser fetch the comic fonts (canvas text alone doesn't trigger it).
try { document.fonts.load('20px "Bangers"'); document.fonts.load('700 12px "Comic Neue"'); } catch (e) {}

// ============================================================================
// Halftone helpers: a dot pattern for cel shadows and a scrolling dotted sky
// ============================================================================
let dotPattern = null, bgCanvas = null, bgY = 0;

function artResize() {
  // dots for shadows: about 3 world units apart, crisp at device resolution
  const ds = Math.max(4, Math.round(3.2 * SCALE));
  const dc = document.createElement('canvas');
  dc.width = dc.height = ds;
  const dg = dc.getContext('2d');
  dg.fillStyle = INK;
  dg.beginPath(); dg.arc(ds / 2, ds / 2, ds * 0.3, 0, TAU); dg.fill();
  dotPattern = ctx.createPattern(dc, 'repeat');
  try { dotPattern.setTransform(new DOMMatrix().scale(1 / SCALE)); } catch (e) {}

  buildBackground(themeStage());
}

// Each stage has its own sky and ambient motion.
const THEMES = {
  1: { base: '#1d1648', dotA: '#2c2270', dotB: '#3b1f66', amb: 'stars' },     // hive fleet
  2: { base: '#070a1f', dotA: '#1b2a6b', dotB: '#4a1460', amb: 'warp' },      // warp zone
  3: { base: '#062a3c', dotA: '#0e4a5e', dotB: '#0b3a52', amb: 'bubbles' },   // the deep
  4: { base: '#36101a', dotA: '#561828', dotB: '#481020', amb: 'cells' },     // inside the leviathan
  5: { base: '#0b0614', amb: 'shards', rainbow: true },                        // prismatic void
  6: { base: '#0a0308', dotA: '#3a0a1a', dotB: '#24082e', amb: 'stars' },     // boss rush (then each boss brings its home sky)
};
let bgStage = 0, bgT = 0;
const themeStage = () => (S && (S.rushStage || S.stage)) || META.lastStage || 1;
function buildBackground(stage) {
  const th = THEMES[stage] || THEMES[1];
  bgStage = stage;
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = cv.width; bgCanvas.height = cv.height;
  const g = bgCanvas.getContext('2d'), h = cv.height, w = cv.width, sp = 11 * SCALE;
  g.fillStyle = th.base; g.fillRect(0, 0, w, h);
  for (let row = 0, y = 0; y < h + sp; row++, y += sp * 0.87) {
    for (let x = (row % 2) * sp / 2; x < w + sp; x += sp) {
      const ph = (y / h) * TAU, f = 0.5 + 0.5 * Math.sin(ph + x / w * 1.5);
      const r = sp * 0.48 * (0.12 + 0.88 * f * f);
      g.fillStyle = th.rainbow ? `hsl(${(x / w * 220 + y / h * 360) % 360},65%,${16 + 10 * f}%)` : Math.cos(ph) > 0 ? th.dotA : th.dotB;
      g.beginPath(); g.arc(x, y % h, r, 0, TAU); g.fill();
    }
  }
  if (stage === 4) {                                   // veins in the flesh walls
    g.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      let x = Math.random() * w, y = h * (0.06 + Math.random() * 0.88);
      for (let k = 0; k < 5; k++) {
        const nx = x + (Math.random() - 0.5) * w * 0.3, ny = Math.min(h * 0.96, Math.max(h * 0.04, y + (Math.random() - 0.5) * h * 0.2));
        for (const [lw, c] of [[4.5, '#1f060c'], [2, '#7a2236']]) {
          g.lineWidth = lw * SCALE; g.strokeStyle = c;
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + nx) / 2 + (Math.random() - 0.5) * 40 * SCALE, (y + ny) / 2, nx, ny); g.stroke();
        }
        x = nx; y = ny;
      }
    }
  }
  initStars();
}

let stars = [];
function initStars() {
  stars = [];
  const amb = (THEMES[bgStage] || THEMES[1]).amb;
  const n = { stars: 46, warp: 44, bubbles: 34, cells: 26, shards: 22 }[amb];
  for (let i = 0; i < n; i++) {
    const st = { x: Math.random() * W, y: Math.random() * H, tw: Math.random() * TAU, amb };
    if (amb === 'stars') Object.assign(st, { line: i % 3 !== 0, len: rand(12, 34), sz: rand(1.6, 3.2) });
    if (amb === 'warp') Object.assign(st, { len: rand(30, 120), sp: rand(600, 1100), col: pick(['#7de0ff', '#ff5df0', '#fff8e7', '#9b8aff']) });
    if (amb === 'bubbles') Object.assign(st, { r: rand(1.5, 5), sp: rand(25, 70) });
    if (amb === 'cells') Object.assign(st, { r: rand(3, 7.5), sp: rand(18, 45), rot: Math.random() * TAU });
    if (amb === 'shards') Object.assign(st, { s: rand(4, 11), sp: rand(15, 40), rot: Math.random() * TAU, vr: rand(-1.5, 1.5), hue: Math.random() * 360 });
    stars.push(st);
  }
}
function artUpdate(dt) {
  const boost = S && S.overdrive > 0 ? 2.2 : 1;
  bgY += 14 * dt; bgT += dt;
  for (const s of stars) {
    s.tw += dt * 4;
    if (s.amb === 'stars') { s.y += (s.line ? 260 * boost : 40) * dt; if (s.y - s.len > H) { s.y = -s.len; s.x = Math.random() * W; } }
    else if (s.amb === 'warp') { s.y += s.sp * boost * dt; if (s.y - s.len > H) { s.y = -s.len; s.x = Math.random() * W; } }
    else if (s.amb === 'bubbles') { s.y -= s.sp * dt; s.x += Math.sin(s.tw * 0.6) * 12 * dt; if (s.y < -10) { s.y = H + 10; s.x = Math.random() * W; } }
    else { s.y += s.sp * boost * dt; if (s.rot !== undefined) s.rot += (s.vr || 0.5) * dt; if (s.y > H + 15) { s.y = -15; s.x = Math.random() * W; } }
  }
}
function drawBackground() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const h = cv.height, off = (bgY * SCALE) % h;
  ctx.drawImage(bgCanvas, 0, off - h);
  ctx.drawImage(bgCanvas, 0, off);
}
function drawStars() {
  const amb = (THEMES[bgStage] || THEMES[1]).amb;
  if (amb === 'stars') {
    ctx.strokeStyle = PAPER; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.22;
    ctx.beginPath();
    for (const s of stars) if (s.line) { ctx.moveTo(s.x, s.y - s.len); ctx.lineTo(s.x, s.y); }
    ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = COL.gold;
    for (const s of stars) if (!s.line) sparkle(s.x, s.y, s.sz * (0.7 + 0.3 * Math.sin(s.tw)));
  } else if (amb === 'warp') {                         // streaking light at warp speed
    ctx.lineWidth = 1.8; ctx.globalAlpha = 0.45;
    for (const s of stars) { ctx.strokeStyle = s.col; ctx.beginPath(); ctx.moveTo(s.x, s.y - s.len); ctx.lineTo(s.x, s.y); ctx.stroke(); }
    ctx.globalAlpha = 0.08 + 0.05 * Math.sin(bgT * 3);
    ctx.fillStyle = '#ff5df0'; ctx.fillRect(0, 0, 18, H); ctx.fillStyle = '#7de0ff'; ctx.fillRect(W - 18, 0, 18, H);
    ctx.globalAlpha = 1;
  } else if (amb === 'bubbles') {                      // light from the surface, rising bubbles
    const gr = ctx.createLinearGradient(0, 0, 0, H * 0.6);
    gr.addColorStop(0, 'rgba(120,230,230,0.22)'); gr.addColorStop(1, 'rgba(120,230,230,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H * 0.6);
    ctx.fillStyle = 'rgba(200,255,250,0.05)';
    for (let k = 0; k < 4; k++) {
      const x = W * (0.15 + k * 0.25) + Math.sin(bgT * 0.5 + k) * 30;
      path([x - 10, 0, x + 26, 0, x + 70 + k * 10, H, x - 10, H]); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(220,255,250,0.55)'; ctx.lineWidth = 1.2;
    for (const s of stars) {
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(s.x - s.r * 0.4, s.y - s.r * 0.5, 1.2, 1.2);
    }
  } else if (amb === 'cells') {                        // drifting blood cells and a heartbeat in the walls
    for (const s of stars) {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.scale(1, 0.7);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#b0283e'; ctx.beginPath(); ctx.arc(0, 0, s.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6e1424'; ctx.beginPath(); ctx.arc(0, 0, s.r * 0.45, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    const beat = Math.pow(Math.max(0, Math.sin(bgT * TAU * 1.1)), 10);
    if (beat > 0.01) {
      for (const [x0, x1] of [[0, 60], [W, W - 60]]) {
        const gr = ctx.createLinearGradient(x0, 0, x1, 0);
        gr.addColorStop(0, `rgba(255,60,80,${0.28 * beat})`); gr.addColorStop(1, 'rgba(255,60,80,0)');
        ctx.fillStyle = gr; ctx.fillRect(Math.min(x0, x1), 0, 60, H);
      }
    }
  } else if (amb === 'shards') {                       // prism shards tumbling through the void
    for (const s of stars) {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot);
      path([0, -s.s, s.s * 0.8, s.s * 0.6, -s.s * 0.8, s.s * 0.6]);
      ctx.globalAlpha = 0.55; ctx.fillStyle = `hsl(${(s.hue + bgT * 40) % 360},90%,65%)`; ctx.fill();
      ctx.globalAlpha = 0.8; ctx.lineWidth = 1.2; ctx.strokeStyle = PAPER; ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
function sparkle(x, y, r) {          // 4-point comic twinkle
  ctx.beginPath();
  ctx.moveTo(x, y - r * 2); ctx.quadraticCurveTo(x, y, x + r * 2, y);
  ctx.quadraticCurveTo(x, y, x, y + r * 2); ctx.quadraticCurveTo(x, y, x - r * 2, y);
  ctx.quadraticCurveTo(x, y, x, y - r * 2);
  ctx.fill();
}

// ============================================================================
// Shape helpers
// ============================================================================
function path(points) {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.closePath();
}

// Flat colour + hard shadow (with halftone dots) on the lower right + highlight + ink outline.
// Call with ctx already translated to the shape's centre. s = rough radius.
function cel(pts, base, s, flash, lw) { celBuild(() => path(pts), base, s, flash, lw); }
// OUTLINE: when true, shapes draw only a white rim (first pass), giving enemies a
// thin white silhouette outline; the normal pass then paints over the inside.
let OUTLINE = false;
const OUT_W = 1.3;
function celBuild(build, base, s, flash, lw) {
  if (OUTLINE) {
    build();
    ctx.lineJoin = 'round';
    ctx.lineWidth = (lw || 2.4) + OUT_W * 2;
    ctx.strokeStyle = PAPER;
    ctx.stroke();
    return;
  }
  build();
  ctx.fillStyle = flash ? PAPER : base;
  ctx.fill();
  if (!flash) {
    ctx.save();
    build();
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(s * 0.12, -s * 2); ctx.lineTo(s * 2, -s * 2); ctx.lineTo(s * 2, s * 2); ctx.lineTo(-s * 0.7, s * 2);
    ctx.closePath();
    ctx.fillStyle = SHADE; ctx.fill();
    if (dotPattern) { ctx.globalAlpha = 0.45; ctx.fillStyle = dotPattern; ctx.fill(); ctx.globalAlpha = 1; }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.ellipse(-s * 0.38, -s * 0.28, s * 0.1, s * 0.3, 0.5, 0, TAU); ctx.fill();
    ctx.restore();
  }
  build();
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw || 2.4;
  ctx.strokeStyle = INK;
  ctx.stroke();
}
function oval(cx, cy, rx, ry, rot, color, flash, lw) {
  ctx.save(); ctx.translate(cx, cy); if (rot) ctx.rotate(rot);
  celBuild(() => { ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); }, color, Math.max(rx, ry), flash, lw);
  ctx.restore();
}
const toneCache = {};
function tone(hex, f) {           // f < 0 darker, f > 0 lighter
  const key = hex + f;
  if (toneCache[key]) return toneCache[key];
  const n = parseInt(hex.slice(1), 16), t = f < 0 ? 0 : 255, k = Math.abs(f);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (t - v) * k));
  return (toneCache[key] = `rgb(${c[0]},${c[1]},${c[2]})`);
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

function burstPath(size, spikes, seed) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * TAU - Math.PI / 2;
    const r = i % 2 ? size * 0.6 : size * (0.92 + 0.14 * Math.sin(i * 2.3 + seed));
    i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

// a gooey splat: a lumpy blob with a few drops thrown off it
function splatPath(r, seed) {
  ctx.beginPath();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU, k = 0.72 + 0.22 * Math.sin(i * 2.7 + seed) + (i % 3 === 0 ? 0.22 : 0);
    const x = Math.cos(a) * r * k, y = Math.sin(a) * r * k;
    if (i === 0) ctx.moveTo(x, y);
    else { const am = a - Math.PI / n, km = 0.6 + 0.15 * Math.cos(i * 1.9 + seed); ctx.quadraticCurveTo(Math.cos(am) * r * km, Math.sin(am) * r * km, x, y); }
  }
  ctx.closePath();
  for (let j = 0; j < 4; j++) {
    const a = seed * 1.7 + j * 1.9, d = r * (1.15 + 0.15 * j), dr = r * (0.13 - j * 0.02);
    ctx.moveTo(Math.cos(a) * d + dr, Math.sin(a) * d);
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, dr, 0, TAU);
  }
}

function heart(x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y, x - s * 0.7, y - s * 1.1, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y, x, y + s * 0.9);
  ctx.closePath();
}

// ============================================================================
// Lettering
// ============================================================================
function inkText(text, x, y, size, fill, align, font, lw) {
  ctx.font = `${size}px ${font || FONT_D}`;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw === undefined ? Math.max(2, size * 0.2) : lw;
  ctx.strokeStyle = INK;
  if (ctx.lineWidth > 0) ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}
function plainText(text, x, y, size, fill, align, font) {
  ctx.font = `${font === FONT_B ? '700 ' : ''}${size}px ${font || FONT_D}`;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fill;
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
function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// A comic panel: hard ink drop shadow, flat fill, ink border.
function panel(x, y, w, h, fill, shadow) {
  const sh = shadow === undefined ? 4 : shadow;
  if (sh) { roundRect(x + sh, y + sh, w, h, 5); ctx.fillStyle = INK; ctx.fill(); }
  roundRect(x, y, w, h, 5);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
}
function dotsIn(x, y, w, h, alpha) {     // halftone overlay inside a rect
  if (!dotPattern) return;
  ctx.save();
  roundRect(x, y, w, h, 5); ctx.clip();
  ctx.globalAlpha = alpha; ctx.fillStyle = dotPattern; ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// Big lettering on a starburst, e.g. "LEVEL UP!"
function burstTitle(text, x, y, size, bg, fg, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot || -0.06);
  ctx.font = `${size}px ${FONT_D}`;
  const w = ctx.measureText(text).width;
  ctx.save(); ctx.scale(Math.max(1, w / size * 0.62), 0.8);
  burstPath(size * 1.05, 14, 1);
  ctx.restore();
  ctx.fillStyle = bg; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  inkText(text, 3, 3, size, INK, 'center', FONT_D, 0);
  inkText(text, 0, 0, size, fg, 'center', FONT_D, size * 0.16);
  ctx.restore();
}

function dim(a) { ctx.fillStyle = `rgba(20,16,31,${a})`; ctx.fillRect(0, 0, W, H); }

// ============================================================================
// Ships
// ============================================================================
const SHIP_SIZE = 1.2;   // player ships are drawn 20% bigger (the hitbox dot stays tiny)
function drawShip(x, y, scale, ship, locked) {
  ship = ship || SHIPS.vesper;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (locked) {
    path(ship.shape);
    ctx.fillStyle = '#4a4470'; ctx.fill();
    ctx.lineJoin = 'round'; ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.stroke();
  } else {
    cel(ship.shape, ship.color, 15, false, 2.4);
    ctx.fillStyle = PAPER;
    ctx.beginPath(); ctx.ellipse(0, -4, 2.4, 4.2, 0, 0, TAU); ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = INK; ctx.stroke();
  }
  ctx.restore();
}

function drawFlame(x, y, s) {
  const f = rand(7, 13) * s;
  ctx.beginPath();
  ctx.moveTo(x - 4.5 * s, y);
  ctx.quadraticCurveTo(x, y + f * 1.6, x + 4.5 * s, y);
  ctx.closePath();
  ctx.fillStyle = COL.gold; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 2 * s, y);
  ctx.quadraticCurveTo(x, y + f * 0.9, x + 2 * s, y);
  ctx.closePath();
  ctx.fillStyle = COL.red; ctx.fill();
}

// Weapons that are part of the ship's look (pods, drones, blades)
const WEAPON_ART = {
  wing() { for (const s of [-1, 1]) drawShip(S.p.x + s * 28, S.p.y + 5, 0.6, S.ship); },
  orbit(w) {
    if (!w.pos) return;
    const sr = 6.5 * Math.sqrt(S.mod.area);
    for (let i = 0; i < w.pos.length; i += 2) {
      ctx.save(); ctx.translate(w.pos[i], w.pos[i + 1]);
      cel([0, -sr, sr * 0.6, 0, 0, sr, -sr * 0.6, 0], WEAPONS.orbit.color, sr, false, 2);
      ctx.restore();
    }
  },
  drone(w) {
    if (!w.drones) return;
    for (const d of w.drones) {
      ctx.save(); ctx.translate(d.x, d.y);
      cel([0, -8, 6, 0, 0, 8, -6, 0], WEAPONS.drone.color, 8, false, 2);
      ctx.restore();
    }
  },
};

function drawPlayer() {
  const p = S.p;
  const blink = p.invuln > 0 && S.phase <= 0 && Math.floor(p.invuln * 16) % 2 === 0;
  drawFlame(p.x, p.y + 10, 1.2);
  for (const id in S.weapons) if (WEAPON_ART[id]) WEAPON_ART[id](S.weapons[id]);
  if (S.phase > 0) {                       // Phase Ram: afterimages and a spiked pink aura
    ctx.globalAlpha = 0.25;
    for (let k = 1; k <= 3; k++) drawShip(p.x - input.dx * k * 0.4, p.y + k * 9, SHIP_SIZE, S.ship);
    ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(S.t * 6);
    ctx.beginPath();
    for (let k = 0; k < 24; k++) { const rr = k % 2 ? 24 : 32 + Math.sin(S.t * 30 + k) * 3, a = (k / 24) * TAU; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = 'rgba(255,63,164,0.3)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#ff3fa4'; ctx.stroke();
    ctx.restore();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 3; ctx.strokeStyle = PAPER;
    ctx.beginPath(); ctx.arc(p.x, p.y, 26 + Math.sin(S.t * 20) * 2, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (S.overdrive > 0) {                   // Overdrive: crackling blue flame aura
    ctx.save(); ctx.translate(p.x, p.y);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) { const a = (i / 16) * TAU, rr = 22 + k * 5 + Math.sin(S.t * 25 + i * 2.1 + k) * 4 + (Math.sin(a) > 0 ? Math.sin(a) * 10 : 0); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.globalAlpha = 0.5 - k * 0.13; ctx.lineWidth = 3; ctx.strokeStyle = k === 1 ? PAPER : '#2ec5ff'; ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  if (!blink) drawShip(p.x, p.y, SHIP_SIZE, S.ship);
  // hitbox dot: the only part that can be hit
  ctx.fillStyle = PAPER;
  ctx.beginPath(); ctx.arc(p.x, p.y, CFG.player.hitRadius - 0.5, 0, TAU); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
  // Deflector Shield: solid ring when ready, a filling arc while recharging
  if (p.bubble) {
    ctx.lineWidth = 5; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2.6; ctx.strokeStyle = COL.player;
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(S.t * 5);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (ML('deflector')) {
    const f = clamp(1 - p.bubbleT / shieldRecharge(), 0, 1);
    ctx.lineWidth = 2; ctx.strokeStyle = COL.player; ctx.globalAlpha = 0.45;
    ctx.beginPath(); ctx.arc(p.x, p.y, 20, UP, UP + TAU * f); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// ============================================================================
// Enemies
// ============================================================================
// The hive fleet: legless horror-bugs (original designs). Fleshy larvae with
// lamprey mouths, bloated sacs crawling with eyes that track your ship, torn
// membrane wings, dripping slime. Each faces down the screen, same ink + cel look.
const EYE = '#c6ff3b', BONE = '#efe2c4', GORE = '#a3172f', PUS = '#efd98a', SLIME = '#c9e14a', BRUISE = '#5b2a6e', MAW = '#1d0812';
let LOOK = 0;          // angle from the creature being drawn to the player (eyes follow you)

function inkLine(lw, pts) {
  ctx.lineWidth = OUTLINE ? lw + OUT_W * 2 : lw;
  ctx.strokeStyle = OUTLINE ? PAPER : INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
}
function flat(build, fill, lw) {               // flat-filled shape with an ink edge (no shading)
  build();
  if (OUTLINE) { ctx.lineJoin = 'round'; ctx.lineWidth = lw + OUT_W * 2; ctx.strokeStyle = PAPER; ctx.stroke(); return; }
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
}
function boneHook(x0, y0, cx, cy, x1, y1, thick, flash) {   // curved bone blade / horn
  celBuild(() => {
    ctx.beginPath(); ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.quadraticCurveTo(cx * 0.55 + x0 * 0.45 + thick, cy * 0.55 + y0 * 0.45, x0 + thick, y0);
    ctx.closePath();
  }, BONE, 8, flash, 1.8);
}
function tendril(x0, y0, x1, y1, wave, color, w) {   // a drooping fleshy tentacle
  const mx = (x0 + x1) / 2 + wave, my = (y0 + y1) / 2;
  const passes = OUTLINE ? [[w + 3 + OUT_W * 2, PAPER]] : [[w + 3, INK], [w, color]];
  for (const [lw, c] of passes) {
    ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1 - wave * 0.5, y1); ctx.stroke();
  }
}
// a toothed lamprey mouth: gum ring, black throat, a ring of bone teeth
function maw(cx, cy, rx, ry, n, open) {
  if (OUTLINE) return;
  ry = Math.max(1.2, ry * (open === undefined ? 1 : open));
  ctx.save(); ctx.translate(cx, cy);
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.fillStyle = GORE; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.68, ry * 0.68, 0, 0, TAU); ctx.fillStyle = MAW; ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, c = Math.cos(a), sn = Math.sin(a), w = 0.32;
    ctx.moveTo(Math.cos(a - w) * rx * 0.9, Math.sin(a - w) * ry * 0.9);
    ctx.lineTo(c * rx * 0.35, sn * ry * 0.35);
    ctx.lineTo(Math.cos(a + w) * rx * 0.9, Math.sin(a + w) * ry * 0.9);
  }
  ctx.fillStyle = BONE; ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = INK; ctx.stroke();
  ctx.restore();
}
// a wet eyeball that tracks the player and blinks now and then
function eyeball(x, y, r, iris, t, angry) {
  if (OUTLINE) return;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = '#f6edd2'; ctx.fill(); ctx.lineWidth = Math.max(1, r * 0.28); ctx.strokeStyle = INK; ctx.stroke();
  if (Math.sin(t * 1.7 + x * 3.1 + y) > 0.97) {           // blink
    ctx.fillStyle = BRUISE; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    inkLine(1, [x - r, y, x + r, y]);
    return;
  }
  const ix = x + Math.cos(LOOK) * r * 0.35, iy = y + Math.sin(LOOK) * r * 0.35;
  ctx.fillStyle = angry ? COL.red : iris || EYE;
  ctx.beginPath(); ctx.arc(ix, iy, r * 0.62, 0, TAU); ctx.fill();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(ix, iy, r * 0.16, r * 0.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(ix - r * 0.25, iy - r * 0.3, r * 0.17, 0, TAU); ctx.fill();
}
// slime drool: a drop stretches, falls, repeats
function drip(x, y, t, seed, size) {
  if (OUTLINE) return;
  const ph = (t * 0.7 + seed * 0.37) % 1, s = size || 1;
  const len = (2 + ph * 9) * s, r = (1.2 + ph * 0.8) * s;
  ctx.fillStyle = SLIME; ctx.strokeStyle = INK; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - r * 0.6, y); ctx.quadraticCurveTo(x, y + len * 0.4, x - r, y + len);
  ctx.arc(x, y + len, r, Math.PI, 0, true); ctx.quadraticCurveTo(x, y + len * 0.4, x + r * 0.6, y);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}
function veins(list) {                          // dark red veins over flesh
  if (OUTLINE) return;
  ctx.strokeStyle = GORE; ctx.lineWidth = 1.2; ctx.lineCap = 'round'; ctx.globalAlpha *= 0.85;
  ctx.beginPath();
  for (const v of list) { ctx.moveTo(v[0], v[1]); ctx.quadraticCurveTo(v[2], v[3], v[4], v[5]); }
  ctx.stroke(); ctx.globalAlpha /= 0.85;
}
function eggs(list, t) {                        // glowing eggs seen through the skin
  if (OUTLINE) return;
  list.forEach(([x, y, r], i) => {
    const g = r * (1 + 0.1 * Math.sin(t * 4 + i * 1.3));
    ctx.fillStyle = PUS; ctx.globalAlpha *= 0.8;
    ctx.beginPath(); ctx.ellipse(x, y, g, g * 1.25, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha /= 0.8;
    ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = '#8a5a1a'; ctx.beginPath(); ctx.arc(x, y + g * 0.2, g * 0.35, 0, TAU); ctx.fill();
  });
}
function membrane(x, y, rot, len, wid, flap) {   // torn translucent wing (no white rim)
  if (OUTLINE) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, flap);
  ctx.globalAlpha *= 0.6;
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -wid, len, -wid * 0.3);
  ctx.lineTo(len * 0.86, 0); ctx.lineTo(len * 0.95, wid * 0.25); ctx.lineTo(len * 0.7, wid * 0.2);
  ctx.lineTo(len * 0.62, wid * 0.55); ctx.lineTo(len * 0.4, wid * 0.35);
  ctx.quadraticCurveTo(len * 0.2, wid * 0.5, 0, 0);
  ctx.fillStyle = '#e9dfe8'; ctx.fill();
  ctx.globalAlpha /= 0.6;
  ctx.lineWidth = 1.3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.lineWidth = 0.8; ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(len * 0.9, -wid * 0.35); ctx.moveTo(len * 0.3, -wid * 0.2); ctx.lineTo(len * 0.55, wid * 0.3);
  ctx.stroke();
  ctx.restore();
}

const CREATURE = {
  drone(e, f) {                       // LARVA: pulsing maggot, lamprey mouth, drool
    const t = e.age, p = Math.sin(t * 6); ctx.scale(e.r / 14, e.r / 14);
    oval(0, -9, 6 + p * 0.5, 5.5, 0, tone(e.color, -0.18), f, 2);
    oval(0, -2, 8.5 - p * 0.4, 6.5, 0, e.color, f, 2.2);
    oval(0, 6, 9, 7.5 + p * 0.4, 0, tone(e.color, 0.12), f, 2.2);
    if (!OUTLINE) {
      ctx.fillStyle = BRUISE; ctx.globalAlpha = 0.5;
      for (const [x, y, r] of [[-4, -3, 2], [3, -8, 1.5], [5, 1, 1.6]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    maw(0, 9, 5.2, 3.6, 7, 0.6 + 0.4 * Math.abs(Math.sin(t * 5)));
    eyeball(-5.5, 3, 1.9, EYE, t); eyeball(5, 1.5, 1.5, EYE, t); eyeball(1.5, -3.5, 1.2, EYE, t);
    drip(0, 12.5, t, e.x, 0.8);
  },

  weaver(e, f) {                      // LAMPREY: segmented flesh-worm, round toothed head
    const segs = 5, gap = 0.09;
    for (let k = segs - 1; k >= 1; k--) {
      const tt = e.age - k * gap;
      const wx = weaverX(e, tt) - e.x;
      const wy = -k * gap * (e.vy || 110), rr = e.r * (0.8 - k * 0.1);
      oval(wx, wy, rr, rr * 0.88, 0, k % 2 ? e.color : tone(e.color, -0.22), f, 2);
      veins([[wx - rr * 0.6, wy - rr * 0.2, wx, wy + rr * 0.5, wx + rr * 0.5, wy - rr * 0.1]]);
    }
    const r = e.r;
    oval(0, 0, r * 0.88, r * 0.84, 0, tone(e.color, 0.08), f, 2.2);
    maw(0, r * 0.18, r * 0.6, r * 0.52, 9, 0.75 + 0.25 * Math.sin(e.age * 8));
    eyeball(-r * 0.66, -r * 0.35, 1.8, EYE, e.age); eyeball(r * 0.66, -r * 0.35, 1.8, EYE, e.age);
  },

  diver(e, f) {                       // FLAYER: torn wings, one huge eye, dripping stinger; dives stinger-first
    if (e.mode === 1 && Math.floor(e.wait * 12) % 2) f = true;
    if (e.mode === 2) ctx.rotate(Math.atan2(e.vy, e.vx) - Math.PI / 2);
    ctx.scale(e.r / 14, e.r / 14);
    const flap = 0.35 + 0.65 * Math.abs(Math.sin(e.age * 34));
    membrane(-3, -5, Math.PI + 0.45, 17, 7, flap); membrane(3, -5, -0.45, 17, 7, flap);
    flat(() => path([-2.4, 15, 2.4, 15, 0, 24]), BONE, 1.2);
    drip(0, 23, e.age * 1.5, e.x, 0.7);
    oval(0, 6, 6.2, 9.5, 0, e.color, f, 2);
    if (!OUTLINE) {
      ctx.lineWidth = 2; ctx.strokeStyle = SLIME;
      ctx.beginPath(); ctx.moveTo(-5.4, 3.5); ctx.quadraticCurveTo(0, 6, 5.4, 3.5); ctx.moveTo(-5, 9); ctx.quadraticCurveTo(0, 11.5, 5, 9); ctx.stroke();
    }
    oval(0, -4, 4.6, 4.2, 0, tone(e.color, -0.35), f, 2);
    oval(0, -11, 5.2, 4.6, 0, tone(e.color, -0.5), f, 2);
    eyeball(0, -11.5, 3.4, '#ff5a3a', e.age);
  },

  gunner(e, f) {                      // BLOATER: swollen pus sac crawling with eyes; the maw gapes before it spits
    ctx.scale(e.r / 24, e.r / 24);
    const t = e.age;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - 1.2, c = Math.cos(a), sn = Math.sin(a);
      flat(() => path([c * 16 - sn * 3, sn * 16 + c * 3, c * 25, sn * 25, c * 16 + sn * 3, sn * 16 - c * 3]), f ? PAPER : BONE, 1.5);
    }
    const pulse = 1 + 0.06 * Math.sin(t * 5);
    ctx.save(); ctx.scale(pulse, 1 / pulse * 1.04); oval(0, 0, 20, 19, 0, e.color, f, 2.4); ctx.restore();
    veins([[-16, -6, -8, -14, 2, -16], [6, -15, 14, -6, 16, 4], [-14, 8, -8, 4, -3, 12]]);
    const open = e.mode === 1 && e.fireT < 0.5 ? 1 - e.fireT / 0.5 : 0.25;
    maw(0, 9, 9, 6.5, 10, 0.35 + open * 0.75);
    eyeball(-9, -6, 3.2, EYE, t); eyeball(6, -10, 2.6, EYE, t); eyeball(12, 0, 2.2, EYE, t); eyeball(-1, -2, 2, EYE, t); eyeball(-13, 3, 1.7, EYE, t);
    drip(-4, 14, t, e.x); drip(5, 13, t, e.y, 0.8);
  },

  brute(e, f) {                       // BROOD BRUTE: armoured tick swollen with eggs, giant lamprey maw
    const t = e.age; ctx.scale(e.r / 44, e.r / 44);
    const p = Math.sin(t * 3);
    oval(0, -14, 36 + p, 30 - p, 0, '#d98a9a', f, 3);
    veins([[-28, -10, -16, -30, 0, -38], [26, -20, 14, -4, 30, 4], [-10, -26, 6, -18, 16, -34]]);
    eggs([[-14, -20, 5], [2, -26, 5.5], [16, -16, 4.5], [-6, -8, 4], [12, -4, 4]], t);
    oval(0, 6, 32, 15, 0, e.color, f, 3);
    oval(0, 15, 27, 12, 0, tone(e.color, -0.15), f, 2.8);
    oval(0, 24, 21, 10, 0, tone(e.color, -0.3), f, 2.6);
    for (const sd of [-1, 1]) for (const [x0, y0, x1, y1] of [[28, 2, 40, -6], [24, 12, 36, 10], [19, 22, 29, 26]])
      flat(() => path([sd * x0, y0 - 3, sd * x1, y1, sd * (x0 - 2), y0 + 4]), f ? PAPER : BONE, 1.6);   // shell spikes
    maw(0, 30, 13, 10, 12, 0.7 + 0.3 * Math.abs(Math.sin(t * 2.5)));
    eyeball(-22, 12, 3.2, EYE, t); eyeball(22, 12, 3.2, EYE, t); eyeball(-15, 22, 2.6, EYE, t); eyeball(15, 22, 2.6, EYE, t);
    eyeball(-8, 9, 2.2, EYE, t); eyeball(8, 9, 2.2, EYE, t);
    drip(-5, 39, t, 1, 1.4); drip(6, 38, t, 2, 1.2);
  },

  mother(e, f) {                      // SPORE MOTHER: pus-sac blimp; pustules that are really eyes
    const t = e.age; ctx.scale(e.r / 48, e.r / 48);
    for (let i = 0; i < 4; i++) tendril((i - 1.5) * 13, 26, (i - 1.5) * 16, 78, Math.sin(t * 2.2 + i) * 8, tone(e.color, 0.25), 5);
    oval(0, -4, 42, 38, 0, e.color, f, 3);
    veins([[-34, -10, -20, -30, 0, -36], [30, -18, 22, 6, 34, 10], [-30, 14, -14, 4, -4, 22]]);
    const bumps = [[-20, -18, 8], [6, -26, 9], [24, -8, 7], [-28, 6, 6], [18, 14, 7], [-6, 4, 6], [6, -6, 5]];
    bumps.forEach(([x, y, r], i) => {
      const g = r * (1 + 0.12 * Math.sin(t * 4 + i));
      oval(x, y, g, g, 0, PUS, f, 1.8);
      if (i % 2 === 0) eyeball(x, y, g * 0.6, EYE, t);
    });
    maw(0, 28, 15, 9, 12, 0.6 + 0.4 * Math.abs(Math.sin(t * 2)));
    drip(-8, 34, t, 1, 1.3); drip(8, 34, t, 3, 1.1);
  },

  stalker(e, f) {                     // SCYTHE WRAITH: bone skull, exposed ribcage, scythe-blade wings
    ctx.scale(e.r / 42, e.r / 42);
    const t = e.age;
    const raise = e.mode === 2 ? 0.95 : 0.35 + Math.sin(e.spin || 0) * 0.35;
    membrane(-6, -20, Math.PI + 0.5 - raise * 0.3, 40, 14, 0.9); membrane(6, -20, -0.5 + raise * 0.3, 40, 14, 0.9);
    for (const sd of [-1, 1]) {
      ctx.save(); ctx.translate(sd * 9, -16); ctx.rotate(-sd * raise);
      boneHook(0, 0, sd * 40, -10, sd * 34, 40, sd * 6, f);
      ctx.restore();
    }
    for (let k = 0; k < 4; k++) {                    // ribcage
      const y = -26 + k * 7, w = 16 - k * 2;
      for (const sd of [-1, 1]) inkLine(4.4, [0, y, sd * w, y + 3, sd * (w - 3), y + 9]);
      if (!OUTLINE) { ctx.strokeStyle = BONE; ctx.lineWidth = 2; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(sd * w, y + 3); ctx.lineTo(sd * (w - 3), y + 9); ctx.stroke(); } }
    }
    if (!OUTLINE) { ctx.fillStyle = GORE; ctx.beginPath(); ctx.ellipse(0, -12, 4, 5 + Math.sin(t * 7), 0, 0, TAU); ctx.fill(); }   // a beating heart in the ribs
    for (let k = 0; k < 6; k++) oval(0, -38 + k * 6.5, 4.6 - k * 0.2, 3.2, 0, BONE, f, 1.6);   // spine
    oval(0, 12, 15, 16, 0, e.color, f, 2.6);
    if (!OUTLINE) {
      for (const sd of [-1, 1]) {
        ctx.fillStyle = MAW; ctx.beginPath(); ctx.ellipse(sd * 6, 8, 4.6, 5.4, sd * 0.3, 0, TAU); ctx.fill();
        ctx.fillStyle = COL.red; ctx.beginPath(); ctx.arc(sd * 6 + Math.cos(LOOK), 9 + Math.sin(LOOK), 1.6 + 0.4 * Math.sin(t * 9), 0, TAU); ctx.fill();
      }
      flat(() => path([-2, 15, 2, 15, 0, 19]), MAW, 1);
    }
    maw(0, 26, 10, 6, 10, e.mode === 2 ? 1 : 0.55);
  },

  queen(e, f) {                       // HIVE QUEEN: crowned horror, glowing egg sac, vertical maw
    const t = e.age; ctx.scale(e.r / 66, e.r / 66);
    const angry = e.phase === 3, flap = 0.85 + 0.15 * Math.sin(t * 3);
    membrane(-16, -40, Math.PI + 0.35, 58, 22, flap); membrane(16, -40, -0.35, 58, 22, flap);
    for (let i = 0; i < 4; i++) tendril((i - 1.5) * 12, 34, (i - 1.5) * 18, 96 + (i % 2) * 10, Math.sin(t * 2 + i * 1.3) * 10, tone(e.color, 0.3), 5.5);
    oval(0, -36, 46 + Math.sin(t * 2) * 1.5, 40, 0, '#d98a9a', f, 3.2);
    veins([[-40, -30, -26, -60, 0, -70], [38, -44, 26, -14, 42, -22], [-30, -12, -10, -24, 6, -8], [8, -60, 20, -40, 34, -56]]);
    eggs([[-22, -44, 6], [-4, -56, 6.5], [16, -46, 6], [-12, -28, 5], [8, -30, 5.5], [26, -26, 4.5], [-28, -24, 4.5]], t);
    for (const [x0, y0, x1, y1] of [[-30, 0, -52, -16], [-22, -6, -42, -30], [30, 0, 52, -16], [22, -6, 42, -30]]) {
      flat(() => path([x0 - 4, y0, x1, y1, x0 + 4, y0 - 4]), f ? PAPER : BONE, 2);
    }
    celBuild(() => path([-34, 4, -20, -8, 0, -12, 20, -8, 34, 4, 26, 32, 0, 44, -26, 32]), e.color, 36, f, 3);
    const open = (angry ? 0.85 : 0.55) + 0.25 * Math.abs(Math.sin(t * (angry ? 5 : 2.5)));
    maw(0, 24, 11, 16, 14, open);
    const eyesAt = [[-18, 6], [18, 6], [-24, 16], [24, 16], [-14, -2], [14, -2], [-20, 27], [20, 27]];
    eyesAt.forEach(([x, y], i) => eyeball(x, y, i < 2 ? 4.2 : 3.2, EYE, t, angry));
    drip(-6, 40, t, 1, 1.6); drip(5, 41, t, 4, 1.4);
  },
};

// ---- final bosses for stages 2-5 -------------------------------------------
Object.assign(CREATURE, {
  wyrm(e, f) {                        // WARP WYRM: a long serpent of glowing segments, horned head
    const t = e.age, tr = e.trail || [];
    for (let i = Math.min(tr.length - 1, 140); i >= 6; i -= 7) {
      const [x, y] = tr[i], lx = x - e.x, ly = y - e.y, k = i / 140, r = 22 * (1 - k * 0.6);
      flat(() => path([lx - r * 0.5, ly - r * 0.6, lx, ly - r * 1.5, lx + r * 0.5, ly - r * 0.6]), f ? PAPER : BONE, 1.4);
      oval(lx, ly, r, r * 0.9, 0, (i / 7) % 2 ? e.color : tone(e.color, 0.3), f, 2.2);
      if (!OUTLINE && (i / 7) % 3 === 0) { ctx.fillStyle = '#7de0ff'; ctx.beginPath(); ctx.arc(lx, ly, r * 0.28, 0, TAU); ctx.fill(); }
    }
    ctx.scale(e.r / 40, e.r / 40);
    for (const sd of [-1, 1]) boneHook(sd * 14, -10, sd * 36, -30, sd * 26, -50, sd * 4, f);
    oval(0, 0, 30, 34, 0, e.color, f, 3);
    oval(0, 20, 20, 15, 0, tone(e.color, -0.3), f, 2.6);
    maw(0, 26, 12, 9, 12, 0.6 + 0.4 * Math.abs(Math.sin(t * 4)));
    eyeball(-14, -4, 4.6, '#7de0ff', t); eyeball(14, -4, 4.6, '#7de0ff', t); eyeball(-7, -15, 3, '#ff5df0', t); eyeball(7, -15, 3, '#ff5df0', t);
    if (!OUTLINE) {
      ctx.strokeStyle = '#c86bff'; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.45 + 0.3 * Math.sin(t * 6);
      ctx.beginPath(); ctx.arc(0, 0, 46 + Math.sin(t * 3) * 3, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
  },

  maw(e, f) {                         // ABYSSAL MAW: anglerfish horror with a glowing lure and needle teeth
    const t = e.age; ctx.scale(e.r / 56, e.r / 56);
    const fl = 0.8 + 0.2 * Math.sin(t * 3);
    membrane(-42, -4, Math.PI + 0.5, 36, 15, fl); membrane(42, -4, -0.5, 36, 15, fl);
    oval(0, -8, 52, 44, 0, e.color, f, 3.2);
    veins([[-40, -20, -22, -44, 0, -50], [36, -30, 26, 0, 44, 6], [-30, 4, -14, -6, -2, 10]]);
    if (!OUTLINE) for (const [x, y, r] of [[-30, -30, 3], [-12, -40, 2.4], [18, -36, 3], [34, -14, 2.4], [-38, -6, 2.2], [8, -22, 2]]) {
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 4 + x); ctx.fillStyle = '#8affff';
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const open = 0.3 + (e.jaw || 0) * 0.7;
    if (!OUTLINE) {                                  // the black mouth with needle teeth
      ctx.fillStyle = MAW; ctx.beginPath(); ctx.moveTo(-44, 10); ctx.quadraticCurveTo(0, 22, 44, 10); ctx.quadraticCurveTo(0, 30 + open * 40, -44, 10); ctx.fill();
      ctx.fillStyle = BONE; ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.beginPath();
      for (let x = -38; x <= 38; x += 7) { const yu = 12 + (1 - Math.abs(x) / 44) * 6; ctx.moveTo(x - 2.5, yu); ctx.lineTo(x, yu + 9 + open * 6); ctx.lineTo(x + 2.5, yu); }
      ctx.fill(); ctx.stroke();
    }
    celBuild(() => { ctx.beginPath(); ctx.moveTo(-48, 10); ctx.quadraticCurveTo(0, 42 + open * 34, 48, 10); ctx.lineTo(42, 18); ctx.quadraticCurveTo(0, 32 + open * 22, -42, 18); ctx.closePath(); },
             tone(e.color, -0.3), 40, f, 3);
    if (!OUTLINE) {
      ctx.fillStyle = BONE; ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.beginPath();
      for (let x = -34; x <= 34; x += 8) { const yb = 18 + (1 - Math.abs(x) / 44) * (14 + open * 22); ctx.moveTo(x - 2.5, yb); ctx.lineTo(x, yb - 11 - open * 5); ctx.lineTo(x + 2.5, yb); }
      ctx.fill(); ctx.stroke();
    }
    eyeball(-26, -18, 5.2, '#e8f0f0', t); eyeball(26, -18, 5.2, '#e8f0f0', t);
    const lx = Math.sin(t * 2) * 26;
    tendril(0, -50, lx, 74, 26 * Math.sin(t), tone(e.color, 0.2), 2.6);
    const charging = e.lure > 0, glow = charging ? (e.lure < 0.5 ? 1 : 0.5 + 0.5 * Math.sin(t * 30)) : 0.45 + 0.15 * Math.sin(t * 3);
    if (!OUTLINE) { ctx.globalAlpha = glow * 0.45; ctx.fillStyle = '#fff7a0'; ctx.beginPath(); ctx.arc(lx, 80, 18 + glow * 10, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    oval(lx, 80, 7, 7, 0, glow > 0.8 ? '#ffffff' : '#fff27a', f, 2);
  },

  heart(e, f) {                       // LEVIATHAN HEART: a beating heart with arteries, veins and eyes
    const t = e.age, k = 1 + 0.12 * (e.beat || 0);
    ctx.scale(e.r / 60 * k, e.r / 60 * k);
    tendril(-16, -38, -44, -88, 8 * Math.sin(t), '#6a2a8a', 9);
    tendril(8, -42, 26, -94, -6 * Math.sin(t * 1.3), '#d23a4a', 10);
    tendril(28, -34, 64, -72, 5 * Math.sin(t), '#d23a4a', 7);
    celBuild(() => {
      ctx.beginPath(); ctx.moveTo(0, 54);
      ctx.bezierCurveTo(-62, 20, -64, -42, -24, -46); ctx.bezierCurveTo(-8, -48, 0, -36, 0, -28);
      ctx.bezierCurveTo(4, -42, 20, -52, 36, -44); ctx.bezierCurveTo(68, -28, 58, 24, 0, 54); ctx.closePath();
    }, e.color, 58, f, 3.4);
    veins([[-40, -20, -22, 0, -8, 30], [30, -36, 14, -10, 18, 24], [-20, -36, -8, -20, 6, -12], [40, 0, 24, 18, 8, 40]]);
    if (!OUTLINE) {
      ctx.strokeStyle = '#6a2a8a'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(-4, -26); ctx.quadraticCurveTo(-14, 10, 2, 46); ctx.stroke();
      if (e.phase === 3) {
        ctx.strokeStyle = '#ffd66a'; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 10);
        ctx.beginPath(); ctx.moveTo(-30, -20); ctx.lineTo(-18, -4); ctx.lineTo(-24, 10); ctx.moveTo(24, -24); ctx.lineTo(16, -6); ctx.lineTo(28, 8); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    eyeball(-20, -10, 4.2, EYE, t, e.phase === 3); eyeball(18, 4, 3.8, EYE, t, e.phase === 3); eyeball(-2, 24, 3, EYE, t, e.phase === 3);
    drip(-6, 50, t, 1, 1.6); drip(10, 44, t, 3, 1.2);
  },

  seraph(e, f) {                      // SERAPH OF THE VOID: six wings, a weeping mask, a halo of spikes
    const t = e.age, ph = e.phase || 1;
    ctx.scale(e.r / 58 * 1.1, e.r / 58 * 1.1);          // drawn grander than her hitbox
    if (!OUTLINE) {                                  // prismatic rays behind
      ctx.save(); ctx.rotate(t * 0.3);
      for (let k = 0; k < 12; k++) {
        ctx.rotate(TAU / 12); ctx.globalAlpha = 0.16; ctx.fillStyle = `hsl(${(k * 30 + t * 60) % 360},90%,65%)`;
        path([-6, 0, 6, 0, 0, 150]); ctx.fill();
      }
      ctx.restore(); ctx.globalAlpha = 1;
    }
    const flap = Math.sin(t * 2.2) * 0.08;
    for (const sd of [-1, 1]) {                      // great feathered wings (back)
      for (let i = 5; i >= 0; i--) oval(sd * (34 + i * 12), -34 - i * 7, 24, 7, sd * (-0.55 - i * 0.12 - flap), i % 2 ? '#f3ead2' : '#e3d6b4', f, 1.8);
      for (let i = 0; i < 4; i++) eyeball(sd * (40 + i * 13), -38 - i * 7, 2.6, ph === 3 ? COL.red : '#ffd66a', t);
    }
    for (const sd of [-1, 1]) {                      // demonic bat wings (middle)
      const x0 = sd * 18, y0 = -6;
      flat(() => {
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(sd * 70, -26 - flap * 40); ctx.lineTo(sd * 64, 0); ctx.lineTo(sd * 76, 18);
        ctx.lineTo(sd * 56, 14); ctx.lineTo(sd * 58, 34); ctx.lineTo(sd * 38, 20); ctx.closePath();
      }, '#2a1a3a', 2);
      if (!OUTLINE) { ctx.strokeStyle = BONE; ctx.lineWidth = 1.6; ctx.beginPath(); for (const [x, y] of [[70, -26], [76, 18], [58, 34]]) { ctx.moveTo(x0, y0); ctx.lineTo(sd * x, y); } ctx.stroke(); }
    }
    for (const sd of [-1, 1]) for (let i = 2; i >= 0; i--) oval(sd * (22 + i * 9), 30 + i * 6, 14, 5, sd * (0.6 + i * 0.15), '#f3ead2', f, 1.6);   // small lower wings
    celBuild(() => path([-16, -14, 16, -14, 26, 46, 0, 58, -26, 46]), '#e8dcc0', 30, f, 2.8);          // robed body
    if (!OUTLINE) { ctx.strokeStyle = COL.gold; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(0, 40); ctx.lineTo(12, 0); ctx.stroke(); }
    // halo of spikes (red and cracked when desperate)
    ctx.save(); ctx.translate(0, -44); ctx.rotate(t * 0.8);
    if (!OUTLINE) {
      ctx.strokeStyle = ph === 3 ? COL.red : COL.gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.stroke();
      ctx.fillStyle = ph === 3 ? COL.red : COL.gold; ctx.beginPath();
      for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; ctx.moveTo(Math.cos(a - 0.08) * 24, Math.sin(a - 0.08) * 24); ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 34); ctx.lineTo(Math.cos(a + 0.08) * 24, Math.sin(a + 0.08) * 24); }
      ctx.fill();
    }
    ctx.restore();
    oval(0, -26, 14, 17, 0, '#f7f3ea', f, 2.6);                                                          // porcelain mask
    if (!OUTLINE) {
      ctx.fillStyle = INK; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 6, -28, 4, 1.6, sd * 0.25, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = ph === 3 ? '#1a0a10' : COL.gold; ctx.lineWidth = 1.6;
      ctx.beginPath(); for (const sd of [-1, 1]) { ctx.moveTo(sd * 6, -26); ctx.quadraticCurveTo(sd * 7, -18, sd * 5, -8); } ctx.stroke();
    }
    eyeball(0, -38, 3.6, ph === 3 ? COL.red : '#ffd66a', t);                                            // third eye
  },
});

// ---- each stage's own small enemies (same four roles, new creatures) -------
function diverPose(e, f) {                 // divers flash while aiming, then point along their dive
  if (e.mode === 1 && Math.floor(e.wait * 12) % 2) f = true;
  if (e.mode === 2) ctx.rotate(Math.atan2(e.vy, e.vx) - Math.PI / 2);
  return f;
}
function weaverSegs(e, n, gap, each) {     // draws a worm's trailing body along its own swim path
  for (let k = n - 1; k >= 1; k--) {
    const tt = e.age - k * gap;
    each(weaverX(e, tt) - e.x, -k * gap * (e.vy || 110), k);
  }
}
function glow(x, y, r, color, a) {
  if (OUTLINE) return;
  ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
}
function spikes(n, r0, r1, rot, color, f, w) {     // a crown of bone or crystal spikes
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU, c = Math.cos(a), sn = Math.sin(a), h = w || 3;
    flat(() => path([c * r0 - sn * h, sn * r0 + c * h, c * r1, sn * r1, c * r0 + sn * h, sn * r0 - c * h]), f ? PAPER : color, 1.3);
  }
}

Object.assign(CREATURE, {
  // STAGE 2 · WARP ZONE ------------------------------------------------------
  blinker(e, f) {                     // BLINK MITE: a crystal tick that flickers out of phase
    const t = e.age; ctx.scale(e.r / 14, e.r / 14);
    if (!OUTLINE) {                                  // chromatic ghost copies
      ctx.globalAlpha = 0.35;
      for (const [dx, c] of [[-3, '#ff5df0'], [3, '#7de0ff']]) { ctx.fillStyle = c; path([dx, -12, dx + 10, 0, dx, 12, dx - 10, 0]); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    cel([0, -12, 10, 0, 0, 12, -10, 0], e.color, 12, f, 2.2);
    flat(() => path([-6, -4, 0, -9, 6, -4, 0, 2]), f ? PAPER : tone(e.color, 0.4), 1.2);
    glow(0, 0, 15, e.color, 0.15 + 0.15 * Math.sin(t * 20));
    eyeball(0, 4, 3, '#ff5df0', t);
  },

  phaseel(e, f) {                     // PHASE EEL: a chain of glowing diamonds with fin blades
    const r = e.r;
    weaverSegs(e, 6, 0.08, (x, y, k) => {
      const rr = r * (0.75 - k * 0.08);
      cel([x, y - rr, x + rr * 0.8, y, x, y + rr, x - rr * 0.8, y], k % 2 ? e.color : tone(e.color, -0.25), rr, f, 1.8);
      glow(x, y, rr * 0.3, '#7de0ff', 0.9);
    });
    for (const sd of [-1, 1]) flat(() => path([sd * r * 0.5, -r * 0.4, sd * r * 1.3, -r * 0.9, sd * r * 0.7, r * 0.2]), f ? PAPER : '#7de0ff', 1.4);
    cel([0, -r, r * 0.8, 0, 0, r * 1.1, -r * 0.8, 0], tone(e.color, 0.1), r, f, 2.2);
    maw(0, r * 0.35, r * 0.38, r * 0.28, 7, 0.6 + 0.4 * Math.sin(e.age * 9));
    eyeball(-r * 0.35, -r * 0.25, 1.8, '#7de0ff', e.age); eyeball(r * 0.35, -r * 0.25, 1.8, '#7de0ff', e.age);
  },

  streak(e, f) {                      // WARP STREAK: an arrowhead with swept fins and a light trail
    f = diverPose(e, f); ctx.scale(e.r / 14, e.r / 14);
    if (!OUTLINE && e.mode === 2) { ctx.globalAlpha = 0.4; ctx.fillStyle = e.color; path([-5, -6, 5, -6, 0, -40]); ctx.fill(); ctx.globalAlpha = 1; }
    for (const sd of [-1, 1]) cel([sd * 3, -4, sd * 16, -14, sd * 6, 6], tone(e.color, -0.3), 10, f, 1.8);
    cel([0, 20, 7, 2, 4, -12, -4, -12, -7, 2], e.color, 14, f, 2.2);
    flat(() => path([-2, 4, 2, 4, 0, 16]), f ? PAPER : '#fff2fb', 1);
    eyeball(0, -3, 3.2, '#7de0ff', e.age);
  },

  prism(e, f) {                       // PRISM NODE: a spinning crystal with a single slit eye
    const t = e.age; ctx.scale(e.r / 24, e.r / 24);
    spikes(4, 14, 26, t * 1.5 + (e.volley || 0) * 0.21, '#c8e4ff', f, 4);
    ctx.save(); ctx.rotate(t * 0.8);
    cel([0, -22, 19, -8, 19, 10, 0, 22, -19, 10, -19, -8], e.color, 22, f, 2.6);
    if (!OUTLINE) { ctx.strokeStyle = tone(e.color, 0.45); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, 22); ctx.moveTo(-19, -8); ctx.lineTo(19, 10); ctx.moveTo(19, -8); ctx.lineTo(-19, 10); ctx.stroke(); }
    ctx.restore();
    const open = e.mode === 1 && e.fireT < 0.4 ? 1 : 0.4;
    oval(0, 0, 9, 9 * open + 1, 0, '#f6edd2', f, 2);
    eyeball(0, 0, 5 * (0.6 + open * 0.4), '#ff5df0', t);
  },

  // STAGE 3 · THE DEEP -------------------------------------------------------
  jelly(e, f) {                       // DRIFT JELLY: a glowing bell trailing stinging threads
    const t = e.age; ctx.scale(e.r / 14, e.r / 14);
    for (let i = 0; i < 5; i++) tendril((i - 2) * 3.5, 4, (i - 2) * 4, 24 + (i % 2) * 5, Math.sin(t * 3 + i) * 4, tone(e.color, 0.3), 1.6);
    const sq = 1 + 0.08 * Math.sin(t * 4);
    ctx.save(); ctx.scale(sq, 1 / sq);
    celBuild(() => { ctx.beginPath(); ctx.moveTo(-12, 4); ctx.quadraticCurveTo(-13, -14, 0, -14); ctx.quadraticCurveTo(13, -14, 12, 4);
      for (let x = 12; x > -12; x -= 6) ctx.quadraticCurveTo(x - 1.5, 8, x - 3, 4), ctx.quadraticCurveTo(x - 4.5, 8, x - 6, 4); ctx.closePath(); }, e.color, 13, f, 2);
    ctx.restore();
    glow(0, -5, 6, '#e8fff8', 0.5 + 0.3 * Math.sin(t * 5));
    eyeball(-4, -4, 1.8, '#ff7ab0', t); eyeball(4, -5, 1.5, '#ff7ab0', t);
  },

  eel(e, f) {                         // GULPER EEL: a thin dark body and a huge hinged jaw
    const r = e.r;
    weaverSegs(e, 7, 0.08, (x, y, k) => {
      const rr = r * (0.62 - k * 0.06);
      oval(x, y, rr, rr * 1.1, 0, k % 2 ? e.color : tone(e.color, -0.3), f, 1.8);
      glow(x, y + rr * 0.2, 1.4, '#8affff', 0.8);
    });
    const open = 0.5 + 0.5 * Math.abs(Math.sin(e.age * 3));
    oval(0, -r * 0.2, r * 0.8, r * 0.7, 0, tone(e.color, 0.1), f, 2.2);
    if (!OUTLINE) {
      ctx.fillStyle = MAW; ctx.beginPath(); ctx.ellipse(0, r * 0.4, r * 0.75, r * 0.3 + open * r * 0.4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = BONE; ctx.beginPath();
      for (let x = -r * 0.6; x <= r * 0.6; x += r * 0.3) { ctx.moveTo(x - 1.5, r * 0.2); ctx.lineTo(x, r * 0.2 + 5 + open * 3); ctx.lineTo(x + 1.5, r * 0.2); }
      ctx.fill();
    }
    eyeball(-r * 0.4, -r * 0.4, 1.6, '#e8f0f0', e.age); eyeball(r * 0.4, -r * 0.4, 1.6, '#e8f0f0', e.age);
  },

  piranha(e, f) {                     // BONE PIRANHA: a skull-faced fish all teeth
    f = diverPose(e, f); ctx.scale(e.r / 14, e.r / 14);
    const wag = Math.sin(e.age * 16) * 4;
    flat(() => path([0, -10, -6 + wag, -22, 6 + wag, -22]), f ? PAPER : tone(e.color, -0.2), 1.6);     // tail
    for (const sd of [-1, 1]) flat(() => path([sd * 7, -2, sd * 15, -8, sd * 9, 4]), f ? PAPER : tone(e.color, -0.3), 1.3);
    oval(0, 0, 10, 13, 0, e.color, f, 2.2);
    oval(0, 6, 9, 8, 0, BONE, f, 2);
    if (!OUTLINE) {
      ctx.fillStyle = MAW; ctx.beginPath(); ctx.ellipse(0, 9, 7, 3.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = BONE; ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.beginPath();
      for (let x = -6; x <= 6; x += 3) { ctx.moveTo(x - 1.2, 6.5); ctx.lineTo(x, 10); ctx.lineTo(x + 1.2, 6.5); ctx.moveTo(x - 1.2, 12); ctx.lineTo(x, 8.5); ctx.lineTo(x + 1.2, 12); }
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = MAW; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * 4, 2, 2.4, 0, TAU); ctx.fill(); }
      ctx.fillStyle = COL.red; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * 4, 2.3, 0.9, 0, TAU); ctx.fill(); }
    }
  },

  urchin(e, f) {                      // SPINE URCHIN: a rolling ball of needles around one eye
    const t = e.age; ctx.scale(e.r / 24, e.r / 24);
    spikes(14, 15, 28 + Math.sin(t * 3) * 2, t * 0.6, '#efe2ff', f, 2.4);
    oval(0, 0, 18, 18, 0, e.color, f, 2.6);
    if (!OUTLINE) for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + t * 0.6; glow(Math.cos(a) * 12, Math.sin(a) * 12, 1.8, '#8affff', 0.8); }
    const open = e.mode === 1 && e.fireT < 0.5 ? 1 : 0.6;
    oval(0, 0, 8, 8 * open, 0, '#f6edd2', f, 2);
    eyeball(0, 0, 5 * open, '#ffd66a', t);
  },

  // STAGE 4 · INSIDE THE LEVIATHAN ------------------------------------------
  fluke(e, f) {                       // BLOOD FLUKE: a flat leaf-shaped parasite with a sucker mouth
    const t = e.age, w = Math.sin(t * 5) * 1.5; ctx.scale(e.r / 14, e.r / 14);
    celBuild(() => { ctx.beginPath(); ctx.moveTo(0, 14); ctx.bezierCurveTo(-14 - w, 6, -10, -12, 0, -14); ctx.bezierCurveTo(10, -12, 14 + w, 6, 0, 14); }, e.color, 13, f, 2.2);
    veins([[-6, -6, 0, 0, 5, 8], [6, -8, 2, -2, -4, 6]]);
    if (!OUTLINE) { ctx.fillStyle = tone(e.color, -0.3); for (const [x, y] of [[-4, -2], [4, 0], [0, 6]]) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill(); } }
    maw(0, 8, 4, 3.5, 6, 0.7 + 0.3 * Math.sin(t * 7));
    eyeball(-3, -8, 1.5, EYE, t); eyeball(3, -8, 1.5, EYE, t);
  },

  tapeworm(e, f) {                    // TAPEWORM: a long ribbon of flat segments and a hooked head
    const r = e.r;
    weaverSegs(e, 9, 0.065, (x, y, k) => {
      const ww = r * (0.8 - k * 0.05), hh = r * 0.42;
      celBuild(() => path([x - ww, y - hh, x + ww, y - hh, x + ww * 0.85, y + hh, x - ww * 0.85, y + hh]), k % 2 ? e.color : tone(e.color, -0.15), ww, f, 1.6);
    });
    oval(0, 0, r * 0.55, r * 0.6, 0, tone(e.color, 0.1), f, 2);
    maw(0, r * 0.15, r * 0.38, r * 0.34, 8, 0.7 + 0.3 * Math.sin(e.age * 6));
    eyeball(-r * 0.3, -r * 0.32, 1.4, EYE, e.age); eyeball(r * 0.3, -r * 0.32, 1.4, EYE, e.age);
  },

  leech(e, f) {                       // LEECH: a tapering slug with a ring-of-teeth sucker
    f = diverPose(e, f); ctx.scale(e.r / 14, e.r / 14);
    const sq = 1 + 0.12 * Math.sin(e.age * 9);
    ctx.save(); ctx.scale(1 / sq, sq);
    celBuild(() => { ctx.beginPath(); ctx.moveTo(0, -20); ctx.bezierCurveTo(-10, -16, -11, 6, -7, 12); ctx.quadraticCurveTo(0, 17, 7, 12); ctx.bezierCurveTo(11, 6, 10, -16, 0, -20); }, e.color, 16, f, 2.2);
    if (!OUTLINE) { ctx.strokeStyle = tone(e.color, -0.4); ctx.lineWidth = 1.2; ctx.beginPath(); for (let y = -14; y <= 6; y += 5) { ctx.moveTo(-8, y); ctx.quadraticCurveTo(0, y + 2.5, 8, y); } ctx.stroke(); }
    ctx.restore();
    maw(0, 11, 6, 5, 10, 1);
    eyeball(-3, -12, 1.3, EYE, e.age); eyeball(3, -12, 1.3, EYE, e.age);
  },

  polyp(e, f) {                       // POLYP: a swollen growth crowned with little mouths on stalks
    const t = e.age; ctx.scale(e.r / 24, e.r / 24);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.55, sw = Math.sin(t * 3 + i) * 3;
      const x1 = Math.cos(a) * 30 + sw, y1 = Math.sin(a) * 28;
      tendril(Math.cos(a) * 14, Math.sin(a) * 14, x1, y1, sw, tone(e.color, -0.15), 3.5);
      oval(x1, y1, 4.5, 4.5, 0, '#d47a8a', f, 1.6);
      maw(x1, y1, 3, 3, 5, 0.5 + 0.5 * Math.abs(Math.sin(t * 4 + i)));
    }
    const pulse = 1 + 0.05 * Math.sin(t * 4);
    ctx.save(); ctx.scale(pulse, 1 / pulse); oval(0, 2, 21, 18, 0, e.color, f, 2.6); ctx.restore();
    veins([[-16, 0, -8, -10, 4, -12], [14, -4, 8, 6, 14, 12]]);
    const open = e.mode === 1 && e.fireT < 0.5 ? 1 - e.fireT / 0.5 : 0.3;
    maw(0, 8, 8, 6, 9, 0.35 + open * 0.7);
    eyeball(-8, -4, 2.8, EYE, t); eyeball(8, -4, 2.8, EYE, t);
  },

  // STAGE 5 · PRISMATIC VOID -------------------------------------------------
  shard(e, f) {                       // EYE SHARD: a spinning triangle of glass with an eye in it
    const t = e.age; ctx.scale(e.r / 14, e.r / 14);
    ctx.save(); ctx.rotate(t * 2.2);
    cel([0, -15, 13, 8, -13, 8], e.color, 14, f, 2.2);
    if (!OUTLINE) { ctx.strokeStyle = `hsl(${(t * 120) % 360},90%,75%)`; ctx.lineWidth = 1.5; path([0, -9, 7.5, 4.5, -7.5, 4.5]); ctx.stroke(); }
    ctx.restore();
    eyeball(0, 0, 3.6, '#ffd66a', t);
  },

  halo(e, f) {                        // HALO CHAIN: linked gold rings, the lead one with a staring eye
    const r = e.r;
    weaverSegs(e, 5, 0.09, (x, y, k) => {
      const rr = r * (0.6 - k * 0.07);
      ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.55);
      const passes = OUTLINE ? [[5 + OUT_W * 2, PAPER]] : [[5, INK], [2.6, f ? PAPER : e.color]];
      for (const [lw, c] of passes) { ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke(); }
      ctx.restore();
    });
    ctx.save(); ctx.rotate(e.age * 1.5); spikes(8, r * 0.8, r * 1.15, 0, e.color, f, 2); ctx.restore();
    const passes = OUTLINE ? [[6 + OUT_W * 2, PAPER]] : [[6, INK], [3.4, f ? PAPER : e.color]];
    for (const [lw, c] of passes) { ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, TAU); ctx.stroke(); }
    eyeball(0, 0, r * 0.38, '#ff5df0', e.age);
  },

  mirror(e, f) {                      // MIRROR BLADE: a living sliver of mirror glass
    f = diverPose(e, f); ctx.scale(e.r / 14, e.r / 14);
    for (const sd of [-1, 1]) cel([sd * 2, -6, sd * 14, -16, sd * 8, 2], tone(e.color, -0.2), 10, f, 1.6);
    cel([0, 22, 6, 0, 0, -18, -6, 0], e.color, 18, f, 2.2);
    if (!OUTLINE) {
      const sh = ((e.age * 1.5) % 1) * 40 - 20;
      ctx.save(); path([0, 22, 6, 0, 0, -18, -6, 0]); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; path([-8, sh - 4, 8, sh - 10, 8, sh - 6, -8, sh]); ctx.fill();
      ctx.restore();
    }
    eyeball(0, -4, 2.6, COL.red, e.age);
  },

  cherub(e, f) {                      // HOLLOW CHERUB: a cracked porcelain face on tiny wings
    const t = e.age; ctx.scale(e.r / 24, e.r / 24);
    const flap = 0.4 + 0.6 * Math.abs(Math.sin(t * 14));
    for (const sd of [-1, 1]) for (let i = 2; i >= 0; i--)
      oval(sd * (20 + i * 6), -8 - i * 4 * flap, 10, 4, sd * (-0.5 - i * 0.25) * flap, i % 2 ? '#f3ead2' : '#e3d6b4', f, 1.5);
    oval(0, 0, 18, 20, 0, e.color, f, 2.6);
    if (!OUTLINE) {
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(6, -19); ctx.lineTo(3, -10); ctx.lineTo(8, -4); ctx.lineTo(5, 4); ctx.stroke();   // crack
      ctx.fillStyle = MAW; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 7, -3, 4.2, 5.4, 0, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#ffd66a'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * 7 + Math.cos(LOOK) * 1.2, -2 + Math.sin(LOOK) * 1.2, 1.3, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,120,150,0.35)'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * 11, 6, 3, 0, TAU); ctx.fill(); }
    }
    const open = e.mode === 1 && e.fireT < 0.5 ? 1 : 0.3;
    maw(0, 10, 5, 4, 8, 0.3 + open * 0.7);
    ctx.save(); ctx.translate(0, -26); ctx.scale(1, 0.35);
    const passes = OUTLINE ? [[4 + OUT_W * 2, PAPER]] : [[4, INK], [2, COL.gold]];
    for (const [lw, c] of passes) { ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.stroke(); }
    ctx.restore();
  },
});

// ---- stage 2-5 mini-bosses ---------------------------------------------------
function ringStroke(x, y, r, w, color, sy) {         // an inked ring (halo, rim) that also gets the white outline
  ctx.save(); ctx.translate(x, y); ctx.scale(1, sy || 1);
  const passes = OUTLINE ? [[w + 2.5 + OUT_W * 2, PAPER]] : [[w + 2.5, INK], [w, color]];
  for (const [lw, c] of passes) { ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); }
  ctx.restore();
}
Object.assign(CREATURE, {
  manta(e, f) {                       // RIFT MANTA: a vast ray with warp-lit wings and a toothed underside
    const t = e.age, fl = Math.sin(t * 2.4) * 6; ctx.scale(e.r / 44, e.r / 44);
    tendril(0, 20, Math.sin(t * 2) * 10, 70, Math.sin(t * 3) * 8, tone(e.color, -0.3), 4);
    celBuild(() => { ctx.beginPath(); ctx.moveTo(0, -26); ctx.bezierCurveTo(30, -26, 50, -10 + fl, 66, 8 + fl); ctx.quadraticCurveTo(40, 6, 18, 24);
      ctx.quadraticCurveTo(0, 30, -18, 24); ctx.quadraticCurveTo(-40, 6, -66, 8 + fl); ctx.bezierCurveTo(-50, -10 + fl, -30, -26, 0, -26); }, e.color, 50, f, 3);
    if (!OUTLINE) for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) glow(sd * (24 + i * 9), -4 + i * 2 + fl * i / 4, 2.6, i % 2 ? '#7de0ff' : '#ff5df0', 0.6 + 0.4 * Math.sin(t * 6 + i));
    for (const sd of [-1, 1]) boneHook(sd * 10, -22, sd * 18, -42, sd * 12, -50, sd * 4, f);
    maw(0, 12, 14, 7, 12, 0.6 + 0.4 * Math.abs(Math.sin(t * 2)));
    eyeball(-12, -10, 4, '#7de0ff', t); eyeball(12, -10, 4, '#7de0ff', t);
  },
  oculus(e, f) {                      // FLUX OCULUS: one great eye in a fleshy lid, crystals orbiting
    const t = e.age, angry = e.hp < e.maxHp / 2, n = angry ? 5 : 3;
    for (let k = 0; k < n; k++) {
      const a = (e.spin || 0) + (k / n) * TAU, ox = Math.cos(a) * 62, oy = Math.sin(a) * 62;
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(t * 3);
      cel([0, -10, 7, 0, 0, 10, -7, 0], '#c8e4ff', 9, f, 2); ctx.restore();
      if (!OUTLINE) { ctx.globalAlpha = 0.3; ctx.strokeStyle = e.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ox, oy); ctx.stroke(); ctx.globalAlpha = 1; }
    }
    ctx.scale(e.r / 40, e.r / 40);
    for (let i = 0; i < 6; i++) tendril(Math.cos(i) * 20, 20, Math.cos(i * 1.7) * 30, 52 + (i % 2) * 8, Math.sin(t * 2 + i) * 6, tone(e.color, -0.2), 3);
    oval(0, 0, 40, 34, 0, e.color, f, 3);
    veins([[-30, -14, -16, -30, 4, -30], [26, -18, 30, 0, 34, 10]]);
    oval(0, 2, 28, 22, 0, '#f6edd2', f, 2.4);
    if (!OUTLINE) {
      const ix = Math.cos(LOOK) * 8, iy = Math.sin(LOOK) * 6;
      ctx.fillStyle = angry ? COL.red : '#ff5df0'; ctx.beginPath(); ctx.arc(ix, 2 + iy, 14, 0, TAU); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(ix, 2 + iy, 4, 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(ix - 5, iy - 4, 3.5, 0, TAU); ctx.fill();
      veins([[-24, -6, -16, 0, -12, 8], [22, 10, 16, 4, 12, -4]]);
    }
    celBuild(() => { ctx.beginPath(); ctx.ellipse(0, -18, 34, 12, 0, Math.PI, TAU); ctx.quadraticCurveTo(0, -6, -34, -18); }, tone(e.color, -0.25), 30, f, 2.4);   // heavy upper lid
  },
  static(e, f) {                      // STATIC WRAITH: a tattered glitching shroud with a TV-snow face
    const t = e.age; ctx.scale(e.r / 40, e.r / 40);
    if (!OUTLINE && e.ghosts) for (const [gx, gy] of e.ghosts) {
      ctx.save(); ctx.translate((gx - e.x) * 40 / e.r, (gy - e.y) * 40 / e.r); ctx.globalAlpha = 0.35;
      ctx.fillStyle = e.color; path([-26, -30, 26, -30, 34, 40, 0, 26, -34, 40]); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1;
    }
    const jx = (e.flick || 0) > 0 || Math.sin(t * 13) > 0.92 ? rand(-5, 5) : 0;
    ctx.translate(jx, 0);
    celBuild(() => path([-26, -34, 0, -44, 26, -34, 36, 10, 40, 44, 22, 30, 10, 46, -4, 30, -18, 46, -28, 28, -40, 44, -36, 6]), e.color, 40, f, 3);
    oval(0, -18, 18, 16, 0, '#2a2a3a', f, 2.6);
    if (!OUTLINE) {
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, -18, 16, 14, 0, 0, TAU); ctx.clip();
      for (let i = 0; i < 70; i++) { ctx.fillStyle = Math.random() < 0.5 ? '#e0f0ff' : '#5a6a80'; ctx.fillRect(rand(-16, 14), rand(-32, 2), 2, 2); }
      ctx.restore();
      ctx.fillStyle = COL.red; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * 6 + Math.cos(LOOK), -20 + Math.sin(LOOK), 2.6, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = '#ff5df0'; ctx.lineWidth = 2; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(-30, rand(-10, 30)); ctx.lineTo(30, rand(-10, 30)); ctx.stroke(); ctx.globalAlpha = 1;
    }
    for (const sd of [-1, 1]) boneHook(sd * 28, 0, sd * 54, 8, sd * 46, 36, sd * 5, f);
  },
  nautilus(e, f) {                    // DREAD NAUTILUS: a coiled shell, a hood of tentacles, one slit eye
    const t = e.age; ctx.scale(e.r / 46, e.r / 46);
    for (let i = 0; i < 6; i++) tendril((i - 2.5) * 7, 18, (i - 2.5) * 14, 64 + (i % 2) * 10, Math.sin(t * 2.4 + i) * 9, '#d8a0a8', 4.5);
    oval(0, -10, 44, 40, 0, '#e8dcc0', f, 3);
    if (!OUTLINE) {                                   // the spiral and stripes
      ctx.save(); ctx.rotate(t * 0.4);
      ctx.strokeStyle = '#8a4a30'; ctx.lineWidth = 4; ctx.beginPath();
      for (let a = 0; a < 14; a += 0.2) { const r = 2 + a * 2.7; ctx.lineTo(Math.cos(a) * r, -10 + Math.sin(a) * r); } ctx.stroke(); ctx.restore();
    }
    oval(0, 16, 30, 14, 0, e.color, f, 2.8);
    eyeball(-14, 14, 5, '#ffd66a', t); eyeball(14, 14, 5, '#ffd66a', t);
    maw(0, 26, 8, 5, 8, 0.5 + 0.5 * Math.abs(Math.sin(t * 3)));
  },
  siren(e, f) {                       // SIREN BLOOM: a carnivorous anemone with a singing face at its heart
    const t = e.age; ctx.scale(e.r / 46, e.r / 46);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + Math.sin(t * 1.5) * 0.1, r1 = 52 + Math.sin(t * 3 + i) * 6;
      tendril(Math.cos(a) * 26, Math.sin(a) * 26, Math.cos(a) * r1, Math.sin(a) * r1, Math.sin(t * 2 + i) * 6, i % 2 ? e.color : '#ff9ac8', 5);
      glow(Math.cos(a) * r1, Math.sin(a) * r1, 3.5, '#fff2a0', 0.7);
    }
    oval(0, 0, 32, 30, 0, e.color, f, 3);
    oval(0, 2, 18, 20, 0, '#f6e0e8', f, 2.4);
    if (!OUTLINE) { ctx.fillStyle = INK; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 7, -3, 3.6, 1.6, sd * 0.2, 0, TAU); ctx.fill(); } }
    const sing = 0.5 + 0.5 * Math.abs(Math.sin(t * 4));
    maw(0, 10, 6, 7, 8, sing);
  },
  gulper(e, f) {                      // GULPER KING: a pale deep-sea horror that is mostly jaw
    const t = e.age, lunge = e.mode === 2; ctx.scale(e.r / 42, e.r / 42);
    tendril(0, -30, Math.sin(t * 2) * 20, -70, 10 * Math.sin(t), tone(e.color, -0.3), 6);
    const open = lunge ? 1 : 0.35 + 0.15 * Math.sin(t * 3);
    oval(0, -12, 34, 28, 0, e.color, f, 3);
    if (!OUTLINE) {
      ctx.fillStyle = MAW; ctx.beginPath(); ctx.ellipse(0, 12, 40, 14 + open * 26, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = BONE; ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.beginPath();
      for (let x = -34; x <= 34; x += 8) { const yy = 12 - (14 + open * 26) * 0.75 * Math.sqrt(1 - (x / 40) ** 2); ctx.moveTo(x - 3, yy); ctx.lineTo(x, yy + 12 + open * 6); ctx.lineTo(x + 3, yy); }
      for (let x = -30; x <= 30; x += 8) { const yy = 12 + (14 + open * 26) * 0.75 * Math.sqrt(1 - (x / 40) ** 2); ctx.moveTo(x - 3, yy); ctx.lineTo(x, yy - 11 - open * 5); ctx.lineTo(x + 3, yy); }
      ctx.fill(); ctx.stroke();
    }
    celBuild(() => { ctx.beginPath(); ctx.ellipse(0, 12, 42, 16 + open * 28, 0, 0, TAU); }, 'rgba(0,0,0,0)', 1, false, 3);
    eyeball(-20, -22, 3.4, '#e8f0f0', t); eyeball(20, -22, 3.4, '#e8f0f0', t); eyeball(-10, -30, 2.4, '#e8f0f0', t); eyeball(10, -30, 2.4, '#e8f0f0', t);
  },
  bladder(e, f) {                     // BILE BLADDER: a translucent sac of acid that swells until it bursts
    const t = e.age, sw = e.swell || 0, k = 1 + sw * 0.22 + 0.03 * Math.sin(t * 8); ctx.scale(e.r / 46, e.r / 46);
    for (let i = 0; i < 4; i++) tendril((i - 1.5) * 16, -24, (i - 1.5) * 22, -60, Math.sin(t * 2 + i) * 8, '#c2405a', 6);
    ctx.save(); ctx.scale(k, k);
    oval(0, 0, 40, 38, 0, e.color, f, 3);
    if (!OUTLINE) {
      ctx.fillStyle = '#c4cf1f'; ctx.globalAlpha = 0.45 + sw * 0.4; ctx.beginPath(); ctx.ellipse(0, 8, 30, 24, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      for (let i = 0; i < 6; i++) glow(Math.sin(t * 2 + i * 2) * 20, 10 + Math.cos(t * 3 + i) * 14, 3, '#efff8a', 0.8);
    }
    veins([[-34, -10, -20, -28, 0, -34], [30, -20, 20, 4, 34, 12], [-28, 16, -12, 8, -4, 26]]);
    eyeball(-14, -14, 4, EYE, t, sw > 0.8); eyeball(14, -14, 4, EYE, t, sw > 0.8);
    maw(0, 24, 10, 6, 10, 0.4 + sw * 0.6);
    ctx.restore();
    drip(-10, 38, t, 1, 1.5); drip(12, 36, t, 2, 1.2);
  },
  parasite(e, f) {                    // PARASITE KING: a bloated head trailing a crown of whipping tapeworm tails
    const t = e.age; ctx.scale(e.r / 42, e.r / 42);
    const arms = e.hp < e.maxHp / 2 ? 4 : 3;
    for (let k = 0; k < arms; k++) {
      const a = (e.spin || 0) + (k / arms) * TAU;
      for (let i = 6; i >= 1; i--) { const rr = 22 + i * 9, w = Math.sin(t * 4 - i * 0.6) * 0.15; oval(Math.cos(a + w * i * 0.3) * rr, Math.sin(a + w * i * 0.3) * rr, 7 - i * 0.6, 7 - i * 0.6, 0, i % 2 ? '#e8d0a0' : tone('#e8d0a0', -0.2), f, 1.8); }
    }
    oval(0, 0, 32, 30, 0, e.color, f, 3);
    veins([[-24, -10, -12, -24, 4, -26], [22, -16, 26, 0, 28, 10]]);
    eggs([[-18, 4, 3.5], [18, 2, 3.5], [0, -2, 3]], t);
    maw(0, 10, 12, 10, 12, 0.6 + 0.4 * Math.abs(Math.sin(t * 3)));
    eyeball(-14, -12, 3.6, EYE, t); eyeball(14, -12, 3.6, EYE, t); eyeball(0, -20, 2.8, EYE, t);
  },
  phagocyte(e, f) {                   // PHAGOCYTE: a wobbling white blood cell with half-digested things inside
    const t = e.age; ctx.scale(e.r / 44, e.r / 44);
    celBuild(() => { ctx.beginPath(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, r = 42 + Math.sin(a * 5 + t * 3) * 4 + Math.sin(a * 3 - t * 2) * 3; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); }, e.color, 44, f, 3);
    if (!OUTLINE) {
      ctx.globalAlpha = 0.6;
      for (const [x, y, r, c] of [[-16, 14, 7, '#e88a8a'], [18, 10, 6, '#7a3050'], [-4, 26, 5, '#e8d0a0']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x + Math.sin(t + x) * 3, y, r, r * 0.7, t * 0.5, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    oval(0, -8, 20, 16, 0, '#b08ac8', f, 2.4);           // nucleus
    eyeball(-7, -10, 4.2, COL.red, t, e.mode === 2); eyeball(7, -10, 4.2, COL.red, t, e.mode === 2);
    if (e.mode === 2) maw(0, 16, 20, 14, 14, 1);
  },
  knight(e, f) {                      // PRISM KNIGHT: a faceless crystal knight with a glass greatsword
    const t = e.age; ctx.scale(e.r / 42, e.r / 42);
    const sw = e.swing > 0 ? (e.swDir || 1) * (e.swing / 0.6 - 0.5) * 2.4 : 0.6;
    ctx.save(); ctx.translate(28, 0); ctx.rotate(-sw + 0.3);                     // the sword
    cel([-4, 0, 4, 0, 5, 64, 0, 76, -5, 64], '#c8e4ff', 40, f, 2.2);
    flat(() => path([-14, -2, 14, -2, 14, 4, -14, 4]), f ? PAPER : COL.gold, 1.5);
    ctx.restore();
    for (const sd of [-1, 1]) cel([sd * 12, -24, sd * 40, -34, sd * 34, -10, sd * 18, -8], tone(e.color, -0.2), 20, f, 2.2);   // pauldrons
    cel([0, -40, 18, -24, 22, 20, 0, 40, -22, 20, -18, -24], e.color, 40, f, 3);
    if (!OUTLINE) { ctx.strokeStyle = `hsl(${(t * 80) % 360},90%,80%)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(0, 40); ctx.moveTo(-18, -24); ctx.lineTo(22, 20); ctx.stroke(); }
    cel([0, -58, 12, -44, 0, -30, -12, -44], '#e0d8ff', 14, f, 2.2);                 // helm
    if (!OUTLINE) { ctx.fillStyle = INK; ctx.fillRect(-8, -46, 16, 3); ctx.fillStyle = COL.red; ctx.fillRect(-6, -45.5, 12 * (0.5 + 0.5 * Math.sin(t * 4)), 2); }
  },
  choir(e, f) {                       // HALO CHOIR: three porcelain masks, each in its own spinning halo
    const t = e.age; ctx.scale(e.r / 46, e.r / 46);
    for (const sd of [-1, 1]) for (let i = 3; i >= 0; i--) oval(sd * (40 + i * 10), -6 - i * 6, 18, 5, sd * (-0.4 - i * 0.15), i % 2 ? '#f3ead2' : '#e3d6b4', f, 1.6);
    const singing = e.hp < e.maxHp / 2 ? [0, 1, 2] : [(e.volley || 0) % 3];
    for (let i = 0; i < 3; i++) {
      const mx = (i - 1) * 42, my = i === 1 ? -10 : 8, on = singing.includes(i);
      ctx.save(); ctx.translate(mx, my); ctx.rotate(t * (i % 2 ? -1 : 1));
      ringStroke(0, 0, 23, 3.5, on ? COL.gold : '#c8b890');
      ctx.restore();
      oval(mx, my, 16, 19, 0, e.color, f, 2.4);
      if (!OUTLINE) {
        ctx.fillStyle = INK; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(mx + sd * 5, my - 3, 3, 1.4, sd * 0.25, 0, TAU); ctx.fill(); }
        ctx.fillStyle = MAW; ctx.beginPath(); ctx.ellipse(mx, my + 7, 3.2, on ? 5 : 1.4, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = COL.gold; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(mx - 5, my - 1); ctx.quadraticCurveTo(mx - 6, my + 6, mx - 4, my + 12); ctx.stroke();
      }
    }
  },
  reflection(e, f) {                  // THE REFLECTION: a cracked mirror-glass figure, your ship's dark twin inside
    const t = e.age; ctx.scale(e.r / 40, e.r / 40);
    celBuild(() => path([0, -46, 30, -30, 38, 10, 18, 44, -18, 44, -38, 10, -30, -30]), '#d8e8f4', 40, f, 3);
    if (!OUTLINE) {
      ctx.save(); path([0, -46, 30, -30, 38, 10, 18, 44, -18, 44, -38, 10, -30, -30]); ctx.clip();
      ctx.fillStyle = '#1d1648'; ctx.fillRect(-30, -36, 60, 72);
      ctx.save(); ctx.rotate(Math.PI); drawShip(0, 0, 1.5, S && S.ship); ctx.restore();          // your ship, upside down, in the glass
      const sh = ((t * 0.6) % 1) * 120 - 60;
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; path([-40, sh, 40, sh - 30, 40, sh - 18, -40, sh + 12]); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.beginPath();
      ctx.moveTo(-10, -30); ctx.lineTo(4, -8); ctx.lineTo(-6, 10); ctx.lineTo(10, 30); ctx.moveTo(4, -8); ctx.lineTo(24, -4); ctx.stroke();
    }
    for (const sd of [-1, 1]) boneHook(sd * 30, -26, sd * 52, -44, sd * 46, -64, sd * 5, f);
    eyeball(-10, -24, 3.6, '#2ec5ff', t); eyeball(10, -24, 3.6, '#2ec5ff', t);
  },
});

function drawEnemy(e) {
  const draw = CREATURE[e.look] || CREATURE[e.type] || CREATURE.drone, flash = e.flash > 0;
  LOOK = S ? Math.atan2(S.p.y - e.y, S.p.x - e.x) : Math.PI / 2;
  // pass 1: thin white rim around the silhouette; pass 2: the creature itself
  ctx.save(); ctx.translate(e.x, e.y);
  OUTLINE = true; ctx.globalAlpha = 0.9;
  draw(e, flash);
  OUTLINE = false; ctx.globalAlpha = 1;
  ctx.restore();
  ctx.save(); ctx.translate(e.x, e.y);
  draw(e, flash);
  ctx.restore();
  if (e.type === 'gunner') {              // small health bar over Spitters
    ctx.fillStyle = INK; ctx.fillRect(e.x - 19, e.y - e.r - 12, 38, 6);
    ctx.fillStyle = COL.gold; ctx.fillRect(e.x - 18, e.y - e.r - 11, 36 * Math.max(0, e.hp / e.maxHp), 4);
  }
}

// ============================================================================
// World
// ============================================================================
function drawWorld() {
  // blood stains drifting away with the background
  for (const sp of S.splats) {
    ctx.save(); ctx.translate(sp.x, sp.y);
    ctx.globalAlpha = 0.45 * Math.min(1, (sp.life - sp.age) / 0.8);
    splatPath(sp.r, sp.seed);
    ctx.fillStyle = sp.color; ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // XP gems: bright mint with a soft additive glow, white rim, ink edge and a twinkle so they pop
  ctx.globalCompositeOperation = 'lighter';
  for (const o of S.orbs) {
    const g = (o.v >= 5 ? 20 : 14) * (1 + 0.15 * Math.sin(o.age * 6));
    ctx.drawImage(GEM_GLOW, o.x - g, o.y - g, g * 2, g * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const o of S.orbs) {
    const s = (o.v >= 5 ? 8.5 : 5.8) * (1 + 0.1 * Math.sin(o.age * 8));
    const gem = [0, -s, s * 0.72, 0, 0, s, -s * 0.72, 0];
    ctx.save(); ctx.translate(o.x, o.y);
    path(gem); ctx.lineJoin = 'round';
    ctx.lineWidth = 4.2; ctx.strokeStyle = PAPER; ctx.stroke();          // white rim
    ctx.fillStyle = GEM; ctx.fill();
    path([0, -s, s * 0.72, 0, 0, s]); ctx.fillStyle = 'rgba(20,16,31,0.14)'; ctx.fill();   // cel shade, right half
    path(gem); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = PAPER; path([0, -s * 0.75, -s * 0.3, -s * 0.05, 0, 0]); ctx.fill();   // facet glint
    const tw = Math.sin(o.age * 5 + o.x);
    if (tw > 0.6) sparkle(s * 0.6, -s * 0.65, (tw - 0.6) * 4);
    ctx.restore();
  }

  if (S.holes) for (const h of S.holes) if (!h.done) drawHole(h);

  for (const e of S.enemies) drawEnemy(e);
  drawGibs();

  drawLaser();
  drawPlayerShots();

  // Lightning
  for (const z of S.zaps) {
    const pts = [z.x1, z.y1];
    for (let k = 1; k < 5; k++) pts.push(lerp(z.x1, z.x2, k / 5) + rand(-9, 9), lerp(z.y1, z.y2, k / 5) + rand(-9, 9));
    pts.push(z.x2, z.y2);
    for (const [lw, c] of [[7, INK], [4, z.color], [1.5, PAPER]]) {
      ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.lineJoin = 'miter';
      ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.stroke();
    }
  }
  // Shockwaves
  for (const n of S.novas) {
    if (n.delay > 0) continue;
    const life = n.small ? 0.3 : 0.55, a = Math.max(0, 1 - n.age / life);
    ctx.globalAlpha = a;
    ctx.lineWidth = n.small ? 5 : 8; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, TAU); ctx.stroke();
    ctx.lineWidth = n.small ? 2.5 : 4.5; ctx.strokeStyle = n.color; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (S.mushroom) drawMushroom(S.mushroom);
  if (S.ultFx) drawUltFx(S.ultFx);
  // Debris
  for (const q of S.parts) {
    ctx.globalAlpha = 1 - q.age / q.life;
    ctx.fillStyle = q.color;
    const s = q.size * 1.3;
    ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;

  if (!['over', 'title', 'hangar', 'stages'].includes(S.state) && !(S.state === 'reveal' && S.reveal.next === 'over')) drawPlayer();

  drawEnemyShots();

  for (const b of S.bursts) drawBurst(b);
  for (const t of S.texts) {
    ctx.globalAlpha = Math.min(1, 2 * (1.2 - t.age));
    inkText(t.txt, t.x, t.y, t.size * 1.4, t.color);
  }
  ctx.globalAlpha = 1;

  if (S.warp > 0) {                        // Time Warp: a tinted screen and a giant slow clock face
    ctx.fillStyle = 'rgba(46,197,255,0.12)'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2, H * 0.45); ctx.globalAlpha = Math.min(1, S.warp) * 0.35;
    ctx.lineWidth = 3; ctx.strokeStyle = '#7de0ff'; ctx.beginPath(); ctx.arc(0, 0, W * 0.46, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, W * 0.4, 0, TAU); ctx.stroke();
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * W * 0.4, Math.sin(a) * W * 0.4); ctx.lineTo(Math.cos(a) * W * 0.46, Math.sin(a) * W * 0.46); ctx.stroke(); }
    ctx.lineWidth = 5; ctx.rotate(S.t * 0.25); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -W * 0.36); ctx.stroke();
    ctx.rotate(S.t * 0.05); ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -W * 0.24); ctx.stroke();
    ctx.restore(); ctx.globalAlpha = 1;
  }
  drawUltBorder();
  if (S.whiteout > 0) { ctx.globalAlpha = S.whiteout / 0.35 * 0.85; ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

// Blood droplets: ink rims first, then colour, batched by colour
function drawGibs() {
  if (!S.gibs.length) return;
  ctx.fillStyle = INK;
  ctx.beginPath();
  for (const g of S.gibs) { const r = g.r * (1 - g.age / g.life) + 0.9; ctx.moveTo(g.x + r, g.y); ctx.arc(g.x, g.y, r, 0, TAU); }
  ctx.fill();
  for (const c of Object.values(BLOOD)) {
    ctx.fillStyle = c; ctx.beginPath();
    for (const g of S.gibs) { if (g.color !== c) continue; const r = g.r * (1 - g.age / g.life); ctx.moveTo(g.x + r, g.y); ctx.arc(g.x, g.y, r, 0, TAU); }
    ctx.fill();
  }
}

// Enemy bullets: pink balls with a cream core and a fat ink rim. Batched for speed.
function drawEnemyShots() {
  const list = S.ebullets;
  if (!list.length) return;
  ctx.fillStyle = INK;
  ctx.beginPath();
  for (const b of list) { const r = b.r * 1.55; ctx.moveTo(b.x + r, b.y); ctx.arc(b.x, b.y, r, 0, TAU); }
  ctx.fill();
  ctx.fillStyle = COL.enemyShot;
  ctx.beginPath();
  for (const b of list) { const r = b.r * 1.1; ctx.moveTo(b.x + r, b.y); ctx.arc(b.x, b.y, r, 0, TAU); }
  ctx.fill();
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  for (const b of list) { const r = b.r * 0.55; ctx.moveTo(b.x - 1 + r, b.y - 1); ctx.arc(b.x - 1, b.y - 1, r, 0, TAU); }
  ctx.fill();
}

function drawPlayerShots() {
  ctx.lineCap = 'round';
  // plain bullets: one ink pass, then colour by colour
  const byColor = new Map();
  ctx.lineWidth = 5.4; ctx.strokeStyle = INK;
  ctx.beginPath();
  for (const b of S.bullets) {
    if (b.kind !== 'main') continue;
    const sp = Math.hypot(b.vx, b.vy) || 1, len = b.r > 2.6 ? 9 : 6;
    b._tx = b.x - b.vx / sp * len; b._ty = b.y - b.vy / sp * len;
    ctx.moveTo(b.x, b.y); ctx.lineTo(b._tx, b._ty);
    if (!byColor.has(b.color)) byColor.set(b.color, []);
    byColor.get(b.color).push(b);
  }
  ctx.stroke();
  ctx.lineWidth = 2.8;
  for (const [c, arr] of byColor) {
    ctx.strokeStyle = c;
    ctx.beginPath();
    for (const b of arr) { ctx.moveTo(b.x, b.y); ctx.lineTo(b._tx, b._ty); }
    ctx.stroke();
  }

  for (const b of S.bullets) {
    switch (b.kind) {
      case 'rocket':
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
        roundRect(-6, -2.6, 12, 5.2, 2.5);
        ctx.fillStyle = b.color; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = PAPER; ctx.fillRect(3, -1.2, 2.5, 2.4);
        ctx.restore();
        break;
      case 'rail':
        for (const [lw, c] of [[10, INK], [6, b.color], [2, PAPER]]) {
          ctx.lineWidth = lw; ctx.strokeStyle = c;
          ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y + 90); ctx.stroke();
        }
        break;
      case 'flak':
        ctx.fillStyle = b.color;
        ctx.beginPath(); ctx.arc(b.x, b.y, 4.5, 0, TAU); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
        break;
      case 'disc':
        ctx.save(); ctx.translate(b.x, b.y);
        ctx.fillStyle = b.color;
        ctx.beginPath(); ctx.arc(0, 0, b.r, 0, TAU); ctx.fill();
        ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
        ctx.rotate(b.spin);
        ctx.beginPath(); ctx.moveTo(-b.r * 0.7, 0); ctx.lineTo(b.r * 0.7, 0); ctx.moveTo(0, -b.r * 0.7); ctx.lineTo(0, b.r * 0.7); ctx.stroke();
        ctx.restore();
        break;
      case 'wave':
        for (const [lw, c] of [[11, INK], [7, b.color], [2.2, PAPER]]) {
          ctx.lineWidth = lw; ctx.strokeStyle = c;
          ctx.beginPath(); ctx.moveTo(b.x - b.hw, b.y + 10); ctx.quadraticCurveTo(b.x, b.y - 14, b.x + b.hw, b.y + 10); ctx.stroke();
        }
        break;
    }
  }
  ctx.lineCap = 'butt';
}

function drawLaser() {
  if (!S.laser) return;
  for (const o of S.laser.offs || [0]) drawBeam(S.p.x + o, S.laser.w, S.laser.color);
}
function drawBeam(x, w, color) {
  const bot = S.p.y - 14;
  const wob = rand(-1, 1);
  ctx.fillStyle = INK; ctx.fillRect(x - w - 2 + wob, 0, (w + 2) * 2, bot);
  ctx.fillStyle = color; ctx.fillRect(x - w + wob, 0, w * 2, bot);
  ctx.fillStyle = PAPER; ctx.fillRect(x - w * 0.3, 0, w * 0.6, bot);
  // comic speed ticks across the beam
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let y = (S.t * 900) % 40; y < bot; y += 40) { ctx.moveTo(x - w * 0.9, y); ctx.lineTo(x - w * 0.45, y + 6); ctx.moveTo(x + w * 0.9, y + 18); ctx.lineTo(x + w * 0.45, y + 24); }
  ctx.stroke();
  ctx.save(); ctx.translate(x, bot); burstPath(w * 1.6, 8, S.t * 30);
  ctx.fillStyle = PAPER; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.restore();
}

function drawHole(h) {
  ctx.save(); ctx.translate(h.x, h.y);
  const r = 26 + Math.sin(S.t * 8) * 2, R = h.R || 170;
  ctx.save(); ctx.rotate(-S.t * 1.5);                  // swirling accretion disk across the whole pull radius
  for (let k = 0; k < 9; k++) {
    ctx.rotate(TAU / 9); ctx.globalAlpha = 0.25; ctx.lineWidth = 2 + (k % 3);
    ctx.strokeStyle = k % 3 === 0 ? PAPER : k % 3 === 1 ? '#a45cff' : '#ff3fa4';
    ctx.beginPath(); ctx.arc(R * 0.45, 0, R * 0.55, Math.PI * 0.7, Math.PI * 1.15); ctx.stroke();
  }
  ctx.restore(); ctx.globalAlpha = 1;
  const gl = ctx.createRadialGradient(0, 0, r, 0, 0, r * 3.2); gl.addColorStop(0, 'rgba(164,92,255,0.55)'); gl.addColorStop(1, 'rgba(164,92,255,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, r * 3.2, 0, TAU); ctx.fill();
  ctx.rotate(S.t * 3);
  ctx.lineWidth = 3;
  for (let k = 0; k < 4; k++) {
    ctx.rotate(TAU / 4);
    ctx.strokeStyle = k % 2 ? '#a45cff' : PAPER;
    ctx.beginPath(); ctx.arc(r * 1.6, 0, r * 1.6, Math.PI * 0.75, Math.PI * 1.05); ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#a45cff'; ctx.stroke();
  ctx.restore();
}

// ---- ULTIMATE wow: the moment it fires ----------------------------------------
function drawUltFx(f) {
  const t = f.t, u = ULTS[f.id];
  if (t < 0.3) { ctx.globalAlpha = (1 - t / 0.3) * 0.55; ctx.fillStyle = f.color; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }   // colour flash
  if (t < 0.06) { ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H); }                                                               // one white frame
  // comic speed lines bursting out of the ship
  const a = Math.max(0, 1 - t / 0.9);
  if (a > 0) {
    ctx.save(); ctx.translate(f.x, f.y);
    for (let i = 0; i < 36; i++) {
      const ang = (i / 36) * TAU + (i * 7.3) % 1 * 0.1, r0 = 40 + t * 500 + (i * 53) % 90, r1 = r0 + 90 + (i * 31) % 120, w = 3 + (i % 4) * 2;
      ctx.globalAlpha = a; ctx.fillStyle = i % 3 ? f.color : PAPER;
      ctx.beginPath(); ctx.moveTo(Math.cos(ang - 0.012 * w) * r0, Math.sin(ang - 0.012 * w) * r0);
      ctx.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1); ctx.lineTo(Math.cos(ang + 0.012 * w) * r0, Math.sin(ang + 0.012 * w) * r0); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  // the ultimate's glyph, huge, swelling and fading behind the action
  const g = clamp(t / 1.2, 0, 1);
  ctx.save(); ctx.globalAlpha = 0.5 * (1 - g); ctx.translate(f.x, f.y - 60); ctx.scale(1 + g * 3, 1 + g * 3);
  ctx.font = '700 60px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.strokeText(u.glyph, 0, 0); ctx.fillStyle = f.color; ctx.fillText(u.glyph, 0, 0);
  ctx.restore();
  // level stars under the word
  if (t < 1.1) {
    ctx.globalAlpha = Math.min(1, (1.1 - t) * 3);
    for (let i = 0; i < f.L; i++) sparkle(W / 2 + (i - (f.L - 1) / 2) * 22, f.y - 40, 7 + Math.sin(t * 20 + i) * 2);
    ctx.globalAlpha = 1;
  }
}
function drawMushroom(m) {                 // Megaton: a comic fireball and mushroom cloud
  const t = m.t, k = easeOut(clamp(t / 0.5, 0, 1)), fade = clamp((1.6 - t) / 0.6, 0, 1);
  ctx.save(); ctx.translate(m.x, m.y); ctx.globalAlpha = fade;
  const R = 40 + 90 * k, rise = t * 30;
  celBuild(() => { ctx.beginPath(); ctx.moveTo(-R * 0.25, R * 1.3); ctx.lineTo(-R * 0.18, -rise); ctx.lineTo(R * 0.18, -rise); ctx.lineTo(R * 0.25, R * 1.3); ctx.closePath(); }, '#ff8a3d', R, false, 3);
  ctx.translate(0, -rise);
  celBuild(() => { burstPath(R, 14, 7); }, '#ff8a3d', R, false, 3.5);
  celBuild(() => { burstPath(R * 0.72, 12, 3); }, COL.gold, R * 0.7, false, 3);
  celBuild(() => { burstPath(R * 0.4, 10, 5); }, PAPER, R * 0.4, false, 2.5);
  ctx.restore(); ctx.globalAlpha = 1;
}
function drawUltBorder() {                 // while an ultimate is running, the screen edge glows in its colour
  const active = S.overdrive > 0 ? '#2ec5ff' : S.warp > 0 ? '#7de0ff' : S.phase > 0 ? '#ff3fa4' : S.holes ? '#a45cff' : S.barrage ? '#ff8c1a' : S.mushroom ? '#ffd60a' : null;
  if (!active) return;
  ctx.globalAlpha = 0.35 + 0.2 * Math.sin(S.t * 10);
  ctx.lineWidth = 10; ctx.strokeStyle = active; ctx.strokeRect(0, 0, W, H);
  ctx.lineWidth = 3; ctx.strokeStyle = PAPER; ctx.strokeRect(7, 7, W - 14, H - 14);
  ctx.globalAlpha = 1;
}

function drawBurst(b) {
  const t = b.age / b.life;
  const sc = t < 0.15 ? (t / 0.15) * 1.15 : t < 0.3 ? 1.15 - ((t - 0.15) / 0.15) * 0.15 : 1;
  ctx.globalAlpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  ctx.scale(sc, sc);
  if (b.splat) splatPath(b.size * 0.85, b.seed); else burstPath(b.size, b.spikes, b.x);
  ctx.fillStyle = b.color; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  if (b.word && b.splat) {
    let fs = b.size * 0.5;
    ctx.font = `${fs}px ${FONT_D}`;
    const w = ctx.measureText(b.word).width;
    if (w > b.size * 1.6) fs *= b.size * 1.6 / w;
    inkText(b.word, 0, 0, fs, PAPER, 'center', FONT_D, fs * 0.22);
  } else if (b.splat) {
    splatPath(b.size * 0.4, b.seed + 3);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
  } else if (b.word) {
    let fs = b.size * 0.55;
    ctx.font = `${fs}px ${FONT_D}`;
    const w = ctx.measureText(b.word).width;
    if (w > b.size * 1.5) fs *= b.size * 1.5 / w;
    inkText(b.word, 0, 0, fs, b.color === COL.red ? PAPER : COL.red, 'center', FONT_D, fs * 0.2);
  } else {
    burstPath(b.size * 0.55, b.spikes, b.y);
    ctx.fillStyle = PAPER; ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ============================================================================
// HUD
// ============================================================================
const PAUSE_BTN = { x: W - 44, y: 14, w: 40, h: 40 };
const ULT_POS = () => ({ x: W - 112, y: H - 44 });

function drawSlot(x, y, def, lvl, max, builtin, size) {
  const s = size || 23;
  if (def) {
    const tc = TIER[def.tier].color;
    roundRect(x + 2, y + 2, s, s, 4); ctx.fillStyle = INK; ctx.fill();
    roundRect(x, y, s, s, 4);
    ctx.fillStyle = tc; ctx.fill();
    ctx.lineWidth = builtin ? 3 : 2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.font = `700 ${Math.round(s * 0.56)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = INK;
    ctx.fillText(def.glyph, x + s / 2, y + s / 2 + 1);
    inkText(lvl >= max ? 'MAX' : String(lvl), x + s + 1, y + s - 1, lvl >= max ? 9 : 11, lvl >= max ? COL.gold : PAPER, 'right', FONT_D, 2.5);
    if (builtin) { ctx.fillStyle = PAPER; sparkle(x + 2, y + 2, 2.2); }
  } else {
    roundRect(x, y, s, s, 4);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(255,248,231,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawHud() {
  const p = S.p;
  // XP bar
  const need = xpNeed(S.level);
  ctx.fillStyle = INK; ctx.fillRect(4, 3, W - 8, 10);
  ctx.fillStyle = '#3a3366'; ctx.fillRect(6, 5, W - 12, 6);
  ctx.fillStyle = COL.xp; ctx.fillRect(6, 5, (W - 12) * clamp(S.xp / need, 0, 1), 6);

  inkText(`LV ${S.level}`, 8, 28, 20, PAPER, 'left');
  const L = stageLen();
  inkText(fmtTime(Math.min(S.t, L)), W / 2, 28, 20, S.queenUp ? COL.red : PAPER);
  // stage progress (top right, under the hearts): 3 mini-boss markers and the final boss at the end
  const pw = 104, px = W - 14 - pw, py = 66;
  inkText(isRush() ? 'RUSH' : `STG ${S.stage}`, px - 6, py + 1, 11, isRush() ? COL.red : COL.dim, 'right', FONT_D, 2.5);
  ctx.fillStyle = INK; ctx.fillRect(px - 2, py - 2, pw + 4, 6);
  ctx.fillStyle = '#3a3366'; ctx.fillRect(px, py, pw, 2);
  ctx.fillStyle = COL.gold; ctx.fillRect(px, py, pw * Math.min(1, S.t / L), 2);
  for (const t of LEVEL_EVENTS().map(ev => ev.t)) {
    const x = px + pw * (t / L), last = t === L, done = S.t >= t;
    ctx.beginPath(); ctx.arc(x, py + 1, last ? 5 : isRush() ? 2.2 : 3.6, 0, TAU);
    ctx.fillStyle = done ? COL.red : last ? '#d81b60' : '#6b6590'; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke();
  }
  inkText(`${Math.floor(S.credits)} CR`, W - 50, 28, 18, COL.gold, 'right');

  // hull hearts, top right
  for (let i = 0; i < p.maxHp; i++) {
    const x = W - 16 - (p.maxHp - 1 - i) * 14, y = 49;
    heart(x, y, 5.5);
    ctx.fillStyle = i < p.hp ? COL.red : '#3a3366'; ctx.fill();
    ctx.lineWidth = 1.8; ctx.strokeStyle = INK; ctx.stroke();
  }

  // Loadout: signature weapon (bold, starred), then the weapon row and the support row.
  // Slots shrink a little once a row holds more than four (stage 3 onwards).
  const sig = S.ship.weapon, wIds = slotWeapons(), pIds = Object.keys(S.passives), sc = slotCount();
  const most = Math.max(sc.weapons, sc.passives), sz = most > 4 ? 19 : 23, step = sz + (most > 4 ? 4 : 5);
  drawSlot(8, 42, WEAPONS[sig], S.weapons[sig].lvl, weaponMax(), true, sz);
  for (let i = 0; i < sc.weapons; i++) {
    const id = wIds[i];
    drawSlot(38 + i * step, 42, id && WEAPONS[id], id && S.weapons[id].lvl, weaponMax(), false, sz);
  }
  for (let i = 0; i < sc.passives; i++) {
    const id = pIds[i];
    drawSlot(38 + i * step, 46 + sz, id && PASSIVES[id], id && S.passives[id].lvl, id && passiveMax(id), false, sz);
  }

  // pause button
  if (S.state === 'play') {
    for (const dx of [11, 22]) {
      ctx.fillStyle = PAPER; ctx.fillRect(PAUSE_BTN.x + dx, PAUSE_BTN.y + 18, 6, 16);
      ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.strokeRect(PAUSE_BTN.x + dx, PAUSE_BTN.y + 18, 6, 16);
    }
  }

  // Ultimate button (bottom right): fills up, then pulses "2x TAP"
  if (S.ult) {
    const u = ULTS[S.ult.id], { x, y } = ULT_POS(), ready = S.ult.cd <= 0;
    const r = ready ? 22 + Math.sin(S.t * 6) * 2 : 20;
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + 3, y + 3, r, 0, TAU); ctx.fill();
    ctx.fillStyle = ready ? TIER.ult.color : '#3a3366';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (!ready) {
      const f = 1 - S.ult.cd / ultCooldown(S.ult.id);
      ctx.fillStyle = TIER.ult.color + '88';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, UP, UP + TAU * f); ctx.closePath(); ctx.fill();
    }
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    if (ready) {
      ctx.font = '700 18px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = PAPER; ctx.fillText(u.glyph, x, y + 1);
      inkText('2x TAP!', x, y - r - 10, 14, COL.gold);
    } else inkText(String(Math.ceil(S.ult.cd)), x, y + 1, 16, PAPER);
    const lv = S.ult.lv || 1;                                         // ultimate level badge
    slant(x + r - 14, y + r - 12, 30, 14, u.color || COL.gold, 0, 4);
    plainText('LV' + lv, x + r + 1, y + r - 5, 10, INK);
    if (S.ultLvFlash > 0) {
      ctx.globalAlpha = Math.min(1, S.ultLvFlash); ctx.lineWidth = 4; ctx.strokeStyle = COL.gold;
      ctx.beginPath(); ctx.arc(x, y, r + 6 + (1.6 - S.ultLvFlash) * 30, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  // pilot face, bottom right: calm, hurt or critical, and it flinches when you're hit
  if (S.shipId && typeof PILOTS !== 'undefined') {
    const fw = 66, fh = 72, shake = UIM.faceHit > 0 ? rand(-3, 3) * UIM.faceHit * 2 : 0;
    const fx = W - fw - 10 + shake, fy = H - fh - 12;
    const box = [fx + 8, fy, fx + fw, fy, fx + fw - 8, fy + fh, fx, fy + fh];
    path(box.map((v, i) => v + 4)); ctx.fillStyle = INK; ctx.fill();
    path(box); ctx.fillStyle = S.ship.color; ctx.fill();
    ctx.save(); path(box); ctx.clip();
    if (dotPattern) { ctx.globalAlpha = 0.25; ctx.fillStyle = dotPattern; ctx.fillRect(fx, fy, fw, fh); ctx.globalAlpha = 1; }
    drawPilotFace(S.shipId, pilotMood(p), fx + 2, fy + 2, fw - 4, fh);
    if (UIM.faceHit > 0) { ctx.fillStyle = `rgba(255,59,59,${UIM.faceHit})`; ctx.fillRect(fx, fy, fw, fh); }
    ctx.restore();
    path(box); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke();
  }
  if (S.ultHint > 0) {
    const y = H * 0.62;
    panel(30, y - 22, W - 60, 44, COL.gold);
    plainText('DOUBLE-TAP ANYWHERE', W / 2, y - 7, 15, INK);
    plainText(`TO FIRE ${ULTS[S.ult.id].name.toUpperCase()}!`, W / 2, y + 10, 15, INK);
  }

  // Boss warning + health bar
  if (S.warn > 0 && Math.floor(S.warn * 4) % 2 === 0) {
    burstTitle('WARNING!', W / 2, H * 0.36, 40, COL.gold, COL.red);
    panel(W / 2 - 115, H * 0.36 + 38, 230, 24, PAPER, 3);
    plainText(`${S.warnName} INBOUND`, W / 2, H * 0.36 + 51, 14, INK);
  }
  const boss = S.enemies.find(e => e.boss && !e.dead);
  if (boss) {
    const y = 98;
    ctx.fillStyle = INK; ctx.fillRect(18, y, W - 36, 10);
    ctx.fillStyle = '#3a3366'; ctx.fillRect(20, y + 2, W - 40, 6);
    ctx.fillStyle = boss.color; ctx.fillRect(20, y + 2, (W - 40) * Math.max(0, boss.hp / boss.maxHp), 6);
    inkText(boss.name || ENEMY[boss.type].name, W / 2, y + 18, 12, PAPER, 'center', FONT_D, 2.5);
  }
}

// ============================================================================
// Menus. Slanted comic panels that slam in one after another, diagonal colour
// wipes between screens. Buttons register themselves while drawing; game.js
// matches taps to them.
// ============================================================================
const UIM = { key: '', t: 0, wipe: 0, idx: 0, faceHit: 0, lastHp: 0, wheelT: 1 };
const WIPE_TIME = 0.42;
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeOutBack = x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const enterK = (i, delay) => easeOutBack(clamp((UIM.t - (delay === undefined ? 0.08 : delay) - i * 0.055) / 0.32, 0, 1));
const shortest = (a, b, n) => (((a - b) % n) + n * 1.5) % n - n / 2;     // signed shortest distance on a ring

// a slanted panel (parallelogram) with a hard ink drop shadow
function slant(x, y, w, h, fill, shadow, k) {
  k = k === undefined ? Math.min(12, h * 0.28) : k;
  const sh = shadow === undefined ? 5 : shadow;
  const pts = (ox, oy) => [x + k + ox, y + oy, x + w + ox, y + oy, x + w - k + ox, y + h + oy, x + ox, y + h + oy];
  if (sh) { path(pts(sh, sh)); ctx.fillStyle = INK; ctx.fill(); }
  path(pts(0, 0)); ctx.fillStyle = fill; ctx.fill();
  ctx.lineJoin = 'miter'; ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke();
}
function slab(pts, fill, dots) {          // a big angled colour slab
  path(pts); ctx.fillStyle = fill; ctx.fill();
  if (dots && dotPattern) { ctx.save(); path(pts); ctx.clip(); ctx.globalAlpha = 0.28; ctx.fillStyle = dotPattern; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  path(pts); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
}

let uiButtons = [];
function addButton(id, rect, action, enabled) { uiButtons.push({ id, rect, action, enabled: enabled !== false }); }
function drawButton(id, x, y, w, h, label, color, action, enabled) {
  const on = enabled !== false, pressed = S.uiPress === id && on, d = pressed ? 3 : 0;
  const i = UIM.idx++, e = enterK(i), off = (1 - e) * (W + 60) * (i % 2 ? -1 : 1);
  ctx.save(); ctx.translate(off + d, d);
  slant(x, y, w, h, on ? color : '#5a5480', pressed ? 0 : 5);
  inkText(label, x + w / 2, y + h / 2 + 2, Math.min(26, h * 0.5), on ? PAPER : '#b9b4d6');
  ctx.restore();
  addButton(id, { x, y, w, h }, action, on);
}
function slamTitle(text, x, y, size, bg, fg, rot, i) {   // burst title that slams in
  const k = clamp((UIM.t - (i || 0) * 0.05) / 0.3, 0, 1);
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); const sc = 2.2 - 1.2 * easeOutBack(k); ctx.scale(sc, sc);
  burstTitle(text, 0, 0, size, bg, fg, rot);
  ctx.restore();
}

// --- pilot portraits on screen ----------------------------------------------
function drawPilot(id, mood, x, y, h, silhouette, alpha) {
  const img = pilotSprite(id, mood, h * SCALE, silhouette);
  const w = h * 200 / 240;
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  ctx.drawImage(img, x, y, w, h);
  ctx.globalAlpha = 1;
  return w;
}
// head-and-shoulders crop of a pilot inside a box
function drawPilotFace(id, mood, x, y, w, h) {
  const s = w / 120;                                // portrait units 40..160 fill the width
  const img = pilotSprite(id, mood, 240 * s * SCALE);
  ctx.drawImage(img, x - 40 * s, y - 34 * s, 200 * s, 240 * s);
}

function drawLevelUp() {
  dim(0.7);
  const isUlt = S.choices[0] && (S.choices[0].kind === 'ult' || S.choices[0].kind === 'uup'), isUup = isUlt && S.choices[0].kind === 'uup';
  const n = S.choices.length, ch = 92, gap = 14, total = n * ch + (n - 1) * gap;
  const y0 = Math.max(170, H * 0.5 - total / 2);
  const titleY = y0 - 84;
  slamTitle(isUup ? 'ULTIMATE UP!' : isUlt ? 'ULTIMATE!' : 'LEVEL UP!', W / 2, titleY, 42, isUlt ? COL.red : COL.gold, isUlt ? COL.gold : PAPER);
  const ek = easeOut(clamp(UIM.t / 0.3, 0, 1));
  ctx.globalAlpha = ek;
  inkText(isUup ? `LEVEL ${S.choiceLevel}: POWER UP ${ULTS[S.ult.id].name.toUpperCase()}` : isUlt ? 'PICK YOUR SUPER MOVE' : `LEVEL ${S.choiceLevel}: CHOOSE ONE`, W / 2, titleY + 46, 15, PAPER);
  if (!isUlt) inkText(`WEAPONS ${slotWeapons().length}/${slotCount().weapons}  ·  PASSIVES ${Object.keys(S.passives).length}/${slotCount().passives}`,
                      W / 2, titleY + 64, 11, COL.dim, 'center', FONT_D, 2.5);
  ctx.globalAlpha = 1;

  S.choices.forEach((c, i) => {
    const r = { x: 18, y: y0 + i * (ch + gap), w: W - 40, h: ch }, info = choiceInfo(c), pressed = S.uiPress === 'card' + i;
    const d = pressed ? 3 : 0, rx = r.x + d, ry = r.y + d, e = enterK(i, 0.12);
    addButton('card' + i, r, () => choose(i));
    ctx.save();
    ctx.translate((1 - e) * W * 1.15, 0);
    ctx.translate(rx + r.w / 2, ry + r.h / 2); ctx.rotate((i % 2 ? 1 : -1) * 0.018); ctx.translate(-(rx + r.w / 2), -(ry + r.h / 2));
    slant(rx, ry, r.w, r.h, PAPER, pressed ? 0 : 6, 10);
    ctx.save(); path([rx + 10, ry, rx + 76, ry, rx + 66, ry + r.h, rx, ry + r.h]); ctx.clip();
    ctx.fillStyle = info.color; ctx.fillRect(rx, ry, 80, r.h);
    if (dotPattern) { ctx.globalAlpha = 0.25; ctx.fillStyle = dotPattern; ctx.fillRect(rx, ry, 80, r.h); ctx.globalAlpha = 1; }
    ctx.restore();
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(rx + 76, ry); ctx.lineTo(rx + 66, ry + r.h); ctx.stroke();
    const ix = rx + 36, iy = ry + r.h / 2;
    ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(ix, iy, 21, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.font = '700 21px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = INK; ctx.fillText(info.glyph, ix, iy + 1);
    const tx = rx + 82, tw = r.w - 96;
    plainText(info.tag, tx, ry + 16, 12, '#5a5480', 'left');
    if (info.tier) {
      ctx.font = `12px ${FONT_D}`;
      const pw = ctx.measureText(info.tier).width + 12;
      roundRect(rx + r.w - pw - 12, ry + 7, pw, 18, 9);
      ctx.fillStyle = info.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
      plainText(info.tier, rx + r.w - pw / 2 - 12, ry + 17, 12, INK);
    }
    plainText(info.title, tx, ry + 37, 22, INK, 'left');
    ctx.font = `700 12.5px ${FONT_B}`;
    wrapLines(info.desc, tw).slice(0, 2).forEach((ln, k) => plainText(ln, tx, ry + 59 + k * 15, 12.5, '#2c2640', 'left', FONT_B));
    ctx.restore();
  });
  UIM.idx = n + 1;
  const by = y0 + total + 20;
  if (ML('reroll') > 0) drawButton('reroll', W / 2 - 80, by, 160, 42, `REROLL (${S.rerolls})`, '#ff8c1a', reroll, S.rerolls > 0);
  if (S.uiLock > 0) dim(0.2);
}

// --- Title -------------------------------------------------------------------
function drawLogo(cx, cy) {
  const k = clamp(UIM.t / 0.38, 0, 1), sc = 2.4 - 1.4 * easeOutBack(k);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.rotate(-0.07);
  ctx.save(); ctx.scale(2.2, 1.15); burstPath(66, 16, 3); ctx.restore();
  ctx.fillStyle = '#7b2cff'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  if (dotPattern) { ctx.save(); ctx.clip(); ctx.globalAlpha = 0.3; ctx.fillStyle = dotPattern; ctx.fillRect(-200, -120, 400, 240); ctx.restore(); }
  inkText('VOID', 5, -16, 78, INK, 'center', FONT_D, 0);
  inkText('VOID', 0, -21, 78, COL.gold, 'center', FONT_D, 9);
  slant(-112, 22, 224, 42, COL.red, 4, 12);
  inkText('SURVIVORS', 0, 45, 40, PAPER, 'center', FONT_D, 6);
  ctx.restore();
}

function drawTitle() {
  const id = S.shipId, sh = curShip(), P = PILOTS[id], wp = WEAPONS[sh.weapon];
  // angled slab with the pilot standing behind their ship
  const e0 = easeOut(clamp(UIM.t / 0.35, 0, 1));
  ctx.save(); ctx.translate(-(1 - e0) * W, 0);
  slab([0, H * 0.24, W, H * 0.30, W, H * 0.62, 0, H * 0.58], sh.color, true);
  ctx.restore();
  const ph = H * 0.38, pe = easeOutBack(clamp((UIM.t - 0.1) / 0.4, 0, 1));
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H * 0.6 + 2); ctx.clip();
  drawPilot(id, 'normal', W * 0.14 - (1 - pe) * W * 0.8, H * 0.6 - ph + 4, ph);
  ctx.restore();
  const se = easeOutBack(clamp((UIM.t - 0.2) / 0.4, 0, 1)), sx = W * 0.73 + (1 - se) * W * 0.6, sy = H * 0.47;
  drawFlame(sx, sy + 12 * 2, 2);
  drawShip(sx, sy + Math.sin(performance.now() / 500) * 3, 2.1, sh);
  // name plates
  ctx.save(); ctx.translate((1 - se) * W, 0);
  slant(W * 0.5, H * 0.555, W * 0.47, 30, INK, 0, 10);
  inkText(sh.name, W * 0.74, H * 0.555 + 16, 22, sh.color, 'center', FONT_D, 4);
  ctx.restore();
  ctx.save(); ctx.translate(-(1 - pe) * W, 0);
  slant(10, H * 0.612, W * 0.62, 26, PAPER, 4, 9);
  plainText(P.name, 22, H * 0.612 + 14, 17, INK, 'left');
  ctx.restore();
  drawLogo(W / 2, H * 0.12);
  if (META.notice) { slant(20, 6, W - 40, 26, COL.xp, 3, 8); plainText(META.notice, W / 2, 20, 14, INK); }

  const by = H * 0.67;
  ctx.globalAlpha = easeOut(clamp((UIM.t - 0.3) / 0.3, 0, 1));
  plainText('Drag to fly  ·  grab gems to level up  ·  only the white dot can be hit', W / 2, by - 6, 11, PAPER, 'center', FONT_B);
  ctx.globalAlpha = 1;
  drawButton('launch', 34, by + 8, W - 68, 54, 'LAUNCH!', COL.xp, openStages);
  drawButton('hangar', 34, by + 74, W - 68, 46, `HANGAR · ${META.bank} CR`, '#ff8c1a', openHangar);
  drawButton('settings', 34, by + 132, W - 68, 40, 'SETTINGS', '#a45cff', openSettings);
  if (META.best > 0) inkText(`BEST TIME ${fmtTime(META.best)}${META.clears ? ` · CLEARS ${META.clears}` : ''}`, W / 2, by + 186, 14, COL.dim, 'center', FONT_D, 3);
}

// --- Hangar ----------------------------------------------------------------
let hangarTab = 'ships';
// Purchases need two taps: the first arms it ("TAP AGAIN"), the second buys.
function confirmBuy(id, fn) {
  if (S.armed && S.armed.id === id) { S.armed = null; fn(); }
  else { S.armed = { id, t: 2.5 }; buzz(10); }
}
const isArmed = id => S.armed && S.armed.id === id;
const blinkOn = () => Math.floor(performance.now() / 200) % 2 === 0;

function drawHangar() {
  const e = easeOut(clamp(UIM.t / 0.3, 0, 1));
  ctx.save(); ctx.translate(-(1 - e) * W, 0);
  slant(-14, 10, 190, 46, COL.red, 5, 14);
  inkText('HANGAR', 84, 35, 34, COL.gold, 'center', FONT_D, 6);
  ctx.restore();
  ctx.save(); ctx.translate((1 - e) * W, 0);
  slant(W - 150, 16, 140, 34, COL.gold, 4, 10);
  plainText(`${META.bank} CR`, W - 80, 34, 22, INK);
  ctx.restore();
  const tw = (W - 44) / 2;
  drawTab('tabShips', 16, 66, tw, 34, 'SHIPS', 'ships');
  drawTab('tabUps', 28 + tw, 66, tw, 34, 'UPGRADES', 'upgrades');
  if (hangarTab === 'ships') drawShipWheel(108, H - 76);
  else {
    const sh = curShip();
    slant(12, 108, 64, 64, sh.color, 4, 8);
    ctx.save(); path([12 + 8, 108, 76, 108, 76 - 8, 172, 12, 172]); ctx.clip();
    drawPilotFace(S.shipId, 'normal', 12, 108, 64, 64);
    ctx.restore();
    path([12 + 8, 108, 76, 108, 76 - 8, 172, 12, 172]); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke();
    inkText(`${sh.name} UPGRADES`, 86, 128, 22, sh.color, 'left');
    plainText(`${PILOTS[S.shipId].name} · ${sh.role.toUpperCase()}`, 86, 150, 11, COL.dim, 'left', FONT_B);
    plainText('Switch ship in SHIPS to upgrade another', 86, 165, 10, COL.dim, 'left', FONT_B);
    drawUpgradeList(180, H - 76);
  }
  drawButton('back', 16, H - 64, tw, 48, 'BACK', '#5a5480', () => { newGame('title'); });
  drawButton('launch', 28 + tw, H - 64, tw, 48, 'LAUNCH!', COL.xp, openStages);
}

function drawTab(id, x, y, w, h, label, tab) {
  const on = hangarTab === tab;
  slant(x, y, w, h, on ? COL.gold : '#3a3366', on ? 4 : 0, 10);
  plainText(label, x + w / 2, y + h / 2 + 1, 18, on ? INK : COL.dim);
  addButton(id, { x, y, w, h }, () => { if (hangarTab !== tab) { hangarTab = tab; S.armed = null; } });
}

// The ship wheel: the chosen ship up front with its pilot behind; the others ride
// around a wheel. Swipe or use the arrows. Locked ships and pilots are silhouettes.
const shipList = () => SHIP_ORDER.filter(shipRevealed);   // only ships you've unlocked so far; one more after each run
let wheelIdx = -1, wheelPos = 0;
function wheelSpin(d) {
  const n = shipList().length;
  wheelIdx = (wheelIdx + d + n) % n;
  S.armed = null; UIM.wheelT = 0;
  snd('click');
}
function uiSwipe(dir) {
  if (S && S.state === 'hangar' && hangarTab === 'ships' && wheelIdx >= 0) { wheelSpin(dir); return true; }
  return false;
}

function drawShipWheel(top, bottom) {
  const SHIP_IDS = shipList(), n = SHIP_IDS.length;
  if (wheelIdx < 0 || wheelIdx >= n) { wheelIdx = Math.max(0, SHIP_IDS.indexOf(META.ship)); wheelPos = wheelIdx; }
  const id = SHIP_IDS[wheelIdx], ship = SHIPS[id], P = PILOTS[id], wp = WEAPONS[ship.weapon];
  const owned = !!META.ships[id], sel = META.ship === id, tc = TIER[wp.tier].color, cost = shipCost(id), afford = META.bank >= cost;
  const avail = bottom - top, wheelH = avail * 0.5;

  // backdrop slab in the ship's tier colour, pilot behind
  slab([0, top + 8, W, top + wheelH * 0.05, W, top + wheelH * 0.9, 0, top + wheelH], owned ? tc : '#3a3366', true);
  const pk = easeOutBack(clamp(UIM.wheelT / 0.32, 0, 1));
  const ph = wheelH * 1.02;
  ctx.save(); path([0, top + 8, W, top + wheelH * 0.05, W, top + wheelH * 0.9, 0, top + wheelH]); ctx.clip();
  drawPilot(id, 'normal', W / 2 - ph * 0.42 - 34 + (1 - pk) * 50, top + wheelH - ph + 4, ph, !owned, 0.35 + 0.65 * pk);
  ctx.restore();
  if (!owned) inkText('?', W / 2 - 34, top + wheelH * 0.45, 70, '#6b6590', 'center', FONT_D, 6);

  // ships around the wheel (far ones first)
  const cy = top + wheelH * 0.8, base = Math.round(wheelPos), list = [];
  for (let k = -3; k <= 3; k++) {
    const i = ((base + k) % n + n) % n, off = shortest(i, wheelPos, n);
    if (Math.abs(off) <= Math.min(2.6, n / 2) && !list.some(l => l[0] === i)) list.push([i, off]);   // small hangars: each ship once
  }
  list.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  for (const [i, off] of list) {
    const a = off * 0.62, x = W / 2 + Math.sin(a) * W * 0.42, y = cy - (1 - Math.cos(a)) * 70;
    const sc = Math.max(0.6, 2.2 - Math.abs(off) * 0.7), sid = SHIP_IDS[i];
    if (Math.abs(off) < 0.5) drawFlame(x, y + 12 * sc, sc);
    ctx.globalAlpha = Math.abs(off) < 0.5 ? 1 : 0.85;
    drawShip(x, y + Math.sin(performance.now() / 500 + i) * 2, sc, SHIPS[sid], !META.ships[sid]);
    ctx.globalAlpha = 1;
  }
  if (!owned) slamTitle('NEW!', W - 70, top + wheelH * 0.3, 26, COL.gold, COL.red, 0.12);
  if (n > 1) {
    drawButton('wl', 8, cy - 26, 40, 50, '<', '#5a5480', () => wheelSpin(-1));
    drawButton('wr', W - 48, cy - 26, 40, 50, '>', '#5a5480', () => wheelSpin(1));
  }

  // info card
  const iy = top + wheelH + 8, ih = avail - wheelH - 66;
  const ie = easeOutBack(clamp(UIM.wheelT / 0.3, 0, 1));
  ctx.save(); ctx.translate((1 - ie) * 40, 0);
  slant(10, iy, W - 20, ih, PAPER, 5, 12);
  inkText(ship.name, 30, iy + 20, 26, owned ? ship.color : '#6b6590', 'left', FONT_D, 4);
  ctx.font = `12px ${FONT_D}`;
  const tier = TIER[wp.tier].name, pw = ctx.measureText(tier).width + 12;
  roundRect(W - 30 - pw, iy + 11, pw, 18, 9); ctx.fillStyle = tc; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  plainText(tier, W - 30 - pw / 2, iy + 21, 12, INK);
  plainText(owned ? `PILOT: ${P.name}` : 'PILOT: ???', 30, iy + 42, 14, '#4a4470', 'left');
  plainText(owned ? `"${P.quote}"` : 'Unlock this ship to meet the pilot.', 30, iy + 58, 11, '#4a4470', 'left', FONT_B);
  plainText(`${wp.name.toUpperCase()} · ${ship.role.toUpperCase()}`, 30, iy + 76, 13, INK, 'left');
  // stats
  const lv = META.shipLv[id] || {}, rows = [['HULL', 'hull'], ['POWER', 'dmg'], ['FIRE RATE', 'rate'], ['PICKUP', 'magnet'], ['HANDLING', 'handling']];
  const rh = clamp((ih - 92) / rows.length, 11, 17);
  rows.forEach(([label, stat], r) => {
    const y = iy + 94 + r * rh, v = shipStat(stat, lv[stat] || 0, ship);
    plainText(label, 30, y, 12, '#4a4470', 'left');
    const bx = 112, bw = W - 112 - 70;
    if (stat === 'hull') {
      for (let k = 0; k < 8; k++) { heart(bx + 7 + k * 15, y, 5); ctx.fillStyle = k < v ? COL.red : '#d9d4ee'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke(); }
    } else {
      const f = clamp((v - 0.5) / 1.0, 0.05, 1);
      ctx.fillStyle = '#d9d4ee'; ctx.fillRect(bx, y - 4, bw, 8);
      ctx.fillStyle = tc; ctx.fillRect(bx, y - 4, bw * f, 8);
      ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.strokeRect(bx, y - 4, bw, 8);
    }
    plainText(fmtStat(stat, v), W - 32, y, 12, INK, 'right');
  });
  ctx.restore();

  // action
  const ay = bottom - 54;
  if (owned) drawButton('wsel', 40, ay, W - 80, 46, sel ? 'FLYING THIS ONE!' : 'SELECT', sel ? '#5a8a4a' : COL.xp,
                        () => { if (!sel) { META.ship = id; saveMeta(); S.shipId = id; S.ship = ship; buzz(20); } }, !sel);
  else if (!afford) drawButton('wbuy', 40, ay, W - 80, 46, `NEED ${cost} CR · YOU HAVE ${META.bank}`, '#5a5480', () => {}, false);
  else drawButton('wbuy', 40, ay, W - 80, 46, isArmed(id) ? 'TAP AGAIN TO UNLOCK' : `UNLOCK · ${cost} CR`, isArmed(id) && blinkOn() ? COL.red : '#ff8c1a',
                  () => confirmBuy(id, () => {
                    META.bank -= cost; META.ships[id] = true; META.ship = id; saveMeta();
                    S.shipId = id; S.ship = ship; S.flash = { id, t: 0.4 }; UIM.wheelT = 0; buzz(40); snd('pick', wp.tier);
                  }));
}

function drawUpgradeList(top, bottom) {
  const rowH = clamp((bottom - top) / HANGAR.length, 40, 60);
  HANGAR.forEach((h, i) => {
    const y = top + i * rowH, lv = ML(h.id), maxed = lv >= h.max, cost = hangarCost(h), afford = !maxed && META.bank >= cost;
    const pressed = S.uiPress === 'h' + i, d = pressed ? 3 : 0, e = enterK(i, 0.04);
    const r = { x: 12, y: y + 2, w: W - 28, h: rowH - 8 };
    const flash = S.flash && S.flash.id === h.id;
    ctx.save(); ctx.translate((1 - e) * W + d, d);
    slant(r.x, r.y, r.w, r.h, flash ? COL.gold : PAPER, pressed ? 0 : 4, 8);
    plainText(h.name, r.x + 14, r.y + r.h * 0.32, 16, INK, 'left');
    plainText(typeof h.desc === 'function' ? h.desc(lv, maxed) : h.desc, r.x + 12, r.y + r.h * 0.72, 11, '#4a4470', 'left', FONT_B);
    const pipW = Math.min(8, 60 / h.max - 2);
    for (let k = 0; k < h.max; k++) {
      const px = r.x + r.w - 86 - h.max * (pipW + 2) + k * (pipW + 2), py = r.y + r.h * 0.32 - 4;
      ctx.fillStyle = k < lv ? COL.gold : '#d9d4ee'; ctx.fillRect(px, py, pipW, 8);
      ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.strokeRect(px, py, pipW, 8);
    }
    const armed = isArmed(h.id);
    const label = maxed ? 'MAX' : armed ? 'TAP AGAIN' : `${cost} CR`;
    ctx.font = `14px ${FONT_D}`;
    const pw = ctx.measureText(label).width + 14, px = r.x + r.w - 12 - pw, py = r.y + r.h / 2;
    roundRect(px, py - 10, pw, 20, 10);
    ctx.fillStyle = maxed ? '#d9d4ee' : armed ? (blinkOn() ? COL.gold : PAPER) : afford ? COL.gold : '#d9d4ee'; ctx.fill();
    ctx.lineWidth = 1.8; ctx.strokeStyle = INK; ctx.stroke();
    plainText(label, px + pw / 2, py + 1, 14, afford || armed ? INK : '#8c86ad');
    ctx.restore();
    addButton('h' + i, r, () => (afford ? confirmBuy(h.id, () => buyHangar(h)) : buzz(20)), !maxed);
  });
}

// --- Settings overlay: volume sliders, vibration, reset progress (with an are-you-sure screen) ---
let uiSliders = [];
function drawSlider(label, y, value, set, color) {
  const x0 = 60, x1 = W - 60;
  plainText(label, 30, y - 22, 18, PAPER, 'left');
  plainText(Math.round(value * 100) + '%', W - 30, y - 22, 18, color, 'right');
  slant(x0 - 14, y - 9, x1 - x0 + 28, 18, INK, 0, 6);
  slant(x0 - 10, y - 5, (x1 - x0 + 20) * Math.max(0.04, value), 10, color, 0, 4);
  const kx = lerp(x0, x1, value);
  ctx.save(); ctx.translate(kx, y); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = PAPER; ctx.fillRect(-11, -11, 22, 22); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeRect(-11, -11, 22, 22);
  ctx.restore();
  uiSliders.push({ rect: { x: x0 - 30, y: y - 26, w: x1 - x0 + 60, h: 52 }, x0, x1, set });
}
function drawSettings() {
  uiButtons = []; uiSliders = [];           // the overlay takes all the taps
  const st = S.settings, e = easeOut(clamp(UIM.t / 0.25, 0, 1));
  dim(0.95);
  ctx.save(); ctx.translate(-(1 - e) * W, 0);
  slab([0, 22, W, 10, W, 74, 0, 86], '#a45cff', true);
  ctx.restore();
  if (st.page === 'main') {
    inkText('SETTINGS', W / 2, 52, 40, COL.gold, 'center', FONT_D, 7);
    const y0 = 150;
    drawSlider('MUSIC', y0, PREF.musicVol, v => setVolume('musicVol', v), '#a45cff');
    drawSlider('SOUND EFFECTS', y0 + 90, PREF.sfxVol, v => { const was = PREF.sfxVol; setVolume('sfxVol', v); if (Math.abs(v - was) > 0.08) snd('gem'); }, COL.player);
    drawButton('vibe', 40, y0 + 150, W - 80, 44, `VIBRATION ${PREF.vibe ? 'ON' : 'OFF'}`, PREF.vibe ? COL.xp : '#5a5480',
               () => { PREF.vibe = !PREF.vibe; saveMeta(); buzz(40); });
    drawButton('reset', 40, H - 150, W - 80, 44, 'RESET PROGRESS', COL.red, () => { st.page = 'confirm'; st.armed = false; UIM.t = 0; S.uiLock = 0.4; });
    drawButton('done', 40, H - 88, W - 80, 54, 'DONE', COL.xp, closeSettings);
  } else {
    // the are-you-sure screen
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    slamTitle('ARE YOU SURE?', W / 2, H * 0.22, 40, COL.red, COL.gold);
    slant(20, H * 0.3, W - 40, 150, PAPER, 5, 12);
    const lines = ['This erases ALL of your progress:', 'credits, ships, pilots, Hangar upgrades,', 'unlocked stages, secrets and best times.', 'Your sound settings stay.', 'THIS CANNOT BE UNDONE.'];
    lines.forEach((l, i) => plainText(l, W / 2, H * 0.3 + 24 + i * 25, i === 4 ? 16 : 13, i === 4 ? COL.red : INK, 'center', i === 4 ? FONT_D : FONT_B));
    drawButton('keep', 40, H * 0.3 + 180, W - 80, 56, 'NO, KEEP MY PROGRESS', COL.xp, () => { st.page = 'main'; UIM.t = 0; });
    drawButton('erase', 40, H * 0.3 + 254, W - 80, 46, st.armed ? 'TAP AGAIN TO ERASE EVERYTHING' : 'YES, ERASE EVERYTHING',
               st.armed && flash ? '#ff7a7a' : COL.red, () => { if (st.armed) resetProgress(); else { st.armed = true; buzz([60, 40, 60]); } });
  }
}

function drawPaused() {
  dim(0.65);
  const e = easeOut(clamp(UIM.t / 0.3, 0, 1));
  ctx.save(); ctx.translate(-(1 - e) * W, 0);
  slab([0, H * 0.24, W, H * 0.2, W, H * 0.42, 0, H * 0.46], '#3a3366', true);
  ctx.restore();
  const ph = H * 0.24;
  drawPilot(S.shipId, pilotMood(S.p), W * 0.58 + (1 - e) * W, H * 0.44 - ph, ph);
  slamTitle('PAUSED', W * 0.32, H * 0.34, 44, COL.player, PAPER);
  drawButton('resume', 44, H * 0.5, W - 88, 54, 'RESUME', COL.xp, resume);
  drawButton('quit', 44, H * 0.5 + 68, W - 88, 46, 'END RUN', COL.red, () => gameOver(true));
  drawButton('settings', 44, H * 0.5 + 128, W - 88, 40, 'SETTINGS', '#a45cff', openSettings);
}

function drawGameOver() {
  dim(0.55);
  const cy = H * 0.2;
  const won = S.state === 'won';
  const e = easeOut(clamp(UIM.t / 0.35, 0, 1));
  const ph = H * 0.26;
  drawPilot(S.shipId, won ? 'normal' : 'crit', W - ph * 0.83 + 6 + (1 - e) * W, cy + 40, ph);
  const finale = won && S.stage === STAGE_COUNT, rush = isRush();
  slamTitle(rush && won ? 'LEGEND!' : finale ? 'YOU WIN!' : won ? 'STAGE CLEAR!' : S.quit ? 'RUN ENDED' : 'SHIP LOST!', W / 2, cy, 46, won ? COL.xp : S.quit ? COL.player : COL.red, COL.gold);
  if (won) inkText(rush ? 'EVERY HORROR, BEATEN AGAIN.' : finale ? 'THE VOID IS SILENT. YOU SURVIVED.' : `${ENEMY[stageDef().final].name} DESTROYED!`, W / 2, cy + 40, 15, PAPER);
  if (won && !finale && !rush) inkText(`Your loadout carries on · +1 weapon and +1 support slot`, W / 2, H * 0.74 - 16, 11, COL.dim, 'center', FONT_B, 3);
  if (S.secretOpen) inkText(S.secretFound ? 'FLAWLESS! A SECRET STAGE HAS OPENED...' : 'THE SECRET STAGE AWAITS...', W / 2, H * 0.74 - 16, 13, blinkOn() ? COL.gold : COL.red, 'center', FONT_D, 3);
  const npY = H * 0.74 - ((won && !finale && !rush) || S.secretOpen ? 34 : 16);
  if (S.newPilot) inkText(`NEW SHIP UNLOCKED: ${SHIPS[S.newPilot].name.toUpperCase()} · SEE THE HANGAR!`, W / 2, npY, 13, blinkOn() ? COL.gold : PAPER, 'center', FONT_D, 3);
  else if (S.revealNeed) inkText(`BEAT A STAGE ${S.revealNeed.stage} BOSS TO UNLOCK ${TIER[S.revealNeed.tier].name} SHIPS`, W / 2, npY, 12, TIER[S.revealNeed.tier].color, 'center', FONT_D, 3);
  const rows = [['STAGE', rush ? 'SECRET' : `${S.stage} / ${STAGE_COUNT}`], ['RUN TIME', fmtTime(S.runT)], ['LEVEL', String(S.level)], ['KILLS', String(S.kills)], ['BEST', fmtTime(META.best)]];
  const py = cy + 62;
  ctx.save(); ctx.translate(-(1 - e) * W, 0);
  slant(24, py, W * 0.6, 22 + rows.length * 24, PAPER, 5, 12);
  rows.forEach(([k, v], i) => {
    const y = py + 22 + i * 24;
    plainText(k, 44, y, 17, '#4a4470', 'left');
    plainText(v, 24 + W * 0.6 - 22, y, 19, INK, 'right');
  });
  ctx.restore();
  const cyy = py + 22 + rows.length * 24 + 46;
  const bk = clamp((UIM.t - 0.35) / 0.3, 0, 1);
  if (bk > 0) {
    ctx.save(); ctx.translate(W / 2, cyy); ctx.rotate(0.05); const sc = 2 - easeOutBack(bk); ctx.scale(sc, sc);
    burstPath(54, 14, 4); ctx.fillStyle = COL.gold; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    inkText(`+${S.earned} CR`, 0, 2, 30, COL.red, 'center', FONT_D, 5);
    ctx.restore();
  }
  inkText(`BOUNTY BANKED · ${META.bank} CR TOTAL${S.newBest ? ' · NEW BEST TIME!' : ''}`, W / 2, cyy + 50, 13, S.newBest ? COL.xp : PAPER, 'center', FONT_D, 3);
  // the "spend it" box: tap to jump straight to this ship's upgrades
  const nUp = affordableUpgrades(), sy = cyy + 62;
  if (bk >= 1) {
    const hot = nUp > 0 && blinkOn();
    drawButton('spend', 30, sy, W - 60, 30, nUp ? `SPEND IT: ${nUp} SHIP UPGRADE${nUp > 1 ? 'S' : ''} READY ›` : 'SAVE UP FOR SHIP UPGRADES ›', hot ? COL.gold : '#5a5480', openUpgrades, S.uiLock <= 0);
  }
  const by = H * 0.74, on = S.uiLock <= 0;
  if (won && S.secretOpen) {
    drawButton('again', 40, by, W - 80, 54, 'SECRET STAGE: BOSS RUSH!', COL.red, nextStage, on);
    drawButton('hangar', 40, by + 68, W - 80, 46, 'END RUN · HANGAR', '#ff8c1a', openHangar, on);
  } else if (won && S.stage < STAGE_COUNT) {
    drawButton('again', 40, by, W - 80, 54, `ONWARD: STAGE ${S.stage + 1}!`, COL.xp, nextStage, on);
    drawButton('hangar', 40, by + 68, W - 80, 46, 'END RUN · HANGAR', '#ff8c1a', openHangar, on);
  } else {
    drawButton('again', 40, by, W - 80, 54, finale ? 'PLAY AGAIN' : 'NEW RUN', COL.xp, openStages, on);
    drawButton('hangar', 40, by + 68, W - 80, 46, 'HANGAR', '#ff8c1a', openHangar, on);
  }
}

// --- Stage select ----------------------------------------------------------------
function drawStages() {
  slamTitle('SELECT STAGE', W / 2, 40, 32, COL.gold, COL.red);
  const top = 82, bottom = H - 78, n = maxStage(), gap = n > 5 ? 7 : 9, ph = (bottom - top - gap * (n - 1)) / n;
  for (let i = 1; i <= n; i++) {
    const st = STAGES[i], th = THEMES[i], y = top + (i - 1) * (ph + gap);
    const open = i <= (META.unlocked || 1) || (i === SECRET_STAGE && META.secret), done = META.cleared && META.cleared[i], sel = i === (META.lastStage || 1);
    const pressed = S.uiPress === 'st' + i && open, d = pressed ? 3 : 0, e = enterK(i - 1, 0.05);
    ctx.save(); ctx.translate((1 - e) * W * (i % 2 ? 1 : -1) + d, d);
    slant(12, y, W - 24, ph, open ? PAPER : '#2a2440', pressed ? 0 : 5, 14);
    // stage swatch with its number
    ctx.save(); path([12 + 14, y, 96, y, 96 - 14, y + ph, 12, y + ph]); ctx.clip();
    if (th.rainbow) { for (let k = 0; k < 8; k++) { ctx.fillStyle = `hsl(${k * 45 + bgT * 30},70%,45%)`; ctx.fillRect(12 + k * 11, y, 12, ph); } }
    else { ctx.fillStyle = th.base; ctx.fillRect(12, y, 90, ph); ctx.fillStyle = th.dotA; ctx.globalAlpha = 0.9; for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc(20 + (k % 3) * 26, y + 12 + Math.floor(k / 3) * ph / 3, 6, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
    ctx.restore();
    path([12 + 14, y, 96, y, 96 - 14, y + ph, 12, y + ph]); ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.stroke();
    inkText(i === SECRET_STAGE ? '??' : String(i).padStart(2, '0'), 55, y + ph / 2 + 2, 38, open ? COL.gold : '#5a5480', 'center', FONT_D, 6);
    const tx = 104;
    plainText(open ? st.name : '???', tx, y + ph * 0.3, 20, open ? INK : '#6b6590', 'left');
    plainText(open ? st.sub : `Clear stage ${i - 1} to unlock`, tx, y + ph * 0.54, 11, open ? '#4a4470' : '#6b6590', 'left', FONT_B);
    if (open) plainText(i === 1 ? `FULL RUN: all 5 stages, loadout carries on` : i === SECRET_STAGE ? `20 BOSSES · HEAD START: ${CFG.headStart * 5} LEVEL-UPS` : `HEAD START: ${CFG.headStart * (i - 1)} LEVEL-UPS · SLOTS ${st.slots[0]}+${st.slots[1]}`, tx, y + ph * 0.78, 11.5, '#4a4470', 'left');
    const tag = !open ? 'LOCKED' : done ? 'CLEARED' : i === SECRET_STAGE ? 'SECRET' : 'NEW';
    ctx.font = `12px ${FONT_D}`;
    const pw = ctx.measureText(tag).width + 12;
    roundRect(W - 30 - pw, y + 8, pw, 18, 9); ctx.fillStyle = !open ? '#5a5480' : done ? COL.xp : COL.gold; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = INK; ctx.stroke();
    plainText(tag, W - 30 - pw / 2, y + 18, 12, INK);
    if (sel && open) { path([12 + 14, y, W - 12, y, W - 12 - 14, y + ph, 12, y + ph]); ctx.lineWidth = 3.5; ctx.strokeStyle = COL.gold; ctx.stroke(); }
    ctx.restore();
    addButton('st' + i, { x: 12, y, w: W - 24, h: ph }, () => startGame(i), open);
  }
  UIM.idx = n;
  const tw = (W - 44) / 2;
  drawButton('back', 16, H - 64, tw, 48, 'BACK', '#5a5480', () => { newGame('title'); });
  drawButton('hangar', 28 + tw, H - 64, tw, 48, 'HANGAR', '#ff8c1a', openHangar);
}

// the card that opens each stage
function drawStageIntro() {
  if (!(S.intro > 0) || S.state !== 'play') return;
  const t = 3.2 - S.intro, inK = easeOutBack(clamp(t / 0.4, 0, 1)), out = easeOut(clamp((0.5 - S.intro) / 0.5, 0, 1));
  const st = stageDef(), y = H * 0.36, x = (1 - inK) * W + out * -W * 1.2;
  ctx.save(); ctx.translate(x, 0);
  slant(-20, y - 44, W + 40, 92, INK, 0, 22);
  slant(-10, y - 36, W + 20, 76, COL.red, 0, 18);
  if (dotPattern) { ctx.save(); path([8, y - 36, W + 10, y - 36, W - 8, y + 40, -10, y + 40]); ctx.clip(); ctx.globalAlpha = 0.25; ctx.fillStyle = dotPattern; ctx.fillRect(0, y - 40, W, 84); ctx.restore(); }
  inkText(isRush() ? 'SECRET STAGE' : `STAGE ${S.stage}`, 24, y - 14, 22, COL.gold, 'left', FONT_D, 4);
  inkText(st.name, W / 2, y + 12, st.name.length > 14 ? 30 : 40, PAPER, 'center', FONT_D, 6);
  ctx.restore();
  ctx.globalAlpha = inK * (1 - out);
  inkText(st.sub, W / 2, y + 58, 13, PAPER, 'center', FONT_B, 3);
  ctx.globalAlpha = 1;
}

// --- Ultimate cut-in: the game freezes for a dramatic splash ------------------
function drawCutin() {
  const c = S.cutin; if (!c) return;
  const t = c.t, D = c.dur, id = S.shipId, P = PILOTS[id], u = ULTS[c.id];
  const out = easeOut(clamp((t - (D - 0.24)) / 0.24, 0, 1));
  const inK = easeOut(clamp(t / 0.16, 0, 1));
  dim(0.62 * inK * (1 - out));
  // speed lines bursting from the middle
  ctx.save(); ctx.globalAlpha = 0.35 * (1 - out); ctx.strokeStyle = PAPER; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 28; i++) { const a = i / 28 * TAU + t * 0.6, r0 = 120 + (i * 37) % 60; ctx.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0); ctx.lineTo(W / 2 + Math.cos(a) * 700, H / 2 + Math.sin(a) * 700); }
  ctx.stroke(); ctx.restore();
  // the big diagonal slab
  ctx.save(); ctx.translate(W / 2, H * 0.52); ctx.rotate(-0.3);
  const sx = (1 - easeOut(clamp(t / 0.22, 0, 1))) * -W * 2.2 + out * W * 2.2;
  ctx.fillStyle = u.color || COL.gold; ctx.fillRect(-sx * 0.8 - W * 1.5, -H * 0.2 - 40, W * 3, 30);   // a counter-sliding stripe in the ultimate's colour
  ctx.fillStyle = COL.gold; ctx.fillRect(sx - W * 1.5, -H * 0.2 - 12, W * 3, 12);
  ctx.fillStyle = COL.red; ctx.fillRect(sx - W * 1.5, -H * 0.2, W * 3, H * 0.4);
  ctx.save(); ctx.globalAlpha = 0.25; ctx.font = `700 ${H * 0.34}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = INK; ctx.fillText(u.glyph, sx - W * 0.25 + t * 40, 0); ctx.restore();
  if (dotPattern) { ctx.globalAlpha = 0.3; ctx.fillStyle = dotPattern; ctx.fillRect(sx - W * 1.5, -H * 0.2, W * 3, H * 0.4); ctx.globalAlpha = 1; }
  ctx.fillStyle = INK; ctx.fillRect(sx - W * 1.5, H * 0.2, W * 3, 16);
  ctx.restore();
  // the pilot, big and tilted
  const ph = H * 0.62, pw = ph * 200 / 240, pk = easeOutBack(clamp((t - 0.06) / 0.3, 0, 1));
  ctx.save();
  ctx.translate(W * 0.62 + (1 - pk) * W + out * W, H * 0.5); ctx.rotate(-0.07);
  drawPilot(id, 'normal', -pw / 2, -ph / 2, ph);
  ctx.restore();
  // the eye strip across the top
  const bandY = H * 0.11, bandH = 70, ek = easeOut(clamp((t - 0.14) / 0.2, 0, 1));
  ctx.save(); ctx.translate(-(1 - ek) * W * 1.2 - out * W * 1.2, 0);
  slant(-20, bandY - 6, W + 40, bandH + 12, INK, 0, 16);
  ctx.save(); path([-4, bandY, W + 20, bandY, W + 6, bandY + bandH, -18, bandY + bandH]); ctx.clip();
  ctx.fillStyle = PILOTS[id].skin; ctx.fillRect(0, bandY, W, bandH);
  const eh = Math.min(240 * 3.1, 1400 / SCALE), es = eh / 240;
  const img = pilotSprite(id, 'normal', eh * SCALE);
  ctx.drawImage(img, W / 2 - 100 * es, bandY + bandH / 2 - 108 * es, 200 * es, eh);
  ctx.restore();
  ctx.restore();
  // the move's name slams in, then the pilot's shout
  const tk = clamp((t - 0.32) / 0.18, 0, 1);
  if (tk > 0) {
    ctx.save(); ctx.translate(W / 2 + out * W, H * 0.74); ctx.rotate(-0.12);
    const sc = 2.6 - 1.6 * easeOutBack(tk); ctx.scale(sc, sc);
    inkText(u.name.toUpperCase() + '!', 4, 4, 58, INK, 'center', FONT_D, 0);
    inkText(u.name.toUpperCase() + '!', 0, 0, 58, COL.gold, 'center', FONT_D, 10);
    ctx.restore();
  }
  if (tk > 0) {                                     // level stars
    const L = (S.ult && S.ult.lv) || 1;
    for (let i = 0; i < L; i++) sparkle(W / 2 + (i - (L - 1) / 2) * 24 + out * W, H * 0.74 - 46 - i % 2 * 4, 8 * easeOutBack(clamp((t - 0.4 - i * 0.05) / 0.2, 0, 1)));
  }
  if (t > 0.3 && t < 0.36) { ctx.fillStyle = PAPER; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }   // impact flash as the name slams
  const qk = easeOutBack(clamp((t - 0.55) / 0.25, 0, 1));
  if (qk > 0) {
    ctx.save(); ctx.translate(-(1 - qk) * W - out * W, 0);
    ctx.font = `20px ${FONT_D}`;
    const qw = Math.min(W - 30, ctx.measureText(P.shout).width + 40);
    slant(14, H * 0.82, qw, 36, PAPER, 5, 10);
    plainText(P.shout, 14 + qw / 2, H * 0.82 + 19, 20, INK);
    plainText(P.name, 22, H * 0.82 - 10, 13, COL.gold, 'left');
    ctx.restore();
  }
}

// --- NEW PILOT reveal: warning flash, a silhouette sweeping in on slabs, then UNLOCKED! ---------
function drawReveal() {
  const r = S.reveal; if (!r) return;
  const t = r.t, id = r.id, ship = SHIPS[id], R = REVEAL;
  dim(Math.min(0.75, t * 1.5));
  // 1) hazard-stripe warning: NEW PILOT APPROACHING
  const wk = clamp((t - R.warn) / 0.25, 0, 1), wOut = easeOut(clamp((t - R.sweep + 0.1) / 0.3, 0, 1));
  if (wk > 0 && wOut < 1) {
    const flash = Math.floor((t - R.warn) * 6) % 2 === 0;
    for (const [yy, dir] of [[H * 0.3, 1], [H * 0.62, -1]]) {
      ctx.save(); ctx.translate(dir * (1 - easeOut(wk)) * W + dir * wOut * W * 1.4, yy); ctx.rotate(-0.08 * dir);
      ctx.fillStyle = INK; ctx.fillRect(-W, -18, W * 3, 36);
      ctx.save(); ctx.beginPath(); ctx.rect(-W, -14, W * 3, 28); ctx.clip();
      for (let x = -W + ((t * 120 * dir) % 40); x < W * 2; x += 40) { ctx.fillStyle = COL.gold; path([x, -14, x + 20, -14, x + 4, 14, x - 16, 14]); ctx.fill(); }
      ctx.restore(); ctx.restore();
    }
    ctx.save(); ctx.globalAlpha = 1 - wOut;
    if (flash) { ctx.fillStyle = 'rgba(255,59,59,0.18)'; ctx.fillRect(0, 0, W, H); }
    burstTitle('NEW PILOT', W / 2, H * 0.42, 40 * (2 - easeOutBack(wk)), COL.gold, COL.red);
    slant(W / 2 - 120, H * 0.48, 240, 30, flash ? COL.red : PAPER, 4, 10);
    plainText('APPROACHING', W / 2, H * 0.48 + 16, 20, flash ? PAPER : INK);
    ctx.restore();
  }
  // 2) the silhouette sweeps across on diagonal slabs, with speed lines
  const sk = clamp((t - R.sweep) / 0.45, 0, 1);
  if (sk > 0) {
    const se = easeOutBack(sk), out = easeOut(clamp((t - R.end + 0.35) / 0.35, 0, 1));
    ctx.save(); ctx.globalAlpha = 0.4 * (1 - out); ctx.strokeStyle = PAPER; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < 26; i++) { const y = (i * 53) % H, x0 = W - ((t * 900 + i * 97) % (W * 2)); ctx.moveTo(x0, y); ctx.lineTo(x0 + 80 + (i % 4) * 30, y); }
    ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate((1 - se) * W * 1.3 - out * W * 1.3, 0);
    slab([0, H * 0.16, W, H * 0.1, W, H * 0.66, 0, H * 0.74], ship.color, true);
    slab([0, H * 0.7, W, H * 0.62, W, H * 0.67, 0, H * 0.76], INK, false);
    ctx.save(); path([0, H * 0.16, W, H * 0.1, W, H * 0.66, 0, H * 0.74]); ctx.clip();
    const ph = H * 0.62;
    drawPilot(id, 'normal', W / 2 - ph * 0.42 + (1 - se) * 60, H * 0.72 - ph, ph, true);
    ctx.restore();
    inkText('?', W * 0.78, H * 0.3, 80, PAPER, 'center', FONT_D, 8);
    ctx.restore();
    // the ship streaks past underneath
    const fx = lerp(-60, W + 80, clamp((t - R.sweep - 0.1) / 0.9, 0, 1));
    if (t - R.sweep < 1.1) { drawFlame(fx - 18, H * 0.8, 1.4); ctx.save(); ctx.translate(fx, H * 0.8); ctx.rotate(Math.PI / 2); drawShip(0, 0, 1.6, ship, true); ctx.restore(); }
  }
  // 3) NEW PILOT UNLOCKED!
  const uk = clamp((t - R.unlock) / 0.3, 0, 1);
  if (uk > 0) {
    if (t - R.unlock < 0.07) { ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H); }
    const out = easeOut(clamp((t - R.end + 0.35) / 0.35, 0, 1));
    ctx.save(); ctx.translate(W / 2 + out * W, H * 0.82); ctx.rotate(-0.08);
    const sc = 2.4 - 1.4 * easeOutBack(uk); ctx.scale(sc, sc);
    burstTitle('UNLOCKED!', 0, 0, 44, COL.gold, COL.red);
    ctx.restore();
    const nk = easeOutBack(clamp((t - R.unlock - 0.25) / 0.3, 0, 1));
    ctx.save(); ctx.translate(-(1 - nk) * W - out * W, 0);
    slant(14, H * 0.88, W - 28, 40, PAPER, 5, 12);
    plainText(`${ship.name} · NOW IN THE HANGAR`, W / 2, H * 0.88 + 21, 18, INK);
    ctx.restore();
  }
  if (t > R.skip) { inkText('TAP TO CONTINUE', W / 2, H - 14, 11, COL.dim, 'center', FONT_D, 2.5); addButton('revealSkip', { x: 0, y: 0, w: W, h: H }, endReveal); }
}

// --- screen wipe between menus ------------------------------------------------
function drawWipe() {
  if (UIM.wipe <= 0) return;
  const p = 1 - UIM.wipe / WIPE_TIME, cx = lerp(-W * 0.9, W * 1.9, easeOut(p));
  const bands = [[COL.red, 150, 60], [INK, 120, -40], [COL.gold, 40, -130]];
  for (const [c, wdt, off] of bands) {
    const x = cx + off;
    path([x - wdt / 2 + 120, -10, x + wdt / 2 + 120, -10, x + wdt / 2 - 120, H + 10, x - wdt / 2 - 120, H + 10]);
    ctx.fillStyle = c; ctx.fill();
  }
}

// ============================================================================
// Frame
// ============================================================================
function uiTick(dt) {
  if (!S) return;
  UIM.t += dt; UIM.wheelT += dt;
  UIM.wipe = Math.max(0, UIM.wipe - dt);
  UIM.faceHit = Math.max(0, UIM.faceHit - dt);
  if (S.p && S.p.hp < UIM.lastHp && S.state === 'play') UIM.faceHit = 0.5;
  if (S.p) UIM.lastHp = S.p.hp;
  if (wheelIdx >= 0 && S && S.state === 'hangar') {
    const n = shipList().length, diff = shortest(wheelIdx, wheelPos, n);
    wheelPos = ((wheelPos + diff * Math.min(1, dt * 10)) % n + n) % n;
  }
}

function render() {
  uiButtons = [];
  UIM.idx = 0;
  if (!bgCanvas) artResize();
  if (themeStage() !== bgStage) buildBackground(themeStage());
  // a new screen? restart its entrance animation (and wipe between menu screens)
  const key = S ? S.state + (S.state === 'hangar' ? hangarTab : '') + (S.state === 'play' ? S.stage : '') + (S.settings ? 'set' : '') : '';
  if (key !== UIM.key) {
    const from = UIM.key;
    UIM.key = key; UIM.t = 0;
    if (S && !['play', 'levelup', 'cutin'].includes(S.state) && !(from.startsWith('play') && S.state === 'paused')) UIM.wipe = WIPE_TIME;
    if (S && S.state !== 'hangar') wheelIdx = -1;
  }
  drawBackground();
  let sx = 0, sy = 0;
  if (S && S.shake > 0) { sx = rand(-1, 1) * S.shake * 10; sy = rand(-1, 1) * S.shake * 10; }
  ctx.setTransform(SCALE, 0, 0, SCALE, sx * SCALE, sy * SCALE);
  drawStars();
  if (!S) return;
  drawWorld();
  if (S.state !== 'title' && S.state !== 'hangar' && S.state !== 'stages') drawHud();
  if (S.state === 'title') drawTitle();
  else if (S.state === 'hangar') drawHangar();
  else if (S.state === 'levelup') drawLevelUp();
  else if (S.state === 'paused') drawPaused();
  else if (S.state === 'cutin') drawCutin();
  else if (S.state === 'reveal') drawReveal();
  else if (S.state === 'stages') drawStages();
  if (S.state === 'play') drawStageIntro();
  else if (S.state === 'over' || S.state === 'won') drawGameOver();
  if (S.settings) drawSettings();
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  drawWipe();
}

// ============================================================================
// Boot + main loop
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
