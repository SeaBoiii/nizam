import type { ContentLoadStatus } from '../content/ContentTypes';
import type { CapturedErrorInfo } from '../game/ErrorBoundary';
import type { GameSettings } from './Settings';
import type { BattleResult, BattleScenario } from './types';
import type { RecordedEvent } from '../sim/events/EventRecorder';

export interface BugReportContextInput {
  state: string;
  run: {
    seed: number | null;
    difficulty: string;
    currentNodeId: string;
    nodesCleared: number;
    perksPicked: string[];
  };
  battle?: {
    mapId: string;
    objectiveType: string;
    stage?: string;
    winner?: string;
    unitCounts?: {
      player: number;
      enemy: number;
    };
  };
  contentStatus: ContentLoadStatus;
  settings: GameSettings;
}

export interface BuildBugReportInput {
  error: CapturedErrorInfo;
  context: BugReportContextInput;
  recentEvents: readonly RecordedEvent[];
  scenario: BattleScenario | null;
  lastBattleResult: BattleResult | null;
}

export interface BugReportV1 {
  version: 1;
  app: {
    name: 'nizam';
    build?: string;
    timestamp: number;
  };
  error: {
    message: string;
    stack: string;
    type: string;
    source: 'onerror' | 'unhandledrejection';
    extra?: string;
  };
  context: {
    state: string;
    run: {
      seed: number | null;
      difficulty: string;
      currentNodeId: string;
      nodesCleared: number;
      perksPicked: string[];
    };
    battle?: {
      mapId: string;
      objectiveType: string;
      stage?: string;
      winner?: string;
      unitCounts?: {
        player: number;
        enemy: number;
      };
    };
    content: {
      versions: {
        combined: string;
      };
      usingFallback: boolean;
      sourceByFile: ContentLoadStatus['sourceByFile'];
    };
    settings: {
      masterVolume: number;
      sfxVolume: number;
      musicVolume: number;
      cameraSpeed: number;
      showMinimap: boolean;
      showTrails: boolean;
      reduceScreenShake: boolean;
    };
  };
  recentEvents: RecordedEvent[];
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

export function buildBugReport(input: BuildBugReportInput): BugReportV1 {
  const scenario = input.scenario;
  const battleResult = input.lastBattleResult;
  const battle =
    scenario !== null
      ? {
          mapId: scenario.mapId,
          objectiveType: scenario.objectiveType,
          stage: input.context.battle?.stage,
          winner: battleResult ? (battleResult.victory ? 'blue' : 'red') : input.context.battle?.winner,
          unitCounts: battleResult
            ? {
                player: battleResult.playerRemaining,
                enemy: battleResult.enemyRemaining,
              }
            : input.context.battle?.unitCounts,
        }
      : input.context.battle;

  return {
    version: 1,
    app: {
      name: 'nizam',
      build: import.meta.env.MODE,
      timestamp: Date.now(),
    },
    error: {
      message: input.error.message,
      stack: input.error.stack,
      type: input.error.type,
      source: input.error.source,
      extra: input.error.extra,
    },
    context: {
      state: input.context.state,
      run: {
        seed: input.context.run.seed,
        difficulty: input.context.run.difficulty,
        currentNodeId: input.context.run.currentNodeId,
        nodesCleared: input.context.run.nodesCleared,
        perksPicked: [...input.context.run.perksPicked],
      },
      battle,
      content: {
        versions: {
          combined: input.context.contentStatus.contentVersion,
        },
        usingFallback: input.context.contentStatus.fallbackUsed,
        sourceByFile: { ...input.context.contentStatus.sourceByFile },
      },
      settings: {
        masterVolume: clampVolume(input.context.settings.masterVolume),
        sfxVolume: clampVolume(input.context.settings.sfxVolume),
        musicVolume: clampVolume(input.context.settings.musicVolume),
        cameraSpeed: input.context.settings.cameraSpeed,
        showMinimap: input.context.settings.showMinimap,
        showTrails: input.context.settings.showTrails,
        reduceScreenShake: input.context.settings.reduceScreenShake,
      },
    },
    recentEvents: input.recentEvents.slice(0, 200),
  };
}

