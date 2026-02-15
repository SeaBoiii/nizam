import { ARCHER_BASE_SPREAD_RADIANS, ARCHER_MAX_LEAD_TIME, ARCHER_MOVING_SPREAD_MULTIPLIER, ARCHER_MOVING_SPEED_THRESHOLD } from '../rules/Constants';
import { clamp } from '../../utils/math';
import type { GameEvents } from '../events/GameEvents';
import type { Soldier } from '../Soldier';
import type { Squad } from '../Squad';
import { canSquadFireRanged } from '../orders/RangedOrders';
import { TerrainMods } from '../rules/TerrainMods';
import type { SpatialHash } from '../SpatialHash';
import { ProjectileSystem } from './ProjectileSystem';

export class RangedSystem {
  private readonly neighbors: Soldier[] = [];
  private randomState = 0x8d12f2a1;

  update(
    dt: number,
    squads: readonly Squad[],
    aliveUnits: readonly Soldier[],
    spatialGrid: SpatialHash,
    projectileSystem: ProjectileSystem,
    events: GameEvents,
    terrainMods: TerrainMods | null = null,
  ): void {
    for (let squadIndex = 0; squadIndex < squads.length; squadIndex += 1) {
      const squad = squads[squadIndex];
      if (!canSquadFireRanged(squad.order)) {
        continue;
      }

      const soldiers = squad.soldiers;
      for (let i = 0; i < soldiers.length; i += 1) {
        const unit = soldiers[i];
        if (!unit.alive || !unit.tags.has('archer')) {
          continue;
        }

        if (unit.rangedCooldown > 0) {
          unit.rangedCooldown = Math.max(0, unit.rangedCooldown - dt);
        }

        const range = unit.baseStats.rangedRange * (terrainMods ? terrainMods.getRangedRangeMult(unit.position) : 1);
        if (range <= 0 || unit.rangedCooldown > 0) {
          continue;
        }

        const target = this.findNearestTarget(unit, range, spatialGrid);
        if (target === null) {
          continue;
        }

        const dx = target.position.x - unit.position.x;
        const dy = target.position.y - unit.position.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= 0.0001) {
          continue;
        }

        const perkMods = unit.squad.perkMods;
        const projectileSpeed =
          unit.baseStats.projectileSpeed *
          Math.max(0.2, perkMods.projectileSpeedMult) *
          (terrainMods ? terrainMods.getProjectileSpeedMult(unit.position) : 1);
        if (projectileSpeed <= 0.0001) {
          continue;
        }

        const leadTime = clamp(dist / projectileSpeed, 0, ARCHER_MAX_LEAD_TIME);
        let aimX = target.position.x + target.velocity.x * leadTime;
        let aimY = target.position.y + target.velocity.y * leadTime;

        let dirX = aimX - unit.position.x;
        let dirY = aimY - unit.position.y;
        let dirLen = Math.hypot(dirX, dirY);

        if (dirLen <= 0.0001) {
          dirX = dx;
          dirY = dy;
          dirLen = dist;
        }

        const invDirLen = 1 / dirLen;
        dirX *= invDirLen;
        dirY *= invDirLen;

        const accuracy = clamp(
          unit.baseStats.accuracy +
            perkMods.rangedAccuracyAdd +
            (terrainMods ? terrainMods.getRangedAccuracyAdd(unit.position, target.position) : 0),
          0,
          1,
        );
        let spread = ARCHER_BASE_SPREAD_RADIANS * (1 - accuracy);
        if (unit.velocity.lenSq() > ARCHER_MOVING_SPEED_THRESHOLD * ARCHER_MOVING_SPEED_THRESHOLD) {
          spread *= ARCHER_MOVING_SPREAD_MULTIPLIER;
        }

        if (spread > 0.0001) {
          const angleOffset = this.randomSigned() * spread;
          const cosA = Math.cos(angleOffset);
          const sinA = Math.sin(angleOffset);

          const rotatedX = dirX * cosA - dirY * sinA;
          const rotatedY = dirX * sinA + dirY * cosA;
          dirX = rotatedX;
          dirY = rotatedY;
        }

        aimX = unit.position.x + dirX * projectileSpeed;
        aimY = unit.position.y + dirY * projectileSpeed;

        projectileSystem.spawnProjectile({
          teamId: unit.team,
          x: unit.position.x + dirX * 6,
          y: unit.position.y + dirY * 6,
          vx: aimX - unit.position.x,
          vy: aimY - unit.position.y,
          damage: unit.baseStats.rangedDamage,
          shooterUnitId: unit.id,
          shooterSquadId: unit.squad.id,
          gravity: unit.baseStats.projectileGravity,
        });
        events.emitProjectileFired(unit.team, unit.position.x, unit.position.y);

        const cooldownFromRate = 1 / Math.max(0.2, unit.baseStats.attackRate);
        unit.rangedCooldown = unit.baseStats.rangedCooldown > 0 ? unit.baseStats.rangedCooldown : cooldownFromRate;
      }
    }

    void aliveUnits;
  }

  private findNearestTarget(attacker: Soldier, range: number, spatialGrid: SpatialHash): Soldier | null {
    const maxRangeSq = range * range;
    spatialGrid.queryRadius(attacker.position.x, attacker.position.y, range, this.neighbors);

    let nearest: Soldier | null = null;
    let nearestDistSq = maxRangeSq;

    for (let i = 0; i < this.neighbors.length; i += 1) {
      const candidate = this.neighbors[i];
      if (!candidate.alive || candidate.team === attacker.team) {
        continue;
      }

      const dx = candidate.position.x - attacker.position.x;
      const dy = candidate.position.y - attacker.position.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > nearestDistSq) {
        continue;
      }

      nearestDistSq = distSq;
      nearest = candidate;
    }

    return nearest;
  }

  private randomSigned(): number {
    this.randomState = (this.randomState * 1664525 + 1013904223) >>> 0;
    const normalized = this.randomState / 0xffffffff;
    return normalized * 2 - 1;
  }
}
