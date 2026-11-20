# Kickoff prompt for the Void Survivors 3D session

Start a new Claude Code session on the **void-survivors-3d** repository and paste everything below the line.

---

I'm making **Void Survivors 3D**, a PC version of my Android game *Void Survivors*, built in
**Godot 4**. It keeps the exact same systems but turns the top-down shooter into an **on-rails 3D space
shooter**, in the spirit of the classic 90s rail shooters: the ship flies forward along a path and I steer
within the screen while it fires automatically.

**Read `DESIGN.md` in this repo first.** It's the full design: every weapon, passive, ship, pilot,
ultimate, Hangar upgrade, the five-stage campaign with carry-over, every boss pattern, the difficulty
scaling and the art and music direction, with real numbers. §14 covers the 3D adaptation. The
original Android game lives in my **void-survivors** repository (`www/game.js` is the rules,
`www/art.js` the drawing, `www/audio.js` the synthesized music, `www/pilots.js` the pilots). Use it
whenever you need an exact formula. Keep the systems and numbers faithful unless I say otherwise.

**About me:** I'm not a programmer. Walk me through everything like it's my first Godot project: exact
steps, what to click, what I should see. I'm on **Fedora Linux** (KDE). Build in small steps so we can
playtest and tweak as we go.

**Rules:**
- Everything must be original: no assets, characters, music, names or level designs copied from
  existing games. Generate art, effects and audio in code or as original assets, and use only fonts
  under the SIL Open Font License (the Android game uses Bangers and Comic Neue).
- Keep a **tuning block** (one config resource or script) holding every gameplay number, like the
  Android game's `CFG`, so we can tweak balance in one place.
- Commit in logical steps with plain-English messages, and push.
- Set up **GitHub Actions** to export Windows and Linux builds and publish them to Releases, so I
  never have to build by hand.

**Milestone 1 (do this first):** a playable vertical slice.
1. The Godot 4 project skeleton and the tuning block, plus what to install and how to open and run it.
2. Rail flight: the camera and ship move forward on their own, I steer in a screen-space box with
   mouse, keyboard or gamepad, and the ship has a tiny hitbox core.
3. Auto-firing **Autocannon** (VESPER's signature weapon).
4. One enemy type (the **Larva**) flying in from ahead and firing aimed shots toward me.
5. **XP gems** dropping from kills, collected by flying near them (magnet), and the XP bar.
6. The **level-up card** screen (3 cards, coin flip between upgrade and new system) with a couple of
   weapons and passives wired in.
7. A first pass at the look: toon shading with ink outlines, and pink enemy bullets that are easy to read.

Then tell me how to play it, what to test, and propose milestone 2 (more weapons and passives, the
stage 1 rail path with mini-bosses and the Hive Queen, the HUD with pilot face, then the Hangar,
pilots, ultimates and cut-ins, the remaining stages, and music).
