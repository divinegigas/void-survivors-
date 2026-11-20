# Starburn (working title)

A vertical space shooter for Android: your ship fires on its own, enemies come down from the top
and shoot back, and every kill drops green XP crystals you have to fly over. Level up and pick an
upgrade. Kills pay credits to spend in the Hangar between runs.

This is separate from Neon Cable 42. It lives in its own folder and its own branch.

## Files
- `www/game.js` is the whole game. The **TUNING** block at the top holds the numbers to tweak.
- `www/index.html` + `www/game.css` are the page the Android app will load (step 3).
- `artifact.html` is the same game wrapped for the shareable claude.ai link.

## Try it on a computer
Open `www/index.html` in a browser. Arrow keys or WASD move, 1/2/3 pick an upgrade, P pauses.

## Roadmap
1. **Core loop** (done): auto-fire, enemies, XP crystals, level-ups.
2. **Loadout + bounties** (done): 4 weapon + 4 passive slots, 12 weapons, 12 passives, level-up cards
   that are a coin flip between "upgrade" and "new system", credits per kill, capital-ship bosses,
   and the Hangar shop for permanent upgrades between runs (saved on the phone).
3. **Feel pass**: tune difficulty, sound effects and music, screen effects.
4. **Real Android app**: wrap `www/` with Capacitor and build the APK on GitHub (no Android Studio needed).
5. **More content**: more bosses and enemy patterns, weapon evolutions.
