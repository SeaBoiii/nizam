import type { DifficultyMode } from '../meta/Difficulty';

export type NodeType = 'BATTLE' | 'SHOP' | 'RECRUIT' | 'REST' | 'ELITE' | 'BOSS';
export type RunMode = 'NORMAL' | 'DAILY';

export interface RunScoreBreakdown {
  baseScore: number;
  bossBonus: number;
  nodesScore: number;
  battlesScore: number;
  timePenalty: number;
  casualtyPenalty: number;
  difficultyMult: number;
  finalScore: number;
  nodesCleared: number;
  battlesWon: number;
  totalBattleDurationSec: number;
  avgCasualtiesPct: number;
}

export interface Node {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  edges: string[];
  cleared: boolean;
}

export interface MapState {
  nodes: Node[];
  startNodeId: string;
  bossNodeId: string;
}

export interface RunState {
  seed: number;
  mode: RunMode;
  dateKey: string | null;
  packIdLocked: string | null;
  currentNodeId: string;
  clearedNodeIds: string[];
  step: number;
  difficultyTier: number;
  difficultyMode: DifficultyMode;
  restBonusBattles: number;
  battleNodesCleared: number;
  lastRewardedNodeId: string;
  consecutiveLosses: number;
  lastObjectiveType: string | null;
  lastMapId: string | null;
  finalScore: number | null;
  scoreBreakdown: RunScoreBreakdown | null;
}
