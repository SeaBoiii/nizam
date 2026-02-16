# Bannerlord-lite Tactical Sandbox (PixiJS + TypeScript + Vite)

Top-down tactical battle sandbox built for GitHub Pages.

## Stack

- PixiJS 8
- TypeScript
- Vite
- GitHub Actions Pages deployment

## Local setup

1. Install dependencies:

```bash
npm i
```

2. Run development server:

```bash
npm run dev
```

3. Build production bundle:

```bash
npm run build
```

4. Preview built output:

```bash
npm run preview
```

## GitHub Pages deployment

Deployment is handled by `.github/workflows/deploy.yml`.

1. Push to `main`.
2. In GitHub repo settings, open `Settings -> Pages`.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Wait for workflow run **Deploy to GitHub Pages** to complete.

No `dist/` commit is required.

## REPO_NAME and base path

`vite.config.ts` uses:

- `REPO_NAME` env var when provided.
- fallback repo name `nizam`.

So default base path is:

- `/nizam/`

If your repo name changes, build with:

```bash
REPO_NAME=your-repo-name npm run build
```

On GitHub Actions, `REPO_NAME` is set automatically from `${{ github.event.repository.name }}`.

## Data-driven content (Sprint 5.1)

Gameplay tuning is loaded from JSON files at startup:

- `public/content/units.json`
- `public/content/upgrades.json`
- `public/content/perks.json`
- `public/content/objectives.json`
- `public/content/nodes.json`
- `public/content/scenarios.json`
- `public/content/maps.json`

The loader uses Vite base-aware paths:

- `${import.meta.env.BASE_URL}content/*.json`

So GitHub Pages pathing under `/nizam/` works correctly.

If a content file is missing or invalid, the game falls back to built-in defaults and logs errors to console. In dev mode, a small HUD warning is shown when fallback is active.

## Terrain + Chokepoints (Sprint 9A)

- Battles now load handcrafted maps from `public/content/maps.json`.
- Terrain types:
  - `OBSTACLE_RECT`: impassable blocks (units route around, cannot pass through).
  - `GATE_RECT`: siege gate obstacle (closed at start, opens during Siege stage transition).
  - `FOREST_RECT`: movement slow and ranged accuracy penalty for shooters inside forest.
  - `HILL_RECT`: ranged range and accuracy bonus for shooters on hill tiles.
- Navigation uses a lightweight nav grid + flow-field steering:
  - squads and units route around obstacles/chokepoints
  - no per-unit A* pathfinding
- Included maps:
  - `open_field`
  - `bridge_crossing`
  - `forest_pass`
  - `siege_gatehouse`
- Map selection is deterministic per node and seed, using scenario content pools in `public/content/scenarios.json`.
- Terrain overlays are rendered in-battle and minimap shows obstacle silhouettes.

## Campaign loop

- `TITLE -> OVERWORLD -> BATTLE -> REWARDS -> OVERWORLD`
- Start with **New Run** or **Continue** on the title screen.
- Progress by clicking connected overworld nodes.
- Battle/Elite/Boss nodes launch tactical battles.
- Hovering battle nodes shows the upcoming objective type.
- Rewards are granted after battle and one bonus choice is required.
- Save data is persisted in localStorage (`nizam_save_v1`) and used by **Continue**.
- Saves now include `saveVersion` and `contentVersion`, and older v1 saves are migrated automatically.

## Anti-frustration rules (Sprint 12.3)

- Losing a non-boss battle now grants consolation rewards and the run continues:
  - gold/recruits are scaled from normal node rewards using `lossProtection` tuning in `public/content/nodes.json`
  - supplies gain uses a flat value from the same tuning block
  - consecutive losses apply a capped multiplier boost to consolation gold/recruits
- Boss defeat ends the run and returns to title from rewards.
- Perk draft is skipped on defeat (victory only).
- Objective streak protection:
  - battle objective type avoids repeating back-to-back when alternatives exist
  - map id also avoids repeating back-to-back when 2+ candidates exist
  - both rules are deterministic from run seed + run state (no `Math.random`)

## Controls

- Title: click `New Run`, `Continue`, `Reset Save`, `Stats`
- Title: pick `Normal` or `Hard` before `New Run`
- Overworld: left click connected nodes to advance, click `Back To Title` to return
- Battle camera pan: `WASD` or Arrow keys
- Battle camera zoom: Mouse wheel
- Battle select squad: Left click
- Battle multi-select: Drag left mouse selection box
- Battle move order: Right click
- Battle queue waypoint: `Shift` + Right click
- Battle move + set facing: `Alt` + Right click
- Battle formation line/column/wedge/loose: `1`, `2`, `3`, `4`
- Battle hold: `H`
- Battle charge nearest enemy: `C`
- Battle retreat to map edge: `R`
- Battle volley (ranged stance): `V`
- Battle skirmish (kite while shooting): `K`
- Rewards: when a perk offer appears, click one perk card to continue
- Debug panel toggle (all states): `F1` or `` ` ``
- Pause menu (Battle + Overworld): `ESC`
- Pause menu: `Stats` opens the local stats screen

## Perks + Difficulty (Sprint 6)

- A commander perk draft appears every `N` cleared battle nodes (default: every 3), configured in `public/content/perks.json`.
- Perk choices are deterministic from run seed + progression count.
- Picked perks persist in save data and apply to player-side battle systems:
  - morale/rout behavior
  - formation cohesion/spacing
  - charge power/cooldown
  - ranged accuracy/projectile speed
  - capture rate
  - spear anti-charge strength
  - armor effectiveness
  - post-battle field medic recruit recovery
- New Run supports `Normal` and `Hard` modes.
- Hard mode scales enemies faster by node depth (tier, size, AI order cadence) and grants slightly higher rewards.

## Pause + Settings + Audio (Sprint 7)

- Press `ESC` in Overworld or Battle to open pause menu.
- Pause menu options:
  - Resume
  - Settings
  - Controls
  - Stats
  - Quit To Title (with confirmation)
- Settings are saved to localStorage key `nizam_settings_v1`:
  - `masterVolume`, `sfxVolume`, `musicVolume`
  - `cameraSpeed`
  - `showMinimap`
  - `showTrails`
  - `reduceScreenShake`
- Browser audio is unlocked on first user interaction (click/tap). Some browsers block sound until then.
- Gameplay SFX cues are throttled to avoid spam (arrows, impacts, rout, etc.).

## Telemetry-lite + Export (Sprint 8.2)

- No external analytics or trackers are used.
- Stats are stored locally only in localStorage key `nizam_stats_v1`.
- The Stats screen is available from:
  - Title (`Stats`)
  - Pause menu (`Stats`)
- Stats screen includes:
  - run/battle totals and winrates
  - objective play/win stats
  - top perks picked
  - top orders issued
  - depth bucket averages (duration and casualty %)
- Export for sharing balance reports/bug context:
  - `Copy Stats JSON`
  - `Copy Last Run JSON`
- `Reset Stats` is available with confirmation on the Stats screen.

## Crash diagnostics (Sprint 11.2)

- Global crash overlay appears automatically on uncaught runtime errors.
- Overlay includes:
  - error message
  - collapsible stack trace
  - run context summary (seed/node/map/objective/difficulty/perks)
  - actions: `Copy Bug Report JSON`, `Copy Stack Trace`, `Reload`
- `Continue` is disabled by default and only enabled for whitelisted non-fatal error messages.
- Bug reports are local-only JSON (no network calls) and include:
  - error details
  - current run/battle/content/settings context
  - recent gameplay events ring buffer (last 200)
- Paste copied bug report JSON directly into a GitHub Issue for repro/balance debugging.

## Battle objectives (Sprint 4)

- `Capture Point`: classic central capture objective.
- `Decapitation` (`ASSASSINATE`): kill the enemy commander before yours dies.
- `Last Stand` (`HOLDOUT`): survive the timer while enemy reinforcement waves attack.
- `Caravan Run` (`ESCORT`): protect the caravan to the exit zone.
- `Siege` (`SIEGE`): two-stage assault. Stage 1 capture the gate zone to open the gate, then Stage 2 capture the courtyard before time expires.
- Overworld battle nodes now preview objective type in the tooltip.
- Objective variants are selected deterministically from run seed + node id.

## Siege mode (Sprint 10)

- Added iconic siege map: `siege_gatehouse` in `public/content/maps.json`.
- Gate mechanic:
  - Gate terrain uses `GATE_RECT` with id `main_gate`.
  - Closed gate blocks movement/nav until Stage 1 is captured.
  - On gate open, nav grid rebuilds and squad flow-fields refresh so units re-route through the breach.
- Siege objective tuning lives in `public/content/objectives.json` under `siege`:
  - `timeLimitSeconds`
  - `gateCaptureRate`
  - `courtyardCaptureRate`
  - `contestedDecayRate`
  - `opposingProgressDrainFactor`
  - `eliteDepthMin` / `eliteChance` (late-elite appearance tuning)
- Siege enemy compositions are data-driven in `public/content/scenarios.json` under `siegeTemplates`.

## Debug panel

Use `F1` or `` ` `` to toggle.

- Shows content load status (`OK` or fallback), current run seed, and content version.
- `Reload Content` re-fetches all JSON content files.
- `Restart Current Battle` appears during battle.
- `Restart Run` appears outside battle.

After content reload, restart battle/run to apply changes to newly spawned units/scenarios.

## Ranged combat (Sprint 2)

- Archer squads now fire real projectiles (no hitscan).
- Arrows have travel time and gravity, so long shots arc and can miss.
- `VOLLEY` keeps formation and fires at targets in range.
- `SKIRMISH` kites away when enemies get too close, while continuing to fire.
- Friendly fire is disabled by default.
- Shielded units take reduced ranged damage from the front arc.

## Overworld node types

- `BATTLE`: standard engagement with moderate enemies
- `ELITE`: stronger enemy composition and slower objective capture speed
- `BOSS`: hardest scenario with higher-tier enemy squads
- `SHOP`: spend gold on squad size or supplies
- `RECRUIT`: gain recruits and optionally buy a discounted new squad
- `REST`: gain supplies and a temporary HP bonus for the next battle

## Gameplay model included

- Campaign state machine with title/overworld/battle/rewards
- Deterministic seeded node-map generation (18-24 nodes, forward edges, guaranteed boss path)
- Save/load + reset save via localStorage
- Player army roster with squad tiers, upgrades, and recruiting
- Node-driven scenario generation (battle/elite/boss scaling)
- Squad archetypes: Infantry, Spearmen, Cavalry, Archers
- Variable squad sizes driven by campaign roster
- Formation slots with stable slot assignment
- Steering with arrive + separation
- Spatial hash melee checks (not O(n^2))
- HP, casualties, morale, flank pressure, rout/recovery
- Directional melee damage (rear/flank/front + shield mitigation)
- Cavalry charge burst with knockback and spear counter behavior
- Real projectile simulation for ranged units (gravity + lifetime + collision)
- Fixed timestep simulation (1/60)
- HUD with FPS/selection/archetype/formation/order
- Objective HUD (dynamic by objective type, with timers/goal bars where relevant)
- Minimap with units/squads and objective markers
- Squad banners + morale bars for battlefield readability
- Waypoint path rendering for selected squads
- Enemy AI Director issuing tactical HOLD/CHARGE/VOLLEY/SKIRMISH orders by role/objective
- Data-driven tuning/content pipeline with JSON validation + runtime fallback defaults

## Troubleshooting blank page on Pages

If GitHub Pages shows a blank page:

1. Confirm `vite.config.ts` base matches your repo path (`/${REPO_NAME}/`).
2. Confirm workflow `Build` step used the right `REPO_NAME`.
3. Confirm Pages source is **GitHub Actions** (not branch deploy).
4. Hard refresh browser cache (`Ctrl+F5`) and check DevTools network paths.
