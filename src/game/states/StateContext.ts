import type { Application, Container } from 'pixi.js';
import type { ArmyState } from '../../meta/Army';
import type { DifficultyMode } from '../../meta/Difficulty';
import type { ChallengePayloadV1 } from '../../meta/ChallengeCode';
import type { PerkState } from '../../meta/Perks';
import type { GameSettings } from '../../meta/Settings';
import type { StatsV1 } from '../../meta/Stats';
import type { BattleResult, BattleScenario } from '../../meta/types';
import type { MapState, RunState } from '../../overworld/types';
import type { ContentLoadStatus, ContentPackManifestEntry } from '../../content/ContentTypes';
import type { GameEvents } from '../../sim/events/GameEvents';
import type { SaveSlot } from '../../meta/Save';

export type GameStateId =
  | 'TITLE'
  | 'OVERWORLD'
  | 'BATTLE'
  | 'REWARDS'
  | 'RUN_END'
  | 'STATS'
  | 'DAILY_HISTORY'
  | 'COMPARE'
  | 'LEADERBOARD';

export interface DailySaveInfo {
  dateKey: string | null;
  isToday: boolean;
  inProgress: boolean;
  difficulty: DifficultyMode;
  seed: number;
}

export interface CampaignData {
  runState: RunState;
  armyState: ArmyState;
  perkState: PerkState;
  mapState: MapState;
}

export interface StateContext {
  app: Application;
  stage: Container;
  getSettings(): GameSettings;
  setContentPack(packId: string): Promise<ContentLoadStatus>;
  getContentStatus(): ContentLoadStatus;
  getAvailableContentPacks(): ContentPackManifestEntry[];
  getCampaignData(): CampaignData | null;
  setCampaignData(data: CampaignData | null): void;
  startNewRun(mode?: DifficultyMode): void;
  startDailyRun(mode?: DifficultyMode): Promise<boolean>;
  startChallengeRun(payload: ChallengePayloadV1, rawCode: string): Promise<boolean>;
  hasSaveData(): boolean;
  hasChallengeSaveData(): boolean;
  loadSaveData(): boolean;
  getDailySaveInfo(): DailySaveInfo | null;
  loadDailySaveData(): Promise<boolean>;
  loadChallengeSaveData(): Promise<boolean>;
  saveCampaignData(): void;
  clearSaveData(): void;
  clearDailySaveData(): void;
  clearChallengeSaveData(): void;
  clearActiveRunSave(): void;
  getActiveSaveSlot(): SaveSlot | null;
  endCurrentRunSession(): void;
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
  recordDiagnosticEvent(eventType: string, payload?: Record<string, unknown>): void;
  getStatsSnapshot(): StatsV1;
  resetStatsData(): StatsV1;
  transitionTo(stateId: GameStateId, payload?: unknown): void;
}
