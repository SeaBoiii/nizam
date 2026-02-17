# Nizam - Bannerlord-lite Tactical Sandbox

A top-down tactical battle simulator with campaign progression, built with PixiJS, TypeScript, and Vite. Deploy to GitHub Pages out of the box.

[![Deploy Status](https://github.com/SeaBoiii/nizam/workflows/Deploy%20to%20GitHub%20Pages/badge.svg)](https://github.com/SeaBoiii/nizam/actions)

## 🎮 What is this?

Nizam is a tactical combat sandbox inspired by Mount & Blade: Bannerlord. Command squads of infantry, archers, cavalry, spearmen, and slingers in real-time battles across varied terrain. Progress through a roguelite campaign, upgrade your army, unlock commander perks, and adapt to dynamic objectives.

**Key Features:**
- **Real-time tactical combat** with formation orders, flanking, morale, and cavalry charges
- **Roguelite campaign** with node-based progression and permanent army growth
- **Data-driven content** via JSON mod packs - easily customize units, perks, maps, and balance
- **Handcrafted maps** with chokepoints, forests, hills, and siege scenarios
- **Daily challenges** with shareable result codes and local leaderboards
- **100% client-side** - no backend, no analytics, all data stored locally

## 🚀 Quick Start

### Play Now
Visit the live demo: [https://seaboiii.github.io/nizam/](https://seaboiii.github.io/nizam/)

### Local Development

```bash
# Install dependencies
npm install

# Start dev server (with hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Open your browser to `http://localhost:5173` and start a new run!

## 📖 How to Play

### Campaign Flow
**Title → Overworld → Battle → Rewards → Overworld** (repeat until victory or defeat)

1. **Title Screen**: Start a new run, continue saved progress, or try daily challenges
2. **Overworld**: Navigate a procedural node map. Click connected nodes to progress.
3. **Battle**: Command your army in real-time tactical combat with various objectives
4. **Rewards**: Collect gold, recruits, and supplies. Draft powerful commander perks every 3 battles.

### Combat Basics

**Camera Controls:**
- `WASD` or Arrow keys: Pan camera
- Mouse wheel: Zoom in/out

**Squad Commands:**
- Left click: Select squad
- Drag selection box: Multi-select
- Right click: Move order
- `Shift` + Right click: Queue waypoint
- `Alt` + Right click: Move and set facing
- `H`: Hold position
- `C`: Charge nearest enemy

**Formation Hotkeys:**
- `1`: Line formation (balanced offense/defense)
- `2`: Column formation (narrow frontage, deep ranks)
- `3`: Wedge formation (breakthrough power)
- `4`: Loose formation (reduced missile casualties)

**Ranged Tactics:**
- `V`: Volley stance (hold position and fire)
- `K`: Skirmish mode (kite away while shooting)

**Commander Ability:**
- `R` or click Ability Bar: Rally (boost nearby squad morale)

**Utility:**
- `T` or `Shift+R`: Retreat to map edge
- `ESC`: Pause menu
- `F1` or `` ` ``: Debug panel

### Objectives
- **Capture Point**: Control the central zone until capture bar fills
- **Decapitation**: Eliminate the enemy commander before losing yours
- **Last Stand**: Survive waves of reinforcements until the timer expires
- **Caravan Escort**: Protect the caravan until it reaches the exit zone
- **Siege**: Two-stage assault - capture the gate zone to open the gate, then capture the courtyard

## 🛠️ Tech Stack

- **PixiJS 8**: Hardware-accelerated 2D rendering
- **TypeScript**: Type-safe game logic
- **Vite**: Lightning-fast dev server and bundler
- **GitHub Actions**: Automated deployment to GitHub Pages

## 📦 Content Modding

Nizam uses JSON-based content packs for easy customization. No code changes needed!

### Content Pack Structure
```
public/mods/<pack-id>/
├── units.json        # Unit archetypes (stats, costs, tiers)
├── upgrades.json     # Squad upgrade tiers
├── perks.json        # Commander perk pool
├── abilities.json    # Commander abilities (Rally, etc.)
├── objectives.json   # Battle objective tuning
├── nodes.json        # Campaign node types and rewards
├── scenarios.json    # Enemy composition templates
└── maps.json         # Handcrafted battle maps
```

### Creating a Custom Pack

1. Copy `public/mods/base/` to `public/mods/your-pack-id/`
2. Edit the JSON files to customize balance, units, and maps
3. Add your pack to `public/mods/packs.json`:
```json
{
  "packs": [
    {
      "id": "your-pack-id",
      "name": "Your Pack Name",
      "version": "1.0.0",
      "author": "Your Name"
    }
  ]
}
```
4. Select your pack on the title screen with `<` / `>` buttons

See [MODDING.md](MODDING.md) for detailed schema documentation.

## 🎯 Performance Tips

Nizam is optimized for smooth 60 FPS gameplay even with 100+ units on screen. Recent optimizations include:

- **Cached flanking checks**: Reduced per-frame O(n) squad iterations
- **Formation radius caching**: Pre-computed geometry to avoid recalculation
- **Waypoint index pointers**: Eliminated O(n) array shifts
- **Dirty flag minimap**: Only redraws terrain when map state changes
- **HUD text caching**: Skips updates when values haven't changed

If you experience performance issues:
1. Reduce screen resolution or window size
2. Enable "Reduce Screen Shake" in Settings
3. Disable "Show Trails" in Settings
4. Zoom out less (fewer units rendered)

## 🌐 GitHub Pages Deployment

Deployment happens automatically via GitHub Actions when you push to `main`.

### Initial Setup
1. Push your repository to GitHub
2. Go to **Settings → Pages**
3. Set **Source** to **GitHub Actions**
4. Push to `main` - deployment workflow will trigger automatically

### Custom Repository Name
The build automatically uses your repository name as the base path. If you rename your repo:

```bash
REPO_NAME=your-new-repo-name npm run build
```

The GitHub Actions workflow handles this automatically using `${{ github.event.repository.name }}`.

## 📊 Save Data & Privacy

**100% Local-Only Storage** - no data leaves your browser.

All game data is stored in browser localStorage:
- `nizam_save_v1`: Normal run progress
- `nizam_save_daily_v1`: Daily challenge progress
- `nizam_save_challenge_v1`: Challenge code run progress
- `nizam_settings_v1`: Audio, camera, and display settings
- `nizam_stats_v1`: Lifetime gameplay statistics
- `nizam_daily_results_v1`: Daily challenge history
- `nizam_leaderboards_v1`: Local leaderboard entries

**Export/Share Features:**
- Copy stats JSON for bug reports
- Download daily share card PNG (generated client-side)
- Share challenge codes and result codes (base64 strings, no server)

## 🎲 Daily Challenges & Result Sharing

### Daily Challenges
- **Deterministic seeded runs** based on Asia/Singapore date (`YYYY-MM-DD`)
- Locked to `Base` content pack for fairness
- Separate save slot - won't overwrite your normal run
- Local result history with best-by-date tracking

### Challenge Codes
Share deterministic seeded runs with friends:
1. Complete a run → Click **Create Challenge Code**
2. Copy and share the base64 code
3. Others can import via **Play Challenge Code** on title screen
4. Compatibility checks ensure matching content packs/versions

### Result Codes
Compare completed run outcomes:
1. Complete a run → Click **Copy Result Code**
2. Share with others or save for later
3. Compare side-by-side via **Compare Results** on title screen
4. View score breakdowns, perks, and run metadata

## 🐛 Troubleshooting

### Blank Page on GitHub Pages
1. Verify `vite.config.ts` base path matches your repo name
2. Confirm Pages source is set to **GitHub Actions** (not branch deploy)
3. Check the Actions workflow completed successfully
4. Hard refresh your browser (`Ctrl+F5` or `Cmd+Shift+R`)
5. Open browser DevTools → Network tab and verify asset paths are correct

### Game Crashes or Errors
When crashes occur, an error overlay appears with:
- Error message and stack trace
- Run context (seed, map, objective, perks)
- **Copy Bug Report JSON** - paste this into a GitHub Issue for debugging

You can also access:
- Debug panel (`F1` or `` ` ``): Shows content load status, allows content reload
- Browser console: Check for JavaScript errors

### Audio Not Playing
Modern browsers block audio until user interaction:
1. Click anywhere on the page to unlock audio
2. Adjust volumes in **Settings → Audio**
3. Ensure your browser isn't muting the tab

### Save Data Issues
- **Reset Save**: Title screen → **Reset Save** (with confirmation)
- **Clear specific slot**: Use localStorage inspector in DevTools
- **Export before reset**: **Stats** → **Copy Last Run JSON** to preserve your progress

## 🤝 Contributing

Contributions welcome! Whether it's bug reports, balance suggestions, new content packs, or code improvements.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

MIT License - see LICENSE file for details.

---

# 📚 Detailed Technical Reference

This section contains in-depth documentation for developers, modders, and advanced users.

## Table of Contents
- [Terrain & Map System](#terrain--map-system)
- [Anti-Frustration Rules](#anti-frustration-rules)
- [Complete Controls Reference](#complete-controls-reference)
- [Perks & Difficulty System](#perks--difficulty-system)
- [Pause, Settings & Audio](#pause-settings--audio)
- [Stats & Telemetry](#stats--telemetry)
- [Crash Diagnostics](#crash-diagnostics)
- [Battle Objectives Deep Dive](#battle-objectives-deep-dive)
- [Siege Mode Mechanics](#siege-mode-mechanics)
- [Debug Panel](#debug-panel)
- [Ranged Combat System](#ranged-combat-system)
- [Slingers & Suppression](#slingers--suppression)
- [Commander Abilities](#commander-abilities)
- [Overworld Node Types](#overworld-node-types)
- [Gameplay Systems Summary](#gameplay-systems-summary)

---

## Terrain & Map System

Battles load handcrafted maps from `public/mods/base/maps.json`.

### Terrain Types

**OBSTACLE_RECT**: Impassable blocks
- Units route around obstacles using nav grid
- Cannot pass through

**GATE_RECT**: Siege gate obstacles  
- Closed at battle start
- Opens during Siege stage transition
- Navigation rebuilds when gate opens

**FOREST_RECT**: Dense woodland
- Movement speed penalty
- Ranged accuracy penalty for shooters inside forest

**HILL_RECT**: Elevated terrain
- Ranged range bonus for shooters on hills
- Ranged accuracy bonus

### Navigation System
- Lightweight nav grid + flow-field steering
- Squads and units route around obstacles/chokepoints
- No per-unit A* pathfinding (performance optimization)

### Included Maps
- `open_field`: Classic open battle
- `bridge_crossing`: Narrow chokepoint combat
- `forest_pass`: Woodland engagement with limited sightlines
- `siege_gatehouse`: Two-stage siege assault

Map selection is deterministic per node and seed, using scenario content pools in `public/mods/base/scenarios.json`.

---

## Anti-Frustration Rules

### Loss Protection (Sprint 12.3)
Losing a non-boss battle now grants consolation rewards and the run continues:
- Gold/recruits scaled from normal node rewards using `lossProtection` tuning in `public/mods/base/nodes.json`
- Supplies gain uses a flat value from the same tuning block
- Consecutive losses apply a capped multiplier boost to consolation gold/recruits

### Boss Defeat
- Boss defeat ends the run
- Returns to title from rewards screen
- Perk draft is skipped on defeat (victory only)

### Objective Streak Protection
Prevents monotonous repetition:
- Battle objective type avoids repeating back-to-back when alternatives exist
- Map id also avoids repeating back-to-back when 2+ candidates exist
- Both rules are deterministic from run seed + run state (no `Math.random`)

---

## Complete Controls Reference

### Title Screen
- `New Run`: Start fresh campaign
- `Continue`: Resume saved progress
- `Reset Save`: Clear all save data (with confirmation)
- `Stats`: View lifetime statistics
- `Content Pack` selection: `<` / `>` buttons
- `Daily Challenge`: Start seeded daily run (Asia/Singapore date)
- `Continue Daily`: Resume today's daily save (if available)
- `Daily History`: Browse local daily result history
- `Play Challenge Code`: Import shared challenge strings
- `Continue Challenge`: Resume challenge-save slot if present
- Difficulty selection: `Normal` or `Hard` before `New Run`

### Overworld
- Left click connected nodes to advance
- `Back To Title` button to return
- Hover battle nodes to preview objective type

### Battle Camera
- `WASD` or Arrow keys: Pan camera
- Mouse wheel: Zoom in/out

### Battle Squad Selection
- Left click: Select single squad
- Drag left mouse: Selection box for multi-select

### Battle Orders
- Right click: Move order
- `Shift` + Right click: Queue waypoint
- `Alt` + Right click: Move + set facing

### Battle Formations
- `1`: Line formation
- `2`: Column formation
- `3`: Wedge formation
- `4`: Loose formation

### Battle Commands
- `H`: Hold position
- `C`: Charge nearest enemy
- `R`: Commander ability (Rally) - or click Ability Bar
- `T` or `Shift+R`: Retreat to map edge
- `V`: Volley (ranged stance)
- `K`: Skirmish (kite while shooting)

### Rewards
- Click one perk card to continue (when perk offer appears)

### Debug & Utility
- `F1` or `` ` ``: Toggle debug panel (all states)
- `ESC`: Pause menu (Battle + Overworld)
- Pause menu → `Stats`: Opens local stats screen

---

## Perks & Difficulty System

### Commander Perks
- Perk draft appears every `N` cleared battle nodes (default: every 3)
- Configured in `public/mods/base/perks.json`
- Perk choices are deterministic from run seed + progression count
- Picked perks persist in save data

### Perk Categories
Perks affect player-side battle systems:
- Morale/rout behavior
- Formation cohesion/spacing
- Charge power/cooldown
- Ranged accuracy/projectile speed
- Capture rate modifiers
- Spear anti-charge strength
- Armor effectiveness
- Post-battle field medic recruit recovery

### Difficulty Modes
**Normal Mode**: Standard enemy scaling

**Hard Mode**:
- Enemies scale faster by node depth
- Higher tier units appear earlier
- Larger enemy squad sizes
- Faster AI order cadence
- Slightly higher rewards to compensate

---

## Pause, Settings & Audio

### Pause Menu (ESC)
Available in Overworld or Battle:
- Resume
- Settings
- Controls
- Stats
- Quit To Title (with confirmation)

### Settings (localStorage key: `nizam_settings_v1`)
**Audio:**
- Master Volume
- SFX Volume
- Music Volume

**Camera:**
- Camera Speed

**Display:**
- Show Minimap
- Show Trails
- Reduce Screen Shake

### Audio Notes
- Browser audio is unlocked on first user interaction (click/tap)
- Some browsers block sound until then
- Gameplay SFX cues are throttled to avoid spam (arrows, impacts, rout, etc.)

---

## Stats & Telemetry

### Privacy
- **No external analytics or trackers**
- Stats stored locally only in localStorage key `nizam_stats_v1`

### Stats Screen Access
- Title screen: `Stats` button
- Pause menu: `Stats` button

### Tracked Statistics
- Run/battle totals and winrates
- Objective play/win stats
- Top perks picked
- Top orders issued
- Depth bucket averages (duration and casualty %)

### Export Options
For sharing balance reports/bug context:
- `Copy Stats JSON`
- `Copy Last Run JSON`
- `Reset Stats` (with confirmation)

---

## Crash Diagnostics

### Global Crash Overlay (Sprint 11.2)
Appears automatically on uncaught runtime errors.

**Overlay includes:**
- Error message
- Collapsible stack trace
- Run context summary (seed/node/map/objective/difficulty/perks)

**Actions:**
- `Copy Bug Report JSON`: Full context for GitHub Issues
- `Copy Stack Trace`: Quick error reference
- `Reload`: Restart application

**Continue button:**
- Disabled by default
- Only enabled for whitelisted non-fatal error messages

### Bug Report Contents
Local-only JSON (no network calls):
- Error details
- Current run/battle/content/settings context
- Recent gameplay events ring buffer (last 200)

Paste copied bug report JSON directly into a GitHub Issue for repro/balance debugging.

---

## Battle Objectives Deep Dive

### Capture Point (Classic)
Central capture objective:
- Control the zone to fill capture bar
- Contested when both sides present
- First to 100% wins

### Decapitation (ASSASSINATE)
High-risk assassination mission:
- Kill the enemy commander before yours dies
- Commander units have distinct markers
- Protects your commander while targeting theirs

### Last Stand (HOLDOUT)
Defensive survival:
- Survive the timer
- Enemy reinforcement waves attack periodically
- Managing morale and casualties is critical

### Caravan Run (ESCORT)
Escort mission:
- Protect the caravan to the exit zone
- Caravan moves automatically
- Enemy tries to destroy caravan
- Balance offense and defense

### Siege (Two-stage assault)
**Stage 1**: Capture gate zone
- Control the gate capture point
- Gate opens when Stage 1 completes
- Navigation rebuilds after gate opens

**Stage 2**: Capture courtyard
- Assault through the opened gate
- Capture the inner courtyard
- Timer limit for both stages combined

Overworld battle nodes preview objective type in tooltip.

---

## Siege Mode Mechanics

### Siege Map: `siege_gatehouse`
Iconic siege assault map in `public/mods/base/maps.json`.

### Gate Mechanic
- Gate terrain uses `GATE_RECT` with id `main_gate`
- Closed gate blocks movement/nav until Stage 1 is captured
- On gate open:
  - Nav grid rebuilds
  - Squad flow-fields refresh
  - Units re-route through the breach

### Siege Tuning
Lives in `public/mods/base/objectives.json` under `siege`:
- `timeLimitSeconds`: Total time for both stages
- `gateCaptureRate`: Stage 1 capture speed
- `courtyardCaptureRate`: Stage 2 capture speed
- `contestedDecayRate`: Decay when contested
- `opposingProgressDrainFactor`: How opposing presence drains progress
- `eliteDepthMin` / `eliteChance`: Late-elite appearance tuning

### Enemy Compositions
Siege enemy compositions are data-driven in `public/mods/base/scenarios.json` under `siegeTemplates`.

---

## Debug Panel

Toggle with `F1` or `` ` `` (backtick).

### Information Displayed
- Content load status (`OK` or fallback)
- Selected/loaded pack id
- Current run seed
- Content version
- First content errors (if any)

### Actions
- `Reload Content`: Re-fetches all JSON content files
- `Restart Current Battle`: Appears during battle
- `Restart Run`: Appears outside battle

**Note**: After content reload, restart battle/run to apply changes to newly spawned units/scenarios.

---

## Ranged Combat System

### Real Projectiles (Sprint 2)
- Archer squads fire real projectiles (no hitscan)
- Arrows have travel time and gravity
- Long shots arc and can miss moving targets

### Ranged Stances
**VOLLEY**: Formation firing
- Keep formation
- Fire at targets in range
- Coordinated volleys

**SKIRMISH**: Hit-and-run
- Kites away when enemies get close
- Continues to fire while retreating
- Ideal for preserving archer squads

### Damage & Mitigation
- Friendly fire is disabled by default
- Shielded units take reduced ranged damage from front arc
- Terrain modifiers apply (forest penalty, hill bonus)

---

## Slingers & Suppression

### Slinger Archetype (Sprint 13.1)
Data-driven in `public/mods/base/units.json`.

**Projectile Type**: Stone
- Heavier arc than arrows
- Different trajectory and travel time

### Suppression Mechanics
Stone hits apply morale suppression on impact:
- Per-squad per-second cap prevents instant rout chains
- Suppression is additional morale pressure

### Suppression Tuning
In `public/mods/base/objectives.json` under `suppression`:
- `stoneMoraleDamage`: Base morale damage per stone hit
- `stoneMoraleDamageOnShieldFrontMult`: Multiplier for shielded targets (reduced)
- `maxSuppressionPerSecondPerSquad`: Rate limit to prevent chain routs

### Tactical Role
- Mid/late enemy templates now include slingers via `public/mods/base/scenarios.json`
- Slinger pressure forces morale management
- Counter with cavalry charges or concentrated melee assault

---

## Commander Abilities

### Data-Driven Abilities (Sprint 19.1)
Defined in:
- `public/mods/base/abilities.json`
- `public/mods/community/abilities.json`

### Rally Ability
Initial commander ability available to player.

**Mechanics:**
- Casts at selected squad anchor (or camera center if nothing selected)
- Instantly boosts nearby allied squad morale
- Applies temporary morale-loss reduction buff
- Uses cooldown + cast time

**Activation:**
- Press `R` key
- Click Ability Bar UI element

### Enemy AI Abilities
- Enemy AI can cast Rally once per battle
- Triggers when nearby allied morale is low
- AI ability usage is deterministic (not random)

---

## Overworld Node Types

### BATTLE
- Standard engagement
- Moderate enemy composition
- Normal objective capture speed

### ELITE
- Stronger enemy composition
- Slower objective capture speed
- Higher tier units
- Greater rewards

### BOSS
- Hardest scenario
- Higher-tier enemy squads
- Larger compositions
- Run ends on defeat

### SHOP
- Spend gold on:
  - Increase squad size
  - Purchase supplies

### RECRUIT
- Gain recruits automatically
- Optional: Buy a discounted new squad

### REST
- Gain supplies
- Temporary HP bonus for next battle
- No combat

---

## Gameplay Systems Summary

### Campaign State Machine
- Title / Overworld / Battle / Rewards state flow
- Deterministic seeded node-map generation
- 18-24 nodes per run
- Forward edges with guaranteed boss path

### Army & Progression
- Player army roster with squad tiers, upgrades, recruiting
- Node-driven scenario generation (battle/elite/boss scaling)
- Squad archetypes: Infantry, Spearmen, Cavalry, Archers, Slingers
- Variable squad sizes driven by campaign roster

### Combat Systems
- Formation slots with stable slot assignment
- Steering with arrive + separation
- Spatial hash melee checks (not O(n²))
- HP, casualties, morale, flank pressure, rout/recovery
- Directional melee damage (rear/flank/front + shield mitigation)
- Cavalry charge burst with knockback
- Spear counter behavior vs cavalry
- Real projectile simulation (gravity + lifetime + collision)

### Rendering & UI
- Fixed timestep simulation (1/60)
- HUD with FPS/selection/archetype/formation/order
- Objective HUD (dynamic by objective type, with timers/goal bars)
- Minimap with units/squads and objective markers
- Squad banners + morale bars for battlefield readability
- Waypoint path rendering for selected squads

### AI Director
- Issues tactical HOLD/CHARGE/VOLLEY/SKIRMISH orders
- Behavior varies by role and objective type
- Deterministic decision-making

### Content Pipeline
- Data-driven tuning/content via JSON
- Runtime validation + fallback defaults
- Hot-reloadable content (via debug panel)

---

**Made with ❤️ using PixiJS, TypeScript, and Vite**
