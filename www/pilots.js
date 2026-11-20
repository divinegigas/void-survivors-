// VOID SURVIVORS pilots: 12 original anime-style characters, one per ship,
// drawn entirely in code (comic ink + cel shading) with three expressions:
// 'normal', 'hurt' (damaged) and 'crit' (critical health).
// Portraits are painted once into off-screen canvases and reused.
'use strict';

const PILOTS = {
  vesper:  { name: 'REN TAKEDA',      f: false, skin: '#f2c9a0', hair: '#5a3a22', style: 'messy',    eye: '#3f86d6', outfit: '#2e6bd6', accent: '#ffd60a', mouth: 'grin',
             acc: ['headband'], quote: 'Just another shift in the void.', shout: 'Time to clean house!' },
  trident: { name: 'MEI LIN',         f: true,  skin: '#f6d3b0', hair: '#231c33', style: 'buns',     eye: '#d0443a', outfit: '#ffd60a', accent: '#e8233a', mouth: 'soft',
             acc: [], quote: 'Wingmen, form up on me!', shout: 'All guns, together!' },
  hornet:  { name: 'PIP "KABOOM" VARGA', f: true, skin: '#f7d6c0', hair: '#ff5fa2', style: 'pigtails', eye: '#7dff6a', outfit: '#ff8c1a', accent: '#5a3a22', mouth: 'manic',
             acc: ['goggles', 'freckles', 'bandaid'], quote: 'Boom boom BOOM! Hehehe!', shout: 'EVERYTHING GOES KABOOM!' },
  bulwark: { name: 'BRAM OKAFOR',     f: false, skin: '#7a4a2e', hair: '#1a1410', style: 'buzz',     eye: '#6b4a2a', outfit: '#b0323a', accent: '#d9d4ee', mouth: 'flat',
             acc: ['beard', 'scar'], quote: 'Hit me. I dare you.', shout: 'NOTHING GETS THROUGH!' },
  halo:    { name: 'LUMI ASTERIA',    f: true,  skin: '#fbe3d0', hair: '#e6e3f6', style: 'long',     eye: '#a982ff', outfit: '#f2f0ff', accent: '#b8ff5d', mouth: 'soft',
             acc: ['star'], quote: 'Everything comes back around.', shout: 'Let the light return!' },
  tide:    { name: 'MARINA REYES',    f: true,  skin: '#d9a27a', hair: '#2ec5c5', style: 'wavy',     eye: '#1f6fb5', outfit: '#5d9dff', accent: '#ffd60a', mouth: 'grin',
             acc: ['flower'], quote: "Surf's up, creeps!", shout: 'RIDE THE BIG ONE!' },
  hive:    { name: 'THEO LINDQVIST',  f: false, skin: '#f4d7c2', hair: '#d9b36a', style: 'neat',     eye: '#4f9a4f', outfit: '#6b6590', accent: '#d6dcff', mouth: 'smirk',
             acc: ['glasses', 'headset'], quote: 'My drones already did the math.', shout: 'Swarm protocol: GO!' },
  lance:   { name: 'SABLE KUROSAWA',  f: true,  skin: '#f5dccb', hair: '#16121f', style: 'hime',     eye: '#e8233a', outfit: '#2a2342', accent: '#c86bff', mouth: 'flat',
             acc: ['earrings'], quote: 'One shot. Make it count.', shout: 'Burn. All of it.' },
  corona:  { name: 'ROX MORENO',      f: true,  skin: '#e0ad86', hair: '#ff6a1a', style: 'undercut', eye: '#2fbf9a', outfit: '#25233a', accent: '#62ffd0', mouth: 'grin',
             acc: ['bandage', 'earrings'], quote: 'Get in close. I like it close.', shout: 'ROUND AND ROUND!' },
  tempest: { name: 'ZEKE ARASHI',     f: false, skin: '#f1cfae', hair: '#2e9bff', style: 'spiky',    eye: '#ffd60a', outfit: '#20304f', accent: '#8fb8ff', mouth: 'grin',
             acc: ['bolt'], quote: 'Feel that static?', shout: "THUNDER'S CALLING!" },
  needle:  { name: 'IRIS NAKAMURA',   f: true,  skin: '#f3d5bd', hair: '#7a4fd1', style: 'ponytail', eye: '#8fd3ff', outfit: '#3a3366', accent: '#ff5df0', mouth: 'soft',
             acc: ['visor'], quote: 'Target acquired.', shout: 'Clean shot. Done.' },
  pulsar:  { name: 'SOL VANCE',       f: false, skin: '#e8bf98', hair: '#c9c4d6', style: 'slick',    eye: '#d98a1a', outfit: '#4a3a20', accent: '#fff36b', mouth: 'smirk',
             acc: ['stubble', 'scar2'], quote: "Kid, I've flown worse.", shout: 'SHINE BRIGHT OR DIE TRYING!' },
};

// --------------------------------------------------------------------------
// Sprite cache. Portrait space is 200 x 240 units (head around y 100).
// --------------------------------------------------------------------------
const PCACHE = {};
function pilotSprite(id, mood, hPx, silhouette) {
  hPx = Math.max(24, Math.round(hPx));
  const key = `${id}|${mood}|${hPx}|${silhouette ? 1 : 0}`;
  if (PCACHE[key]) return PCACHE[key];
  const s = hPx / 240, c = document.createElement('canvas');
  c.width = Math.ceil(200 * s); c.height = hPx;
  const g = c.getContext('2d');
  g.scale(s, s);
  paintPilot(g, PILOTS[id] || PILOTS.vesper, mood);
  if (!silhouette) celFinish(c);
  if (silhouette) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#0d0a1c'; g.fillRect(0, 0, c.width, c.height);
  }
  return (PCACHE[key] = c);
}
const pilotMood = p => (p.hp >= p.maxHp ? 'normal' : p.hp <= 1 || p.hp / p.maxHp <= 0.34 ? 'crit' : 'hurt');

// --------------------------------------------------------------------------
// Painting: late-90s cel animation look. Longer, angular faces; almond eyes
// with a heavy upper lid; hard-edged shadow shapes (no halftone); chunky hair
// locks with a sharp highlight band; muted, warm colours and a little grain.
// --------------------------------------------------------------------------
const P_INK = '#1d1418';                  // warm near-black line art
function pRGB(c) {
  if (c[0] === '#') { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  return c.match(/\d+/g).slice(0, 3).map(Number);
}
const pHex = rgb => '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function pMix(a, b, k) { const x = pRGB(a), y = pRGB(b); return pHex(x.map((v, i) => v + (y[i] - v) * k)); }
function pShade(c, f) { return pMix(c, f < 0 ? '#000000' : '#ffffff', Math.abs(f)); }
function pMute(c, k) {                    // pull a colour toward a warm grey of the same brightness
  const [r, g, b] = pRGB(c), l = 0.3 * r + 0.59 * g + 0.11 * b;
  return pMix(c, pHex([l * 1.04, l * 0.98, l * 0.92]), k);
}
const celShadow = c => pMix(pShade(c, -0.12), '#5a2846', 0.3);   // cel shadows lean purple-brown
function pPoly(g, pts) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); }

let P_SHADOW = null;   // when set, shapes just fill with this colour (casts the fringe's shadow onto the face)
function pCel(g, build, fill, lw, shadeX) {
  if (P_SHADOW) { build(); g.fillStyle = P_SHADOW; g.fill(); return; }
  build(); g.fillStyle = fill; g.fill();
  g.save(); build(); g.clip();
  const sx = shadeX === undefined ? 108 : shadeX;      // a hard, slightly angular shadow on the right
  g.beginPath(); g.moveTo(sx + 6, -60); g.lineTo(320, -60); g.lineTo(320, 330); g.lineTo(sx - 26, 330); g.lineTo(sx - 8, 150); g.lineTo(sx + 2, 90); g.closePath();
  g.fillStyle = celShadow(fill); g.fill();
  g.restore();
  build(); g.lineJoin = 'round'; g.lineWidth = (lw || 3) * 0.72; g.strokeStyle = P_INK; g.stroke();
}
function pInk(g, lw, fn) {
  if (P_SHADOW) return;
  g.beginPath(); fn(); g.lineWidth = lw; g.strokeStyle = P_INK; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
}
// an adult, angular face: cheekbones, a defined jaw, a pointed chin
const headPath = g => () => {
  g.beginPath(); g.moveTo(56, 98);
  g.bezierCurveTo(52, 36, 148, 36, 144, 98);
  g.lineTo(141, 120); g.lineTo(131, 145); g.quadraticCurveTo(117, 163, 100, 170);
  g.quadraticCurveTo(83, 163, 69, 145); g.lineTo(59, 120);
  g.closePath();
};

function paintPilot(g, P0, mood) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  const P = Object.assign({}, P0, {
    skin: pMute(P0.skin, 0.1), hair: pMute(P0.hair, 0.26), outfit: pMute(P0.outfit, 0.32),
    accent: pMute(P0.accent, 0.25), eye: pMute(P0.eye, 0.12),
  });
  const hurt = mood !== 'normal', crit = mood === 'crit';
  const skinShadow = celShadow(P.skin);

  const back = HAIR_BACK[P.style];
  if (back) back(g, P);

  // torso: broad flight jacket with a turned-up collar and fold lines
  const wide = P.f ? 0.92 : 1.06;
  g.save(); g.translate(100, 0); g.scale(wide, 1); g.translate(-100, 0);
  pCel(g, () => pPoly(g, [4, 240, 12, 204, 30, 186, 72, 174, 100, 192, 128, 174, 170, 186, 188, 204, 196, 240]), P.outfit, 3);
  pInk(g, 1.3, () => { g.moveTo(34, 196); g.quadraticCurveTo(46, 210, 44, 230); g.moveTo(160, 194); g.quadraticCurveTo(152, 212, 156, 232); g.moveTo(62, 186); g.lineTo(70, 200); });
  for (const sd of [-1, 1]) pCel(g, () => pPoly(g, [100 + sd * 30, 164, 100 + sd * 14, 200, 100 + sd * 2, 190, 100 + sd * 8, 176]), P.accent, 2.5, sd < 0 ? 80 : 300);
  pInk(g, 1.6, () => { g.moveTo(100, 194); g.lineTo(100, 240); });
  g.beginPath(); g.arc(40, 216, 8, 0, Math.PI * 2); g.fillStyle = P.accent; g.fill(); g.lineWidth = 1.6; g.strokeStyle = P_INK; g.stroke();
  g.restore();

  // neck, with the jaw's shadow on it
  pPoly(g, [85, 138, 115, 138, 117, 184, 83, 184]); g.fillStyle = P.skin; g.fill();
  pPoly(g, [85, 138, 115, 138, 117, 160, 100, 168, 83, 160]); g.fillStyle = skinShadow; g.fill();
  pPoly(g, [85, 138, 115, 138, 117, 184, 83, 184]); g.lineWidth = 2; g.strokeStyle = P_INK; g.stroke();
  for (const x of [54, 146]) pCel(g, () => { g.beginPath(); g.ellipse(x, 112, 6, 11, 0, 0, Math.PI * 2); }, P.skin, 2.4, 300);

  // head: flat skin, a cheekbone shadow down the right side, and the fringe's shadow across the forehead
  const head = headPath(g);
  head(); g.fillStyle = P.skin; g.fill();
  g.save(); head(); g.clip();
  pPoly(g, [126, 40, 180, 40, 180, 200, 100, 200, 120, 160, 133, 134, 136, 108, 130, 78]); g.fillStyle = skinShadow; g.fill();
  g.translate(3, 9); P_SHADOW = skinShadow; HAIR_FRONT[P.style](g, P); P_SHADOW = null;
  g.restore();
  head(); g.lineWidth = 2.4; g.strokeStyle = P_INK; g.stroke();

  if (P.acc.includes('beard')) {
    g.fillStyle = pMix('#1a1410', P.skin, 0.1);
    g.beginPath(); g.moveTo(60, 120); g.lineTo(70, 146); g.quadraticCurveTo(84, 163, 100, 171); g.quadraticCurveTo(116, 163, 130, 146); g.lineTo(140, 120);
    g.lineTo(132, 136); g.quadraticCurveTo(118, 140, 112, 140); g.quadraticCurveTo(100, 156, 88, 140); g.quadraticCurveTo(82, 140, 68, 136); g.closePath(); g.fill();
  }
  if (P.acc.includes('stubble')) {
    g.fillStyle = 'rgba(70,60,80,0.32)';
    for (let i = 0; i < 90; i++) { const a = Math.PI * 0.12 + (i / 90) * Math.PI * 0.76, r = 44 + (i * 7) % 9; g.fillRect(100 + Math.cos(a) * r * 0.95, 116 + Math.sin(a) * r * 1.12, 1.3, 1.3); }
  }
  // blush as hatch lines, the classic cel way
  if (P.f || P.mouth === 'manic') pInk(g, 1.1, () => { for (const x of [70, 124]) for (let k = 0; k < 3; k++) { g.moveTo(x + k * 4, 130); g.lineTo(x + k * 4 + 3, 125); } });
  if (P.acc.includes('freckles')) {
    g.fillStyle = 'rgba(130,70,50,0.65)';
    for (const [x, y] of [[66, 122], [72, 126], [78, 122], [122, 122], [128, 126], [134, 122]]) { g.beginPath(); g.arc(x, y, 1.1, 0, Math.PI * 2); g.fill(); }
  }

  // eyes and brows
  drawEye(g, 80, 106, P, -1, crit ? 'fierce' : 'open');
  drawEye(g, 120, 106, P, 1, crit ? 'fierce' : hurt ? 'shut' : 'open');
  for (const side of [-1, 1]) {
    const x = 100 + side * 21;
    const inner = crit ? 5 : hurt ? -4 : 0, outer = crit ? -3 : hurt ? 1 : -3;
    pInk(g, 2.6, () => { g.moveTo(x - side * 13, 90 + inner); g.lineTo(x - side * 2, 86 + Math.min(inner, outer) * 0.6); g.lineTo(x + side * 14, 89 + outer); });
  }
  // nose: an angular bridge with its own shadow
  pPoly(g, [101, 108, 107, 126, 100, 129]); g.fillStyle = skinShadow; g.fill();
  pInk(g, 1.6, () => { g.moveTo(102, 112); g.lineTo(106, 127); g.lineTo(99, 129); });
  drawMouth(g, P, mood);

  // marks of battle
  if (P.acc.includes('scar')) pInk(g, 1.6, () => { g.moveTo(112, 80); g.lineTo(130, 100); g.moveTo(116, 86); g.lineTo(120, 84); g.moveTo(122, 92); g.lineTo(126, 90); });
  if (P.acc.includes('scar2')) pInk(g, 1.6, () => { g.moveTo(84, 120); g.lineTo(112, 130); });
  if (P.acc.includes('bolt')) { pPoly(g, [124, 118, 132, 118, 128, 125, 134, 125, 122, 138, 126, 128, 120, 128]); g.fillStyle = pMute('#ffd60a', 0.2); g.fill(); g.lineWidth = 1.3; g.strokeStyle = P_INK; g.stroke(); }
  if (hurt) {
    g.fillStyle = 'rgba(100,40,120,0.28)'; g.beginPath(); g.ellipse(130, 126, 9, 6, -0.3, 0, Math.PI * 2); g.fill();
    sweat(g, 148, 80, 0.9);
    pInk(g, 1.2, () => { g.moveTo(64, 134); g.lineTo(72, 129); g.moveTo(66, 138); g.lineTo(73, 134); });
  }
  if (crit) {
    g.fillStyle = 'rgba(40,30,40,0.22)';
    for (const [x, y, r] of [[64, 118, 10], [138, 140, 8], [90, 154, 6]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#a3122a'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(70, 70); g.quadraticCurveTo(66, 90, 70, 102); g.stroke();
    g.beginPath(); g.moveTo(110, 150); g.lineTo(112, 160); g.stroke();
    g.fillStyle = '#a3122a'; g.beginPath(); g.arc(70, 104, 2.4, 0, Math.PI * 2); g.fill();
    sweat(g, 46, 94, 0.75);
  }

  const front = HAIR_FRONT[P.style];
  front(g, P);

  for (const a of P.acc) if (ACCESSORY[a]) ACCESSORY[a](g, P, crit);
  if (P.acc.includes('bandaid') || (crit && !P.acc.includes('bandage'))) bandaid(g, crit && !P.acc.includes('bandaid') ? 128 : 101, crit && !P.acc.includes('bandaid') ? 134 : 117);
}

// a whisper of film grain and a warm cel tint over the finished portrait
function celFinish(c) {
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(255,196,150,0.07)'; g.fillRect(0, 0, c.width, c.height);
  try {
    const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
    for (let i = 0; i < a.length; i += 4) { if (!a[i + 3]) continue; const n = (Math.random() - 0.5) * 14; a[i] += n; a[i + 1] += n; a[i + 2] += n; }
    g.putImageData(d, 0, 0);
  } catch (e) { /* tainted or unsupported: skip the grain */ }
  g.globalCompositeOperation = 'source-over';
}

function sweat(g, x, y, s) {
  g.beginPath(); g.moveTo(x, y - 9 * s); g.quadraticCurveTo(x + 7 * s, y + 4 * s, x, y + 6 * s); g.quadraticCurveTo(x - 7 * s, y + 4 * s, x, y - 9 * s);
  g.fillStyle = '#a9d4ec'; g.fill(); g.lineWidth = 1.3; g.strokeStyle = P_INK; g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 1.5 * s, y + 1 * s, 1.3 * s, 0, Math.PI * 2); g.fill();
}
function bandaid(g, x, y) {
  g.save(); g.translate(x, y); g.rotate(-0.3);
  g.fillStyle = '#e8bf92'; g.beginPath(); g.rect(-11, -4, 22, 8); g.fill(); g.lineWidth = 1.3; g.strokeStyle = P_INK; g.stroke();
  g.fillStyle = '#d4a676'; g.fillRect(-4, -3, 8, 6);
  g.restore();
}

// almond eye: heavy upper lid, a crease above, an iris tucked under the lid, one sharp highlight
function drawEye(g, x, y, P, side, state) {
  if (state === 'shut') {                        // squeezed shut in pain
    pInk(g, 2.8, () => { g.moveTo(x - 13, y - 1); g.quadraticCurveTo(x, y + 4, x + 13, y - 2); });
    pInk(g, 1.4, () => { g.moveTo(x - 9, y - 6); g.lineTo(x + 9, y - 8); });
    return;
  }
  const k = state === 'fierce' ? 0.7 : 1, ry = (P.f ? 8 : 6.5) * k, o = side * 1.5;
  const almond = () => {
    g.beginPath(); g.moveTo(x - 14, y + 1);
    g.quadraticCurveTo(x - 3 + o, y - ry * 1.5, x + 14, y - 2);
    g.quadraticCurveTo(x + 2 + o, y + ry * 1.05, x - 14, y + 1);
    g.closePath();
  };
  g.save(); almond(); g.fillStyle = '#f7f1e6'; g.fill(); g.clip();
  const ir = state === 'fierce' ? 5.6 : P.f ? 7.2 : 6.4;
  g.fillStyle = P.eye; g.beginPath(); g.arc(x + o, y - 1.5, ir, 0, Math.PI * 2); g.fill();
  g.fillStyle = pShade(P.eye, -0.45); g.fillRect(x - 14, y - ry * 1.6, 28, ry * 0.9);           // the lid's shadow on the iris
  g.fillStyle = P_INK; g.beginPath(); g.arc(x + o, y - 1, state === 'fierce' ? 1.8 : 2.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.fillRect(x + o - 4, y - 5, 2.6, 2.6);                                  // one sharp highlight
  g.restore();
  // heavy upper lid that runs past the outer corner, lighter lower lid, and the crease
  pInk(g, P.f ? 3.4 : 3, () => { g.moveTo(x - 15, y + 1.5); g.quadraticCurveTo(x - 3 + o, y - ry * 1.62, x + side * 0 + 15, y - 2.5); g.lineTo(x + side * 16 + (side > 0 ? 2 : -2), y - 4); });
  if (P.f) pInk(g, 1.8, () => { const ox = x + side * 15; g.moveTo(ox, y - 3); g.lineTo(ox + side * 4, y - 7); g.moveTo(ox - side * 4, y - ry - 1); g.lineTo(ox - side * 1, y - ry - 5); });
  pInk(g, 1.1, () => { g.moveTo(x + side * -2, y + ry * 0.95); g.quadraticCurveTo(x + side * 6, y + ry * 0.8, x + side * 12, y + 1); });
  pInk(g, 1.1, () => { g.moveTo(x - 9, y - ry * 1.55 - 3); g.quadraticCurveTo(x + o, y - ry * 1.95 - 3, x + 10, y - ry * 1.3 - 3); });
}

function drawMouth(g, P, mood) {
  const y = 146;
  const ink = (lw, fn) => pInk(g, lw, fn);
  if (mood === 'crit') {                      // teeth gritted
    g.beginPath(); g.moveTo(88, y - 3); g.lineTo(112, y - 4); g.lineTo(110, y + 4); g.lineTo(90, y + 4); g.closePath();
    g.fillStyle = '#f2ece0'; g.fill(); g.lineWidth = 1.8; g.strokeStyle = P_INK; g.stroke();
    ink(1, () => { g.moveTo(89, y); g.lineTo(111, y); for (const x of [95, 101, 107]) { g.moveTo(x, y - 4); g.lineTo(x, y + 4); } });
    return;
  }
  if (mood === 'hurt') {                      // a clenched, lopsided grimace
    g.beginPath(); g.moveTo(90, y + 1); g.lineTo(110, y - 2); g.lineTo(108, y + 3); g.lineTo(96, y + 4); g.closePath();
    g.fillStyle = '#4a1420'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = P_INK; g.stroke();
    g.fillStyle = '#f2ece0'; g.fillRect(100, y - 1, 7, 2.5);
    return;
  }
  switch (P.mouth) {
    case 'manic': {
      g.beginPath(); g.moveTo(84, y - 4); g.quadraticCurveTo(100, y, 116, y - 5); g.quadraticCurveTo(102, y + 15, 84, y - 4); g.closePath();
      g.fillStyle = '#5e1424'; g.fill();
      g.save(); g.clip(); g.fillStyle = '#f2ece0'; g.fillRect(80, y - 8, 40, 7); g.restore();
      g.lineWidth = 1.8; g.strokeStyle = P_INK; g.stroke();
      break;
    }
    case 'grin': ink(1.9, () => { g.moveTo(89, y - 1); g.quadraticCurveTo(100, y + 5, 112, y - 3); g.moveTo(112, y - 3); g.lineTo(114, y - 5); }); break;
    case 'smirk': ink(1.9, () => { g.moveTo(92, y + 1); g.quadraticCurveTo(104, y + 2, 112, y - 4); }); break;
    case 'flat': ink(1.9, () => { g.moveTo(92, y); g.lineTo(108, y); }); break;
    default: ink(1.8, () => { g.moveTo(93, y - 1); g.quadraticCurveTo(100, y + 3, 108, y - 1); });
  }
  g.fillStyle = celShadow(P.skin); g.beginPath(); g.ellipse(100, y + 7, 5, 1.6, 0, 0, Math.PI * 2); g.fill();   // soft lower-lip shadow
}

// --------------------------------------------------------------------------
// Hair: chunky locks with dark separations and a sharp highlight band
// --------------------------------------------------------------------------
// glossy highlight: separate angled slivers following the curve of the head (lit from the upper left)
function hairShine(g, P, x, y, w) {
  if (P_SHADOW) return;
  g.fillStyle = pShade(P.hair, 0.3);
  const cy = y + 46, r = w + 8;
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (1.18 + i * 0.1), len = i === 1 || i === 2 ? 12 : 8;
    const px = x + Math.cos(a) * r, py = cy + Math.sin(a) * r, tx = Math.cos(a + Math.PI / 2), ty = Math.sin(a + Math.PI / 2);
    g.beginPath();
    g.moveTo(px - tx * 2, py - ty * 2); g.lineTo(px + tx * 2.5, py + ty * 2.5);
    g.lineTo(px + tx * 1 + Math.cos(a) * -len, py + ty * 1 + Math.sin(a) * -len);
    g.closePath(); g.fill();
    g.beginPath(); g.moveTo(px - tx * 2, py - ty * 2); g.lineTo(px + tx * 2.5, py + ty * 2.5);
    g.lineTo(px + Math.cos(a) * len * 0.8, py + Math.sin(a) * len * 0.8); g.closePath(); g.fill();
  }
}
function cap(g, P, edge, top) {
  const t = top === undefined ? 18 : top;
  // the outline: pointed locks over the cheeks, then a chunky, lock-by-lock crown
  const ry = 64 - t, N = 16;
  const build = () => {
    g.beginPath(); g.moveTo(55, 98); g.lineTo(43, 128); g.lineTo(44, 70);
    for (let i = 1; i < N; i++) {
      const th = Math.PI + (i / N) * Math.PI, k = i % 2 ? 1.07 : 0.99;
      g.lineTo(100 + Math.cos(th) * 57 * k, 68 + Math.sin(th) * ry * k);
    }
    g.lineTo(156, 70); g.lineTo(157, 128); g.lineTo(145, 98);
    for (let i = 0; i < edge.length; i += 2) g.lineTo(edge[i], edge[i + 1]);
    g.closePath();
  };
  pCel(g, build, P.hair, 3, 118);
  if (P_SHADOW) return;
  g.save(); build(); g.clip();
  g.fillStyle = pShade(P.hair, -0.4);                           // lock separations
  for (let i = 0; i < edge.length; i += 4) {
    const x = edge[i], y = edge[i + 1], cx = 100 + (x - 100) * 0.3;
    g.beginPath(); g.moveTo(cx - 2, t + 10); g.lineTo(x, y); g.lineTo(cx + 3.5, t + 14); g.closePath(); g.fill();
  }
  hairShine(g, P, 100, t + 22, 40);
  g.restore();
  build(); g.lineWidth = 2.2; g.strokeStyle = P_INK; g.stroke();
}
const HAIR_BACK = {
  long:     (g, P) => pCel(g, () => { g.beginPath(); g.moveTo(48, 60); g.bezierCurveTo(30, 120, 28, 180, 34, 214); g.lineTo(166, 214); g.bezierCurveTo(172, 180, 170, 120, 152, 60); g.closePath(); }, pShade(P.hair, -0.12), 3, 130),
  hime:     (g, P) => pCel(g, () => pPoly(g, [46, 60, 40, 220, 160, 220, 154, 60]), pShade(P.hair, -0.1), 3, 130),
  wavy:     (g, P) => pCel(g, () => {
              g.beginPath(); g.moveTo(48, 60);
              for (let y = 70; y <= 210; y += 20) g.quadraticCurveTo(28 + ((y / 20) % 2) * 14, y - 10, 36 + ((y / 20) % 2) * 6, y);
              g.lineTo(164, 210);
              for (let y = 200; y >= 70; y -= 20) g.quadraticCurveTo(172 - ((y / 20) % 2) * 14, y - 10, 164 - ((y / 20) % 2) * 6, y - 20);
              g.lineTo(152, 60); g.closePath();
            }, pShade(P.hair, -0.1), 3, 130),
  ponytail: (g, P) => pCel(g, () => { g.beginPath(); g.moveTo(130, 40); g.bezierCurveTo(196, 40, 196, 140, 176, 196); g.lineTo(166, 176); g.bezierCurveTo(176, 120, 168, 80, 140, 70); g.closePath(); }, pShade(P.hair, -0.1), 3, 160),
  pigtails: (g, P) => {
    for (const side of [-1, 1]) {
      const big = side > 0 ? 1.15 : 1;
      pCel(g, () => {
        const x0 = 100 + side * 46;
        g.beginPath(); g.moveTo(x0, 52);
        const pts = [[side * 40, -14], [side * 58, 4], [side * 44, 18], [side * 66, 34], [side * 44, 44], [side * 58, 66], [side * 30, 60], [side * 20, 76], [side * 4, 50]];
        for (const [dx, dy] of pts) g.lineTo(x0 + dx * big, 52 + dy * big);
        g.closePath();
      }, P.hair, 3, side > 0 ? 150 : 40);
      g.fillStyle = '#ffd60a'; g.beginPath(); g.arc(100 + side * 50, 56, 6, 0, Math.PI * 2); g.fill(); g.lineWidth = 2; g.strokeStyle = P_INK; g.stroke();
    }
  },
  buns:     (g, P) => { for (const x of [58, 142]) pCel(g, () => { g.beginPath(); g.arc(x, 40, 21, 0, Math.PI * 2); }, P.hair, 3, x + 4); },
};
const HAIR_FRONT = {
  messy:    (g, P) => cap(g, P, [140, 84, 134, 99, 124, 80, 112, 97, 100, 78, 88, 95, 76, 80, 64, 97, 55, 82]),
  buns:     (g, P) => { cap(g, P, [150, 92, 132, 90, 100, 92, 68, 90, 50, 92]); for (const s of [-1, 1]) pCel(g, () => pPoly(g, [100 + s * 50, 92, 100 + s * 44, 92, 100 + s * 46, 140, 100 + s * 52, 134]), P.hair, 2.5); },
  pigtails: (g, P) => cap(g, P, [148, 86, 140, 80, 132, 93, 122, 82, 112, 95, 102, 84, 92, 95, 82, 82, 72, 93, 62, 82, 52, 90]),
  buzz:     (g, P) => {
    pCel(g, () => { g.beginPath(); g.moveTo(54, 90); g.bezierCurveTo(50, 36, 150, 36, 146, 90); g.lineTo(140, 74); g.quadraticCurveTo(100, 58, 60, 74); g.closePath(); }, P.hair, 2.5, 116);
  },
  long:     (g, P) => { cap(g, P, [152, 110, 138, 82, 114, 70, 100, 62, 86, 70, 62, 82, 48, 110]); for (const s of [-1, 1]) pCel(g, () => pPoly(g, [100 + s * 52, 80, 100 + s * 40, 96, 100 + s * 44, 170, 100 + s * 54, 176]), P.hair, 2.5); },
  hime:     (g, P) => { cap(g, P, [152, 94, 128, 96, 100, 97, 72, 96, 48, 94]); for (const s of [-1, 1]) pCel(g, () => pPoly(g, [100 + s * 53, 90, 100 + s * 42, 96, 100 + s * 42, 152, 100 + s * 55, 152]), P.hair, 2.5); },
  wavy:     (g, P) => cap(g, P, [152, 82, 136, 72, 116, 84, 96, 92, 78, 100, 60, 112, 48, 112]),
  ponytail: (g, P) => { cap(g, P, [152, 112, 144, 100, 128, 88, 110, 80, 90, 76, 70, 74, 52, 80]); },
  neat:     (g, P) => { cap(g, P, [152, 96, 146, 80, 128, 74, 100, 76, 80, 84, 64, 98, 52, 104]); pInk(g, 1.8, () => { g.moveTo(80, 30); g.quadraticCurveTo(90, 50, 96, 76); }); },
  undercut: (g, P) => {
    if (!P_SHADOW) {
      g.fillStyle = pShade(P.hair, -0.45); g.globalAlpha = 0.55;
      g.beginPath(); g.moveTo(50, 100); g.lineTo(47, 64); g.quadraticCurveTo(56, 42, 80, 34); g.lineTo(86, 60); g.closePath(); g.fill(); g.globalAlpha = 1;
    }
    pCel(g, () => { g.beginPath(); g.moveTo(80, 32); g.bezierCurveTo(120, 10, 162, 30, 156, 70); g.lineTo(154, 128); g.lineTo(140, 112); g.lineTo(132, 92); g.lineTo(114, 84); g.lineTo(96, 78); g.lineTo(80, 70); g.lineTo(70, 60); g.closePath(); }, P.hair, 3, 130);
    hairShine(g, P, 118, 20, 30);
  },
  spiky:    (g, P) => {
    pCel(g, () => pPoly(g, [48, 104, 34, 72, 52, 64, 34, 30, 66, 46, 64, 4, 90, 34, 100, -4, 112, 32, 138, 4, 136, 46, 168, 30, 150, 64, 168, 72, 152, 104,
                             142, 84, 130, 98, 118, 80, 104, 96, 92, 80, 80, 96, 68, 82, 58, 98]), P.hair, 3, 116);
    hairShine(g, P, 98, 22, 36);
  },
  slick:    (g, P) => {
    cap(g, P, [152, 88, 132, 76, 112, 74, 104, 82, 98, 74, 78, 76, 50, 88], 22);
    pInk(g, 1.6, () => { for (const x of [76, 96, 118]) { g.moveTo(x, 76); g.quadraticCurveTo(x + 6, 50, x + 20, 32); } });
  },
};

// --------------------------------------------------------------------------
// Accessories
// --------------------------------------------------------------------------
const ACCESSORY = {
  headband(g, P) {
    pCel(g, () => pPoly(g, [47, 72, 153, 70, 153, 82, 47, 84]), '#e8233a', 2.5, 140);
    pCel(g, () => pPoly(g, [47, 74, 26, 66, 22, 86, 47, 82]), '#e8233a', 2.5, 300);
  },
  goggles(g) {
    pInk(g, 7, () => { g.moveTo(46, 70); g.lineTo(154, 68); });
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 4; g.beginPath(); g.moveTo(46, 70); g.lineTo(154, 68); g.stroke();
    for (const x of [80, 120]) {
      g.beginPath(); g.arc(x, 66, 15, 0, Math.PI * 2); g.fillStyle = '#c9a24a'; g.fill(); g.lineWidth = 3; g.strokeStyle = P_INK; g.stroke();
      g.beginPath(); g.arc(x, 66, 10, 0, Math.PI * 2); g.fillStyle = '#7dd8ff'; g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(x - 4, 62, 3, 0, Math.PI * 2); g.fill();
    }
  },
  glasses(g, P, crit) {
    for (const x of [78, 122]) {
      g.beginPath(); g.roundRect ? g.roundRect(x - 18, 96, 36, 28, 7) : g.rect(x - 18, 96, 36, 28);
      g.fillStyle = 'rgba(190,230,255,0.25)'; g.fill(); g.lineWidth = 3; g.strokeStyle = P_INK; g.stroke();
      if (crit) pInk(g, 1.2, () => { g.moveTo(x - 8, 99); g.lineTo(x + 1, 108); g.lineTo(x - 4, 121); g.moveTo(x + 1, 108); g.lineTo(x + 12, 114); });
    }
    pInk(g, 3, () => { g.moveTo(96, 108); g.quadraticCurveTo(100, 104, 104, 108); });
  },
  headset(g) {
    pInk(g, 6, () => { g.moveTo(48, 100); g.bezierCurveTo(40, 20, 160, 20, 152, 100); });
    g.strokeStyle = '#8c86ad'; g.lineWidth = 3; g.beginPath(); g.moveTo(48, 100); g.bezierCurveTo(40, 20, 160, 20, 152, 100); g.stroke();
    for (const x of [48, 152]) { g.beginPath(); g.ellipse(x, 108, 9, 14, 0, 0, Math.PI * 2); g.fillStyle = '#5a5480'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = P_INK; g.stroke(); }
    pInk(g, 3, () => { g.moveTo(152, 118); g.quadraticCurveTo(146, 146, 118, 146); });
    g.fillStyle = '#5a5480'; g.beginPath(); g.arc(116, 146, 4, 0, Math.PI * 2); g.fill(); g.lineWidth = 2; g.stroke();
  },
  visor(g, P, crit) {
    g.save(); g.globalAlpha = 0.7;
    pPoly(g, [104, 94, 154, 90, 154, 124, 104, 124]); g.fillStyle = P.accent; g.fill();
    g.restore();
    pPoly(g, [104, 94, 154, 90, 154, 124, 104, 124]); g.lineWidth = 2.5; g.strokeStyle = P_INK; g.stroke();
    pInk(g, 1.2, () => { g.moveTo(110, 100); g.lineTo(146, 98); });
    if (crit) pInk(g, 1.4, () => { g.moveTo(118, 96); g.lineTo(126, 108); g.lineTo(120, 119); g.moveTo(126, 108); g.lineTo(140, 112); });
  },
  earrings(g, P) { for (const x of [52, 148]) { g.beginPath(); g.arc(x, 124, 3.5, 0, Math.PI * 2); g.fillStyle = P.accent; g.fill(); g.lineWidth = 1.6; g.strokeStyle = P_INK; g.stroke(); } },
  star(g, P) {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4 : 10; g.lineTo(136 + Math.cos(a) * r, 70 + Math.sin(a) * r); }
    g.closePath(); g.fillStyle = '#ffd60a'; g.fill(); g.lineWidth = 2; g.strokeStyle = P_INK; g.stroke();
    g.beginPath(); g.ellipse(100, 22, 30, 7, 0, 0, Math.PI * 2); g.lineWidth = 6; g.strokeStyle = P_INK; g.stroke(); g.lineWidth = 3; g.strokeStyle = '#ffe98a'; g.stroke();
  },
  flower(g) {
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; g.beginPath(); g.ellipse(140 + Math.cos(a) * 8, 76 + Math.sin(a) * 8, 7, 5, a, 0, Math.PI * 2); g.fillStyle = '#ff5f7a'; g.fill(); g.lineWidth = 1.8; g.strokeStyle = P_INK; g.stroke(); }
    g.beginPath(); g.arc(140, 76, 4, 0, Math.PI * 2); g.fillStyle = '#ffd60a'; g.fill(); g.stroke();
  },
  bandage(g) {
    g.save(); g.translate(128, 130); g.rotate(-0.2);
    g.fillStyle = '#fffaf0'; g.fillRect(-12, -6, 24, 12); g.lineWidth = 1.6; g.strokeStyle = P_INK; g.strokeRect(-12, -6, 24, 12);
    pInk(g, 1, () => { g.moveTo(-6, -6); g.lineTo(-6, 6); g.moveTo(6, -6); g.lineTo(6, 6); });
    g.restore();
  },
};
