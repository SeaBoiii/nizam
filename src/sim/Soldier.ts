import { Graphics } from 'pixi.js';
import { Vec2 } from '../utils/vec2';
import type { UnitArchetype, UnitStats, UnitTag } from './types/UnitArchetype';
import type { Squad } from './Squad';
import type { TeamId } from './types';

export const SOLDIER_RADIUS = 4;
const SPRITE_RADIUS = SOLDIER_RADIUS + 0.95;

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

function tintColor(color: number, mult: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((color >> 16) & 0xff) * mult)));
  const g = Math.max(0, Math.min(255, Math.round(((color >> 8) & 0xff) * mult)));
  const b = Math.max(0, Math.min(255, Math.round((color & 0xff) * mult)));
  return (r << 16) | (g << 8) | b;
}

function drawGlyph(sprite: Graphics, tags: ReadonlySet<UnitTag>, teamColor: number): void {
  const bodyColor = tintColor(teamColor, 1.02);
  const borderColor = tintColor(teamColor, 0.56);
  const accentColor = tags.has('heavy') ? 0xf4d7a0 : 0xe4f1ff;
  const supportColor = tintColor(teamColor, 1.2);

  sprite.clear();

  sprite.circle(0, 0, SPRITE_RADIUS + 0.65);
  sprite.fill({ color: 0x000000, alpha: 0.28 });
  sprite.circle(0, 0, SPRITE_RADIUS);
  sprite.fill({ color: bodyColor, alpha: 0.98 });
  sprite.circle(0, 0, SPRITE_RADIUS);
  sprite.stroke({ color: borderColor, alpha: 0.95, width: 1.2 });

  if (tags.has('cavalry')) {
    sprite.moveTo(-2.7, 0);
    sprite.lineTo(-1, -2.5);
    sprite.lineTo(2.8, -0.8);
    sprite.lineTo(2.5, 1.2);
    sprite.lineTo(-1.2, 2.5);
    sprite.closePath();
    sprite.fill({ color: accentColor, alpha: 0.78 });
  } else if (tags.has('archer')) {
    sprite.moveTo(-2.8, -2.7);
    sprite.lineTo(-4.1, 0);
    sprite.lineTo(-2.8, 2.7);
    sprite.stroke({ color: accentColor, alpha: 0.9, width: 1.15 });

    sprite.moveTo(-1.1, -0.2);
    sprite.lineTo(3.1, -0.2);
    sprite.stroke({ color: accentColor, alpha: 0.9, width: 1.15 });
    sprite.moveTo(3.1, -0.2);
    sprite.lineTo(1.9, -1.2);
    sprite.lineTo(1.9, 0.8);
    sprite.closePath();
    sprite.fill({ color: accentColor, alpha: 0.9 });
  } else if (tags.has('slinger')) {
    sprite.circle(-0.6, 0, 2.25);
    sprite.stroke({ color: accentColor, alpha: 0.9, width: 1.2 });
    sprite.circle(2.3, 0, 1.05);
    sprite.fill({ color: supportColor, alpha: 0.84 });
  } else if (tags.has('spear')) {
    sprite.moveTo(-3.2, 0);
    sprite.lineTo(2.7, 0);
    sprite.stroke({ color: accentColor, alpha: 0.9, width: 1.15 });
    sprite.moveTo(2.7, 0);
    sprite.lineTo(0.9, -1.5);
    sprite.lineTo(0.9, 1.5);
    sprite.closePath();
    sprite.fill({ color: accentColor, alpha: 0.9 });
  } else {
    sprite.roundRect(-2.6, -2.6, 5.2, 5.2, 1.3);
    sprite.fill({ color: accentColor, alpha: 0.74 });
  }

  if (tags.has('shield')) {
    sprite.moveTo(0.8, -2.2);
    sprite.lineTo(2.5, -1.5);
    sprite.lineTo(2.5, 1.5);
    sprite.lineTo(0.8, 2.2);
    sprite.closePath();
    sprite.fill({ color: 0xc7d9eb, alpha: 0.8 });
  }

  sprite.moveTo(SPRITE_RADIUS + 0.75, 0);
  sprite.lineTo(SPRITE_RADIUS - 1.05, -1.5);
  sprite.lineTo(SPRITE_RADIUS - 1.05, 1.5);
  sprite.closePath();
  sprite.fill({ color: 0xfef6d2, alpha: 0.92 });
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
    drawGlyph(this.sprite, this.tags, options.color);
    this.sprite.position.set(this.position.x, this.position.y);
    this.sprite.rotation = Math.atan2(this.lastFacing.y, this.lastFacing.x);
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

    const speedSq = this.velocity.lenSq();
    if (speedSq > 1.5) {
      const invLen = 1 / Math.sqrt(speedSq);
      this.lastFacing.x = this.velocity.x * invLen;
      this.lastFacing.y = this.velocity.y * invLen;
    } else {
      this.lastFacing.x = Math.cos(this.squad.facing);
      this.lastFacing.y = Math.sin(this.squad.facing);
    }

    this.sprite.position.set(this.position.x, this.position.y);
    this.sprite.rotation = Math.atan2(this.lastFacing.y, this.lastFacing.x);
  }
}
