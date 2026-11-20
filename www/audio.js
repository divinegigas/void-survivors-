// STARBURN audio: music and sound effects, all synthesized live with Web Audio.
// No sound files. Every riff and melody here is original.
//
// Level 1 track "Hive Surf": E-minor surf rock (tremolo-picked lead drenched in
// spring reverb, thumping toms) crossed with chugging 90s-shooter metal, plus a
// few bars of dubstep wobble. 168 BPM, about a minute long, then it loops.
'use strict';

let AC = null;                       // the AudioContext (created on the first tap)
const AUD = {};                      // shared nodes
const PREF = META.audio || (META.audio = { music: true, sfx: true });
const MUSIC_VOL = 0.3, SFX_VOL = 0.85;     // the mix: music a touch under the effects

const mf = m => 440 * Math.pow(2, (m - 69) / 12);     // MIDI note -> Hz

function audioUnlock() {
  if (AC) { if (AC.state === 'suspended') AC.resume().catch(() => {}); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try { AC = new Ctx(); } catch (e) { AC = null; return; }
  buildGraph();
}

function shaperCurve(k) {
  const n = 2048, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
  return c;
}
function node(type, opts) {
  const n = type === 'gain' ? AC.createGain() : type === 'filter' ? AC.createBiquadFilter()
          : type === 'shaper' ? AC.createWaveShaper() : null;
  if (opts) for (const k in opts) {
    if (n[k] instanceof AudioParam) n[k].value = opts[k]; else n[k] = opts[k];
  }
  return n;
}
function chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[0]; }

function buildGraph() {
  const master = AC.createDynamicsCompressor();
  master.threshold.value = -16; master.ratio.value = 4; master.attack.value = 0.005; master.release.value = 0.2;
  master.connect(AC.destination);
  AUD.music = node('gain', { gain: PREF.music ? MUSIC_VOL : 0 }); AUD.music.connect(master);
  AUD.sfx = node('gain', { gain: PREF.sfx ? SFX_VOL : 0 }); AUD.sfx.connect(master);
  AUD.song = node('gain', { gain: 1 }); AUD.song.connect(AUD.music);

  // spring-ish reverb: a short burst of decaying, slightly "boingy" noise
  const len = Math.floor(AC.sampleRate * 2.2), ir = AC.createBuffer(2, len, AC.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / AC.sampleRate;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 2.6) * (1 + 0.35 * Math.sin(t * 2 * Math.PI * 7));
    }
  }
  AUD.verb = AC.createConvolver(); AUD.verb.buffer = ir;
  AUD.verbIn = node('gain', { gain: 1 });
  chain(AUD.verbIn, AUD.verb, node('gain', { gain: 0.32 }), AUD.song);

  // white noise for drums and effects
  const nb = AC.createBuffer(1, AC.sampleRate, AC.sampleRate), nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  AUD.noise = nb;

  // guitar amps: open chords and palm mutes, both heavily driven
  const amp = (lp, vol) => {
    const input = node('gain', { gain: 1 });
    chain(input, node('shaper', { curve: shaperCurve(60), oversample: '2x' }), node('filter', { type: 'highpass', frequency: 90 }),
          node('filter', { type: 'lowpass', frequency: lp, Q: 0.7 }), node('gain', { gain: vol }), AUD.song);
    return input;
  };
  AUD.gtrOpen = amp(3200, 0.2);
  AUD.gtrMute = amp(1100, 0.26);
  // surf lead: light drive, lots of reverb
  AUD.lead = node('gain', { gain: 1 });
  const leadOut = node('gain', { gain: 0.13 });
  chain(AUD.lead, node('shaper', { curve: shaperCurve(6) }), node('filter', { type: 'lowpass', frequency: 4200 }), leadOut, AUD.song);
  const leadSend = node('gain', { gain: 0.8 }); leadOut.connect(leadSend); leadSend.connect(AUD.verbIn);
  AUD.bass = node('gain', { gain: 1 });
  chain(AUD.bass, node('filter', { type: 'lowpass', frequency: 650 }), node('gain', { gain: 0.32 }), AUD.song);
  AUD.wob = node('gain', { gain: 1 });
  chain(AUD.wob, node('shaper', { curve: shaperCurve(5) }), node('gain', { gain: 0.3 }), AUD.song);
  AUD.drums = node('gain', { gain: 0.6 }); AUD.drums.connect(AUD.song);
  AUD.drumVerb = node('gain', { gain: 0.35 }); AUD.drumVerb.connect(AUD.verbIn);
  AUD.sfxNodes = AUD.sfx;
}

// ============================================================================
// Instruments
// ============================================================================
function osc(type, f, t, dur, dest, detune) {
  const o = AC.createOscillator();
  o.type = type; o.frequency.value = f;
  if (detune) o.detune.value = detune;
  o.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  return o;
}
function noise(t, dur, dest, offset) {
  const s = AC.createBufferSource();
  s.buffer = AUD.noise; s.connect(dest);
  s.start(t, offset === undefined ? Math.random() * 0.8 : offset); s.stop(t + dur + 0.02);
  return s;
}
function env(dest, t, peak, attack, decay, hold) {   // gain envelope node
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  if (hold) g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.setTargetAtTime(0.0001, t + attack + (hold || 0), decay);
  g.connect(dest);
  return g;
}

// power chord (root + fifth + octave), palm-muted or ringing
function gtr(t, midi, dur, mute) {
  const len = mute ? Math.min(dur, 0.1) : dur;
  const g = env(mute ? AUD.gtrMute : AUD.gtrOpen, t, 1, 0.004, mute ? 0.035 : 0.12, mute ? 0.02 : len * 0.8);
  for (const [iv, det] of [[0, -7], [0, 6], [7, 0], [12, 4]]) osc('sawtooth', mf(midi + iv), t, len + 0.3, g, det);
}
// tremolo-picked surf lead: one note, re-picked every 32nd
function lead(t, midi, dur, trem) {
  const g = AC.createGain(); g.connect(AUD.lead);
  g.gain.setValueAtTime(0.0001, t);
  for (let tt = t; tt < t + dur - 0.01; tt += trem) {
    g.gain.setValueAtTime(1, tt);
    g.gain.exponentialRampToValueAtTime(0.2, tt + trem * 0.92);
  }
  g.gain.setTargetAtTime(0.0001, t + dur, 0.05);
  const f = mf(midi), vib = AC.createOscillator(), vg = AC.createGain();
  vib.frequency.value = 5.5; vg.gain.value = f * 0.006; vib.connect(vg);
  for (const [type, k] of [['sawtooth', 1], ['square', 1.003]]) { const o = osc(type, f * k, t, dur + 0.2, g); vg.connect(o.frequency); }
  vib.start(t); vib.stop(t + dur + 0.25);
}
function bass(t, midi, dur) {
  const g = env(AUD.bass, t, 1, 0.005, 0.08, dur * 0.7);
  osc('sawtooth', mf(midi), t, dur + 0.3, g);
  osc('sine', mf(midi), t, dur + 0.3, g);
}
// dubstep wobble: a filter swept by an LFO at `rate` wobbles per second
function wobble(t, midi, dur, rate) {
  const f = mf(midi);
  const filt = node('filter', { type: 'lowpass', frequency: 380, Q: 9 }); filt.connect(AUD.wob);
  const lfo = AC.createOscillator(), lg = AC.createGain();
  lfo.type = 'triangle'; lfo.frequency.value = rate; lg.gain.value = 1400;
  lfo.connect(lg); lg.connect(filt.frequency);
  lfo.start(t); lfo.stop(t + dur + 0.1);
  const g = env(filt, t, 1, 0.01, 0.05, dur * 0.9);
  osc('sawtooth', f, t, dur + 0.2, g, -8); osc('sawtooth', f, t, dur + 0.2, g, 8); osc('square', f / 2, t, dur + 0.2, g);
  const sub = env(AUD.song, t, 0.35, 0.01, 0.05, dur * 0.9);
  osc('sine', f, t, dur + 0.2, sub);
}

// drums
function kick(t, v) {
  const g = env(AUD.drums, t, v, 0.002, 0.09);
  const o = osc('sine', 150, t, 0.4, g);
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
}
function snare(t, v) {
  const f = node('filter', { type: 'bandpass', frequency: 1900, Q: 0.8 });
  const g = env(AUD.drums, t, 0.7 * v, 0.002, 0.06); f.connect(g); f.connect(AUD.drumVerb);
  noise(t, 0.25, f);
  const tg = env(AUD.drums, t, 0.35 * v, 0.002, 0.03);
  const o = osc('triangle', 200, t, 0.12, tg); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
}
function hat(t, v, open) {
  const f = node('filter', { type: 'highpass', frequency: 7500 });
  f.connect(env(AUD.drums, t, 0.22 * v, 0.001, open ? 0.08 : 0.015));
  noise(t, open ? 0.3 : 0.06, f);
}
function tom(t, v, f0) {
  const g = env(AUD.drums, t, 0.7 * v, 0.002, 0.11); g.connect(AUD.drumVerb);
  const o = osc('sine', f0, t, 0.4, g); o.frequency.exponentialRampToValueAtTime(f0 * 0.6, t + 0.25);
}
function crash(t, v) {
  const f = node('filter', { type: 'highpass', frequency: 4000 });
  f.connect(env(AUD.drums, t, 0.28 * v, 0.002, 0.5));
  noise(t, 1.6, f);
}

// ============================================================================
// The song: patterns and arrangement
// ============================================================================
// Drum grooves, 16 steps per bar. Upper case = accent.
const GROOVES = {
  metal:  { k: 'x..x..x.x..x..x.', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.' },
  metal2: { k: 'xxxxxxxxxxxxxxxx', s: '....X.......X...', h: 'x...x...x...x...' },
  surf:   { k: 'x.......x.x.....', s: '....X.......X...', t: 'x.x.x.x.x.x.x.x.', h: '..x...x...x...x.' },
  fill:   { k: 'x.......x.......', s: '....X...x.xxXXXX', t: 'xx..xx..........' },
  dub:    { k: 'X.........x.....', s: '........X.......', h: 'x.xxx.x.x.xxx.xx', c: 'x...............' },
  build:  { k: 'x...x...x...x...', s: 'x...x...x.x.xxXX' },
  intro:  { t: 'x...x...x...xxxx', c: 'x...............' },
};

// Metal riffs in E: [step, length in steps, MIDI root, palm-muted?]
const E = 40;
const RIFF = {
  A1: [[0,1,E,1],[1,1,E,1],[2,1,E,1],[3,2,43,0],[5,1,E,1],[6,1,E,1],[7,1,46,0],[8,1,E,1],[9,1,E,1],[10,1,E,1],[11,2,45,0],[13,1,E,1],[14,1,43,0],[15,1,42,0]],
  A2: [[0,1,E,1],[1,1,E,1],[2,1,E,1],[3,3,48,0],[6,1,E,1],[7,1,E,1],[8,2,47,0],[10,1,E,1],[11,1,E,1],[12,2,46,0],[14,1,45,0],[15,1,43,0]],
  A3: [[0,1,E,1],[1,1,E,1],[2,1,E,1],[3,2,43,0],[5,1,E,1],[6,1,E,1],[7,1,46,0],[8,1,E,1],[9,1,E,1],[10,1,E,1],[11,2,45,0],[13,1,E,1],[14,1,47,0],[15,1,48,0]],
  A4: [[0,3,E,0],[4,1,E,1],[5,3,41,0],[8,1,E,1],[9,1,E,1],[10,1,E,1],[11,1,E,1],[12,1,43,0],[13,1,42,0],[14,1,41,0],[15,1,E,0]],
};
// Surf lead melodies (E Phrygian dominant): [step, length, MIDI]
const LEAD_B1 = [
  [[0,4,76],[4,2,74],[6,2,72],[8,6,71],[14,2,72]],
  [[0,4,71],[4,2,68],[6,2,69],[8,8,71]],
  [[0,4,72],[4,4,71],[8,2,69],[10,2,68],[12,4,65]],
  [[0,8,64],[8,4,65],[12,4,68]],
  [[0,4,69],[4,4,71],[8,4,72],[12,4,74]],
  [[0,6,76],[6,2,77],[8,8,76]],
  [[0,4,74],[4,4,72],[8,4,71],[12,2,69],[14,2,68]],
  [[0,16,64]],
];
const LEAD_B2 = LEAD_B1.slice(0, 4).concat([
  [[0,2,76],[2,2,77],[4,4,76],[8,4,74],[12,4,72]],
  [[0,4,71],[4,4,72],[8,8,74]],
  [[0,4,76],[4,4,74],[8,4,72],[12,4,71]],
  [[0,12,76],[12,2,74],[14,2,71]],
]);
const SURF_ROOTS = [40, 40, 41, 40, 45, 48, 47, 40];
// Dubstep wobbles: [step, length, MIDI, wobbles per beat]
const WOB = [
  [[0,8,28,2],[8,8,28,4]],
  [[0,6,28,6],[6,2,31,2],[8,8,28,3]],
  [[0,8,31,2],[8,4,34,4],[12,4,33,8]],
  [[0,12,29,4],[12,4,28,1]],
];

function songLevel1() {
  const bars = [];
  const metalBar = (r, drums) => ({ drums, gtr: RIFF[r], bass: RIFF[r].map(([s, l, m]) => [s, l, m - 12]) });
  const surfBar = (i, mel, drums) => {
    const root = SURF_ROOTS[i];
    const g = [[0, 2, root, 0]]; for (let s = 2; s < 16; s += 2) g.push([s, 1, root, 1]);
    return { drums, gtr: g, lead: mel[i], bass: [[0, 4, root - 12], [4, 4, root - 5], [8, 4, root], [12, 4, root - 5]] };
  };
  // intro: toms and a ringing chord, then a lead pickup
  bars.push({ drums: 'intro', gtr: [[0, 16, E, 0]] });
  bars.push({ drums: 'intro', lead: [[8, 2, 71], [10, 2, 72], [12, 4, 74]] });
  const loop = bars.length;
  ['A1', 'A2', 'A1', 'A3', 'A1', 'A2', 'A1', 'A4'].forEach((r, i) => bars.push(metalBar(r, i === 7 ? 'fill' : 'metal')));
  for (let i = 0; i < 8; i++) bars.push(surfBar(i, LEAD_B1, i === 7 ? 'fill' : 'surf'));
  ['A1', 'A2', 'A1', 'A3', 'A1', 'A2', 'A1', 'A4'].forEach((r, i) => bars.push(metalBar(r, i >= 4 ? (i === 7 ? 'fill' : 'metal2') : 'metal')));
  WOB.forEach((w, i) => bars.push({ drums: i === 3 ? 'build' : 'dub', wob: w, gtr: i % 2 === 0 ? [[0, 4, E, 0]] : null }));
  for (let i = 0; i < 8; i++) bars.push(surfBar(i, LEAD_B2, i === 7 ? 'fill' : 'surf'));
  WOB.forEach((w, i) => bars.push({ drums: i === 3 ? 'build' : 'dub', wob: w, gtr: i % 2 === 0 ? [[0, 4, E, 0]] : null }));
  return { bpm: 168, bars, loop };
}
const SONGS = { level1: songLevel1 };

// ============================================================================
// Sequencer: schedules a little ahead of time so the beat stays tight
// ============================================================================
const MUS = { on: false, song: null, bar: 0, step: 0, t: 0, timer: null, intense: false };

function musicStart(id) {
  audioUnlock();
  if (!AC) return;
  MUS.song = SONGS[id]();
  MUS.bar = 0; MUS.step = 0; MUS.t = AC.currentTime + 0.12; MUS.on = true;
  AUD.song.gain.cancelScheduledValues(AC.currentTime);
  AUD.song.gain.setValueAtTime(1, AC.currentTime);
  if (!MUS.timer) MUS.timer = setInterval(musicTick, 25);
}
function musicStop() {
  if (!AC || !MUS.on) return;
  MUS.on = false;
  AUD.song.gain.setTargetAtTime(0.0001, AC.currentTime, 0.12);
}

function musicTick() {
  if (!MUS.on || !AC || AC.state !== 'running') return;
  const sp = 60 / MUS.song.bpm / 4;
  if (MUS.t < AC.currentTime - 0.05) MUS.t = AC.currentTime + 0.05;   // after a pause, don't catch up
  while (MUS.t < AC.currentTime + 0.12) {
    playStep(MUS.song.bars[MUS.bar], MUS.step, MUS.t, sp);
    MUS.t += sp;
    if (++MUS.step === 16) {
      MUS.step = 0;
      if (++MUS.bar >= MUS.song.bars.length) MUS.bar = MUS.song.loop;
    }
  }
}

function playStep(bar, step, t, sp) {
  const gr = GROOVES[bar.drums];
  if (gr) {
    const hit = (row) => row && row[step] !== '.' ? (row[step] === row[step].toUpperCase() && row[step] !== 'x' ? 1.15 : 0.85) : 0;
    let v;
    if ((v = hit(gr.k))) kick(t, bar.drums === 'metal2' ? 0.6 : v);
    if ((v = hit(gr.s))) snare(t, v);
    if ((v = hit(gr.h))) hat(t, v, bar.drums === 'dub' && step % 4 === 2);
    if ((v = hit(gr.t))) tom(t, v, bar.drums === 'fill' || bar.drums === 'intro' ? 180 - step * 6 : 95);
    if ((v = hit(gr.c))) crash(t, 1);
    // during boss fights the drummer switches to double kick
    if (MUS.intense && bar.drums !== 'dub' && bar.drums !== 'metal2' && !hit(gr.k)) kick(t, 0.45);
  }
  for (const [s, l, m, mute] of bar.gtr || []) if (s === step) gtr(t, m, l * sp, mute);
  for (const [s, l, m] of bar.bass || []) if (s === step) bass(t, m, l * sp * 0.95);
  for (const [s, l, m] of bar.lead || []) if (s === step) lead(t, m, l * sp, sp / 2);
  for (const [s, l, m, r] of bar.wob || []) if (s === step) wobble(t, m, l * sp, (MUS.song.bpm / 60) * r);
}

// ============================================================================
// Sound effects: short and quiet, with limits so busy moments don't turn to mush
// ============================================================================
const SFX_GAP = { kill: 0.045, gem: 0.03, hit: 0.2, default: 0.07 };
const sfxLast = {};
let gemCombo = 0, gemT = 0;

function sfx(name, arg) {
  if (!AC || !PREF.sfx || AC.state !== 'running') return;
  const t = AC.currentTime, gap = SFX_GAP[name] || SFX_GAP.default;
  if (t - (sfxLast[name] || -1) < gap) return;
  sfxLast[name] = t;
  const fn = SFX[name];
  if (fn) fn(t, arg);
}
function blip(t, type, f0, f1, dur, vol, dest) {
  const g = env(dest || AUD.sfx, t, vol, 0.003, dur / 3);
  const o = osc(type, f0, t, dur, g);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
}
function hiss(t, type, freq, dur, vol, q) {
  const f = node('filter', { type, frequency: freq, Q: q || 1 });
  f.connect(env(AUD.sfx, t, vol, 0.003, dur / 3));
  noise(t, dur, f);
  return f;
}
const SFX = {
  // weapons (one sound per volley)
  cannon:  (t) => { hiss(t, 'highpass', 3000, 0.03, 0.05); blip(t, 'square', 700, 350, 0.035, 0.022); },
  spread:  (t) => blip(t, 'triangle', 1300, 600, 0.06, 0.04),
  wing:    (t) => hiss(t, 'highpass', 4000, 0.025, 0.035),
  rockets: (t) => { const f = hiss(t, 'bandpass', 700, 0.28, 0.06, 2); f.frequency.exponentialRampToValueAtTime(2600, t + 0.25); },
  laser:   (t) => blip(t, 'sawtooth', 260, 900, 0.18, 0.05),
  nova:    (t) => { blip(t, 'sine', 130, 40, 0.45, 0.22); hiss(t, 'lowpass', 500, 0.35, 0.12); },
  chain:   (t) => { for (const d of [0, 0.03, 0.06]) hiss(t + d, 'highpass', 2500, 0.03, 0.06); blip(t, 'square', 1900, 300, 0.1, 0.025); },
  rail:    (t) => { blip(t, 'sawtooth', 2400, 180, 0.2, 0.055); hiss(t, 'highpass', 5000, 0.08, 0.05); },
  flak:    (t) => hiss(t, 'lowpass', 650, 0.12, 0.13),
  disc:    (t) => blip(t, 'sine', 1700, 1500, 0.2, 0.04),
  wave:    (t) => { blip(t, 'sine', 320, 140, 0.25, 0.06); hiss(t, 'bandpass', 500, 0.25, 0.04); },
  // hits and pickups
  kill:    (t, r) => {
    const big = (r || 14) > 20, p = 0.85 + Math.random() * 0.3;
    hiss(t, 'bandpass', (big ? 450 : 800) * p, big ? 0.22 : 0.12, big ? 0.16 : 0.09, 0.9);
    blip(t, 'sine', (big ? 160 : 260) * p, 50, big ? 0.2 : 0.12, big ? 0.14 : 0.08);
  },
  bossDie: (t) => { hiss(t, 'lowpass', 350, 1.4, 0.45); blip(t, 'sine', 90, 28, 1.2, 0.4); crashFx(t); },
  gem:     (t) => {
    gemCombo = t - gemT < 0.35 ? Math.min(gemCombo + 1, 12) : 0; gemT = t;
    blip(t, 'sine', 990 * Math.pow(2, gemCombo / 12), 0, 0.06, 0.016);
  },
  levelup: (t) => levelUpFanfare(t),
  pick:    (t, tier) => cardPick(t, tier),
  cutin:   (t) => cutinStinger(t),
  hit:     (t) => { hiss(t, 'lowpass', 420, 0.25, 0.3); blip(t, 'square', 140, 55, 0.2, 0.08); },
  shield:  (t) => blip(t, 'sine', 1100, 2600, 0.15, 0.07),
  ult:     (t) => { const f = hiss(t, 'bandpass', 300, 0.6, 0.12, 1.5); f.frequency.exponentialRampToValueAtTime(4000, t + 0.5);
                    [64, 71, 76].forEach(m => blip(t + 0.05, 'sawtooth', mf(m), 0, 0.5, 0.035)); },
  warning: (t) => { for (let i = 0; i < 4; i++) blip(t + i * 0.36, 'square', i % 2 ? 330 : 440, 0, 0.3, 0.05); },
  victory: (t) => [64, 68, 71, 76, 80, 83, 88].forEach((m, i) => blip(t + i * 0.09, 'triangle', mf(m), 0, 0.4, 0.07)),
  gameover:(t) => [64, 63, 62, 52].forEach((m, i) => blip(t + i * 0.22, 'sawtooth', mf(m), 0, 0.35, 0.05)),
  click:   (t) => blip(t, 'square', 1500, 1200, 0.025, 0.03),
};
// LEVEL UP: whoosh riser -> sparkling run up the scale -> big shimmering chord + bell + thump
function levelUpFanfare(t) {
  const w = hiss(t, 'bandpass', 350, 0.4, 0.12, 2.5); w.frequency.exponentialRampToValueAtTime(7000, t + 0.32);
  [76, 80, 83, 85, 88, 92, 95, 97].forEach((m, i) => blip(t + 0.04 + i * 0.038, 'triangle', mf(m), 0, 0.14, 0.075));
  const t2 = t + 0.36;
  const filt = node('filter', { type: 'lowpass', frequency: 500, Q: 2 });
  filt.frequency.setValueAtTime(500, t2); filt.frequency.exponentialRampToValueAtTime(6000, t2 + 0.25);
  const g = env(AUD.sfx, t2, 0.07, 0.02, 0.35, 0.25); filt.connect(g);
  for (const m of [64, 68, 71, 75, 78]) { osc('sawtooth', mf(m), t2, 1.6, filt, -6); osc('sawtooth', mf(m), t2, 1.6, filt, 6); }
  const bell = env(AUD.sfx, t2, 0.09, 0.002, 0.4);
  osc('sine', mf(88), t2, 1.6, bell); osc('sine', mf(88) * 2.76, t2, 0.6, env(AUD.sfx, t2, 0.03, 0.002, 0.12));
  blip(t2, 'sine', 130, 50, 0.3, 0.22);
  const sh = node('filter', { type: 'highpass', frequency: 8000 }); sh.connect(env(AUD.sfx, t2, 0.05, 0.05, 0.3)); noise(t2, 1.0, sh);
}
// CARD PICKED: a crisp "ka-ching", plus more sparkle the rarer the card
function cardPick(t, tier) {
  blip(t, 'square', mf(83), 0, 0.07, 0.05);
  blip(t + 0.06, 'square', mf(88), 0, 0.25, 0.06);
  blip(t, 'sine', 180, 60, 0.15, 0.15);
  const extra = { uncommon: 3, rare: 6, ult: 9 }[tier] || 0;
  for (let i = 0; i < extra; i++) blip(t + 0.1 + i * 0.045, 'triangle', mf(88 + [3, 7, 10, 12, 15, 19, 22, 24, 27][i]), 0, 0.12, 0.05);
  if (tier === 'rare' || tier === 'ult') blip(t + 0.12, 'sine', mf(100), 0, 0.8, 0.05);
}
// ULTIMATE CUT-IN: a rising whoosh, a huge impact, then a heroic chord stab
function cutinStinger(t) {
  const w = hiss(t, 'bandpass', 250, 0.3, 0.16, 2); w.frequency.exponentialRampToValueAtTime(5000, t + 0.28);
  const ti = t + 0.3;
  blip(ti, 'sine', 150, 38, 0.6, 0.5);
  hiss(ti, 'lowpass', 900, 0.5, 0.35);
  crashFx(ti);
  const filt = node('filter', { type: 'lowpass', frequency: 900, Q: 3 });
  filt.frequency.setValueAtTime(900, ti); filt.frequency.exponentialRampToValueAtTime(5000, ti + 0.3);
  const shaper = node('shaper', { curve: shaperCurve(30) });
  const g = env(AUD.sfx, ti, 0.1, 0.005, 0.5, 0.5);
  chain(filt, shaper, g);
  for (const m of [40, 47, 52, 59, 64]) { osc('sawtooth', mf(m), ti, 1.3, filt, -7); osc('sawtooth', mf(m), ti, 1.3, filt, 7); }
  [76, 83, 88].forEach((m, i) => blip(ti + 0.45 + i * 0.07, 'triangle', mf(m), 0, 0.4, 0.06));
}
function crashFx(t) { const f = node('filter', { type: 'highpass', frequency: 3000 }); f.connect(env(AUD.sfx, t, 0.15, 0.002, 0.6)); noise(t, 1.5, f); }

// ============================================================================
// Called every frame: music volume (ducked when paused), boss intensity, laser hum
// ============================================================================
let lastMusicLevel = -1, laserHum = null;
function audioUpdate() {
  if (!AC || !S) return;
  const level = !PREF.music ? 0 : S.state === 'paused' ? 0.12 : S.state === 'cutin' ? 0.2 : S.state === 'levelup' ? 0.6 : 1;
  if (level !== lastMusicLevel) { lastMusicLevel = level; AUD.music.gain.setTargetAtTime(MUSIC_VOL * level, AC.currentTime, 0.15); }
  AUD.sfx.gain.setTargetAtTime(PREF.sfx ? SFX_VOL : 0, AC.currentTime, 0.05);
  MUS.intense = S.state === 'play' && S.enemies.some(e => e.boss && !e.dead);
  // a soft hum while the Pulse Laser is firing
  const want = PREF.sfx && S.laser && S.state === 'play';
  if (want && !laserHum) {
    const g = AC.createGain(); g.gain.value = 0.0001; g.connect(AUD.sfx);
    g.gain.setTargetAtTime(0.035, AC.currentTime, 0.03);
    const f = node('filter', { type: 'lowpass', frequency: 900 }); f.connect(g);
    const o1 = AC.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 110; o1.connect(f); o1.start();
    const o2 = AC.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 165.5; o2.connect(f); o2.start();
    laserHum = { g, o1, o2 };
  } else if (!want && laserHum) {
    const h = laserHum; laserHum = null;
    h.g.gain.setTargetAtTime(0.0001, AC.currentTime, 0.04);
    h.o1.stop(AC.currentTime + 0.3); h.o2.stop(AC.currentTime + 0.3);
  }
}

function toggleMusic() { PREF.music = !PREF.music; saveMeta(); lastMusicLevel = -1; }
function toggleSfx() { PREF.sfx = !PREF.sfx; saveMeta(); }

// pause audio when the app is in the background
document.addEventListener('visibilitychange', () => {
  if (!AC) return;
  if (document.hidden) AC.suspend().catch(() => {}); else AC.resume().catch(() => {});
});
