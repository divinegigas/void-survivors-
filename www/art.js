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
// The hive fleet: organic, insect-like creatures (original designs). Each faces
// down the screen. Bio colours, bone claws, acid-green eyes, same ink + cel look.
const EYE = '#b6ff3b', BONE = '#f3e2c7', CHITIN = '#4a2a6e';

function inkLine(lw, pts) {
  ctx.lineWidth = OUTLINE ? lw + OUT_W * 2 : lw;
  ctx.strokeStyle = OUTLINE ? PAPER : INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
}
function limb(pts, lw, color) {                // a thick coloured limb with an ink edge
  if (OUTLINE) return inkLine(lw, pts);
  inkLine(lw, pts);
  ctx.lineWidth = lw - 3.5; ctx.strokeStyle = color;
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
function eyes(list, r, color) {
  if (OUTLINE) return;
  for (const [x, y] of list) {
    ctx.fillStyle = color || EYE;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, TAU); ctx.fill();
  }
}
function boneHook(x0, y0, cx, cy, x1, y1, thick, flash) {   // a curved bone claw / mandible
  celBuild(() => {
    ctx.beginPath(); ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.quadraticCurveTo(cx * 0.55 + x0 * 0.45 + thick, cy * 0.55 + y0 * 0.45, x0 + thick, y0);
    ctx.closePath();
  }, BONE, 8, flash, 1.8);
}
function tendril(x0, y0, x1, y1, wave, color, w) {
  const mx = (x0 + x1) / 2 + wave, my = (y0 + y1) / 2;
  const passes = OUTLINE ? [[w + 3 + OUT_W * 2, PAPER]] : [[w + 3, INK], [w, color]];
  for (const [lw, c] of passes) {
    ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1 - wave * 0.5, y1); ctx.stroke();
  }
}
function wing(x, y, rot, sx, rx, ry, cx) {     // translucent insect wing (no white rim)
  if (OUTLINE) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sx, 1);
  ctx.globalAlpha = 0.75;
  ctx.beginPath(); ctx.ellipse(cx, 0, rx, ry, 0, 0, TAU);
  ctx.fillStyle = PAPER; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.restore();
}

const CREATURE = {
  drone(e, f) {                       // MITE: little beetle, scuttling legs, snapping mandibles
    const t = e.age; ctx.scale(e.r / 14, e.r / 14);
    for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) {
      const w = Math.sin(t * 16 + i * 2.1 + sd) * 2.5, by = -5 + i * 5;
      inkLine(2.2, [sd * 6, by, sd * 12, by - 3 + w, sd * 16, by + 3 + w]);
    }
    const o = 1.5 + 1.5 * Math.sin(t * 9);
    for (const sd of [-1, 1]) boneHook(sd * 2, 11, sd * (8 + o), 15, sd * 1.5, 20, sd * 1.5, f);
    oval(0, -2, 9, 11, 0, e.color, f, 2.2);
    if (!OUTLINE) inkLine(1.4, [0, -12, 0, 7]);
    oval(0, 9, 6.5, 5, 0, tone(e.color, -0.4), f, 2);
    eyes([[-2.6, 10.5], [2.6, 10.5]], 1.7);
  },

  weaver(e, f) {                      // WRIGGLER: segmented worm whipping side to side
    const segs = 5, gap = 0.09;
    for (let k = segs - 1; k >= 1; k--) {
      const tt = e.age - k * gap;
      const wx = (e.bx !== undefined ? e.bx + Math.sin(tt * 2.4 + e.ph) * e.amp : e.x) - e.x;
      const wy = -k * gap * (e.vy || 110), rr = e.r * (0.78 - k * 0.09);
      inkLine(1.8, [wx - rr - 3, wy + 2, wx + rr + 3, wy + 2]);
      oval(wx, wy, rr, rr * 0.9, 0, k % 2 ? e.color : tone(e.color, -0.2), f, 2);
    }
    const r = e.r, o = Math.sin(e.age * 10) * 1.5;
    for (const sd of [-1, 1]) boneHook(sd * r * 0.25, r * 0.6, sd * (r * 0.75 + o), r * 0.9, sd * r * 0.15, r * 1.3, sd * 1.4, f);
    oval(0, 0, r * 0.85, r * 0.8, 0, e.color, f, 2.2);
    eyes([[-r * 0.32, r * 0.22], [r * 0.32, r * 0.22]], 1.9);
  },

  diver(e, f) {                       // STINGER: wasp; flashes, then dives stinger-first
    if (e.mode === 1 && Math.floor(e.wait * 12) % 2) f = true;
    if (e.mode === 2) ctx.rotate(Math.atan2(e.vy, e.vx) - Math.PI / 2);
    ctx.scale(e.r / 14, e.r / 14);
    const flap = Math.abs(Math.sin(e.age * 38));
    for (const sd of [-1, 1]) wing(sd * 4, -5, sd * -0.5, 0.35 + 0.65 * flap, 9, 4.5, sd * 8);
    flat(() => path([-2.6, 14, 2.6, 14, 0, 23]), INK, 1);
    oval(0, 6, 6, 9, 0, e.color, f, 2);
    if (!OUTLINE) {
      ctx.lineWidth = 1.8; ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.moveTo(-5.6, 4); ctx.quadraticCurveTo(0, 6.5, 5.6, 4); ctx.moveTo(-4.8, 9); ctx.quadraticCurveTo(0, 11.5, 4.8, 9); ctx.stroke();
    }
    oval(0, -4, 4.5, 4, 0, tone(e.color, -0.3), f, 2);
    oval(0, -10.5, 4.5, 4, 0, tone(e.color, -0.5), f, 2);
    eyes([[-2, -11.5], [2, -11.5]], 1.6);
  },

  gunner(e, f) {                      // SPITTER: bloated acid sac, bone spines; mouth gapes before it spits
    ctx.scale(e.r / 24, e.r / 24);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2, c = Math.cos(a), sn = Math.sin(a);
      flat(() => path([c * 17 - sn * 3.5, sn * 17 + c * 3.5, c * 28, sn * 28, c * 17 + sn * 3.5, sn * 17 - c * 3.5]), f ? PAPER : BONE, 1.6);
    }
    const pulse = 1 + 0.05 * Math.sin(e.age * 5);
    ctx.save(); ctx.scale(pulse, pulse); oval(0, 0, 20, 19, 0, e.color, f, 2.4); ctx.restore();
    if (OUTLINE) return;
    for (const j of [-1, 0, 1]) oval(j * 9, -9 + Math.abs(j) * 3, 7, 5, j * 0.4, CHITIN, f, 1.8);
    const open = e.mode === 1 && e.fireT < 0.5 ? 1 - e.fireT / 0.5 : 0.15;
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, 11, 7, 2 + 5 * open, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff8fb0'; ctx.beginPath(); ctx.ellipse(0, 12 + 2 * open, 3.5, 1 + 2 * open, 0, 0, TAU); ctx.fill();
    eyes([[-8, 4], [8, 4], [0, 1]], 2);
  },

  brute(e, f) {                       // BROOD BRUTE: armoured beetle, bone mandibles
    const t = e.age; ctx.scale(e.r / 44, e.r / 44);
    for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) {
      const w = Math.sin(t * 6 + i * 1.7 + sd) * 4, by = -12 + i * 14;
      inkLine(4.5, [sd * 24, by, sd * 42, by - 6 + w, sd * 52, by + 12 + w]);
    }
    const o = 4 + 4 * Math.sin(t * 4);
    for (const sd of [-1, 1]) boneHook(sd * 6, 30, sd * (30 + o), 38, sd * 5, 58, sd * 6, f);
    oval(0, 26, 20, 14, 0, tone(e.color, -0.45), f, 3);
    for (const sd of [-1, 1]) {
      celBuild(() => {
        ctx.beginPath();
        ctx.ellipse(sd * 1, -6, 30, 32, 0, sd < 0 ? Math.PI / 2 : -Math.PI / 2, sd < 0 ? Math.PI * 1.5 : Math.PI / 2);
        ctx.closePath();
      }, e.color, 32, f, 3);
      if (!OUTLINE) for (const [sx, sy, sr] of [[16, -18, 4], [20, -2, 3], [13, 10, 3.5]]) {
        ctx.fillStyle = f ? PAPER : BONE; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(sd * sx, sy, sr, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      }
    }
    eyes([[-9, 26], [-3, 29], [3, 29], [9, 26]], 2.6);
  },

  mother(e, f) {                      // SPORE MOTHER: floating sac of pustules trailing tendrils
    const t = e.age; ctx.scale(e.r / 48, e.r / 48);
    for (let i = 0; i < 5; i++) tendril((i - 2) * 11, 24, (i - 2) * 15, 74, Math.sin(t * 3 + i) * 9, tone(e.color, 0.3), 3.5);
    oval(0, -4, 42, 38, 0, e.color, f, 3);
    const bumps = [[-20, -18, 8], [4, -26, 9], [24, -10, 7], [-28, 6, 6], [18, 12, 7], [-6, 4, 6], [6, -8, 5]];
    bumps.forEach(([x, y, r], i) => { const g = r * (1 + 0.15 * Math.sin(t * 4 + i)); oval(x, y, g, g, 0, tone(e.color, 0.4), f, 1.8); });
    oval(0, 30, 14, 10, 0, tone(e.color, -0.45), f, 2.4);
    eyes([[-5, 31], [0, 33.5], [5, 31]], 2.4);
  },

  stalker(e, f) {                     // SCYTHE STALKER: mantis, bone scythes raised to strike
    ctx.scale(e.r / 42, e.r / 42);
    const flick = Math.sin(e.age * 30) * 0.1;
    for (const sd of [-1, 1]) wing(sd * 6, -18, sd * (0.6 + flick), 1, 18, 6, sd * 14);
    oval(0, -22, 12, 22, 0, tone(e.color, -0.25), f, 2.4);
    if (!OUTLINE) { inkLine(1.6, [-10, -26, 10, -26]); inkLine(1.6, [-11, -16, 11, -16]); }
    const raise = e.mode === 2 ? 0.9 : 0.35 + Math.sin(e.spin || 0) * 0.35;
    for (const sd of [-1, 1]) {
      ctx.save(); ctx.translate(sd * 8, 4); ctx.rotate(-sd * raise);
      limb([0, 0, sd * 20, 14], 8, e.color);
      boneHook(sd * 20, 14, sd * 44, 4, sd * 34, 44, sd * 5, f);
      ctx.restore();
    }
    oval(0, 4, 7, 14, 0, e.color, f, 2.2);
    celBuild(() => path([-15, 16, 15, 16, 0, 34]), e.color, 16, f, 2.4);
    if (!OUTLINE) { oval(-8, 19, 5.5, 4.5, -0.3, EYE, f, 1.6); oval(8, 19, 5.5, 4.5, 0.3, EYE, f, 1.6); }
  },

  queen(e, f) {                       // HIVE QUEEN: crowned brood-mother, four bone scythes
    const t = e.age; ctx.scale(e.r / 66, e.r / 66);
    const eyeC = e.phase === 3 ? COL.red : EYE;
    for (let i = 0; i < 6; i++) {
      const sd = i % 2 ? 1 : -1, k = Math.floor(i / 2);
      tendril(sd * (20 + k * 10), -40 + k * 12, sd * (62 + k * 6), -70 + k * 22, Math.sin(t * 2.5 + i) * 10, tone(e.color, 0.25), 3.5);
    }
    oval(0, -34, 46, 40, 0, tone(e.color, -0.15), f, 3.2);
    if (!OUTLINE) {
      ctx.lineWidth = 2; ctx.strokeStyle = INK;
      for (const yy of [-52, -38, -24]) { ctx.beginPath(); ctx.moveTo(-38, yy); ctx.quadraticCurveTo(0, yy + 10, 38, yy); ctx.stroke(); }
      [[-18, -44], [16, -46], [-6, -30], [22, -28]].forEach(([x, y], i) => {
        const g = 4.5 + Math.sin(t * 5 + i) * 1.2; oval(x, y, g, g, 0, '#ff9ad1', f, 1.4);
      });
    }
    for (const sd of [-1, 1]) for (let j = 0; j < 2; j++) {
      const sw = Math.sin(t * 3 + j * 1.5 + sd) * 4;
      const ex = sd * (58 + j * 6), ey = 8 + j * 18 + sw;
      limb([sd * 28, 2 + j * 14, ex, ey], 8, e.color);
      boneHook(ex, ey, ex + sd * 14, ey + 20, ex - sd * 6, ey + 42, sd * 5, f);
    }
    for (const [x0, y0, x1, y1] of [[-30, 0, -50, -14], [-22, -6, -40, -28], [30, 0, 50, -14], [22, -6, 40, -28]]) {
      flat(() => path([x0 - 4, y0, x1, y1, x0 + 4, y0 - 4]), f ? PAPER : BONE, 2);
    }
    celBuild(() => path([-34, 4, -20, -8, 0, -12, 20, -8, 34, 4, 24, 30, 0, 40, -24, 30]), e.color, 36, f, 3);
    const o = 3 + 3 * Math.sin(t * 5);
    for (const sd of [-1, 1]) boneHook(sd * 8, 34, sd * (24 + o), 44, sd * 4, 62, sd * 6, f);
    eyes([[-14, 12], [14, 12], [-8, 21], [8, 21], [-4, 5], [4, 5]], 3.4, eyeC);
  },
};

function drawEnemy(e) {
  const draw = CREATURE[e.type] || CREATURE.drone, flash = e.flash > 0;
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
  burstPath(b.size, b.spikes, b.x);
  ctx.fillStyle = b.color; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  if (b.word) {
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
const ULT_POS = () => ({ x: W - 36, y: H - 46 });

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
// Menus. Buttons register themselves while drawing; game.js matches taps to them.
// ============================================================================
let uiButtons = [];
function addButton(id, rect, action, enabled) { uiButtons.push({ id, rect, action, enabled: enabled !== false }); }
function drawButton(id, x, y, w, h, label, color, action, enabled) {
  const on = enabled !== false, pressed = S.uiPress === id && on, d = pressed ? 3 : 0;
  panel(x + d, y + d, w, h, on ? color : '#5a5480', pressed ? 0 : 4);
  inkText(label, x + w / 2 + d, y + h / 2 + 2 + d, Math.min(26, h * 0.5), on ? PAPER : '#b9b4d6');
  addButton(id, { x, y, w, h }, action, on);
}

function drawLevelUp() {
  dim(0.7);
  const isUlt = S.choices[0] && S.choices[0].kind === 'ult';
  const n = S.choices.length, ch = 92, gap = 14, total = n * ch + (n - 1) * gap;
  const y0 = Math.max(170, H * 0.5 - total / 2);
  const titleY = y0 - 84;
  burstTitle(isUlt ? 'ULTIMATE!' : 'LEVEL UP!', W / 2, titleY, 42, isUlt ? COL.red : COL.gold, isUlt ? COL.gold : PAPER);
  inkText(isUlt ? 'PICK YOUR SUPER MOVE' : `LEVEL ${S.choiceLevel}: CHOOSE ONE`, W / 2, titleY + 46, 15, PAPER);
  if (!isUlt) inkText(`WEAPONS ${slotWeapons().length}/${CFG.slots.weapons}  ·  PASSIVES ${Object.keys(S.passives).length}/${CFG.slots.passives}`,
                      W / 2, titleY + 64, 11, COL.dim, 'center', FONT_D, 2.5);

  S.choices.forEach((c, i) => {
    const r = { x: 18, y: y0 + i * (ch + gap), w: W - 40, h: ch }, info = choiceInfo(c), pressed = S.uiPress === 'card' + i;
    const d = pressed ? 3 : 0, rx = r.x + d, ry = r.y + d;
    addButton('card' + i, r, () => choose(i));
    panel(rx, ry, r.w, r.h, PAPER, pressed ? 0 : 5);
    // tier band with icon
    ctx.save(); roundRect(rx, ry, r.w, r.h, 5); ctx.clip();
    ctx.fillStyle = info.color; ctx.fillRect(rx, ry, 66, r.h);
    ctx.globalAlpha = 0.25; ctx.fillStyle = dotPattern || info.color; ctx.fillRect(rx, ry, 66, r.h); ctx.globalAlpha = 1;
    ctx.restore();
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(rx + 66, ry); ctx.lineTo(rx + 66, ry + r.h); ctx.stroke();
    const ix = rx + 33, iy = ry + r.h / 2;
    ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(ix, iy, 21, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.font = '700 21px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = INK; ctx.fillText(info.glyph, ix, iy + 1);
    // text
    const tx = rx + 78, tw = r.w - 90;
    plainText(info.tag, tx, ry + 16, 12, '#5a5480', 'left');
    if (info.tier) {
      ctx.font = `12px ${FONT_D}`;
      const pw = ctx.measureText(info.tier).width + 12;
      roundRect(rx + r.w - pw - 8, ry + 7, pw, 18, 9);
      ctx.fillStyle = info.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
      plainText(info.tier, rx + r.w - pw / 2 - 8, ry + 17, 12, INK);
    }
    plainText(info.title, tx, ry + 37, 22, INK, 'left');
    ctx.font = `700 12.5px ${FONT_B}`;
    wrapLines(info.desc, tw).slice(0, 2).forEach((ln, k) => plainText(ln, tx, ry + 59 + k * 15, 12.5, '#2c2640', 'left', FONT_B));
  });
  const by = y0 + total + 20;
  if (ML('reroll') > 0) drawButton('reroll', W / 2 - 80, by, 160, 42, `REROLL (${S.rerolls})`, '#ff8c1a', reroll, S.rerolls > 0);
  if (S.uiLock > 0) dim(0.2);
}

function drawTitle() {
  const cy = H * 0.17;
  // logo
  ctx.save(); ctx.translate(W / 2, cy); ctx.rotate(-0.07);
  ctx.save(); ctx.scale(2.3, 0.95); burstPath(70, 16, 3); ctx.restore();
  ctx.fillStyle = COL.red; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  if (dotPattern) { ctx.save(); ctx.clip(); ctx.globalAlpha = 0.3; ctx.fillStyle = dotPattern; ctx.fillRect(-200, -100, 400, 200); ctx.restore(); }
  inkText('STARBURN', 5, 5, 72, INK, 'center', FONT_D, 0);
  inkText('STARBURN', 0, 0, 72, COL.gold, 'center', FONT_D, 9);
  ctx.restore();
  ctx.save(); ctx.translate(W / 2 + 40, cy + 62); ctx.rotate(0.03);
  panel(-110, -15, 220, 30, PAPER, 3);
  plainText('SHOOT! SALVAGE! EVOLVE!', 0, 1, 18, INK);
  ctx.restore();

  // caption box with the basics
  if (META.notice) {
    panel(28, cy - 66, W - 56, 28, COL.xp, 3);
    plainText(META.notice, W / 2, cy - 51, 15, INK);
  }
  const by0 = cy + 100;
  panel(28, by0, W - 56, 64, COL.gold, 4);
  const lines = ['Drag anywhere to fly. You fire on your own.', 'Grab green gems to level up.', 'Only the white dot can be hit!'];
  lines.forEach((l, i) => plainText(l, W / 2, by0 + 15 + i * 17, 13, INK, 'center', FONT_B));

  // selected ship
  const sh = curShip(), wp = WEAPONS[sh.weapon], sy = H * 0.52;
  ctx.save(); ctx.translate(W / 2, sy); burstPath(46, 12, 2);
  ctx.fillStyle = PAPER; ctx.globalAlpha = 0.12; ctx.fill(); ctx.globalAlpha = 1; ctx.restore();
  drawFlame(W / 2, sy + 8 * 1.7, 1.7);
  drawShip(W / 2, sy + Math.sin(performance.now() / 500) * 3, 1.7, sh);
  inkText(sh.name, W / 2, sy + 44, 24, sh.color);
  inkText(`${wp.name} · ${TIER[wp.tier].name}`, W / 2, sy + 66, 13, TIER[wp.tier].color, 'center', FONT_D, 3);

  const by = H * 0.7;
  drawButton('launch', 40, by, W - 80, 56, 'LAUNCH!', COL.xp, startGame);
  drawButton('hangar', 40, by + 70, W - 80, 48, `HANGAR · ${META.bank} CR`, '#ff8c1a', openHangar);
  drawSoundToggles(by + 128);
  if (META.best > 0) inkText(`BEST TIME ${fmtTime(META.best)}${META.clears ? ` · CLEARS ${META.clears}` : ''}`, W / 2, by + 184, 14, COL.dim, 'center', FONT_D, 3);
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
  burstTitle('HANGAR', W / 2, 34, 36, COL.gold, COL.red, -0.04);
  inkText(`${META.bank} CR`, W / 2, 70, 20, COL.gold);
  const tw = (W - 44) / 2;
  drawTab('tabShips', 16, 84, tw, 34, 'SHIPS', 'ships');
  drawTab('tabUps', 28 + tw, 84, tw, 34, 'UPGRADES', 'upgrades');
  if (hangarTab === 'ships') drawShipGrid(130, H - 78);
  else {
    const sh = curShip();
    drawShip(34, 150, 1.05, sh);
    inkText(`${sh.name} UPGRADES`, 58, 143, 20, sh.color, 'left');
    plainText(`${sh.role.toUpperCase()} · switch ship in SHIPS`, 58, 162, 10.5, COL.dim, 'left', FONT_B);
    drawUpgradeList(176, H - 78);
  }
  drawButton('back', 16, H - 64, tw, 48, 'BACK', '#5a5480', () => { newGame('title'); });
  drawButton('launch', 28 + tw, H - 64, tw, 48, 'LAUNCH!', COL.xp, startGame);
}

function drawTab(id, x, y, w, h, label, tab) {
  const on = hangarTab === tab;
  panel(x, y, w, h, on ? COL.gold : '#3a3366', on ? 3 : 0);
  plainText(label, x + w / 2, y + h / 2 + 1, 18, on ? INK : COL.dim);
  addButton(id, { x, y, w, h }, () => { hangarTab = tab; S.armed = null; });
}

function drawShipGrid(top, bottom) {
  const ids = Object.keys(SHIPS), cols = 3, gap = 9;
  const cw = (W - 28 - gap * (cols - 1)) / cols;
  const chh = clamp((bottom - top - gap * 3) / 4, 82, 130);
  ids.forEach((id, i) => {
    const ship = SHIPS[id], wp = WEAPONS[ship.weapon], tc = TIER[wp.tier].color;
    const owned = !!META.ships[id], sel = META.ship === id, cost = shipCost(id), afford = META.bank >= cost;
    const r = { x: 12 + (i % cols) * (cw + gap), y: top + Math.floor(i / cols) * (chh + gap), w: cw, h: chh };
    const pressed = S.uiPress === 's' + i, d = pressed ? 3 : 0, rx = r.x + d, ry = r.y + d;
    const flash = S.flash && S.flash.id === id, cx = rx + r.w / 2, band = chh * 0.52;
    panel(rx, ry, r.w, r.h, flash ? COL.gold : PAPER, pressed ? 0 : 3);
    ctx.save(); roundRect(rx, ry, r.w, r.h, 5); ctx.clip();
    ctx.fillStyle = owned ? tc : '#8c86ad'; ctx.fillRect(rx, ry, r.w, band);
    if (dotPattern) { ctx.globalAlpha = 0.22; ctx.fillStyle = dotPattern; ctx.fillRect(rx, ry, r.w, band); ctx.globalAlpha = 1; }
    ctx.restore();
    ctx.lineWidth = 2; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(rx, ry + band); ctx.lineTo(rx + r.w, ry + band); ctx.stroke();
    if (sel) { roundRect(rx - 3, ry - 3, r.w + 6, r.h + 6, 7); ctx.lineWidth = 3; ctx.strokeStyle = COL.gold; ctx.stroke(); }
    drawShip(cx, ry + band * 0.52, 1.2, ship, !owned);
    plainText(ship.name, cx, ry + band + (chh - band) * 0.22, 15, INK);
    plainText(wp.name, cx, ry + band + (chh - band) * 0.48, 10.5, '#4a4470', 'center', FONT_B);
    let label, fill, txt = INK;
    if (owned) { label = sel ? 'FLYING' : 'OWNED'; fill = sel ? COL.xp : '#d9d4ee'; }
    else if (isArmed(id)) { label = 'TAP AGAIN'; fill = blinkOn() ? COL.gold : PAPER; }
    else { label = `${cost} CR`; fill = afford ? COL.gold : '#d9d4ee'; txt = afford ? INK : '#8c86ad'; }
    const py = ry + band + (chh - band) * 0.78;
    ctx.font = `13px ${FONT_D}`;
    const pw = ctx.measureText(label).width + 14;
    roundRect(cx - pw / 2, py - 9, pw, 18, 9); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = INK; ctx.stroke();
    plainText(label, cx, py + 1, 13, txt);
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
  const rowH = clamp((bottom - top) / HANGAR.length, 40, 60);
  HANGAR.forEach((h, i) => {
    const y = top + i * rowH, lv = ML(h.id), maxed = lv >= h.max, cost = hangarCost(h), afford = !maxed && META.bank >= cost;
    const pressed = S.uiPress === 'h' + i, d = pressed ? 3 : 0;
    const r = { x: 12, y: y + 2, w: W - 28, h: rowH - 8 };
    const flash = S.flash && S.flash.id === h.id;
    panel(r.x + d, r.y + d, r.w, r.h, flash ? COL.gold : PAPER, pressed ? 0 : 3);
    plainText(h.name, r.x + 10 + d, r.y + r.h * 0.32 + d, 16, INK, 'left');
    plainText(typeof h.desc === 'function' ? h.desc(lv, maxed) : h.desc, r.x + 10 + d, r.y + r.h * 0.72 + d, 11, '#4a4470', 'left', FONT_B);
    const pipW = Math.min(8, 60 / h.max - 2);
    for (let k = 0; k < h.max; k++) {
      const px = r.x + r.w - 84 - h.max * (pipW + 2) + k * (pipW + 2) + d, py = r.y + r.h * 0.32 - 4 + d;
      ctx.fillStyle = k < lv ? COL.gold : '#d9d4ee'; ctx.fillRect(px, py, pipW, 8);
      ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.strokeRect(px, py, pipW, 8);
    }
    const armed = isArmed(h.id);
    const label = maxed ? 'MAX' : armed ? 'TAP AGAIN' : `${cost} CR`;
    ctx.font = `14px ${FONT_D}`;
    const pw = ctx.measureText(label).width + 14, px = r.x + r.w - 8 - pw + d, py = r.y + r.h / 2 + d;
    roundRect(px, py - 10, pw, 20, 10);
    ctx.fillStyle = maxed ? '#d9d4ee' : armed ? (blinkOn() ? COL.gold : PAPER) : afford ? COL.gold : '#d9d4ee'; ctx.fill();
    ctx.lineWidth = 1.8; ctx.strokeStyle = INK; ctx.stroke();
    plainText(label, px + pw / 2, py + 1, 14, afford || armed ? INK : '#8c86ad');
    addButton('h' + i, r, () => (afford ? confirmBuy(h.id, () => buyHangar(h)) : buzz(20)), !maxed);
  });
}

function drawSoundToggles(y) {
  if (typeof toggleMusic !== 'function') return;
  const w = (W - 112) / 2;
  drawButton('music', 50, y, w, 38, `MUSIC ${PREF.music ? 'ON' : 'OFF'}`, PREF.music ? '#a45cff' : '#5a5480', toggleMusic);
  drawButton('sound', 62 + w, y, w, 38, `SOUND ${PREF.sfx ? 'ON' : 'OFF'}`, PREF.sfx ? '#a45cff' : '#5a5480', toggleSfx);
}

function drawPaused() {
  dim(0.65);
  burstTitle('PAUSED', W / 2, H * 0.34, 46, COL.player, PAPER);
  drawButton('resume', 50, H * 0.48, W - 100, 54, 'RESUME', COL.xp, resume);
  drawButton('quit', 50, H * 0.48 + 70, W - 100, 46, 'END RUN', COL.red, () => gameOver(true));
  drawSoundToggles(H * 0.48 + 136);
}

function drawGameOver() {
  dim(0.55);
  const cy = H * 0.2;
  const won = S.state === 'won';
  burstTitle(won ? 'LEVEL CLEAR!' : S.quit ? 'RUN ENDED' : 'SHIP LOST!', W / 2, cy, 46, won ? COL.xp : S.quit ? COL.player : COL.red, COL.gold);
  if (won) inkText('THE HIVE QUEEN IS DEAD!', W / 2, cy + 40, 16, PAPER);
  const rows = [['SURVIVED', fmtTime(S.t)], ['LEVEL', String(S.level)], ['KILLS', String(S.kills)], ['BEST', fmtTime(META.best)]];
  const py = cy + 62;
  panel(50, py, W - 100, 22 + rows.length * 24, PAPER);
  rows.forEach(([k, v], i) => {
    const y = py + 22 + i * 24;
    plainText(k, 66, y, 17, '#4a4470', 'left');
    plainText(v, W - 66, y, 19, INK, 'right');
  });
  const cyy = py + 22 + rows.length * 24 + 46;
  ctx.save(); ctx.translate(W / 2, cyy); ctx.rotate(0.05);
  burstPath(54, 14, 4); ctx.fillStyle = COL.gold; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  inkText(`+${S.earned} CR`, 0, 2, 30, COL.red, 'center', FONT_D, 5);
  ctx.restore();
  inkText(`BOUNTY BANKED · ${META.bank} CR TOTAL`, W / 2, cyy + 52, 13, PAPER, 'center', FONT_D, 3);
  if (S.newBest) inkText('NEW BEST TIME!', W / 2, cyy + 72, 16, COL.xp);
  const by = H * 0.74, on = S.uiLock <= 0;
  drawButton('again', 40, by, W - 80, 54, 'FLY AGAIN!', COL.xp, startGame, on);
  drawButton('hangar', 40, by + 68, W - 80, 46, 'HANGAR', '#ff8c1a', openHangar, on);
}

// ============================================================================
// Frame
// ============================================================================
function render() {
  uiButtons = [];
  if (!bgCanvas) artResize();
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
  else if (S.state === 'over' || S.state === 'won') drawGameOver();
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
