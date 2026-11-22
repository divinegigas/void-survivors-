# Void Survivors: handoff

Read this first, then `DESIGN.md` (the full design with every number). This file is about **where things
stand, how the code is organised, how we work, and what's next**.

## 1. What it is

An Android phone game (portrait, touch). A vertical on-rails space shooter like the classic 19xx arcade games
(always firing, enemies from the top, a little bullet hell) crossed with survivor-style roguelites (enemies drop
XP gems, level-ups offer 3 cards: upgrade something or get something new). Pop-art comic, cel-shaded look; a
horror-bug hive as the enemy; 12 anime-style pilots (late-90s cel look, placeholders: final pilot art will come
from another tool later); Persona-style slanted menus; original synthesized music. Everything is original.

## 2. The owner

- Not a programmer. Explain things plainly: what changed, how to try it, what to test. Walk through anything they
  must do themselves step by step.
- Plays on an Android phone (APK from GitHub Releases) and in the web playtest link. Builds in small steps and
  tweaks a lot; likes "pomp and celebration" (flashy unlocks, Persona-style motion).
- Wants a sense of progression on every run, win or lose.

## 3. Where things live

| What | Where |
|---|---|
| This game (Android) | GitHub `divinegigas/void-survivors-` (note the trailing dash), branch `main` |
| Phone app | Every push to `main` runs `.github/workflows/android.yml` → release tag `latest`, file `void-survivors.apk`. Installs over the old one (fixed debug keystore `android/app/starburn-debug.keystore`, password `android`), keeps progress. |
| Web playtest link | https://claude.ai/artifact/RtuHZ4ZisPKiVYfjpiqe5B (an Artifact; publish `artifact.html` with `files` mapping `game.js`, `audio.js`, `pilots.js`, `art.js` from `www/`; read the artifact first in a new session, then publish with its `url`) |
| 3D PC spin-off | GitHub `divinegigas/void-survivors-3d` (Godot 4, separate session; kickoff prompt in `PROMPT-3D.md`) |
| Old copy | `divinegigas/getsome` branch `claude/android-vertical-shooter-tsf1vp`, folder `shooter/` (backup only; don't develop there) |

## 4. Code map (all plain JavaScript, no build step)

Load order: `game.js` → `audio.js` → `pilots.js` → `art.js` (classic scripts sharing top-level names; cross-file
calls happen only at runtime).

- **`www/game.js`** (rules): `CFG` tuning block at the top (every gameplay number lives here, with comments),
  weapons (`WEAPONS`, 13), ultimates (`ULTS`, 6, with perks), passives (`PASSIVES`, 12), ships (`SHIPS`, 12),
  Hangar upgrades (`HANGAR`, 10), save data (`META`, localStorage key `starburn.meta.v1`), stages (`STAGES[1..5]`
  plus `STAGES[6]` = secret Boss Rush), small enemies (`ENEMY` roles + `FOE` per-stage looks), boss brains
  (`BOSS_BRAIN`), level-up cards (`buildChoices`, `choiceInfo`, `choose`), the main update, ship reveals
  (`revealPilot`), the reveal queue (`startReveal`/`nextReveal`/`endReveal`), music tracks (`TRACKS`), settings
  helpers, input. Test hook: `window.STARBURN` (`step(dt, n)` fast-forwards).
- **`www/audio.js`**: Web Audio synth (no sound files). Instruments, drum `GROOVES`, 15 songs (`SONGS`:
  `level1..5`, `level1b..5c`), sound effects (`SFX`), music ducking, volume prefs (`PREF.musicVol/sfxVol/vibe`).
- **`www/pilots.js`**: the 12 pilots (names, quotes, shouts, looks), drawn in code and cached (`pilotSprite`).
- **`www/art.js`**: all drawing and menus. Stage themes, cel-shading helpers (`celBuild`, `oval`, ink outlines,
  white enemy rim pass), every creature drawer (`CREATURE`), HUD, level-up cards, title, Hangar + ship wheel,
  stage select, settings overlay, results, ultimate cut-in and effects, ship and track reveal cinematics, the
  main loop.
- `artifact.html`: the web wrapper (Google Fonts for Bangers / Comic Neue). `www/index.html` uses bundled OFL
  fonts in `www/fonts`. `tools/make_icon.py` makes the icon. `tools/test/`: headless test scripts (see its README).

## 5. How the game works now (short version; details in DESIGN.md)

- **A run is a 5-stage campaign**, 7 minutes per stage: 3 mini-bosses (1:45, 3:30, 5:15), then the final boss.
  The loadout carries over; each stage adds +1 weapon and +1 passive slot (2+2 → 6+6). Starting on a later stage
  gives a head start (8 level-ups per skipped stage). Each stage has its own enemies, its own 3 mini-bosses, its
  own final boss (bigger, 3 phases), its own look and music.
- **Difficulty:** enemy health +45% of base per minute, more per stage; boss health doubled, mini-bosses ×1.25 more,
  and every boss scales with your firepower (`bossPowerScale 0.6`) so maxed ships don't melt bosses.
- **Cards:** coin flip between upgrading and something new; tiers common/uncommon/rare (4:2:1). Level caps grow by
  stage (5/8/11/14/17); above 5 weapons overcharge. Rapid Fire 1.5× as common; Multishot is the rarest card
  (3 levels, +1 projectile for every weapon). Secret pity: failed runs in a row make rares likelier.
- **XP:** half-rate gems; levels 1–5 are cheaper (×0.5…0.9).
- **Ultimate:** chosen at level 10, fired by double-tap, with a 1.8 s Persona-style cut-in and a big impact
  (flash, shockwaves, slow-mo, layered sound). Every 10th level after, the cards are ultimate upgrades (Amplify,
  Quick Charge, or one of 2 unique perks). Secret 2 s invincibility after firing.
- **Safety:** 1.5 s blinking invincibility after a level-up pick and after unpausing.
- **Hangar:** per-ship upgrades (costs ×3). The Hangar starts with only Vesper; **each run that beats at least one
  boss unlocks the next ship** (cheapest first) with a "NEW PILOT APPROACHING → UNLOCKED!" cinematic. Common ships
  need a stage 1 boss, uncommon a stage 2 boss, rare a stage 3 boss. New ships stay silhouettes until bought.
- **Secret Boss Rush:** beat stage 5 at full health → "SECRET STAGE: BOSS RUSH!" (and stage "??" on stage
  select): all 20 bosses, one per minute, each with its stage's music and sky. Win → "LEGEND!".
- **Music:** 3 original tracks per stage; the 2nd unlocks after 10 plays of that stage, the 3rd after 20, with a
  "NEW TRACK INCOMING" record-and-equalizer reveal that plays the song. Pick tracks in Settings → STAGE MUSIC.
- **Settings** (title and pause screens): music and sound sliders, vibration, stage music, Reset Progress (an
  "ARE YOU SURE?" screen, two taps to erase; keeps sound settings).
- **HUD:** XP bar on top; level top left with loadout slots under it; clock and stage progress top centre; credits
  and pause top right; big pilot portrait bottom left; big hearts along the bottom; ultimate button bottom right.
- **Results screen:** credits banked, a "SPEND IT: N SHIP UPGRADES READY ›" box that jumps to the Hangar upgrades,
  new-ship notices and hints ("BEAT A STAGE 2 BOSS TO UNLOCK UNCOMMON SHIPS").

## 6. How we work

1. Make the change in `www/*.js` (small, targeted edits; keep numbers in `CFG`).
2. Check syntax: `node --check www/game.js` (and the other files).
3. Test headless with Playwright (Chromium is preinstalled; `require('playwright')`): drive the game through
   `STARBURN` and global functions, take screenshots and look at them. See `tools/test/`. For balance run
   `node tools/test/campaign-bot.js vesper max` (and other ships). For music run `tools/test/render-music.js`.
4. Update `DESIGN.md` when a rule or number changes.
5. Commit on `main` with a plain-English message (what changed for the player), then push. GitHub builds the APK.
6. Republish the web playtest link (Artifact `publish` with `url` and the `files` mapping).
7. Tell the owner: what changed, where to try it, what to test, and any balance worries, in plain words.

Rules: original art, music, names and characters only (no copying existing games or soundtracks); SIL OFL fonts
only; no personal details in the repo.

## 7. Open threads and ideas

- **Prizes for clearing stages 4 and 5** (the owner wants to brainstorm). Ideas so far: alternate pilot outfits or
  ship paint jobs (with the same reveal), new ultimates (a 7th and 8th), a starting perk or extra reroll,
  "prestige" ship variants, a hard mode, a bestiary / codex of every enemy and boss.
- **Balance to watch:** final and mini-boss fight lengths with the firepower scaling (`bossPowerScale`), the
  20-minute Boss Rush length (`rush.gap`), level caps and overcharge strength, Multishot rarity, the early XP curve.
- **Pilot art** is a placeholder; real portraits will be made in another app and swapped in later.
- **Name:** the repo is `void-survivors-` with a trailing dash; it can be renamed on GitHub (links redirect).
