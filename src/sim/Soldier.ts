import { Graphics } from 'pixi.js';
import { Vec2 } from '../utils/vec2';
import type { Squad } from './Squad';
import type { TeamId } from './types';

export const SOLDIER_RADIUS = 4;

interface SoldierOptions {
  id: number;
  squad: Squad;
  team: TeamId;
  slotIndex: number;
  color: number;
  initialPosition: Vec2;
}

export class Soldier {
  readonly id: number;
  readonly squad: Squad;
  readonly team: TeamId;
  readonly slotIndex: number;
  readonly position: Vec2;
  readonly velocity: Vec2;
  readonly sprite: Graphics;
  readonly jitterPhase: number;

  hp = 100;
  alive = true;

  constructor(options: SoldierOptions) {
    this.id = options.id;
    this.squad = options.squad;
    this.team = options.team;
    this.slotIndex = options.slotIndex;
    this.position = options.initialPosition.clone();
    this.velocity = new Vec2();
    this.jitterPhase = this.id * 0.61 + this.slotIndex * 0.27;

    this.sprite = new Graphics();
    this.sprite.circle(0, 0, SOLDIER_RADIUS);
    this.sprite.fill({ color: options.color, alpha: 1 });
    this.sprite.position.set(this.position.x, this.position.y);
  }

  applyDamage(amount: number): void {
    if (!this.alive) {
      return;
    }

    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.velocity.set(0, 0);
      this.sprite.visible = false;
    }
  }

  syncGraphics(): void {
    if (!this.alive) {
      return;
    }
    this.sprite.position.set(this.position.x, this.position.y);
  }
}