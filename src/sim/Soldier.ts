import { Graphics } from 'pixi.js';
import { Vec2 } from '../utils/vec2';
import type { UnitArchetype, UnitStats, UnitTag } from './types/UnitArchetype';
import type { Squad } from './Squad';
import type { TeamId } from './types';

export const SOLDIER_RADIUS = 4;

export type ChargeState = 'none' | 'charging' | 'cooldown';

interface SoldierOptions {
  id: number;
  squad: Squad;
  team: TeamId;
  slotIndex: number;
  color: number;
  initialPosition: Vec2;
  archetype: UnitArchetype;
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

  readonly archetypeId: string;
  readonly tags: Set<UnitTag>;
  readonly baseStats: UnitStats;
  readonly hpMax: number;
  readonly mass: number;
  readonly lastFacing: Vec2;

  hp: number;
  alive = true;

  attackCooldown = 0;
  rangedCooldown = 0;
  trailCooldown = 0;
  chargeState: ChargeState = 'none';
  chargeCooldown = 0;
  chargeReady = true;

  constructor(options: SoldierOptions) {
    this.id = options.id;
    this.squad = options.squad;
    this.team = options.team;
    this.slotIndex = options.slotIndex;
    this.position = options.initialPosition.clone();
    this.velocity = new Vec2();
    this.jitterPhase = this.id * 0.61 + this.slotIndex * 0.27;

    this.archetypeId = options.archetype.id;
    this.tags = new Set(options.archetype.tags);
    this.baseStats = {
      hp: options.archetype.stats.hp,
      moveSpeed: options.archetype.stats.moveSpeed,
      attackDamage: options.archetype.stats.attackDamage,
      attackRate: options.archetype.stats.attackRate,
      meleeRange: options.archetype.stats.meleeRange,
      rangedDamage: options.archetype.stats.rangedDamage,
      rangedRange: options.archetype.stats.rangedRange,
      projectileSpeed: options.archetype.stats.projectileSpeed,
      projectileGravity: options.archetype.stats.projectileGravity,
      rangedCooldown: options.archetype.stats.rangedCooldown,
      accuracy: options.archetype.stats.accuracy,
      armor: options.archetype.stats.armor,
      mass: options.archetype.stats.mass,
      chargePower: options.archetype.stats.chargePower,
      chargeMinSpeed: options.archetype.stats.chargeMinSpeed,
    };
    this.hpMax = this.baseStats.hp;
    this.mass = this.baseStats.mass;
    this.hp = this.hpMax;
    this.lastFacing = new Vec2(Math.cos(this.squad.facing), Math.sin(this.squad.facing));

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
