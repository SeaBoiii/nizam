import type { TeamId } from '../types';
import { Vec2 } from '../../utils/vec2';
import { PROJECTILE_DEFAULT_DRAG, PROJECTILE_DEFAULT_MAX_LIFE, PROJECTILE_DEFAULT_RADIUS } from '../rules/Constants';

export interface ProjectileSpawnParams {
  id: number;
  teamId: TeamId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  shooterUnitId: number;
  shooterSquadId: number;
  gravity: number;
  radius?: number;
  maxLife?: number;
  drag?: number;
}

export class Projectile {
  id = 0;
  teamId: TeamId = 0;
  readonly pos = new Vec2();
  readonly vel = new Vec2();
  readonly prevPos = new Vec2();
  radius = PROJECTILE_DEFAULT_RADIUS;
  damage = 0;
  alive = false;
  life = 0;
  maxLife = PROJECTILE_DEFAULT_MAX_LIFE;
  shooterUnitId = -1;
  shooterSquadId = -1;
  gravity = 0;
  drag = PROJECTILE_DEFAULT_DRAG;

  reset(params: ProjectileSpawnParams): void {
    this.id = params.id;
    this.teamId = params.teamId;
    this.pos.set(params.x, params.y);
    this.prevPos.set(params.x, params.y);
    this.vel.set(params.vx, params.vy);
    this.radius = params.radius ?? PROJECTILE_DEFAULT_RADIUS;
    this.damage = params.damage;
    this.alive = true;
    this.life = 0;
    this.maxLife = params.maxLife ?? PROJECTILE_DEFAULT_MAX_LIFE;
    this.shooterUnitId = params.shooterUnitId;
    this.shooterSquadId = params.shooterSquadId;
    this.gravity = params.gravity;
    this.drag = params.drag ?? PROJECTILE_DEFAULT_DRAG;
  }

  update(dt: number): void {
    if (!this.alive) {
      return;
    }

    this.prevPos.copy(this.pos);

    if (this.drag > 0) {
      const damp = Math.max(0, 1 - this.drag * dt);
      this.vel.scale(damp);
    }

    this.vel.y += this.gravity * dt;

    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    this.life += dt;
    if (this.life >= this.maxLife) {
      this.alive = false;
    }
  }
}