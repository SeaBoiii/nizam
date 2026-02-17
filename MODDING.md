# Nizam Modding Guide

This project supports drop-in JSON content packs under `public/mods/<packId>/`.

## Quick start

1. Copy `public/mods/base/` to `public/mods/<yourPackId>/`.
2. Add your pack to `public/mods/packs.json`:

```json
{
  "id": "your_pack",
  "name": "Your Pack",
  "desc": "Short description."
}
```

3. Start dev server:

```bash
npm run dev
```

4. Select your pack on the Title screen.

If pack validation fails, the game falls back to `base` and shows warnings.

## Required files in every pack

- `units.json`
- `upgrades.json`
- `objectives.json`
- `nodes.json`
- `scenarios.json`
- `maps.json`
- `perks.json`

## Example tweaks

### Add or tune a unit

Edit `units.json`:

- add/update an entry under `units[]`
- keep `id` stable (`infantry`, `slingers`, etc.)
- provide full tier stat blocks (`tiers.1`, `tiers.2`, `tiers.3`)

If a scenario references a unit id that does not exist, pack validation fails.

### Change enemy compositions

Edit `scenarios.json`:

- `templatesByNodeType` controls normal/elite/boss templates
- `siegeTemplates` controls siege encounters
- `mapPoolsByNodeType` controls which maps can roll by depth

### Add or tune maps + terrain

Edit `maps.json`:

- add map in `maps[]` with unique `id`
- define spawns, objective circles, and terrain entries
- terrain supports `OBSTACLE_RECT`, `FOREST_RECT`, `HILL_RECT`, `GATE_RECT`

If a scenario map pool references a missing map id, validation fails.

## Determinism and balancing

- Objective/map/template rolls are seeded and deterministic.
- Keep IDs stable while tuning values.
- Large stat changes can affect campaign balance quickly; start with small increments.

## GitHub Pages path note

Content is fetched with:

- `${import.meta.env.BASE_URL}mods/<packId>/<file>.json`

This works for local dev and GitHub Pages (`/nizam/` base).
