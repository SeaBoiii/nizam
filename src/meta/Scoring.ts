import { DifficultyMode } from './Difficulty';
import type { RunScoreBreakdown } from '../overworld/types';

export interface RunScoreInput {
  nodesCleared: number;
  battlesWon: number;
  totalBattleDurationSec: number;
  avgCasualtiesPct: number;
  difficulty: DifficultyMode;
  bossCleared: boolean;
}

export const SCORE_TUNING = {
  nodeScore: 1000,
  battleWinScore: 300,
  bossBonus: 2500,
  timePenaltyPerSec: 2,
  casualtyPenaltyScale: 1500,
  hardDifficultyMult: 1.25,
  normalDifficultyMult: 1,
} as const;

function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

export function computeRunScore(input: RunScoreInput): RunScoreBreakdown {
  const nodesCleared = Math.max(0, Math.floor(input.nodesCleared));
  const battlesWon = Math.max(0, Math.floor(input.battlesWon));
  const totalBattleDurationSec = Math.max(0, input.totalBattleDurationSec);
  const avgCasualtiesPct = clamp01(input.avgCasualtiesPct);

  const nodesScore = nodesCleared * SCORE_TUNING.nodeScore;
  const battlesScore = battlesWon * SCORE_TUNING.battleWinScore;
  const bossBonus = input.bossCleared ? SCORE_TUNING.bossBonus : 0;
  const baseScore = nodesScore + battlesScore + bossBonus;

  const timePenalty = Math.floor(totalBattleDurationSec * SCORE_TUNING.timePenaltyPerSec);
  const casualtyPenalty = Math.floor(avgCasualtiesPct * SCORE_TUNING.casualtyPenaltyScale);
  const rawScore = baseScore - timePenalty - casualtyPenalty;
  const difficultyMult =
    input.difficulty === DifficultyMode.HARD ? SCORE_TUNING.hardDifficultyMult : SCORE_TUNING.normalDifficultyMult;

  const finalScore = Math.max(0, Math.floor(rawScore * difficultyMult));

  return {
    baseScore,
    bossBonus,
    nodesScore,
    battlesScore,
    timePenalty,
    casualtyPenalty,
    difficultyMult,
    finalScore,
    nodesCleared,
    battlesWon,
    totalBattleDurationSec,
    avgCasualtiesPct,
  };
}
