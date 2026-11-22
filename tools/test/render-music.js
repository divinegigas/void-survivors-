const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + require('path').resolve(__dirname, '../../www/index.html')); await pg.waitForTimeout(400);
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['level1','level1b','level1c','level2','level2b','level2c','level3','level3b','level3c','level4','level4b','level4c','level5','level5b','level5c','menu'];
  for (const id of ids) {
    const r = await pg.evaluate(async ([id, secs]) => {
      const oc = new OfflineAudioContext(2, 44100 * secs, 44100);
      AC = oc; for (const k in AUD) delete AUD[k]; PREF.musicVol = 1; PREF.sfxVol = 1; buildGraph();
      const song = SONGS[id](); MUS.song = song; MUS.intense = false;
      AUD.song.gain.setValueAtTime(song.gain || 1, 0);
      let t = 0.05, bar = 0, step = 0;
      while (t < secs - 0.5) { const bb = song.bars[bar], sp = 60 / (bb.bpm || song.bpm) / 4; playStep(bb, step, t, sp); t += sp; if (++step === 16) { step = 0; if (++bar >= song.bars.length) bar = song.loop; } }
      const buf = await oc.startRendering(), d = buf.getChannelData(0);
      let pk = 0, rms = 0; for (let i = 0; i < d.length; i++) { pk = Math.max(pk, Math.abs(d[i])); rms += d[i] * d[i]; }
      // loop length in seconds
      let L = 0; song.bars.forEach(bb => L += 16 * 60 / (bb.bpm || song.bpm) / 4);
      const pcm = new Int16Array(d.length * 2), d2 = buf.getChannelData(1);
      for (let i = 0; i < d.length; i++) { pcm[2 * i] = Math.max(-1, Math.min(1, d[i])) * 32767; pcm[2 * i + 1] = Math.max(-1, Math.min(1, d2[i])) * 32767; }
      return { peak: +pk.toFixed(3), rms: +Math.sqrt(rms / d.length).toFixed(4), len: Math.round(L), pcm: Array.from(new Uint8Array(pcm.buffer)) };
    }, [id, 40]);
    const hdr = Buffer.alloc(44), data = Buffer.from(r.pcm);
    hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
    hdr.writeUInt32LE(44100, 24); hdr.writeUInt32LE(44100 * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
    fs.mkdirSync('tracks', { recursive: true }); fs.writeFileSync(`tracks/${id}.wav`, Buffer.concat([hdr, data]));
    console.log(id.padEnd(8), 'peak', r.peak, 'rms', r.rms, 'song length', r.len + 's');
  }
  console.log(errs); await b.close();
})();
