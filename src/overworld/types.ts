import type { DifficultyMode } from '../meta/Difficulty';

export type NodeType = 'BATTLE' | 'SHOP' | 'RECRUIT' | 'REST' | 'ELITE' | 'BOSS';

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
  currentNodeId: string;
  clearedNodeIds: string[];
  step: number;
  difficultyTier: number;
  difficultyMode: DifficultyMode;
  restBonusBattles: number;
  battleNodesCleared: number;
  lastRewardedNodeId: string;
}
