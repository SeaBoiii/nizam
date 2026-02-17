import { DifficultyMode, normalizeDifficultyMode } from './Difficulty';
import type { SquadMeta } from './Army';
import type { BattleResult, BattleScenario } from './types';
import {
  cloneStats,
  findDepthBucket,
  incrementCounter,
  loadStats,
  resetStats,
  saveStats,
  updateRunningAverage,
  type DifficultyKey,
  type StatsV1,
} from './Stats';
import type { PerkState } from './Perks';
import type { RunState } from '../overworld/types';
import type { GameEvents } from '../sim/events/GameEvents';
import { TeamId } from '../sim/types';

interface ActiveBattleContext {
  nodeId: string;
  nodeType: string;
  objectiveType: string;
  depth: number;
  difficulty: DifficultyKey;
  startedAt: number;
  playerInitial: number;
}

function difficultyKey(mode: DifficultyMode): DifficultyKey {
  return mode === DifficultyMode.HARD ? 'HARD' : 'NORMAL';
}

function toDifficultyKey(value: unknown): DifficultyKey {
  return normalizeDifficultyMode(value) === DifficultyMode.HARD ? 'HARD' : 'NORMAL';
}

function now(): number {
  return Date.now();
}

function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function toOrderKey(orderType: string): string {
  return orderType.trim().toUpperCase();
}

export class StatsCollector {
  private stats: StatsV1 = loadStats();
  private dirty = false;
  private saveTimer = 0;
  private readonly saveIntervalSec = 3;
  private playtimeUnsaved = 0;
  private activeBattle: ActiveBattleContext | null = null;

  constructor() {
    if (this.stats.lastRun !== null && this.stats.lastRun.outcome !== undefined) {
      this.activeBattle = null;
    }
  }

  getSnapshot(): StatsV1 {
    return cloneStats(this.stats);
  }

  reset(): StatsV1 {
    this.stats = resetStats();
    this.dirty = false;
    this.saveTimer = 0;
    this.playtimeUnsaved = 0;
    this.activeBattle = null;
    return cloneStats(this.stats);
  }

  update(dtSeconds: number, countPlayTime: boolean): void {
    if (countPlayTime && this.isRunActive()) {
      const dt = Math.max(0, Math.min(0.25, dtSeconds));
      this.stats.totals.totalPlayTimeSec += dt;
      this.playtimeUnsaved += dt;
      if (this.playtimeUnsaved >= 1) {
        this.markDirty();
        this.playtimeUnsaved = 0;
      }
    }

    if (!this.dirty) {
      return;
    }

    this.saveTimer += Math.max(0, dtSeconds);
    if (this.saveTimer >= this.saveIntervalSec) {
      this.flush();
    }
  }

  saveNow(): void {
    if (this.dirty) {
      this.flush();
    } else {
      saveStats(this.stats);
    }
  }

  onRunStarted(runState: RunState, perkState: PerkState): void {
    this.stats.totals.runsStarted += 1;
    const diff = difficultyKey(runState.difficultyMode);
    this.stats.byDifficulty[diff].runsStarted += 1;
    if (runState.mode === 'DAILY') {
      this.stats.totals.dailyRunsStarted += 1;
    }

    this.stats.lastRun = {
      seed: runState.seed >>> 0,
      difficulty: diff,
      startedAt: now(),
      nodesCleared: runState.clearedNodeIds.length,
      perksPicked: [...perkState.pickedPerkIds],
      battleSummaries: [],
    };

    this.activeBattle = null;
    this.markDirty();
  }

  onRunLoaded(runState: RunState, perkState: PerkState): void {
    const diff = difficultyKey(runState.difficultyMode);
    const existing = this.stats.lastRun;

    if (existing !== null && existing.seed === (runState.seed >>> 0) && existing.outcome === undefined) {
      existing.difficulty = diff;
      existing.nodesCleared = runState.clearedNodeIds.length;
      existing.perksPicked = [...perkState.pickedPerkIds];
      this.markDirty();
      return;
    }

    this.stats.lastRun = {
      seed: runState.seed >>> 0,
      difficulty: diff,
      startedAt: now(),
      nodesCleared: runState.clearedNodeIds.length,
      perksPicked: [...perkState.pickedPerkIds],
      battleSummaries: [],
    };
    this.markDirty();
  }

  onRunAbandoned(runState: RunState | null, perkState: PerkState | null): void {
    const lastRun = this.stats.lastRun;
    if (lastRun === null || lastRun.outcome !== undefined) {
      return;
    }

    lastRun.outcome = 'ABANDON';
    lastRun.endedAt = now();
    if (runState !== null) {
      lastRun.nodesCleared = runState.clearedNodeIds.length;
      lastRun.difficulty = difficultyKey(runState.difficultyMode);
    }
    if (perkState !== null) {
      lastRun.perksPicked = [...perkState.pickedPerkIds];
    }

    this.stats.totals.runsAbandoned += 1;
    this.activeBattle = null;
    this.markDirty();
  }

  onRunCompleted(runState: RunState, perkState: PerkState, outcome: 'WIN' | 'LOSS' = 'WIN'): void {
    this.ensureLastRun(runState, perkState);
    const lastRun = this.stats.lastRun;
    if (lastRun === null || lastRun.outcome !== undefined) {
      return;
    }

    lastRun.outcome = outcome;
    lastRun.endedAt = now();
    lastRun.nodesCleared = runState.clearedNodeIds.length;
    lastRun.perksPicked = [...perkState.pickedPerkIds];

    if (outcome === 'WIN') {
      this.stats.totals.runsCompleted += 1;
      this.stats.byDifficulty[difficultyKey(runState.difficultyMode)].runsCompleted += 1;
    }
    if (runState.mode === 'DAILY') {
      this.stats.totals.dailyRunsCompleted += 1;
      const dateKey = runState.dateKey;
      const finalScore = runState.finalScore;
      if (dateKey !== null && typeof finalScore === 'number' && Number.isFinite(finalScore)) {
        const prevBest = this.stats.dailyBestScoreByDateKey[dateKey] ?? 0;
        if (finalScore > prevBest) {
          this.stats.dailyBestScoreByDateKey[dateKey] = finalScore;
        }
      }
    }
    this.markDirty();
  }

  syncRunSnapshot(runState: RunState, perkState: PerkState): void {
    const lastRun = this.stats.lastRun;
    if (lastRun === null || lastRun.outcome !== undefined) {
      return;
    }

    lastRun.nodesCleared = runState.clearedNodeIds.length;
    lastRun.perksPicked = [...perkState.pickedPerkIds];
    lastRun.difficulty = difficultyKey(runState.difficultyMode);
    this.markDirty();
  }

  onBattleStarted(
    scenario: BattleScenario,
    runState: RunState,
    perkState: PerkState,
    playerSquads: readonly SquadMeta[],
  ): void {
    this.ensureLastRun(runState, perkState);

    const diff = difficultyKey(runState.difficultyMode);
    this.stats.totals.battlesPlayed += 1;
    this.stats.byDifficulty[diff].battlesPlayed += 1;
    incrementCounter(this.stats.objectives.played, scenario.objectiveType, 1);

    for (let i = 0; i < playerSquads.length; i += 1) {
      incrementCounter(this.stats.archetypes.fielded, playerSquads[i].archetypeId, 1);
    }
    for (let i = 0; i < scenario.enemySquads.length; i += 1) {
      incrementCounter(this.stats.archetypes.fielded, scenario.enemySquads[i].archetypeId, 1);
    }

    this.activeBattle = {
      nodeId: scenario.nodeId,
      nodeType: scenario.nodeType,
      objectiveType: scenario.objectiveType,
      depth: Math.max(0, runState.step),
      difficulty: diff,
      startedAt: now(),
      playerInitial: this.computePlayerInitial(playerSquads),
    };
    this.markDirty();
  }

  onBattleEnded(result: BattleResult, runState: RunState | null, perkState: PerkState | null): void {
    const depth = this.activeBattle?.depth ?? Math.max(0, runState?.step ?? 0);
    const difficulty = this.activeBattle?.difficulty ?? toDifficultyKey(result.scenario.difficultyMode);

    if (result.victory) {
      this.stats.totals.battlesWon += 1;
      this.stats.byDifficulty[difficulty].battlesWon += 1;
      incrementCounter(this.stats.objectives.wins, result.scenario.objectiveType, 1);
    } else {
      this.stats.totals.battlesLost += 1;
    }

    const playerInitial = result.playerInitial > 0 ? result.playerInitial : this.activeBattle?.playerInitial ?? 0;
    const casualtiesPct = playerInitial > 0 ? clamp01(result.playerCasualties / playerInitial) : 0;
    const durationSec = Math.max(
      0,
      result.durationSec ?? ((now() - (this.activeBattle?.startedAt ?? now())) / 1000),
    );

    const bucket = findDepthBucket(this.stats, depth);
    bucket.battlesPlayed += 1;
    if (result.victory) {
      bucket.battlesWon += 1;
    }
    bucket.sampleCount += 1;
    bucket.avgBattleDurationSec = updateRunningAverage(bucket.avgBattleDurationSec, bucket.sampleCount, durationSec);
    bucket.avgCasualtiesPct = updateRunningAverage(bucket.avgCasualtiesPct, bucket.sampleCount, casualtiesPct);

    const archetypeDeaths = result.archetypeDeaths ?? {};
    const archetypeKeys = Object.keys(archetypeDeaths);
    for (let i = 0; i < archetypeKeys.length; i += 1) {
      const key = archetypeKeys[i];
      const value = Math.max(0, Math.floor(archetypeDeaths[key] ?? 0));
      if (value > 0) {
        incrementCounter(this.stats.archetypes.deaths, key, value);
      }
    }

    if (runState !== null && perkState !== null) {
      this.ensureLastRun(runState, perkState);
      const lastRun = this.stats.lastRun;
      if (lastRun !== null && lastRun.outcome === undefined) {
        lastRun.nodesCleared = runState.clearedNodeIds.length;
        lastRun.perksPicked = [...perkState.pickedPerkIds];
        lastRun.battleSummaries.push({
          nodeId: result.scenario.nodeId,
          nodeType: result.scenario.nodeType,
          objectiveType: result.scenario.objectiveType,
          depth,
          won: result.victory,
          durationSec,
          playerCasualtiesPct: casualtiesPct,
        });
      }
    }

    this.activeBattle = null;
    this.markDirty();
  }

  onBattleAborted(runState: RunState | null, perkState: PerkState | null): void {
    if (this.activeBattle === null) {
      return;
    }

    this.stats.totals.battlesLost += 1;

    const durationSec = Math.max(0, (now() - this.activeBattle.startedAt) / 1000);
    const bucket = findDepthBucket(this.stats, this.activeBattle.depth);
    bucket.battlesPlayed += 1;
    bucket.sampleCount += 1;
    bucket.avgBattleDurationSec = updateRunningAverage(bucket.avgBattleDurationSec, bucket.sampleCount, durationSec);
    bucket.avgCasualtiesPct = updateRunningAverage(bucket.avgCasualtiesPct, bucket.sampleCount, 1);

    if (runState !== null && perkState !== null) {
      this.ensureLastRun(runState, perkState);
      const lastRun = this.stats.lastRun;
      if (lastRun !== null && lastRun.outcome === undefined) {
        lastRun.nodesCleared = runState.clearedNodeIds.length;
        lastRun.perksPicked = [...perkState.pickedPerkIds];
        lastRun.battleSummaries.push({
          nodeId: this.activeBattle.nodeId,
          nodeType: this.activeBattle.nodeType,
          objectiveType: this.activeBattle.objectiveType,
          depth: this.activeBattle.depth,
          won: false,
          durationSec,
          playerCasualtiesPct: 1,
        });
      }
    }

    this.activeBattle = null;
    this.markDirty();
  }

  recordPerkOffered(_choices: number): void {
    this.stats.perks.offered += 1;
    this.markDirty();
  }

  recordPerkPicked(perkId: string, perkState: PerkState | null): void {
    incrementCounter(this.stats.perks.picks, perkId, 1);
    if (perkState !== null && this.stats.lastRun !== null && this.stats.lastRun.outcome === undefined) {
      this.stats.lastRun.perksPicked = [...perkState.pickedPerkIds];
    }
    this.markDirty();
  }

  bindGameEvents(events: GameEvents): () => void {
    const unsubOrder = events.onOrderIssued((event) => {
      if (event.teamId !== TeamId.Blue) {
        return;
      }
      incrementCounter(this.stats.orders.issued, toOrderKey(event.orderType), 1);
      this.markDirty();
    });

    return () => {
      unsubOrder();
    };
  }

  private isRunActive(): boolean {
    return this.stats.lastRun !== null && this.stats.lastRun.outcome === undefined;
  }

  private ensureLastRun(runState: RunState, perkState: PerkState): void {
    const seed = runState.seed >>> 0;
    const diff = difficultyKey(runState.difficultyMode);
    if (
      this.stats.lastRun !== null &&
      this.stats.lastRun.seed === seed &&
      this.stats.lastRun.outcome === undefined
    ) {
      this.stats.lastRun.nodesCleared = runState.clearedNodeIds.length;
      this.stats.lastRun.perksPicked = [...perkState.pickedPerkIds];
      this.stats.lastRun.difficulty = diff;
      return;
    }

    this.stats.lastRun = {
      seed,
      difficulty: diff,
      startedAt: now(),
      nodesCleared: runState.clearedNodeIds.length,
      perksPicked: [...perkState.pickedPerkIds],
      battleSummaries: [],
    };
  }

  private computePlayerInitial(playerSquads: readonly SquadMeta[]): number {
    let total = 0;
    for (let i = 0; i < playerSquads.length; i += 1) {
      total += Math.max(0, Math.floor(playerSquads[i].size));
    }
    return total;
  }

  private markDirty(): void {
    this.dirty = true;
  }

  private flush(): void {
    saveStats(this.stats);
    this.dirty = false;
    this.saveTimer = 0;
  }
}
