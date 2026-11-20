# Starburn (working title)

A vertical space shooter for Android: your ship fires on its own, enemies come down from the top
and shoot back, and every kill drops green XP crystals you have to fly over. Level up and pick an
upgrade. Kills pay credits to spend in the Hangar between runs.

This is separate from Neon Cable 42. It lives in its own folder and its own branch.

## Files
- `www/game.js` is the game rules. The **TUNING** block at the top holds the numbers to tweak.
- `www/art.js` is everything you see: the pop-art comic style, menus, and the main loop.
- `www/index.html` + `www/game.css` are the page the Android app will load.
- `artifact.html` is the same game wrapped for the shareable claude.ai link.

## Install it on your Android phone
Every time the game changes on this branch, GitHub builds the app by itself
(see `.github/workflows/starburn-android.yml`).
1. On your phone, open the repository on GitHub → **Releases** → **Starburn (latest build)**.
2. Tap **starburn.apk** to download it, then open the download.
3. The first time, Android asks to allow installs from your browser: allow it, then tap **Install**.
4. Later builds install right over the old one and keep your credits and ships.

## Android project
- `capacitor.config.json` + `android/`: the Android wrapper (Capacitor 6). It shows `www/` full screen,
  portrait only, keeps the screen awake and allows vibration.
- `android/app/starburn-debug.keystore`: one fixed signing key so updates install over each other.
  It's a debug key (password `android`), fine for your own phone, not for the Play Store.
- `tools/make_icon.py` draws the app icon; `icon-512.png` is the large version.
- Fonts are bundled in `www/fonts/` (SIL Open Font License) so the app works offline.

## Try it on a computer
Open `www/index.html` in a browser. Arrow keys or WASD move, 1/2/3 pick an upgrade, E fires the ultimate, P pauses.

## Roadmap
1. **Core loop** (done): auto-fire, enemies, XP crystals, level-ups.
2. **Loadout + bounties** (done): 4 weapon + 4 passive slots, 12 weapons, 12 passives, level-up cards
   that are a coin flip between "upgrade" and "new system", credits per kill, capital-ship bosses,
   and the Hangar shop for permanent upgrades between runs (saved on the phone).
3. **Ships + rarity** (done): 12 ships (one per weapon, unlocked in the Hangar by tier), common /
   uncommon / rare tiers (green / purple / gold) for weapons and passives, Deflector Shield in the Hangar.
   Ships have no basic cannon: each fires only its signature weapon (20% faster cooldown on its own
   ship) plus whatever it picks up.
4. **Ultimates + pop art** (done): Autocannon as a common card, level-10 ultimate choice
   (6 ultimates, double-tap to fire), comic-book cel-shaded look with halftone dots and POW! bursts.
5. **Level 1: the hive** (done): VESPER fires straight ahead (Autocannon), per-ship stats and Hangar
   upgrades (hull, power, fire rate, pickup range, handling), ships 20% bigger, organic insect-hive
   enemies, a 15-minute level with 3 mini-bosses (3:45, 7:30, 11:15) and the Hive Queen at 15:00.
6. **Feel pass**: tune difficulty, sound effects and music, screen effects.
7. **Real Android app** (done): Capacitor wrapper, APK built by GitHub Actions and posted to Releases.
8. **More content**: more levels,: more bosses and enemy patterns, weapon evolutions.
