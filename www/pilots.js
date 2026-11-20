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
  if (silhouette) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#0d0a1c'; g.fillRect(0, 0, c.width, c.height);
  }
  return (PCACHE[key] = c);
}
const pilotMood = p => (p.hp >= p.maxHp ? 'normal' : p.hp <= 1 || p.hp / p.maxHp <= 0.34 ? 'crit' : 'hurt');

// --------------------------------------------------------------------------
// Painting
// --------------------------------------------------------------------------
const P_INK = '#14101f';
function pShade(hex, f) {             // darker / lighter version of a hex colour
  const n = parseInt(hex.slice(1), 16), t = f < 0 ? 0 : 255, k = Math.abs(f);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (t - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function pPoly(g, pts) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); }
// fill a shape, give it a hard cel shadow (with halftone dots) on the right, then ink it
function pCel(g, build, fill, lw, shadeX, soft) {
  build(); g.fillStyle = fill; g.fill();
  g.save(); build(); g.clip();
  const sx = shadeX === undefined ? 108 : shadeX;
  g.beginPath(); g.moveTo(sx, -50); g.lineTo(260, -50); g.lineTo(260, 300); g.lineTo(sx - 30, 300); g.closePath();
  g.fillStyle = soft ? 'rgba(120,40,70,0.13)' : 'rgba(60,20,70,0.24)'; g.fill();
  g.fillStyle = soft ? 'rgba(120,40,70,0.08)' : 'rgba(60,20,70,0.22)';
  for (let y = -40; y < 300; y += 6) for (let x = sx - 30 + ((y / 6) % 2) * 3; x < 220; x += 6) {
    if (x > sx - (y + 50) * 30 / 350) { g.beginPath(); g.arc(x, y, 1.1, 0, Math.PI * 2); g.fill(); }
  }
  g.restore();
  build(); g.lineJoin = 'round'; g.lineWidth = lw || 3; g.strokeStyle = P_INK; g.stroke();
}
function pInk(g, lw, fn) { g.beginPath(); fn(); g.lineWidth = lw; g.strokeStyle = P_INK; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); }
const headPath = g => () => {
  g.beginPath(); g.moveTo(54, 96);
  g.bezierCurveTo(50, 40, 150, 40, 146, 96);
  g.bezierCurveTo(146, 126, 128, 150, 100, 162);
  g.bezierCurveTo(72, 150, 54, 126, 54, 96);
  g.closePath();
};

function paintPilot(g, P, mood) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  const hurt = mood !== 'normal', crit = mood === 'crit';
  const hairDark = pShade(P.hair, -0.32);

  // back hair (behind everything)
  const back = HAIR_BACK[P.style];
  if (back) back(g, P);

  // torso: a high-collared flight suit
  const narrow = P.f ? 0.9 : 1;
  g.save(); g.translate(100, 0); g.scale(narrow, 1); g.translate(-100, 0);
  pCel(g, () => pPoly(g, [6, 240, 16, 206, 34, 186, 74, 176, 100, 190, 126, 176, 166, 186, 184, 206, 194, 240]), P.outfit, 3);
  pCel(g, () => pPoly(g, [76, 168, 82, 194, 100, 202, 118, 194, 124, 168, 100, 178]), P.accent, 2.5);
  pInk(g, 2, () => { g.moveTo(100, 202); g.lineTo(100, 240); });
  g.beginPath(); g.arc(40, 216, 9, 0, Math.PI * 2); g.fillStyle = P.accent; g.fill(); g.lineWidth = 2; g.strokeStyle = P_INK; g.stroke();
  g.restore();

  // neck and ears
  pCel(g, () => pPoly(g, [86, 140, 114, 140, 116, 180, 84, 180]), P.skin, 2.5, 100, true);
  for (const x of [52, 148]) pCel(g, () => { g.beginPath(); g.ellipse(x, 110, 7, 11, 0, 0, Math.PI * 2); }, P.skin, 2.5, undefined, true);

  // head
  pCel(g, headPath(g), P.skin, 3.2, 116, true);
  if (P.acc.includes('beard')) {
    g.fillStyle = 'rgba(26,20,16,0.85)';
    g.beginPath(); g.moveTo(56, 112); g.bezierCurveTo(58, 140, 78, 158, 100, 164); g.bezierCurveTo(122, 158, 142, 140, 144, 112);
    g.bezierCurveTo(136, 128, 124, 134, 116, 132); g.quadraticCurveTo(100, 150, 84, 132); g.bezierCurveTo(76, 134, 64, 128, 56, 112); g.fill();
  }
  if (P.acc.includes('stubble')) {
    g.fillStyle = 'rgba(80,70,90,0.35)';
    for (let i = 0; i < 70; i++) { const a = Math.PI * 0.15 + (i / 70) * Math.PI * 0.7, r = 40 + (i * 7) % 9; g.fillRect(100 + Math.cos(a) * r * 1.05, 112 + Math.sin(a) * r * 1.15, 1.6, 1.6); }
  }
  // blush and freckles
  if (P.f || P.mouth === 'manic') {
    g.fillStyle = 'rgba(255,110,140,0.35)';
    for (const x of [72, 128]) { g.beginPath(); g.ellipse(x, 128, 9, 4.5, 0, 0, Math.PI * 2); g.fill(); }
  }
  if (P.acc.includes('freckles')) {
    g.fillStyle = 'rgba(150,80,50,0.7)';
    for (const [x, y] of [[66, 124], [72, 128], [78, 124], [122, 124], [128, 128], [134, 124], [70, 132], [130, 132]]) { g.beginPath(); g.arc(x, y, 1.3, 0, Math.PI * 2); g.fill(); }
  }

  // eyes and brows
  const eyeL = 'open', eyeR = crit ? 'fierce' : hurt ? 'squint' : 'open';
  drawEye(g, 78, 110, P, -1, crit ? 'fierce' : eyeL);
  drawEye(g, 122, 110, P, 1, eyeR);
  for (const side of [-1, 1]) {
    const x = 100 + side * 22;
    const inner = crit ? 6 : hurt ? -5 : -1, outer = crit ? -3 : hurt ? 2 : -2;   // + is lower
    pInk(g, crit ? 4.4 : 3.6, () => { g.moveTo(x - side * 12, 89 + inner); g.quadraticCurveTo(x, 83 + Math.min(inner, outer), x + side * 13, 89 + outer); });
  }
  // nose
  pInk(g, 2, () => { g.moveTo(101, 118); g.lineTo(97, 126); g.lineTo(101, 127); });
  drawMouth(g, P, mood);

  // marks of battle
  if (P.acc.includes('scar')) pInk(g, 2, () => { g.moveTo(112, 82); g.lineTo(130, 102); g.moveTo(116, 88); g.lineTo(120, 86); g.moveTo(122, 94); g.lineTo(126, 92); });
  if (P.acc.includes('scar2')) pInk(g, 2, () => { g.moveTo(84, 118); g.lineTo(112, 130); });
  if (P.acc.includes('bolt')) { pPoly(g, [124, 118, 132, 118, 128, 125, 134, 125, 122, 138, 126, 128, 120, 128]); g.fillStyle = '#ffd60a'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = P_INK; g.stroke(); }
  if (hurt) {
    g.fillStyle = 'rgba(110,40,140,0.32)'; g.beginPath(); g.ellipse(130, 126, 9, 6, -0.3, 0, Math.PI * 2); g.fill();
    sweat(g, 150, 80, 1);
    pInk(g, 1.5, () => { g.moveTo(66, 136); g.lineTo(74, 132); g.moveTo(68, 140); g.lineTo(75, 137); });
  }
  if (crit) {
    g.fillStyle = 'rgba(40,30,40,0.25)';
    for (const [x, y, r] of [[64, 120, 10], [140, 140, 8], [90, 150, 6]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#c8102e'; g.lineWidth = 3.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(70, 72); g.quadraticCurveTo(66, 92, 70, 104); g.stroke();
    g.fillStyle = '#c8102e'; g.beginPath(); g.arc(70, 106, 2.6, 0, Math.PI * 2); g.fill();
    sweat(g, 44, 96, 0.8);
  }

  // front hair
  const front = HAIR_FRONT[P.style];
  front(g, P, hairDark);

  // accessories
  for (const a of P.acc) if (ACCESSORY[a]) ACCESSORY[a](g, P, crit);
  if (P.acc.includes('bandaid') || (crit && !P.acc.includes('bandage'))) bandaid(g, crit && !P.acc.includes('bandaid') ? 128 : 100, crit && !P.acc.includes('bandaid') ? 134 : 116);
}

function sweat(g, x, y, s) {
  g.beginPath(); g.moveTo(x, y - 9 * s); g.quadraticCurveTo(x + 7 * s, y + 4 * s, x, y + 6 * s); g.quadraticCurveTo(x - 7 * s, y + 4 * s, x, y - 9 * s);
  g.fillStyle = '#9ad7ff'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = P_INK; g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 1.5 * s, y + 1 * s, 1.4 * s, 0, Math.PI * 2); g.fill();
}
function bandaid(g, x, y) {
  g.save(); g.translate(x, y); g.rotate(-0.3);
  g.fillStyle = '#f2c38f'; g.beginPath(); g.rect(-11, -4, 22, 8); g.fill(); g.lineWidth = 1.5; g.strokeStyle = P_INK; g.stroke();
  g.fillStyle = '#e0a874'; g.fillRect(-4, -3, 8, 6);
  g.restore();
}

// anime eye: white, big glossy iris, slit-ish pupil, two highlights, heavy upper lash
function drawEye(g, x, y, P, side, state) {
  const k = state === 'squint' ? 0.32 : state === 'fierce' ? 0.72 : 1;
  const ry = (P.f ? 12 : 10) * k, rx = 13.5;
  g.save();
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = '#fffaf0'; g.fill();
  g.clip();
  const ir = state === 'fierce' ? 7 : 8.6;
  g.fillStyle = P.eye; g.beginPath(); g.ellipse(x + side * 1, y + 1, ir, 11.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = pShade(P.eye, 0.45); g.beginPath(); g.ellipse(x + side * 1, y + 6, ir * 0.7, 4, 0, 0, Math.PI * 2); g.fill();   // glossy lower iris
  g.fillStyle = 'rgba(20,16,31,0.4)'; g.fillRect(x - 12, y - 14, 24, 7);
  g.fillStyle = P_INK; g.beginPath(); g.ellipse(x + side * 1, y + 1, state === 'fierce' ? 2.2 : 3.8, 5.8, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x - 3, y - 3.5, 3.2, 2.6, -0.4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x + 3.5, y + 4.5, 1.4, 0, Math.PI * 2); g.fill();
  g.restore();
  // upper lash line and lower lid
  pInk(g, P.f ? 4.6 : 3.8, () => { g.moveTo(x - rx - 1.5, y + 2); g.quadraticCurveTo(x, y - ry * 1.5, x + rx + 1.5, y - 1); });
  if (P.f) pInk(g, 3.2, () => { const ox = x + side * (rx + 1); g.moveTo(ox, y - 1); g.lineTo(ox + side * 6, y - 7); });
  pInk(g, 1.5, () => { g.moveTo(x - 8, y + ry + 1); g.quadraticCurveTo(x, y + ry + 2.5, x + 8, y + ry + 1); });
}

function drawMouth(g, P, mood) {
  const y = 140;
  const ink = (lw, fn) => pInk(g, lw, fn);
  if (mood === 'crit') {                      // gritted teeth
    g.beginPath(); g.moveTo(86, y - 4); g.quadraticCurveTo(100, y - 7, 114, y - 4); g.lineTo(112, y + 5); g.quadraticCurveTo(100, y + 8, 88, y + 5); g.closePath();
    g.fillStyle = '#fffaf0'; g.fill(); g.lineWidth = 2.4; g.strokeStyle = P_INK; g.stroke();
    ink(1.3, () => { g.moveTo(87, y + 0.5); g.lineTo(113, y + 0.5); for (const x of [93, 100, 107]) { g.moveTo(x, y - 5); g.lineTo(x, y + 6); } });
    return;
  }
  if (mood === 'hurt') {                      // pained grimace
    g.beginPath(); g.moveTo(90, y); g.quadraticCurveTo(100, y - 4, 110, y + 1); g.quadraticCurveTo(100, y + 7, 90, y);
    g.fillStyle = '#5a1020'; g.fill(); g.lineWidth = 2.2; g.strokeStyle = P_INK; g.stroke();
    return;
  }
  switch (P.mouth) {
    case 'grin': case 'manic': {
      const w = P.mouth === 'manic' ? 17 : 12, d = P.mouth === 'manic' ? 13 : 9;
      g.beginPath(); g.moveTo(100 - w, y - 3); g.quadraticCurveTo(100, y + 1, 100 + w, y - 3); g.quadraticCurveTo(100, y + d * 1.4, 100 - w, y - 3); g.closePath();
      g.fillStyle = '#7a1830'; g.fill();
      g.save(); g.clip(); g.fillStyle = '#fffaf0'; g.fillRect(80, y - 6, 40, 6);
      if (P.mouth === 'manic') { g.fillStyle = '#ff7a9a'; g.beginPath(); g.ellipse(103, y + d * 0.9, 7, 5, 0, 0, Math.PI * 2); g.fill(); }
      g.restore();
      g.lineWidth = 2.4; g.strokeStyle = P_INK; g.stroke();
      break;
    }
    case 'smirk': ink(2.6, () => { g.moveTo(90, y + 1); g.quadraticCurveTo(102, y + 4, 112, y - 4); }); break;
    case 'flat': ink(2.6, () => { g.moveTo(92, y + 1); g.quadraticCurveTo(100, y, 108, y + 1); }); break;
    default: ink(2.6, () => { g.moveTo(91, y - 1); g.quadraticCurveTo(100, y + 5, 109, y - 1); });
  }
}

// --------------------------------------------------------------------------
// Hair. Back layers sit behind the head; front layers are a cap + bangs.
// --------------------------------------------------------------------------
function hairShine(g, P, x, y, w) {
  g.save(); g.globalAlpha = 0.5; g.strokeStyle = pShade(P.hair, 0.55); g.lineWidth = 3.5;
  g.beginPath(); g.arc(x, y + 40, w, Math.PI * 1.22, Math.PI * 1.5); g.stroke();
  g.restore();
}
function cap(g, P, edge, top) {
  const t = top === undefined ? 18 : top;
  pCel(g, () => {
    g.beginPath(); g.moveTo(48, 104); g.lineTo(45, 62); g.bezierCurveTo(50, t, 150, t, 155, 62); g.lineTo(152, 104);
    for (let i = 0; i < edge.length; i += 2) g.lineTo(edge[i], edge[i + 1]);
    g.closePath();
  }, P.hair, 3, 116);
  hairShine(g, P, 98, 26, 34);
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
    g.fillStyle = pShade(P.hair, -0.45); g.globalAlpha = 0.55;
    g.beginPath(); g.moveTo(50, 100); g.lineTo(47, 64); g.quadraticCurveTo(56, 42, 80, 34); g.lineTo(86, 60); g.closePath(); g.fill(); g.globalAlpha = 1;
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
