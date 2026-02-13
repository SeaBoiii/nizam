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

## Campaign loop

- `TITLE -> OVERWORLD -> BATTLE -> REWARDS -> OVERWORLD`
- Start with **New Run** or **Continue** on the title screen.
- Progress by clicking connected overworld nodes.
- Battle/Elite/Boss nodes launch tactical battles.
- Rewards are granted after battle and one bonus choice is required.
- Save data is persisted in localStorage (`nizam_save_v1`) and used by **Continue**.

## Controls

- Title: click `New Run`, `Continue`, `Reset Save`
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

## Battle objective

- A single capture point sits at the center of the battlefield.
- Alive units inside the objective radius generate capture pressure.
- If one team has more units inside, that team gains capture progress and the other side loses some progress.
- If both teams are equally present, progress slowly decays toward neutral.
- First side to reach `100%` capture progress wins the match.
- Result transitions to rewards, then returns to overworld progression.

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
- Objective HUD (Blue/Red capture progress and contested state)
- Minimap with units/squads/capture point
- Squad banners + morale bars for battlefield readability
- Waypoint path rendering for selected squads

## Troubleshooting blank page on Pages

If GitHub Pages shows a blank page:

1. Confirm `vite.config.ts` base matches your repo path (`/${REPO_NAME}/`).
2. Confirm workflow `Build` step used the right `REPO_NAME`.
3. Confirm Pages source is **GitHub Actions** (not branch deploy).
4. Hard refresh browser cache (`Ctrl+F5`) and check DevTools network paths.
