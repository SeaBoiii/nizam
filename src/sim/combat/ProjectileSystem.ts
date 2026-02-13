import { Graphics, type Container } from 'pixi.js';
import type { GameEvents } from '../events/GameEvents';
import type { Soldier } from '../Soldier';
import { SOLDIER_RADIUS } from '../Soldier';
import { TeamId } from '../types';
import type { SpatialHash } from '../SpatialHash';
import { FRIENDLY_FIRE_ENABLED } from '../rules/Constants';
import { computeRangedDamage } from '../rules/RangedDamage';
import { Projectile, type ProjectileSpawnParams } from './Projectile';

interface SpawnParams extends Omit<ProjectileSpawnParams, 'id'> {}

export class ProjectileSystem {
  readonly graphics: Graphics;

  private readonly projectiles: Projectile[] = [];
  private readonly pool: Projectile[] = [];
  private readonly nearbyUnits: Soldier[] = [];
  private nextId = 1;

  constructor(layer: Container) {
    this.graphics = new Graphics();
    layer.addChild(this.graphics);
  }

  clear(): void {
    for (let i = 0; i < this.projectiles.length; i += 1) {
      const projectile = this.projectiles[i];
      projectile.alive = false;
      this.pool.push(projectile);
    }

    this.projectiles.length = 0;
    this.graphics.clear();
  }

  spawnProjectile(params: SpawnParams): void {
    const projectile = this.pool.length > 0 ? this.pool.pop()! : new Projectile();
    projectile.reset({
      id: this.nextId,
      teamId: params.teamId,
      x: params.x,
      y: params.y,
      vx: params.vx,
      vy: params.vy,
      damage: params.damage,
      shooterUnitId: params.shooterUnitId,
      shooterSquadId: params.shooterSquadId,
      gravity: params.gravity,
      radius: params.radius,
      maxLife: params.maxLife,
      drag: params.drag,
    });

    this.nextId += 1;
    this.projectiles.push(projectile);
  }

  update(dt: number, units: readonly Soldier[], spatialGrid: SpatialHash, events: GameEvents): void {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.projectiles[i];
      if (!projectile.alive) {
        this.recycleAt(i);
        continue;
      }

      projectile.update(dt);
      if (!projectile.alive) {
        this.recycleAt(i);
        continue;
      }

      const collisionRadius = projectile.radius + SOLDIER_RADIUS;
      spatialGrid.queryRadius(projectile.pos.x, projectile.pos.y, collisionRadius + 1, this.nearbyUnits);

      for (let unitIndex = 0; unitIndex < this.nearbyUnits.length; unitIndex += 1) {
        const unit = this.nearbyUnits[unitIndex];
        if (!unit.alive || unit.id === projectile.shooterUnitId) {
          continue;
        }

        if (!FRIENDLY_FIRE_ENABLED && unit.team === projectile.teamId) {
          continue;
        }

        const dx = unit.position.x - projectile.pos.x;
        const dy = unit.position.y - projectile.pos.y;
        const hitRadius = collisionRadius;
        if (dx * dx + dy * dy > hitRadius * hitRadius) {
          continue;
        }

        const damage = computeRangedDamage(projectile, unit, projectile.damage);
        unit.applyDamage(damage);
        events.emitDamage(projectile.teamId, unit.team, unit.position.x, unit.position.y, damage);

        projectile.alive = false;
        this.recycleAt(i);
        break;
      }
    }

    this.render();
    void units;
  }

  private render(): void {
    this.graphics.clear();

    for (let i = 0; i < this.projectiles.length; i += 1) {
      const projectile = this.projectiles[i];
      const color = projectile.teamId === TeamId.Blue ? 0xbfdfff : 0xffc9b0;

      this.graphics.moveTo(projectile.prevPos.x, projectile.prevPos.y);
      this.graphics.lineTo(projectile.pos.x, projectile.pos.y);
      this.graphics.stroke({ color, alpha: 0.35, width: 1 });

      this.graphics.circle(projectile.pos.x, projectile.pos.y, projectile.radius);
      this.graphics.fill({ color, alpha: 0.95 });
    }
  }

  private recycleAt(index: number): void {
    const projectile = this.projectiles[index];
    projectile.alive = false;
    this.pool.push(projectile);

    const lastIndex = this.projectiles.length - 1;
    if (index !== lastIndex) {
      this.projectiles[index] = this.projectiles[lastIndex];
    }
    this.projectiles.pop();
  }
}
