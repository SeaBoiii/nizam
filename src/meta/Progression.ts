import { ARCHERS, CAVALRY, INFANTRY, SPEARMEN } from '../sim/rules/Archetypes';
import type { UnitArchetype } from '../sim/types/UnitArchetype';
import type { SquadMeta } from './Army';

const ARCHETYPE_BY_ID: Record<string, UnitArchetype> = {
  infantry: INFANTRY,
  spearmen: SPEARMEN,
  cavalry: CAVALRY,
  archers: ARCHERS,
};

const TIER_MULTIPLIERS: Record<number, { hp: number; attack: number; ranged: number; armor: number; speed: number }> = {
  1: { hp: 1, attack: 1, ranged: 1, armor: 1, speed: 1 },
  2: { hp: 1.14, attack: 1.12, ranged: 1.11, armor: 1.12, speed: 1.03 },
  3: { hp: 1.28, attack: 1.22, ranged: 1.2, armor: 1.24, speed: 1.05 },
};

export const MAX_TIER = 3;

export function clampTier(tier: number): number {
  if (tier < 1) {
    return 1;
  }
  if (tier > MAX_TIER) {
    return MAX_TIER;
  }
  return Math.floor(tier);
}

export function getBaseArchetype(archetypeId: string): UnitArchetype {
  const archetype = ARCHETYPE_BY_ID[archetypeId];
  if (!archetype) {
    return INFANTRY;
  }
  return archetype;
}

export function getTieredArchetype(archetypeId: string, tier: number): UnitArchetype {
  const base = getBaseArchetype(archetypeId);
  const normalizedTier = clampTier(tier);
  const mult = TIER_MULTIPLIERS[normalizedTier] ?? TIER_MULTIPLIERS[1];

  return {
    id: `${base.id}_t${normalizedTier}`,
    name: `${base.name} T${normalizedTier}`,
    tags: [...base.tags],
    stats: {
      hp: base.stats.hp * mult.hp,
      moveSpeed: base.stats.moveSpeed * mult.speed,
      attackDamage: base.stats.attackDamage * mult.attack,
      attackRate: base.stats.attackRate,
      meleeRange: base.stats.meleeRange,
      rangedDamage: base.stats.rangedDamage * mult.ranged,
      rangedRange: base.stats.rangedRange,
      projectileSpeed: base.stats.projectileSpeed,
      projectileGravity: base.stats.projectileGravity,
      rangedCooldown: base.stats.rangedCooldown,
      accuracy: base.stats.accuracy,
      armor: base.stats.armor * mult.armor,
      mass: base.stats.mass,
      chargePower: base.stats.chargePower,
      chargeMinSpeed: base.stats.chargeMinSpeed,
    },
  };
}

export function squadPowerScore(squad: SquadMeta): number {
  const base = getBaseArchetype(squad.archetypeId);
  const tierScale = 1 + (clampTier(squad.tier) - 1) * 0.27;
  return squad.size * tierScale * (0.7 + base.stats.attackDamage * 0.025 + base.stats.armor * 0.03);
}

export function canUpgradeSquad(squad: SquadMeta): boolean {
  return clampTier(squad.tier) < MAX_TIER;
}

export function upgradeSquadTier(squad: SquadMeta): boolean {
  if (!canUpgradeSquad(squad)) {
    return false;
  }

  squad.tier = clampTier(squad.tier + 1);
  return true;
}

export function archetypeChoices(): string[] {
  return ['infantry', 'spearmen', 'cavalry', 'archers'];
}

export function archetypeDisplayName(archetypeId: string): string {
  return getBaseArchetype(archetypeId).name;
}