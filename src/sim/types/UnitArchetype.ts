export type UnitTag = 'infantry' | 'spear' | 'cavalry' | 'archer' | 'shield' | 'light' | 'heavy' | 'caravan';

export interface UnitStats {
  hp: number;
  moveSpeed: number;
  attackDamage: number;
  attackRate: number;
  meleeRange: number;
  rangedDamage: number;
  rangedRange: number;
  projectileSpeed: number;
  projectileGravity: number;
  rangedCooldown: number;
  accuracy: number;
  armor: number;
  mass: number;
  chargePower: number;
  chargeMinSpeed: number;
}

export interface UnitArchetype {
  id: string;
  name: string;
  tags: UnitTag[];
  stats: UnitStats;
}
