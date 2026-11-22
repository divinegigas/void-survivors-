const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 400, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.addInitScript(() => localStorage.clear());
  await pg.goto('file://' + require('path').resolve(__dirname, '../../www/index.html')); await pg.waitForTimeout(400);
  const sp = process.argv[2];
  // 1) a fresh save: only vesper revealed; a 40s run reveals the next pilot
  console.log(await pg.evaluate(() => {
    const r = { order: SHIP_ORDER.join(','), revealed0: META.revealed };
    startGame(1); S.intro = 0; S.p.invuln = 1e9; STARBURN.step(1 / 60, 60 * 40); while (S.state === 'levelup') choose(0);
    gameOver(false); r.newPilot = S.newPilot; r.revealed1 = META.revealed;
    return JSON.stringify(r);
  }));
  await pg.waitForTimeout(1500); await pg.screenshot({ path: sp + '/r_over.png' });
  await pg.evaluate(() => { openHangar(); });
  await pg.waitForTimeout(300);
  await pg.evaluate(() => { wheelSpin(1); }); await pg.waitForTimeout(700); await pg.screenshot({ path: sp + '/r_wheel1.png' });
  await pg.evaluate(() => { wheelSpin(1); }); await pg.waitForTimeout(700); await pg.screenshot({ path: sp + '/r_wheel2.png' });
  // 2) flawless finale -> secret
  console.log(await pg.evaluate(() => {
    META.unlocked = 5; startGame(5); while (S.state === 'levelup') choose(0); S.intro = 0;
    S.t = CFG.level.length - 1; S.p.invuln = 1e9; S.ev = 3;
    STARBURN.step(1 / 60, 90); while (S.state === 'levelup') choose(0);
    const boss = S.enemies.find(e => e.final); boss.hp = 1; hitEnemy(boss, 999);
    STARBURN.step(1 / 60, 200);
    return JSON.stringify({ state: S.state, secret: META.secret, found: S.secretFound, open: S.secretOpen });
  }));
  await pg.waitForTimeout(1500); await pg.screenshot({ path: sp + '/r_finale.png' });
  // 3) the rush
  console.log(await pg.evaluate(() => {
    nextStage(); const out = { stage: S.stage, rush: isRush(), len: stageLen(), events: LEVEL_EVENTS().length };
    const seen = [], music = [], dead = [];
    for (let i = 0; i < 60 * 60 * 21 && S.state !== 'won'; i++) {
      S.p.invuln = 1e9;
      STARBURN.step(1 / 60, 1); while (S.state === 'levelup') choose(0);
      if (S.state === 'cutin') continue;
      for (const e of S.enemies) if (e.boss && !e.seen) { e.seen = 1; seen.push(e.type + (e.final ? '*' : '')); music.push(S.rushStage); }
      // kill each boss 20s after it arrives (but leave the last one alive for a while)
      for (const e of S.enemies) if (e.boss && !e.dead && e.age > 20) { hitEnemy(e, 1e9); dead.push(e.type); }
    }
    Object.assign(out, { seen: seen.join(' '), stages: music.join(''), state: S.state, t: Math.round(S.t), cleared6: META.cleared && META.cleared[6] });
    return JSON.stringify(out);
  }));
  await pg.waitForTimeout(1500); await pg.screenshot({ path: sp + '/r_legend.png' });
  await pg.evaluate(() => openStages()); await pg.waitForTimeout(1200); await pg.screenshot({ path: sp + '/r_stages.png' });
  console.log('errors', errs);
  await b.close();
})();
