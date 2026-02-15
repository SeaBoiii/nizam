import type { SquadMeta } from './Army';
import type { DifficultyMode } from './Difficulty';
import type { NodeType } from '../overworld/types';
import type { BattleObjectiveType } from '../sim/objectives/ObjectiveTypes';

export interface BattleScenario {
  nodeId: string;
  nodeType: NodeType;
  objectiveType: BattleObjectiveType;
  captureSpeedMultiplier: number;
  holdoutDurationSeconds?: number;
  holdoutWaveInterval?: number;
  holdoutMaxWaves?: number;
  escortTimeLimitSeconds?: number;
  objectiveSeed: number;
  difficultyTier: number;
  difficultyMode: DifficultyMode;
  enemyAIFrequencyMult: number;
  holdoutWaveStrengthMult: number;
  enemySquads: SquadMeta[];
  goldReward: number;
  recruitsReward: number;
  playerHpBuffMultiplier: number;
}

export interface BattleResult {
  scenario: BattleScenario;
  victory: boolean;
  durationSec: number;
  playerInitial: number;
  playerRemaining: number;
  enemyInitial: number;
  enemyRemaining: number;
  playerCasualties: number;
  enemyCasualties: number;
  archetypeDeaths: Record<string, number>;
}
