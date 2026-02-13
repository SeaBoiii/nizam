import { contentManager } from '../content/ContentManager';
import type { PerkContent, PerkRewardRulesContent } from '../content/ContentTypes';
import type { RunState } from '../overworld/types';
import { createPerkMods, mergePerkMods, type CombinedPerkMods } from '../sim/rules/PerkMods';
import { SeededRng } from '../utils/rng';

export interface PerkState {
  pickedPerkIds: string[];
  lastOfferedAtBattleCount: number;
}

export function createPerkState(): PerkState {
  return {
    pickedPerkIds: [],
    lastOfferedAtBattleCount: 0,
  };
}

function clonePerk(perk: PerkContent): PerkContent {
  return {
    id: perk.id,
    name: perk.name,
    desc: perk.desc,
    rarity: perk.rarity,
    mods: { ...perk.mods },
  };
}

export function getCombinedPerkMods(perkIds: readonly string[]): CombinedPerkMods {
  const combined = createPerkMods();
  for (let i = 0; i < perkIds.length; i += 1) {
    const perk = contentManager.getPerk(perkIds[i]);
    if (perk === null) {
      continue;
    }
    mergePerkMods(combined, perk.mods as Record<string, unknown>);
  }
  return combined;
}

export function shouldOfferPerk(
  runState: RunState,
  rewardRules: PerkRewardRulesContent,
  perkState: PerkState,
): boolean {
  const everyNNodes = Math.max(1, Math.floor(rewardRules.everyNNodes));
  const clearedBattles = Math.max(0, Math.floor(runState.battleNodesCleared));
  if (clearedBattles <= 0) {
    return false;
  }
  if (clearedBattles % everyNNodes !== 0) {
    return false;
  }
  return perkState.lastOfferedAtBattleCount < clearedBattles;
}

export function getDeterministicPerkChoices(
  runState: RunState,
  perkState: PerkState,
  choiceCount: number,
  perkPool: readonly PerkContent[],
): PerkContent[] {
  const desiredCount = Math.max(1, Math.floor(choiceCount));
  const available: PerkContent[] = [];
  for (let i = 0; i < perkPool.length; i += 1) {
    const perk = perkPool[i];
    if (!perkState.pickedPerkIds.includes(perk.id)) {
      available.push(perk);
    }
  }

  if (available.length === 0) {
    return [];
  }
  if (available.length <= desiredCount) {
    return available.map(clonePerk);
  }

  const rngSeed =
    (runState.seed ^
      Math.imul(runState.battleNodesCleared + 1, 0x9e3779b1) ^
      Math.imul(runState.step + 17, 0x85ebca6b)) >>>
    0;
  const rng = new SeededRng(rngSeed);

  for (let i = available.length - 1; i > 0; i -= 1) {
    const swapIndex = rng.int(0, i);
    const temp = available[i];
    available[i] = available[swapIndex];
    available[swapIndex] = temp;
  }

  const picks: PerkContent[] = [];
  for (let i = 0; i < desiredCount; i += 1) {
    picks.push(clonePerk(available[i]));
  }
  return picks;
}

