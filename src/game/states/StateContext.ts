import type { Application, Container } from 'pixi.js';
import type { ArmyState } from '../../meta/Army';
import type { BattleResult, BattleScenario } from '../../meta/types';
import type { MapState, RunState } from '../../overworld/types';

export type GameStateId = 'TITLE' | 'OVERWORLD' | 'BATTLE' | 'REWARDS';

export interface CampaignData {
  runState: RunState;
  armyState: ArmyState;
  mapState: MapState;
}

export interface StateContext {
  app: Application;
  stage: Container;
  getCampaignData(): CampaignData | null;
  setCampaignData(data: CampaignData): void;
  startNewRun(): void;
  hasSaveData(): boolean;
  loadSaveData(): boolean;
  saveCampaignData(): void;
  clearSaveData(): void;
  setPendingScenario(scenario: BattleScenario): void;
  getPendingScenario(): BattleScenario | null;
  setLastBattleResult(result: BattleResult): void;
  getLastBattleResult(): BattleResult | null;
  transitionTo(stateId: GameStateId, payload?: unknown): void;
}