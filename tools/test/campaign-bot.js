const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 400, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + require('path').resolve(__dirname, '../../www/index.html')); await pg.waitForTimeout(400);
  const ship = process.argv[2] || 'vesper', pickMode = process.argv[3] || 'smart';
  const r = await pg.evaluate(([ship, pickMode, nStages]) => {
    const log = []; META.unlocked = 5; META.ships = Object.keys(SHIPS); META.ship = ship; if (pickMode === 'max') { META.shipLv[ship] = { dmg: 10, rate: 10, hull: 3, magnet: 5, handling: 5, xp: 5 }; } startGame(1); S.intro = 0;
    const pickBest = () => {           // prefer weapon upgrades/new weapons, like a real player chasing damage
      const ch = S.choices || [];
      let bi = 0, bs = -1;
      ch.forEach((c, i) => { const dmgP = ['power', 'multi', 'rapid', 'crit', 'velocity'].includes(c.id); const sc = c.kind === 'ult' ? 9 : dmgP ? 6 : c.kind === 'wup' && c.id === META.ship ? 5.5 : c.kind === 'wnew' ? 5 : c.kind === 'wup' ? 4 : c.kind === 'pnew' ? 3 : c.kind === 'pup' ? 2 : 0; if (sc > bs) { bs = sc; bi = i; } });
      choose(pickMode === 'first' ? 0 : bi);
    };
    for (let st = 1; st <= nStages; st++) {
      const born = {};
      for (let i = 0; i < 60 * 60 * 14; i++) {
        S.p.invuln = 1e9;
        const boss = S.enemies.find(e => e.boss && !e.dead && e.mode > 0);
        let tx = W / 2, ty = H * 0.72;
        if (boss) { tx = boss.x; ty = Math.min(H * 0.8, boss.y + 220); }
        else { let best = 1e9; for (const o of S.orbs) { const d = Math.abs(o.x - S.p.x) + Math.abs(o.y - S.p.y); if (d < best && o.y > 100) { best = d; tx = o.x; ty = Math.max(o.y, H * 0.45); } } }
        S.p.x += Math.sign(tx - S.p.x) * Math.min(Math.abs(tx - S.p.x), 5); S.p.y += Math.sign(ty - S.p.y) * Math.min(Math.abs(ty - S.p.y), 5);
        if (S.ult && S.ult.cd <= 0 && boss) activateUlt();
        STARBURN.step(1 / 60, 1);
        while (S.state === 'levelup') pickBest();
        for (const e of S.enemies) if (e.boss && e.mode > 0 && !born[e.type]) born[e.type] = { t: S.t, e };
        for (const k in born) if (born[k].e.dead && !born[k].done) { born[k].done = S.t - born[k].t; }
        if (S.victoryT || S.state === 'won') break;
      }
      const fights = Object.entries(born).map(([k, v]) => `${k}:${v.done ? v.done.toFixed(1) : 'alive'}s/${Math.round(v.e.maxHp)}`);
      log.push({ st, lv: S.level, kills: S.kills, drops: JSON.stringify(S.dropMade), got: JSON.stringify(S.dropLog), ult: S.ult && S.ult.id + S.ult.lv, w: Object.keys(S.weapons).map(k => k + S.weapons[k].lvl).join(','), fights: fights.join(' ') });
      for (let i = 0; i < 400 && S.state !== 'won'; i++) STARBURN.step(1 / 60, 1);
      if (st < 5) { if (S.state !== 'won') break; nextStage(); S.intro = 0; }
    }
    return log;
  }, [ship, pickMode, +process.env.STAGES || 5]);
  for (const l of r) console.log(JSON.stringify(l));
  console.log(errs);
  await b.close();
})();
