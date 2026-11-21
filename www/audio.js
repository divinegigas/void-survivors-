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
  // a big dark hall for the ultimates (on the effects bus, so it isn't ducked with the music)
  const hl = Math.floor(AC.sampleRate * 2.6), hir = AC.createBuffer(2, hl, AC.sampleRate);
  for (let c = 0; c < 2; c++) { const d = hir.getChannelData(c); for (let i = 0; i < hl; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / hl, 3.2); }
  AUD.hall = AC.createConvolver(); AUD.hall.buffer = hir;
  AUD.hallIn = node('gain', { gain: 1 });
  chain(AUD.hallIn, AUD.hall, node('gain', { gain: 0.5 }), AUD.sfx);

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
  // tempo-synced echo (set per song)
  AUD.delay = AC.createDelay(1.5); AUD.delay.delayTime.value = 0.27;
  AUD.delayIn = node('gain', { gain: 1 });
  const fb = node('gain', { gain: 0.38 }), dlp = node('filter', { type: 'lowpass', frequency: 2600 });
  chain(AUD.delayIn, AUD.delay, dlp, fb, AUD.delay); dlp.connect(node('gain', { gain: 0.6 })).connect(AUD.song);
  // phaser for the psychedelic guitar: four sweeping all-pass filters
  AUD.phaser = node('gain', { gain: 1 });
  let last = AUD.phaser; const lfo = AC.createOscillator(); lfo.frequency.value = 0.35; lfo.start();
  for (let i = 0; i < 4; i++) {
    const ap = node('filter', { type: 'allpass', frequency: 600 + i * 300, Q: 0.7 });
    const lg = AC.createGain(); lg.gain.value = 450 + i * 150; lfo.connect(lg); lg.connect(ap.frequency);
    last.connect(ap); last = ap;
  }
  const phOut = node('gain', { gain: 0.16 }); last.connect(phOut); AUD.phaser.connect(phOut); phOut.connect(AUD.song); phOut.connect(AUD.verbIn);
  // bit-crusher for glitch hits
  const steps = 10, cc = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; cc[i] = Math.round(x * steps) / steps; }
  AUD.crush = node('gain', { gain: 1 });
  chain(AUD.crush, node('shaper', { curve: cc }), node('filter', { type: 'highpass', frequency: 200 }), node('gain', { gain: 0.32 }), AUD.song);
  // organ and choir pads
  AUD.organ = node('gain', { gain: 1 });
  const organTrem = node('gain', { gain: 0.09 });
  const lfo2 = AC.createOscillator(), lg2 = AC.createGain(); lfo2.frequency.value = 6; lg2.gain.value = 0.03; lfo2.connect(lg2); lg2.connect(organTrem.gain); lfo2.start();
  chain(AUD.organ, node('shaper', { curve: shaperCurve(2) }), organTrem, AUD.song); organTrem.connect(AUD.verbIn);
  AUD.pad = node('gain', { gain: 1 });
  const padOut = node('gain', { gain: 0.07 });
  chain(AUD.pad, node('filter', { type: 'lowpass', frequency: 1800 }), padOut, AUD.song); padOut.connect(AUD.verbIn);
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

// --- instruments for stages 2-5 ---
function synthBass(t, midi, dur) {          // electro bass: detuned saws + sub, a filter blip, drenched in reverb
  const f = mf(midi), filt = node('filter', { type: 'lowpass', frequency: 300, Q: 6 });
  filt.frequency.setValueAtTime(2400, t); filt.frequency.exponentialRampToValueAtTime(300, t + Math.min(dur, 0.25));
  const g = env(AUD.song, t, 0.28, 0.004, 0.06, dur * 0.7); filt.connect(g);
  const send = node('gain', { gain: 0.5 }); g.connect(send); send.connect(AUD.verbIn);
  osc('sawtooth', f, t, dur + 0.2, filt, -10); osc('sawtooth', f, t, dur + 0.2, filt, 10); osc('sine', f / 2, t, dur + 0.2, g);
}
function arp(t, midi, dur) {                // bright square pluck with an echo
  const g = env(AUD.song, t, 0.06, 0.002, Math.min(0.12, dur * 0.6));
  const d = node('gain', { gain: 0.7 }); g.connect(d); d.connect(AUD.delayIn);
  osc('square', mf(midi), t, dur + 0.15, g);
}
function synthLead(t, midi, dur, brass) {   // soaring saw lead (brass-like for the finale)
  const f = mf(midi), filt = node('filter', { type: 'lowpass', frequency: brass ? 900 : 2600, Q: 1 });
  if (brass) { filt.frequency.setValueAtTime(700, t); filt.frequency.linearRampToValueAtTime(3200, t + 0.08); filt.frequency.setTargetAtTime(1600, t + 0.1, 0.2); }
  const g = env(AUD.song, t, brass ? 0.11 : 0.09, brass ? 0.03 : 0.01, 0.12, dur * 0.85); filt.connect(g);
  const d = node('gain', { gain: 0.35 }); g.connect(d); d.connect(AUD.delayIn); g.connect(AUD.verbIn);
  const vib = AC.createOscillator(), vg = AC.createGain(); vib.frequency.value = 5.2; vg.gain.value = f * 0.008; vib.connect(vg);
  for (const det of [-8, 8]) { const o = osc('sawtooth', f, t, dur + 0.25, filt, det); vg.connect(o.frequency); }
  if (!brass) { const o = osc('square', f * 2, t, dur + 0.25, filt); vg.connect(o.frequency); }
  vib.start(t + 0.12); vib.stop(t + dur + 0.3);
}
function organ(t, notes, dur) {             // drawbar organ through a wobbling Leslie
  const g = env(AUD.organ, t, 1, 0.02, 0.15, dur * 0.9);
  for (const m of notes) for (const [mul, v] of [[0.5, 0.5], [1, 1], [2, 0.6], [3, 0.3], [4, 0.2]]) {
    const pg = AC.createGain(); pg.gain.value = v * 0.35; pg.connect(g); osc('sine', mf(m) * mul, t, dur + 0.3, pg);
  }
}
function pad(t, notes, dur) {               // airy choir pad: slow swell, detuned saws
  const g = AC.createGain(); g.connect(AUD.pad);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + Math.min(0.6, dur * 0.4)); g.gain.setValueAtTime(1, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
  for (const m of notes) { osc('sawtooth', mf(m), t, dur + 0.5, g, -9); osc('sawtooth', mf(m), t, dur + 0.5, g, 9); osc('triangle', mf(m + 12), t, dur + 0.5, g); }
}
function phGtr(t, midi, dur) {              // clean-fuzz guitar through the phaser
  const g = env(AUD.phaser, t, 1, 0.003, 0.18, Math.min(dur, 0.3));
  const sh = node('shaper', { curve: shaperCurve(8) }); sh.connect(g);
  osc('sawtooth', mf(midi), t, dur + 0.4, sh); osc('triangle', mf(midi) * 2, t, dur + 0.4, sh);
}
function wahLead(t, midi, dur) {            // fuzz lead through an auto-wah that opens with each note
  const f = mf(midi), bp = node('filter', { type: 'bandpass', frequency: 450, Q: 4 });
  bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(2200, t + Math.min(0.5, dur * 0.6)); bp.frequency.exponentialRampToValueAtTime(700, t + dur);
  const g = env(AUD.song, t, 0.22, 0.01, 0.2, dur * 0.85); bp.connect(g); g.connect(AUD.verbIn);
  const sh = node('shaper', { curve: shaperCurve(40) }); sh.connect(bp);
  const o = osc('sawtooth', f, t, dur + 0.3, sh);
  o.frequency.setValueAtTime(f * 0.97, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.12);   // a little bend into the note
}
function harpsi(t, midi, dur) {             // plucky harpsichord
  const g = env(AUD.song, t, 0.07, 0.001, 0.08);
  const hp = node('filter', { type: 'highpass', frequency: 500 }); hp.connect(g); g.connect(AUD.verbIn);
  osc('sawtooth', mf(midi), t, 0.4, hp); osc('square', mf(midi + 12), t, 0.3, hp);
}
function bell(t, midi, dur) {
  const g = env(AUD.song, t, 0.1, 0.002, 0.8); g.connect(AUD.verbIn);
  osc('sine', mf(midi), t, 2.5, g); osc('sine', mf(midi) * 2.76, t, 1, env(AUD.song, t, 0.03, 0.002, 0.2));
}
function timpani(t, midi, v) {
  const g = env(AUD.drums, t, 0.9 * (v || 1), 0.003, 0.35); g.connect(AUD.drumVerb);
  const o = osc('sine', mf(midi) * 1.02, t, 1.4, g); o.frequency.exponentialRampToValueAtTime(mf(midi), t + 0.1);
  const f = node('filter', { type: 'lowpass', frequency: 600 }); f.connect(env(AUD.drums, t, 0.2, 0.002, 0.05)); noise(t, 0.1, f);
}
function orchHit(t, notes) {                // big orchestra stab
  const g = env(AUD.song, t, 0.16, 0.003, 0.12); g.connect(AUD.verbIn);
  const f = node('filter', { type: 'lowpass', frequency: 3500 }); f.connect(g);
  for (const m of notes) { osc('sawtooth', mf(m), t, 0.5, f, -6); osc('sawtooth', mf(m), t, 0.5, f, 6); }
  const nf = node('filter', { type: 'bandpass', frequency: 1200 }); nf.connect(env(AUD.song, t, 0.12, 0.002, 0.05)); noise(t, 0.2, nf);
}
function stutter(t, midi, sp) {             // glitch: a chord chopped into shrinking repeats, bit-crushed
  for (let i = 0; i < 6; i++) {
    const tt = t + i * sp * (i < 3 ? 0.5 : 0.25), g = env(AUD.crush, tt, 0.9 - i * 0.12, 0.001, 0.02);
    for (const iv of [0, 7, 12]) osc('square', mf(midi + iv), tt, 0.06, g);
  }
}
function glitchHit(t) {                     // a crunchy, crushed noise/snare hit
  const f = node('filter', { type: 'bandpass', frequency: 2400, Q: 1 }); f.connect(env(AUD.crush, t, 0.9, 0.001, 0.05)); noise(t, 0.12, f);
}
function bloop(t) {                         // underwater bubble
  const g = env(AUD.song, t, 0.06, 0.002, 0.05); g.connect(AUD.verbIn);
  const o = osc('sine', 300 + Math.random() * 500, t, 0.2, g); o.frequency.exponentialRampToValueAtTime(1400 + Math.random() * 800, t + 0.12);
}
function riser(t, dur) {
  const f = node('filter', { type: 'bandpass', frequency: 300, Q: 2 }); f.frequency.exponentialRampToValueAtTime(6000, t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.18, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
  f.connect(g); g.connect(AUD.song); noise(t, dur + 0.1, f, 0);
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
  // stage 2: speed metal
  speed:  { k: 'xxxxxxxxxxxxxxxx', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.' },
  speed2: { k: 'x.xxx.xxx.xxx.xx', s: 'X...X...X...X...', h: 'xxxxxxxxxxxxxxxx' },
  half:   { k: 'X.........x.....', s: '........X.......', h: 'x...x...x...x...', c: 'x...............' },
  warpIn: { k: '....x...x...x.x.', h: 'xxxxxxxxxxxxxxxx' },
  // stage 3: psychedelic rock
  psych:  { k: 'x......x..x.....', s: '....X.......X...', r: 'x.x.x.x.x.x.x.x.' },
  psychF: { k: 'x......x..x.....', s: '....X.......X.xx', t: '..........xx..xx', r: 'x.x.x.x.x.x.....' },
  drift:  { r: 'x...x...x...x...' },
  // stage 4: doom + glitch hop
  doom:   { k: 'X.......x.......', s: '........X.......', c: 'x...............', r: 'x...x...x...x...' },
  glitch: { k: 'X.....x...x.....', s: '....X.......X...', h: 'x.xxx.xxx.xx.xxx' },
  glitchS:{ k: 'X.....x...x.....', s: '....X.......X...', h: 'x.xxx.xxx.......', g: '............x...' },
  heartb: { k: 'X..x............' },
  // stage 5: JRPG finale
  epicIn: { t: 'x.......x.......', c: 'x...............' },
  epic:   { k: 'x..x....x.xx....', s: '....X.......X...', h: 'xxxxxxxxxxxxxxxx' },
  epicF:  { k: 'x..x....x.xx....', s: '....X.......XXXX', h: 'xxxxxxxxxxxx....', c: 'x...............' },
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
// ---------------------------------------------------------------------------
// STAGE 2 · "WARP RIDER": speed metal + reverb-drenched electro bass, 186 BPM, E minor
// ---------------------------------------------------------------------------
const GALLOP = (a, b, c, d) => [[0,1,E,1],[2,1,E,1],[3,1,E,1],[4,1,E,1],[6,1,E,1],[7,1,E,1],[8,2,a,0],[10,1,E,1],[11,1,E,1],[12,2,b,0],[14,1,c,0],[15,1,d,0]];
const CH = { Em: [64, 67, 71, 76], C: [60, 64, 67, 72], D: [62, 66, 69, 74], B: [59, 63, 66, 71], A: [57, 61, 64, 69],
             Em7: [52, 55, 59, 62], A7: [57, 61, 64, 67], G: [55, 59, 62, 67], D3: [50, 54, 57, 62], B7: [59, 63, 66, 69],
             Dm: [62, 65, 69], Bb: [58, 62, 65], Cm: [60, 64, 67], Am: [57, 61, 64], Gm: [55, 58, 62] };
function songLevel2() {
  const bars = [];
  bars.push({ drums: null, arp: { notes: CH.Em, div: 1 }, riser: [[0, 16]] });
  bars.push({ drums: 'warpIn', arp: { notes: CH.Em, div: 1 }, sbass: [[0, 2, 28], [4, 2, 40], [8, 2, 28], [12, 2, 40]] });
  const loop = bars.length;
  const riffs = [GALLOP(43, 46, 45, 43), GALLOP(43, 46, 47, 48), GALLOP(43, 46, 45, 43), GALLOP(48, 47, 46, 45)];
  for (let i = 0; i < 8; i++) {
    const g = riffs[i % 4];
    bars.push({ drums: i === 7 ? 'fill' : 'speed', gtr: g, arp: { notes: CH.Em, div: 1 },
                sbass: [0, 2, 4, 6, 8, 10, 12, 14].map((st, k) => [st, 2, k % 2 ? 40 : 28]) });
  }
  const roots = [40, 36, 38, 35, 40, 36, 38, 35], chords = [CH.Em, CH.C, CH.D, CH.B, CH.Em, CH.C, CH.D, CH.B];
  const mel = [
    [[0,4,76],[4,2,74],[6,2,71],[8,4,72],[12,4,71]], [[0,6,69],[6,2,71],[8,8,67]], [[0,4,72],[4,4,74],[8,4,76],[12,4,79]], [[0,8,78],[8,8,71]],
    [[0,4,79],[4,4,78],[8,4,76],[12,4,74]], [[0,4,72],[4,4,74],[8,8,76]], [[0,2,71],[2,2,72],[4,4,74],[8,4,72],[12,4,71]], [[0,16,64]],
  ];
  for (let i = 0; i < 8; i++) {
    const r = roots[i], g = [[0, 2, r, 0]]; for (let st = 2; st < 16; st++) g.push([st, 1, r, 1]);
    bars.push({ drums: i === 7 ? 'fill' : 'speed2', gtr: g, lead2: mel[i], arp: { notes: chords[i], div: 2 },
                sbass: [0, 2, 4, 6, 8, 10, 12, 14].map(st => [st, 2, r - 12 + (st % 4 === 2 ? 12 : 0)]) });
  }
  for (let i = 0; i < 4; i++) bars.push({ drums: 'half', bpm: 186, sbass: [[0, 12, 28], [12, 4, 31 + i]], arp: { notes: CH.Em.map(m => m + 12), div: 4 },
                                          gtr: i % 2 ? null : [[0, 8, E, 0]], riser: i === 3 ? [[0, 16]] : null });
  return { bpm: 186, bars, loop, gain: 1.35 };
}

// ---------------------------------------------------------------------------
// STAGE 3 · "ABYSSAL DRIFT": slow psychedelic rock, 92 BPM, E dorian
// ---------------------------------------------------------------------------
function songLevel3() {
  const bars = [];
  const prog = [['Em7', 40], ['Em7', 40], ['A7', 45], ['A7', 45], ['G', 43], ['D3', 38], ['Em7', 40], ['B7', 47]];
  const bassLine = r => [[0, 4, r], [6, 2, r + 7], [8, 2, r + 10], [10, 2, r + 12], [12, 2, r + 7], [14, 2, r + 5]];
  const arpLine = notes => [0, 2, 4, 6, 8, 10, 12, 14].map((st, k) => [st, 2, notes[k % notes.length] + 12]);
  bars.push({ drums: 'drift', organ: [[0, 16, CH.Em7]], bloop: [[3], [9], [13]] });
  bars.push({ drums: 'drift', organ: [[0, 16, CH.A7]], phgtr: arpLine(CH.A7), bloop: [[5], [11]] });
  const loop = bars.length;
  for (let i = 0; i < 8; i++) {
    const [c, r] = prog[i];
    bars.push({ drums: i === 7 ? 'psychF' : 'psych', organ: [[0, 16, CH[c]]], bass: bassLine(r), phgtr: arpLine(CH[c]), bloop: i % 2 ? [[7]] : null });
  }
  const wah = [
    [[0,6,71],[6,2,73],[8,8,74]], [[0,4,76],[4,4,74],[8,8,71]], [[0,8,69],[8,4,71],[12,4,73]], [[0,16,69]],
    [[0,4,67],[4,4,69],[8,4,71],[12,4,74]], [[0,8,76],[8,8,78]], [[0,4,76],[4,4,74],[8,4,73],[12,4,71]], [[0,16,64]],
  ];
  for (let i = 0; i < 8; i++) {
    const [c, r] = prog[i];
    bars.push({ drums: i === 7 ? 'psychF' : 'psych', organ: [[0, 16, CH[c]]], bass: bassLine(r), wah: wah[i] });
  }
  for (let i = 0; i < 4; i++) {
    const [c, r] = prog[i * 2];
    bars.push({ drums: 'drift', pad: [[0, 16, CH[c]]], phgtr: [[0, 4, CH[c][0] + 12], [8, 4, CH[c][2] + 12]], bass: [[0, 16, r]], bloop: [[2], [6], [10], [14]] });
  }
  return { bpm: 92, bars, loop, gain: 1.6 };
}

// ---------------------------------------------------------------------------
// STAGE 4 · "HEART OF THE BEAST": doom metal crushed into glitch hop, 100 BPM, B
// ---------------------------------------------------------------------------
function songLevel4() {
  const bars = [];
  bars.push({ drums: 'heartb', bass: [[0, 2, 23], [3, 2, 23]] });
  bars.push({ drums: 'heartb', bass: [[0, 2, 23], [3, 2, 23]], riser: [[8, 8]] });
  const loop = bars.length;
  const doomA = [[[0, 16, 35]], [[0, 8, 35], [8, 8, 38]], [[0, 16, 37]], [[0, 8, 36], [8, 4, 35], [12, 4, 34]]];
  const doomB = [[[0, 16, 35]], [[0, 8, 38], [8, 8, 37]], [[0, 8, 36], [8, 8, 35]], [[0, 16, 34]]];
  for (let i = 0; i < 8; i++) {
    const ch = (i < 4 ? doomA : doomB)[i % 4];
    bars.push({ drums: 'doom', gtr: ch.map(([st, l, m]) => [st, l, m, 0]), bass: ch.map(([st, l, m]) => [st, l, m - 12]) });
  }
  const wobs = [[[0, 8, 35, 2], [8, 8, 35, 6]], [[0, 6, 38, 3], [6, 2, 37, 8], [8, 8, 35, 4]], [[0, 8, 36, 2], [8, 4, 35, 6], [12, 4, 34, 8]], [[0, 12, 35, 4], [12, 4, 35, 1]]];
  for (let i = 0; i < 8; i++) {
    const last = i % 4 === 3;
    bars.push({ drums: last ? 'glitchS' : 'glitch', wob: wobs[i % 4], gtr: [[2, 1, 35, 0], [10, 1, 35, 0]],
                stut: last ? [[12, 47]] : i % 2 ? [[14, 47]] : null, ghit: [[7], [15]] });
  }
  for (let i = 0; i < 4; i++) {
    const ch = doomA[i];
    bars.push({ drums: i === 3 ? 'glitchS' : 'glitch', gtr: ch.map(([st, l, m]) => [st, l, m, 0]), bass: ch.map(([st, l, m]) => [st, l, m - 12]), stut: [[12, 47]], ghit: [[3], [11]] });
  }
  return { bpm: 100, bars, loop, gain: 1.55 };
}

// ---------------------------------------------------------------------------
// STAGE 5 · "SERAPH": JRPG final battle. Slow and majestic (72 BPM), then it
// erupts into the fast battle theme (160 BPM). D minor.
// ---------------------------------------------------------------------------
function songLevel5() {
  const bars = [];
  const intro = [['Dm', 50, [[0, 8, 74], [8, 8, 77]]], ['Bb', 46, [[0, 8, 76], [8, 8, 74]]], ['Gm', 43, [[0, 8, 72], [8, 8, 70]]], ['Am', 45, [[0, 16, 73]]]];
  intro.forEach(([c, r, mel], i) => bars.push({ bpm: 72, drums: 'epicIn', organ: [[0, 16, CH[c].map(m => m - 12)]], pad: [[0, 16, CH[c]]], bell: mel, timp: [[0, r - 12], [8, r - 12]] }));
  bars.push({ bpm: 72, hit: [[0, CH.Dm], [4, CH.Bb], [8, CH.Cm], [12, CH.Am]], timp: [[0, 38], [4, 38], [8, 38], [10, 38], [12, 38], [13, 38], [14, 38], [15, 38]], riser: [[8, 8]] });
  const loop = bars.length;
  const prog = [['Dm', 38], ['Bb', 34], ['Cm', 36], ['Am', 33], ['Dm', 38], ['Bb', 34], ['Gm', 31], ['Am', 33]];
  const mel = [
    [[0,4,74],[4,2,76],[6,2,77],[8,6,81],[14,2,79]], [[0,4,77],[4,4,76],[8,8,74]], [[0,4,72],[4,2,74],[6,2,76],[8,4,77],[12,4,79]], [[0,12,76],[12,2,73],[14,2,76]],
    [[0,4,81],[4,4,82],[8,4,81],[12,4,79]], [[0,4,77],[4,4,79],[8,8,81]], [[0,4,82],[4,2,81],[6,2,79],[8,4,77],[12,4,76]], [[0,8,74],[8,8,73]],
  ];
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 8; i++) {
    const [c, r] = prog[i], up = pass === 1 ? 12 : 0;
    bars.push({ bpm: 160, drums: i === 7 ? 'epicF' : 'epic', pad: i % 2 ? null : [[0, 32, CH[c]]],
                harp: { notes: CH[c].map(m => m + up), div: 1 }, brass: mel[i],
                gtr: [0, 2, 4, 6, 8, 10, 12, 14].map(st => [st, 1, r + 12, st % 8 === 0 ? 0 : 1]),
                bass: [0, 2, 4, 6, 8, 10, 12, 14].map(st => [st, 2, r + (st % 4 === 2 ? 12 : 0)]),
                hit: i === 0 ? [[0, CH[c]]] : null });
  }
  return { bpm: 160, bars, loop, gain: 1.35 };
}
const SONGS = { level1: songLevel1, level2: songLevel2, level3: songLevel3, level4: songLevel4, level5: songLevel5 };

// ============================================================================
// Sequencer: schedules a little ahead of time so the beat stays tight
// ============================================================================
const MUS = { on: false, song: null, bar: 0, step: 0, t: 0, timer: null, intense: false };

function musicStart(id) {
  audioUnlock();
  if (!AC) return;
  MUS.song = (SONGS[id] || SONGS.level1)();
  AUD.delay.delayTime.setValueAtTime((60 / MUS.song.bpm) * 0.75, AC.currentTime);   // dotted-eighth echo
  MUS.bar = 0; MUS.step = 0; MUS.t = AC.currentTime + 0.12; MUS.on = true;
  AUD.song.gain.cancelScheduledValues(AC.currentTime);
  AUD.song.gain.setValueAtTime(MUS.song.gain || 1, AC.currentTime);     // per-song level so every stage sits at the same loudness
  if (!MUS.timer) MUS.timer = setInterval(musicTick, 25);
}
function musicStop() {
  if (!AC || !MUS.on) return;
  MUS.on = false;
  AUD.song.gain.setTargetAtTime(0.0001, AC.currentTime, 0.12);
}

function musicTick() {
  if (!MUS.on || !AC || AC.state !== 'running') return;
  if (MUS.t < AC.currentTime - 0.05) MUS.t = AC.currentTime + 0.05;   // after a pause, don't catch up
  while (MUS.t < AC.currentTime + 0.12) {
    const bar = MUS.song.bars[MUS.bar], sp = 60 / (bar.bpm || MUS.song.bpm) / 4;
    playStep(bar, MUS.step, MUS.t, sp);
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
    if ((v = hit(gr.r))) hat(t, v * 0.8, true);
    if ((v = hit(gr.g))) stutterSnare(t, sp);
    // during boss fights the drummer switches to double kick
    if (MUS.intense && !['dub', 'metal2', 'speed', 'doom', 'half', 'drift', 'heartb', 'epicIn'].includes(bar.drums) && !hit(gr.k)) kick(t, 0.45);
  }
  for (const [s, l, m, mute] of bar.gtr || []) if (s === step) gtr(t, m, l * sp, mute);
  for (const [s, l, m] of bar.bass || []) if (s === step) bass(t, m, l * sp * 0.95);
  for (const [s, l, m] of bar.lead || []) if (s === step) lead(t, m, l * sp, sp / 2);
  for (const [s, l, m, r] of bar.wob || []) if (s === step) wobble(t, m, l * sp, ((bar.bpm || MUS.song.bpm) / 60) * r);
  for (const [s, l, m] of bar.sbass || []) if (s === step) synthBass(t, m, l * sp);
  for (const [s, l, m] of bar.lead2 || []) if (s === step) synthLead(t, m, l * sp);
  for (const [s, l, m] of bar.brass || []) if (s === step) synthLead(t, m, l * sp, true);
  for (const [s, l, ns] of bar.organ || []) if (s === step) organ(t, ns, l * sp);
  for (const [s, l, ns] of bar.pad || []) if (s === step) pad(t, ns, l * sp);
  for (const [s, l, m] of bar.phgtr || []) if (s === step) phGtr(t, m, l * sp);
  for (const [s, l, m] of bar.wah || []) if (s === step) wahLead(t, m, l * sp);
  for (const [s, l, m] of bar.bell || []) if (s === step) bell(t, m, l * sp);
  for (const [s, m] of bar.timp || []) if (s === step) timpani(t, m);
  for (const [s, ns] of bar.hit || []) if (s === step) orchHit(t, ns);
  for (const [s, m] of bar.stut || []) if (s === step) stutter(t, m, sp);
  for (const [s] of bar.ghit || []) if (s === step) glitchHit(t);
  for (const [s] of bar.bloop || []) if (s === step) bloop(t);
  for (const [s, l] of bar.riser || []) if (s === step) riser(t, l * sp);
  if (bar.arp && step % bar.arp.div === 0) arp(t, bar.arp.notes[(step / bar.arp.div) % bar.arp.notes.length], sp * bar.arp.div);
  if (bar.harp && step % bar.harp.div === 0) harpsi(t, bar.harp.notes[(step / bar.harp.div) % bar.harp.notes.length], sp);
}
function stutterSnare(t, sp) { for (let i = 0; i < 6; i++) snare(t + i * sp * 0.25, 0.9 - i * 0.1); }

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
  ult:     (t, id) => ultBlast(t, id),
  ultup:   (t) => ultLevelUpSting(t),
  warning: (t) => { for (let i = 0; i < 4; i++) blip(t + i * 0.36, 'square', i % 2 ? 330 : 440, 0, 0.3, 0.05); },
  victory: (t) => victoryFanfare(t),
  gameover:(t) => defeatSting(t),
  revealWarn:   (t) => { for (let i = 0; i < 3; i++) { blip(t + i * 0.2, 'square', i % 2 ? 660 : 880, 0, 0.16, 0.06); }
                         const w = hiss(t + 0.3, 'bandpass', 300, 0.8, 0.12, 3); w.frequency.exponentialRampToValueAtTime(6000, t + 1.05); },
  revealSweep:  (t) => { blip(t, 'sine', 140, 40, 0.5, 0.4); crashFx(t);
                         const f = hiss(t, 'bandpass', 3000, 0.5, 0.12, 2); f.frequency.exponentialRampToValueAtTime(400, t + 0.45); },
  revealUnlock: (t) => { cardPick(t, 'ult'); levelUpFanfare(t + 0.05); blip(t, 'sine', 110, 35, 0.6, 0.4); },
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
  const sw = node('filter', { type: 'highpass', frequency: 2500 }), sg = AC.createGain();     // reverse-cymbal swell into the hit
  sg.gain.setValueAtTime(0.0001, t); sg.gain.exponentialRampToValueAtTime(0.14, t + 0.3); sg.gain.setValueAtTime(0.0001, t + 0.31);
  sw.connect(sg); sg.connect(AUD.sfx); noise(t, 0.32, sw);
  const ti = t + 0.3;
  blip(ti, 'sine', 150, 38, 0.6, 0.5);
  const sub = env(AUD.hallIn, ti, 0.35, 0.003, 0.4); osc('sine', 55, ti, 1, sub);
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
// ULTIMATE FIRES: sub-bass drop + distorted impact + a huge power-chord stab drenched in hall
// reverb + a sparkle run, then a flavour layer for each ultimate.
function ultBlast(t, id) {
  const wet = d => { const g = node('gain', { gain: d }); g.connect(AUD.hallIn); return g; };
  // sub drop
  const sub = env(AUD.sfx, t, 0.45, 0.004, 0.5); const so = osc('sine', 120, t, 1.4, sub); so.frequency.exponentialRampToValueAtTime(26, t + 1.2);
  // impact: crushed noise burst + crash
  const imp = node('filter', { type: 'lowpass', frequency: 1800 }); const sh = node('shaper', { curve: shaperCurve(40) });
  chain(imp, sh, env(AUD.sfx, t, 0.22, 0.002, 0.18)); noise(t, 0.5, imp);
  crashFx(t); crashFx(t + 0.02);
  // power chord stab with a filter sweep (root changes per ultimate)
  const root = { nuke: 38, overdrive: 45, warp: 41, barrage: 43, phase: 46, hole: 36 }[id] || 40;
  const filt = node('filter', { type: 'lowpass', frequency: 600, Q: 4 });
  filt.frequency.setValueAtTime(600, t); filt.frequency.exponentialRampToValueAtTime(6500, t + 0.25); filt.frequency.exponentialRampToValueAtTime(900, t + 1.4);
  const g = env(AUD.sfx, t, 0.085, 0.005, 0.6, 0.35); chain(filt, node('shaper', { curve: shaperCurve(20) }), g); g.connect(wet(1.4));
  for (const m of [root, root + 7, root + 12, root + 19, root + 24]) { osc('sawtooth', mf(m), t, 1.8, filt, -9); osc('sawtooth', mf(m), t, 1.8, filt, 9); }
  // sparkle run
  [0, 4, 7, 12, 16, 19, 24, 28].forEach((k, i) => { const gg = env(AUD.sfx, t + 0.08 + i * 0.035, 0.05, 0.002, 0.12); gg.connect(wet(0.8)); osc('triangle', mf(root + 36 + k), t + 0.08 + i * 0.035, 0.3, gg); });
  // flavour
  switch (id) {
    case 'nuke': {                                  // long rolling rumble
      for (let k = 0; k < 3; k++) { const f = node('filter', { type: 'lowpass', frequency: 260 - k * 50 }); f.connect(env(AUD.sfx, t + k * 0.6, 0.3, 0.05, 0.7)); noise(t + k * 0.6, 1, f, 0); }
      blip(t + 0.15, 'sine', 70, 22, 2.2, 0.4); break;
    }
    case 'overdrive': {                             // engine scream rising
      const f = node('filter', { type: 'bandpass', frequency: 400, Q: 3 }); f.frequency.exponentialRampToValueAtTime(3500, t + 1);
      f.connect(env(AUD.sfx, t, 0.09, 0.05, 0.5, 0.6)); const o = osc('sawtooth', 90, t, 1.6, f); o.frequency.exponentialRampToValueAtTime(420, t + 1.2); break;
    }
    case 'warp': {                                  // tape-stop: everything slides down
      const gg = env(AUD.sfx, t, 0.1, 0.01, 0.5, 0.5); gg.connect(wet(1.5));
      for (const m of [64, 67, 71]) { const o = osc('square', mf(m), t, 1.5, gg); o.frequency.exponentialRampToValueAtTime(mf(m) / 6, t + 1.3); }
      for (let i = 0; i < 6; i++) blip(t + 0.2 + i * 0.18 * (1 + i * 0.25), 'sine', 1760, 0, 0.05, 0.05);   // a slowing clock tick
      break;
    }
    case 'barrage':                                 // a volley of launches
      for (let i = 0; i < 10; i++) { const f = hiss(t + 0.05 + i * 0.06, 'bandpass', 900, 0.2, 0.06, 2); f.frequency.exponentialRampToValueAtTime(3000, t + 0.25 + i * 0.06); }
      break;
    case 'phase': {                                 // shimmering phase sweep
      const gg = env(AUD.hallIn, t, 0.08, 0.05, 0.6, 0.4);
      for (const m of [76, 83, 88]) osc('sawtooth', mf(m), t, 1.4, gg, 12);
      const f = hiss(t, 'bandpass', 2000, 1.2, 0.07, 6); f.frequency.exponentialRampToValueAtTime(400, t + 1.1); break;
    }
    case 'hole': {                                  // a deep falling vortex with a wobble
      const gg = env(AUD.sfx, t, 0.22, 0.02, 0.8, 0.4); const o = osc('sine', 220, t, 2, gg); o.frequency.exponentialRampToValueAtTime(30, t + 1.8);
      const lfo = AC.createOscillator(); lfo.frequency.value = 7; const lg = AC.createGain(); lg.gain.value = 25; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + 2);
      const f = hiss(t, 'lowpass', 3000, 1.6, 0.12); f.frequency.exponentialRampToValueAtTime(120, t + 1.5); break;
    }
  }
}
// ULTIMATE LEVELS UP: a brass-ish fanfare climbing in fourths, then a shimmering chord
function ultLevelUpSting(t) {
  levelUpFanfare(t);
  [52, 57, 62, 67].forEach((m, i) => {
    const f = node('filter', { type: 'lowpass', frequency: 1800 }); f.connect(env(AUD.sfx, t + 0.5 + i * 0.12, 0.07, 0.01, 0.2));
    osc('sawtooth', mf(m), t + 0.5 + i * 0.12, 0.5, f, -6); osc('sawtooth', mf(m + 12), t + 0.5 + i * 0.12, 0.5, f, 6);
  });
  blip(t + 0.98, 'sine', 110, 35, 0.7, 0.45); crashFx(t + 0.98);
}
// RUN OVER: a heavy hit, a falling minor line and a low drone fading out
function defeatSting(t) {
  blip(t, 'sine', 120, 30, 0.9, 0.45); hiss(t, 'lowpass', 500, 0.6, 0.25);
  const f = node('filter', { type: 'lowpass', frequency: 1400 }); f.connect(env(AUD.hallIn, t, 0.08, 0.01, 0.6, 0.6));
  [64, 63, 60, 55, 52].forEach((m, i) => { osc('sawtooth', mf(m), t + 0.15 + i * 0.2, 0.3, f, -7); osc('sawtooth', mf(m - 12), t + 0.15 + i * 0.2, 0.3, f, 7); });
  const d = env(AUD.sfx, t + 1.1, 0.12, 0.2, 0.8, 0.5); osc('triangle', mf(40), t + 1.1, 2, d); osc('triangle', mf(47), t + 1.1, 2, d);
}
// STAGE CLEAR: drum hit, a rising run and a big major chord with a bell on top
function victoryFanfare(t) {
  blip(t, 'sine', 130, 45, 0.4, 0.4); crashFx(t);
  [64, 68, 71, 76, 80, 83, 88].forEach((m, i) => blip(t + i * 0.07, 'triangle', mf(m), 0, 0.3, 0.08));
  const t2 = t + 0.55, f = node('filter', { type: 'lowpass', frequency: 3500 }); const g = env(AUD.sfx, t2, 0.08, 0.02, 0.6, 0.5); f.connect(g); g.connect(AUD.hallIn);
  for (const m of [52, 59, 64, 68, 71, 76]) { osc('sawtooth', mf(m), t2, 1.8, f, -6); osc('sawtooth', mf(m), t2, 1.8, f, 6); }
  const bell = env(AUD.hallIn, t2, 0.12, 0.002, 0.5); osc('sine', mf(88), t2, 1.6, bell);
  blip(t2, 'sine', 110, 40, 0.5, 0.35); crashFx(t2);
}
function crashFx(t) { const f = node('filter', { type: 'highpass', frequency: 3000 }); f.connect(env(AUD.sfx, t, 0.15, 0.002, 0.6)); noise(t, 1.5, f); }

// ============================================================================
// Called every frame: music volume (ducked when paused), boss intensity, laser hum
// ============================================================================
let lastMusicLevel = -1, laserHum = null;
function audioUpdate() {
  if (!AC || !S) return;
  const level = !PREF.music ? 0 : S.state === 'paused' ? 0.12 : S.state === 'cutin' ? 0.2 : S.state === 'levelup' ? 0.6 : S.impact > 0 || (S.ultFx && S.ultFx.t < 0.8) ? 0.4 : 1;
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
