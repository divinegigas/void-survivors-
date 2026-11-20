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

  // sky: deep indigo with big soft halftone bands; tiles vertically
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = cv.width; bgCanvas.height = cv.height;
  const g = bgCanvas.getContext('2d'), h = cv.height, sp = 11 * SCALE;
  g.fillStyle = BG.base; g.fillRect(0, 0, bgCanvas.width, h);
  for (let row = 0, y = 0; y < h + sp; row++, y += sp * 0.87) {
    for (let x = (row % 2) * sp / 2; x < bgCanvas.width + sp; x += sp) {
      const ph = (y / h) * TAU, f = 0.5 + 0.5 * Math.sin(ph + x / bgCanvas.width * 1.5);
      const r = sp * 0.48 * (0.12 + 0.88 * f * f);
      g.fillStyle = Math.cos(ph) > 0 ? BG.dotA : BG.dotB;
      g.beginPath(); g.arc(x, y % h, r, 0, TAU); g.fill();
    }
  }
  initStars();
}

let stars = [];
function initStars() {
  stars = [];
  for (let i = 0; i < 46; i++) {
    const line = i % 3 !== 0;
    stars.push({ x: Math.random() * W, y: Math.random() * H, line, len: rand(12, 34), sz: rand(1.6, 3.2), tw: Math.random() * TAU });
  }
}
function artUpdate(dt) {
  const boost = S && S.overdrive > 0 ? 2.2 : 1;
  bgY += 14 * dt;
  for (const s of stars) {
    s.y += (s.line ? 260 * boost : 40) * dt;
    s.tw += dt * 4;
    if (s.y - s.len > H) { s.y = -s.len; s.x = Math.random() * W; }
  }
}
function drawBackground() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const h = cv.height, off = (bgY * SCALE) % h;
  ctx.drawImage(bgCanvas, 0, off - h);
  ctx.drawImage(bgCanvas, 0, off);
}
function drawStars() {
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  for (const s of stars) if (s.line) { ctx.moveTo(s.x, s.y - s.len); ctx.lineTo(s.x, s.y); }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = COL.gold;
  for (const s of stars) {
    if (s.line) continue;
    const r = s.sz * (0.7 + 0.3 * Math.sin(s.tw));
    sparkle(s.x, s.y, r);
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
  if (S.phase > 0) {                       // Phase Ram: dashed ink aura
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 3; ctx.strokeStyle = PAPER;
    ctx.beginPath(); ctx.arc(p.x, p.y, 26 + Math.sin(S.t * 20) * 2, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
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
      const wx = (e.bx !== undefined ? e.bx + Math.sin(tt * 2.4 + e.ph) * e.amp : e.x) - e.x;
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

function drawEnemy(e) {
  const draw = CREATURE[e.type] || CREATURE.drone, flash = e.flash > 0;
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

  if (S.hole) drawHole(S.hole);

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
    const life = n.small ? 0.3 : 0.55, a = Math.max(0, 1 - n.age / life);
    ctx.globalAlpha = a;
    ctx.lineWidth = n.small ? 5 : 8; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, TAU); ctx.stroke();
    ctx.lineWidth = n.small ? 2.5 : 4.5; ctx.strokeStyle = n.color; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Debris
  for (const q of S.parts) {
    ctx.globalAlpha = 1 - q.age / q.life;
    ctx.fillStyle = q.color;
    const s = q.size * 1.3;
    ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;

  if (S.state !== 'over' && S.state !== 'title' && S.state !== 'hangar') drawPlayer();

  drawEnemyShots();

  for (const b of S.bursts) drawBurst(b);
  for (const t of S.texts) {
    ctx.globalAlpha = Math.min(1, 2 * (1.2 - t.age));
    inkText(t.txt, t.x, t.y, t.size * 1.4, t.color);
  }
  ctx.globalAlpha = 1;

  if (S.warp > 0) { ctx.fillStyle = 'rgba(46,197,255,0.10)'; ctx.fillRect(0, 0, W, H); }
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
  for (const b of list) { ctx.moveTo(b.x + 6.2, b.y); ctx.arc(b.x, b.y, 6.2, 0, TAU); }
  ctx.fill();
  ctx.fillStyle = COL.enemyShot;
  ctx.beginPath();
  for (const b of list) { ctx.moveTo(b.x + 4.4, b.y); ctx.arc(b.x, b.y, 4.4, 0, TAU); }
  ctx.fill();
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  for (const b of list) { ctx.moveTo(b.x + 1.2, b.y - 1); ctx.arc(b.x - 1, b.y - 1, 2.2, 0, TAU); }
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
  const x = S.p.x, w = S.laser.w, bot = S.p.y - 14;
  const wob = rand(-1, 1);
  ctx.fillStyle = INK; ctx.fillRect(x - w - 2 + wob, 0, (w + 2) * 2, bot);
  ctx.fillStyle = S.laser.color; ctx.fillRect(x - w + wob, 0, w * 2, bot);
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
  const r = 26 + Math.sin(S.t * 8) * 2;
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

function drawSlot(x, y, def, lvl, max, builtin) {
  const s = 23;
  if (def) {
    const tc = TIER[def.tier].color;
    roundRect(x + 2, y + 2, s, s, 4); ctx.fillStyle = INK; ctx.fill();
    roundRect(x, y, s, s, 4);
    ctx.fillStyle = tc; ctx.fill();
    ctx.lineWidth = builtin ? 3 : 2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.font = '700 13px system-ui, sans-serif';
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
  const L = CFG.level.length;
  inkText(fmtTime(Math.min(S.t, L)), W / 2, 28, 20, S.queenUp ? COL.red : PAPER);
  inkText(S.queenUp ? 'FINAL BOSS' : `${S.kills} KILLS`, W / 2, 47, 13, S.queenUp ? COL.gold : COL.dim, 'center', FONT_D, 2.5);
  // level progress: 3 mini-boss markers and the Queen at the end
  const px = W / 2 - 60, pw = 120, py = 60;
  ctx.fillStyle = INK; ctx.fillRect(px - 2, py - 2, pw + 4, 6);
  ctx.fillStyle = '#3a3366'; ctx.fillRect(px, py, pw, 2);
  ctx.fillStyle = COL.gold; ctx.fillRect(px, py, pw * Math.min(1, S.t / L), 2);
  for (const t of [...CFG.level.miniBosses, L]) {
    const x = px + pw * (t / L), last = t === L, done = S.t >= t;
    ctx.beginPath(); ctx.arc(x, py + 1, last ? 5 : 3.6, 0, TAU);
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

  // Loadout: signature weapon (bold, starred), 4 weapon slots, 4 passive slots
  const sig = S.ship.weapon, wIds = slotWeapons(), pIds = Object.keys(S.passives);
  drawSlot(8, 42, WEAPONS[sig], S.weapons[sig].lvl, CFG.maxLevel, true);
  for (let i = 0; i < CFG.slots.weapons; i++) {
    const id = wIds[i];
    drawSlot(40 + i * 28, 42, id && WEAPONS[id], id && S.weapons[id].lvl, CFG.maxLevel);
  }
  for (let i = 0; i < CFG.slots.passives; i++) {
    const id = pIds[i];
    drawSlot(40 + i * 28, 70, id && PASSIVES[id], id && S.passives[id].lvl, id && passiveMax(id));
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
    inkText(ENEMY[boss.type].name, W / 2, y + 18, 12, PAPER, 'center', FONT_D, 2.5);
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
  const isUlt = S.choices[0] && S.choices[0].kind === 'ult';
  const n = S.choices.length, ch = 92, gap = 14, total = n * ch + (n - 1) * gap;
  const y0 = Math.max(170, H * 0.5 - total / 2);
  const titleY = y0 - 84;
  slamTitle(isUlt ? 'ULTIMATE!' : 'LEVEL UP!', W / 2, titleY, 42, isUlt ? COL.red : COL.gold, isUlt ? COL.gold : PAPER);
  const ek = easeOut(clamp(UIM.t / 0.3, 0, 1));
  ctx.globalAlpha = ek;
  inkText(isUlt ? 'PICK YOUR SUPER MOVE' : `LEVEL ${S.choiceLevel}: CHOOSE ONE`, W / 2, titleY + 46, 15, PAPER);
  if (!isUlt) inkText(`WEAPONS ${slotWeapons().length}/${CFG.slots.weapons}  ·  PASSIVES ${Object.keys(S.passives).length}/${CFG.slots.passives}`,
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
  drawButton('launch', 34, by + 8, W - 68, 54, 'LAUNCH!', COL.xp, startGame);
  drawButton('hangar', 34, by + 74, W - 68, 46, `HANGAR · ${META.bank} CR`, '#ff8c1a', openHangar);
  drawSoundToggles(by + 132);
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
  drawButton('launch', 28 + tw, H - 64, tw, 48, 'LAUNCH!', COL.xp, startGame);
}

function drawTab(id, x, y, w, h, label, tab) {
  const on = hangarTab === tab;
  slant(x, y, w, h, on ? COL.gold : '#3a3366', on ? 4 : 0, 10);
  plainText(label, x + w / 2, y + h / 2 + 1, 18, on ? INK : COL.dim);
  addButton(id, { x, y, w, h }, () => { if (hangarTab !== tab) { hangarTab = tab; S.armed = null; } });
}

// The ship wheel: the chosen ship up front with its pilot behind; the others ride
// around a wheel. Swipe or use the arrows. Locked ships and pilots are silhouettes.
const SHIP_IDS = Object.keys(SHIPS);
let wheelIdx = -1, wheelPos = 0;
function wheelSpin(d) {
  const n = SHIP_IDS.length;
  wheelIdx = (wheelIdx + d + n) % n;
  S.armed = null; UIM.wheelT = 0;
  snd('click');
}
function uiSwipe(dir) {
  if (S && S.state === 'hangar' && hangarTab === 'ships' && wheelIdx >= 0) { wheelSpin(dir); return true; }
  return false;
}

function drawShipWheel(top, bottom) {
  const n = SHIP_IDS.length;
  if (wheelIdx < 0) { wheelIdx = Math.max(0, SHIP_IDS.indexOf(META.ship)); wheelPos = wheelIdx; }
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
    if (Math.abs(off) <= 2.6) list.push([i, off]);
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
  drawButton('wl', 8, cy - 26, 40, 50, '<', '#5a5480', () => wheelSpin(-1));
  drawButton('wr', W - 48, cy - 26, 40, 50, '>', '#5a5480', () => wheelSpin(1));

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
  else if (!afford) drawButton('wbuy', 40, ay, W - 80, 46, `NEED ${cost} CR`, '#5a5480', () => {}, false);
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

function drawSoundToggles(y) {
  if (typeof toggleMusic !== 'function') return;
  const w = (W - 100) / 2;
  drawButton('music', 44, y, w, 38, `MUSIC ${PREF.music ? 'ON' : 'OFF'}`, PREF.music ? '#a45cff' : '#5a5480', toggleMusic);
  drawButton('sound', 56 + w, y, w, 38, `SOUND ${PREF.sfx ? 'ON' : 'OFF'}`, PREF.sfx ? '#a45cff' : '#5a5480', toggleSfx);
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
  drawSoundToggles(H * 0.5 + 128);
}

function drawGameOver() {
  dim(0.55);
  const cy = H * 0.2;
  const won = S.state === 'won';
  const e = easeOut(clamp(UIM.t / 0.35, 0, 1));
  const ph = H * 0.26;
  drawPilot(S.shipId, won ? 'normal' : 'crit', W - ph * 0.83 + 6 + (1 - e) * W, cy + 40, ph);
  slamTitle(won ? 'LEVEL CLEAR!' : S.quit ? 'RUN ENDED' : 'SHIP LOST!', W / 2, cy, 46, won ? COL.xp : S.quit ? COL.player : COL.red, COL.gold);
  if (won) inkText('THE HIVE QUEEN IS DEAD!', W / 2, cy + 40, 16, PAPER);
  const rows = [['SURVIVED', fmtTime(S.t)], ['LEVEL', String(S.level)], ['KILLS', String(S.kills)], ['BEST', fmtTime(META.best)]];
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
  inkText(`BOUNTY BANKED · ${META.bank} CR TOTAL`, W / 2, cyy + 52, 13, PAPER, 'center', FONT_D, 3);
  if (S.newBest) inkText('NEW BEST TIME!', W / 2, cyy + 72, 16, COL.xp);
  const by = H * 0.74, on = S.uiLock <= 0;
  drawButton('again', 40, by, W - 80, 54, 'FLY AGAIN!', COL.xp, startGame, on);
  drawButton('hangar', 40, by + 68, W - 80, 46, 'HANGAR', '#ff8c1a', openHangar, on);
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
  ctx.fillStyle = COL.gold; ctx.fillRect(sx - W * 1.5, -H * 0.2 - 12, W * 3, 12);
  ctx.fillStyle = COL.red; ctx.fillRect(sx - W * 1.5, -H * 0.2, W * 3, H * 0.4);
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
  if (wheelIdx >= 0) {
    const n = SHIP_IDS.length, diff = shortest(wheelIdx, wheelPos, n);
    wheelPos = ((wheelPos + diff * Math.min(1, dt * 10)) % n + n) % n;
  }
}

function render() {
  uiButtons = [];
  UIM.idx = 0;
  if (!bgCanvas) artResize();
  // a new screen? restart its entrance animation (and wipe between menu screens)
  const key = S ? S.state + (S.state === 'hangar' ? hangarTab : '') : '';
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
  if (S.state !== 'title' && S.state !== 'hangar') drawHud();
  if (S.state === 'title') drawTitle();
  else if (S.state === 'hangar') drawHangar();
  else if (S.state === 'levelup') drawLevelUp();
  else if (S.state === 'paused') drawPaused();
  else if (S.state === 'cutin') drawCutin();
  else if (S.state === 'over' || S.state === 'won') drawGameOver();
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
