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

## Controls

- Camera pan: `WASD` or Arrow keys
- Camera zoom: Mouse wheel
- Select squad: Left click
- Multi-select: Drag left mouse selection box
- Move order: Right click
- Queue waypoint: `Shift` + Right click
- Move + set facing: `Alt` + Right click
- Formation Line: `1`
- Formation Column: `2`
- Formation Wedge: `3`
- Formation Loose: `4`
- Hold: `H`
- Charge nearest enemy: `C`
- Retreat to map edge: `R`

## Gameplay model included

- 2 teams (Blue vs Red), 3 squads each
- ~30 soldiers per squad
- Formation slots with stable slot assignment
- Steering with arrive + separation
- Spatial hash melee checks (not O(n^2))
- HP, casualties, morale, flank pressure, rout/recovery
- Fixed timestep simulation (1/60)
- HUD with FPS/selection/formation/order
- Waypoint path rendering for selected squads

## Troubleshooting blank page on Pages

If GitHub Pages shows a blank page:

1. Confirm `vite.config.ts` base matches your repo path (`/${REPO_NAME}/`).
2. Confirm workflow `Build` step used the right `REPO_NAME`.
3. Confirm Pages source is **GitHub Actions** (not branch deploy).
4. Hard refresh browser cache (`Ctrl+F5`) and check DevTools network paths.
