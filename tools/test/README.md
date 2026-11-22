# Test scripts (headless Chromium via Playwright)

Run from the repository root with Node. Playwright and Chromium must be available
(`require('playwright')`). They drive the real game through `window.STARBURN` and the global functions.

- `node tools/test/campaign-bot.js [ship] [smart|max|first]`: a bot plays the campaign (invincible, sits under
  bosses, collects gems) and prints, per stage, pilot level, loadout and how long each boss took.
  `max` gives the ship a maxed Hangar and prefers damage passives. `STAGES=2` limits how many stages it plays.
- `node tools/test/render-music.js [songId ...]`: renders songs offline (40 s each) to `tracks/*.wav` and prints
  peak / RMS loudness and loop length. Keep new songs' RMS close to the stage's first track (adjust `gain`).
- `node tools/test/flow-smoke.js .`: fresh save → ship reveal after a run → flawless finale unlocks the secret
  Boss Rush → full rush to victory; saves screenshots (`r_*.png`) to the folder given.

The bot is invincible and doesn't dodge, so it measures firepower, not difficulty.
