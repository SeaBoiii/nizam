import type { Application, Container } from 'pixi.js';
import type { ArmyState } from '../../meta/Army';
import type { DifficultyMode } from '../../meta/Difficulty';
import type { PerkState } from '../../meta/Perks';
import type { StatsV1 } from '../../meta/Stats';
import type { BattleResult, BattleScenario } from '../../meta/types';
import type { MapState, RunState } from '../../overworld/types';
import type { GameEvents } from '../../sim/events/GameEvents';

export type GameStateId = 'TITLE' | 'OVERWORLD' | 'BATTLE' | 'REWARDS' | 'STATS';

export interface CampaignData {
  runState: RunState;
  armyState: ArmyState;
  perkState: PerkState;
  mapState: MapState;
}

export interface StateContext {
  app: Application;
  stage: Container;
  getCampaignData(): CampaignData | null;
  setCampaignData(data: CampaignData): void;
  startNewRun(mode?: DifficultyMode): void;
  hasSaveData(): boolean;
  loadSaveData(): boolean;
  saveCampaignData(): void;
  clearSaveData(): void;
  setPendingScenario(scenario: BattleScenario): void;
  getPendingScenario(): BattleScenario | null;
  setLastBattleResult(result: BattleResult): void;
  getLastBattleResult(): BattleResult | null;
  bindBattleTelemetry(events: GameEvents): () => void;
  markBattleStarted(scenario: BattleScenario): void;
  markBattleEnded(result: BattleResult): void;
  markBattleAborted(): void;
  markPerkOffered(choiceCount: number): void;
  markPerkPicked(perkId: string): void;
  markRunCompleted(outcome: 'WIN' | 'LOSS'): void;
  getStatsSnapshot(): StatsV1;
  resetStatsData(): StatsV1;
  transitionTo(stateId: GameStateId, payload?: unknown): void;
}
