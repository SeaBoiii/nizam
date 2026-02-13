import { contentManager } from '../content/ContentManager';
import type { UnitArchetype } from '../sim/types/UnitArchetype';
import type { SquadMeta } from './Army';

export function clampTier(tier: number): number {
  const maxTier = contentManager.getMaxTier();
  if (!Number.isFinite(tier)) {
    return 1;
  }
  if (tier < 1) {
    return 1;
  }
  if (tier > maxTier) {
    return maxTier;
  }
  return Math.floor(tier);
}

export function getBaseArchetype(archetypeId: string): UnitArchetype {
  return contentManager.getBaseUnit(archetypeId);
}

export function getTieredArchetype(archetypeId: string, tier: number): UnitArchetype {
  return contentManager.getUnit(archetypeId, clampTier(tier));
}

export function squadPowerScore(squad: SquadMeta): number {
  const archetype = getTieredArchetype(squad.archetypeId, squad.tier);
  return squad.size * (0.7 + archetype.stats.attackDamage * 0.025 + archetype.stats.armor * 0.03);
}

export function canUpgradeSquad(squad: SquadMeta): boolean {
  return contentManager.getNextTier(squad.archetypeId, clampTier(squad.tier)) !== null;
}

export function nextTierForSquad(squad: SquadMeta): number | null {
  return contentManager.getNextTier(squad.archetypeId, clampTier(squad.tier));
}

export function upgradeCostForSquad(squad: SquadMeta): number {
  const nextTier = nextTierForSquad(squad);
  if (nextTier === null) {
    return 0;
  }
  return contentManager.getUpgradeCost(squad.archetypeId, nextTier);
}

export function upgradeSquadTier(squad: SquadMeta): boolean {
  const nextTier = nextTierForSquad(squad);
  if (nextTier === null) {
    return false;
  }
  squad.tier = nextTier;
  return true;
}

export function archetypeChoices(): string[] {
  return contentManager.getRecruitableArchetypeIds();
}

export function archetypeDisplayName(archetypeId: string): string {
  return getBaseArchetype(archetypeId).name;
}
