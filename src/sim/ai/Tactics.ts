import type { Squad } from '../Squad';
import type { ObjectiveTacticalState } from '../objectives/IObjective';
import type { WorldBounds } from '../types';
import { clamp } from '../../utils/math';
import { Vec2 } from '../../utils/vec2';

export type SquadRole = 'INFANTRY' | 'SPEAR' | 'CAVALRY' | 'ARCHER';

export function squadRole(squad: Squad): SquadRole {
  if (squad.archetype.tags.includes('archer') || squad.archetype.tags.includes('slinger')) {
    return 'ARCHER';
  }
  if (squad.archetype.tags.includes('cavalry')) {
    return 'CAVALRY';
  }
  if (squad.archetype.tags.includes('spear')) {
    return 'SPEAR';
  }
  return 'INFANTRY';
}

export function livingTeamSquads(all: readonly Squad[], team: number, out: Squad[]): Squad[] {
  out.length = 0;
  for (let i = 0; i < all.length; i += 1) {
    const squad = all[i];
    if (squad.team !== team || !squad.hasLivingSoldiers()) {
      continue;
    }
    out.push(squad);
  }
  return out;
}

export function nearestEnemySquad(from: Squad, enemies: readonly Squad[]): Squad | null {
  let nearest: Squad | null = null;
  let nearestDistSq = Number.POSITIVE_INFINITY;

  for (let i = 0; i < enemies.length; i += 1) {
    const candidate = enemies[i];
    if (!candidate.hasLivingSoldiers()) {
      continue;
    }
    const distSq = from.anchor.distanceSqTo(candidate.anchor);
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearest = candidate;
    }
  }

  return nearest;
}

export function nearestEnemyByRole(
  from: Squad,
  enemies: readonly Squad[],
  role: SquadRole,
): Squad | null {
  let nearest: Squad | null = null;
  let nearestDistSq = Number.POSITIVE_INFINITY;

  for (let i = 0; i < enemies.length; i += 1) {
    const candidate = enemies[i];
    if (!candidate.hasLivingSoldiers() || squadRole(candidate) !== role) {
      continue;
    }

    const distSq = from.anchor.distanceSqTo(candidate.anchor);
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearest = candidate;
    }
  }

  return nearest;
}

export function findRoutingEnemy(enemies: readonly Squad[]): Squad | null {
  for (let i = 0; i < enemies.length; i += 1) {
    const squad = enemies[i];
    if (squad.hasLivingSoldiers() && squad.order === 'rout') {
      return squad;
    }
  }
  return null;
}

export function computeFlankPoint(
  target: Squad,
  bounds: WorldBounds,
  out: Vec2,
  flankDistance = 210,
): Vec2 {
  const backX = target.anchor.x - Math.cos(target.facing) * flankDistance;
  const backY = target.anchor.y - Math.sin(target.facing) * flankDistance;
  const sideSign = Math.sin(target.facing * 1.37) >= 0 ? 1 : -1;
  const sideX = -Math.sin(target.facing) * flankDistance * 0.45 * sideSign;
  const sideY = Math.cos(target.facing) * flankDistance * 0.45 * sideSign;

  out.x = clamp(backX + sideX, 46, bounds.width - 46);
  out.y = clamp(backY + sideY, 46, bounds.height - 46);
  return out;
}

export function objectiveAnchor(state: ObjectiveTacticalState): Vec2 {
  if (state.type === 'ESCORT' && state.caravan !== null && state.caravan.alive) {
    return state.caravan.position;
  }
  if (state.type === 'ASSASSINATE' && state.blueCommander !== null && state.blueCommander.alive) {
    return state.blueCommander.position;
  }
  return state.focusPosition;
}

export function distanceSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
