import type { UnitArchetype, UnitStats } from '../types/UnitArchetype';

function stats(values: UnitStats): UnitStats {
  return values;
}

export const INFANTRY: UnitArchetype = {
  id: 'infantry',
  name: 'Infantry',
  tags: ['infantry', 'shield'],
  stats: stats({
    hp: 100,
    moveSpeed: 90,
    attackDamage: 10,
    attackRate: 1,
    meleeRange: 13,
    rangedDamage: 0,
    rangedRange: 0,
    projectileSpeed: 0,
    projectileGravity: 0,
    rangedCooldown: 0,
    accuracy: 1,
    armor: 4,
    mass: 1,
    chargePower: 1,
    chargeMinSpeed: 999,
  }),
};

export const SPEARMEN: UnitArchetype = {
  id: 'spearmen',
  name: 'Spearmen',
  tags: ['infantry', 'spear'],
  stats: stats({
    hp: 95,
    moveSpeed: 85,
    attackDamage: 9,
    attackRate: 1,
    meleeRange: 14,
    rangedDamage: 0,
    rangedRange: 0,
    projectileSpeed: 0,
    projectileGravity: 0,
    rangedCooldown: 0,
    accuracy: 1,
    armor: 3,
    mass: 1,
    chargePower: 1,
    chargeMinSpeed: 999,
  }),
};

export const CAVALRY: UnitArchetype = {
  id: 'cavalry',
  name: 'Cavalry',
  tags: ['cavalry', 'heavy'],
  stats: stats({
    hp: 120,
    moveSpeed: 140,
    attackDamage: 11,
    attackRate: 0.9,
    meleeRange: 14,
    rangedDamage: 0,
    rangedRange: 0,
    projectileSpeed: 0,
    projectileGravity: 0,
    rangedCooldown: 0,
    accuracy: 1,
    armor: 5,
    mass: 1.4,
    chargePower: 2.2,
    chargeMinSpeed: 110,
  }),
};

export const ARCHERS: UnitArchetype = {
  id: 'archers',
  name: 'Archers',
  tags: ['archer', 'light'],
  stats: stats({
    hp: 75,
    moveSpeed: 95,
    attackDamage: 6,
    attackRate: 1.25,
    meleeRange: 12,
    rangedDamage: 7.2,
    rangedRange: 390,
    projectileSpeed: 340,
    projectileGravity: 150,
    rangedCooldown: 0,
    accuracy: 0.78,
    armor: 1,
    mass: 0.9,
    chargePower: 1,
    chargeMinSpeed: 999,
  }),
};

export const ALL_ARCHETYPES: readonly UnitArchetype[] = [INFANTRY, SPEARMEN, CAVALRY, ARCHERS];
