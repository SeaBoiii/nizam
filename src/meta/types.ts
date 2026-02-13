import type { SquadMeta } from './Army';
import type { NodeType } from '../overworld/types';

export interface BattleScenario {
  nodeId: string;
  nodeType: NodeType;
  objectiveType: 'capture';
  captureSpeedMultiplier: number;
  enemySquads: SquadMeta[];
  goldReward: number;
  recruitsReward: number;
  playerHpBuffMultiplier: number;
}

export interface BattleResult {
  scenario: BattleScenario;
  victory: boolean;
  playerInitial: number;
  playerRemaining: number;
  enemyInitial: number;
  enemyRemaining: number;
  playerCasualties: number;
  enemyCasualties: number;
}