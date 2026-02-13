import { clamp } from '../utils/math';

export enum DifficultyMode {
  NORMAL = 'NORMAL',
  HARD = 'HARD',
}

export interface DifficultyScaling {
  enemyTierBonus: number;
  enemySizeMult: number;
  enemyAIFrequencyMult: number;
  rewardGoldMult: number;
}

export function normalizeDifficultyMode(value: unknown): DifficultyMode {
  return value === DifficultyMode.HARD ? DifficultyMode.HARD : DifficultyMode.NORMAL;
}

export function getScaling(depth: number, mode: DifficultyMode): DifficultyScaling {
  const normalizedDepth = Math.max(0, Math.floor(depth));
  const depthFactor = clamp(normalizedDepth / 15, 0, 1);
  const hardBonus = mode === DifficultyMode.HARD ? 1 : 0;

  const enemyTierBonus = Math.min(2, Math.floor((normalizedDepth + hardBonus * 3) / 7));
  const enemySizeMult = clamp(1 + depthFactor * 0.22 + hardBonus * 0.12, 1, 1.4);
  const enemyAIFrequencyMult = clamp(1 + depthFactor * 0.2 + hardBonus * 0.22, 1, 1.5);
  const rewardGoldMult = clamp(1 + depthFactor * 0.08 + hardBonus * 0.08, 1, 1.2);

  return {
    enemyTierBonus,
    enemySizeMult,
    enemyAIFrequencyMult,
    rewardGoldMult,
  };
}

