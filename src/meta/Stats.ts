export type DifficultyKey = 'NORMAL' | 'HARD';

export interface DepthBucketStats {
  depthMin: number;
  depthMax: number;
  battlesPlayed: number;
  battlesWon: number;
  avgBattleDurationSec: number;
  avgCasualtiesPct: number;
  sampleCount: number;
}

export interface StatsV1 {
  version: 1;
  createdAt: number;
  lastUpdatedAt: number;
  totals: {
    runsStarted: number;
    runsCompleted: number;
    runsAbandoned: number;
    battlesPlayed: number;
    battlesWon: number;
    battlesLost: number;
    totalPlayTimeSec: number;
    dailyRunsStarted: number;
    dailyRunsCompleted: number;
  };
  byDifficulty: Record<
    DifficultyKey,
    {
      battlesPlayed: number;
      battlesWon: number;
      runsStarted: number;
      runsCompleted: number;
    }
  >;
  byDepthBucket: DepthBucketStats[];
  perks: {
    picks: Record<string, number>;
    offered: number;
  };
  orders: {
    issued: Record<string, number>;
  };
  archetypes: {
    fielded: Record<string, number>;
    deaths: Record<string, number>;
  };
  objectives: {
    played: Record<string, number>;
    wins: Record<string, number>;
  };
  dailyBestScoreByDateKey: Record<string, number>;
  lastRun: null | {
    seed: number;
    difficulty: DifficultyKey;
    startedAt: number;
    endedAt?: number;
    outcome?: 'WIN' | 'LOSS' | 'ABANDON';
    nodesCleared: number;
    perksPicked: string[];
    battleSummaries: Array<{
      nodeId: string;
      nodeType: string;
      objectiveType: string;
      depth: number;
      won: boolean;
      durationSec: number;
      playerCasualtiesPct: number;
    }>;
  };
}

const STATS_KEY = 'nizam_stats_v1';

const DEFAULT_BUCKETS: DepthBucketStats[] = [
  { depthMin: 0, depthMax: 3, battlesPlayed: 0, battlesWon: 0, avgBattleDurationSec: 0, avgCasualtiesPct: 0, sampleCount: 0 },
  { depthMin: 4, depthMax: 7, battlesPlayed: 0, battlesWon: 0, avgBattleDurationSec: 0, avgCasualtiesPct: 0, sampleCount: 0 },
  { depthMin: 8, depthMax: 11, battlesPlayed: 0, battlesWon: 0, avgBattleDurationSec: 0, avgCasualtiesPct: 0, sampleCount: 0 },
  { depthMin: 12, depthMax: 99, battlesPlayed: 0, battlesWon: 0, avgBattleDurationSec: 0, avgCasualtiesPct: 0, sampleCount: 0 },
];

export function createDefaultStats(): StatsV1 {
  const now = Date.now();
  return {
    version: 1,
    createdAt: now,
    lastUpdatedAt: now,
    totals: {
      runsStarted: 0,
      runsCompleted: 0,
      runsAbandoned: 0,
      battlesPlayed: 0,
      battlesWon: 0,
      battlesLost: 0,
      totalPlayTimeSec: 0,
      dailyRunsStarted: 0,
      dailyRunsCompleted: 0,
    },
    byDifficulty: {
      NORMAL: {
        battlesPlayed: 0,
        battlesWon: 0,
        runsStarted: 0,
        runsCompleted: 0,
      },
      HARD: {
        battlesPlayed: 0,
        battlesWon: 0,
        runsStarted: 0,
        runsCompleted: 0,
      },
    },
    byDepthBucket: DEFAULT_BUCKETS.map((bucket) => ({ ...bucket })),
    perks: {
      picks: {},
      offered: 0,
    },
    orders: {
      issued: {},
    },
    archetypes: {
      fielded: {},
      deaths: {},
    },
    objectives: {
      played: {},
      wins: {},
    },
    dailyBestScoreByDateKey: {},
    lastRun: null,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

function asRecordNumbers(value: unknown): Record<string, number> {
  if (!isObject(value)) {
    return {};
  }
  const result: Record<string, number> = {};
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const raw = value[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      result[key] = raw;
    }
  }
  return result;
}

function sanitizeDepthBuckets(value: unknown): DepthBucketStats[] {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_BUCKETS.map((bucket) => ({ ...bucket }));
  }

  const buckets: DepthBucketStats[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const raw = value[i];
    if (!isObject(raw)) {
      continue;
    }
    buckets.push({
      depthMin: Math.max(0, Math.floor(asNumber(raw.depthMin, 0))),
      depthMax: Math.max(0, Math.floor(asNumber(raw.depthMax, 0))),
      battlesPlayed: Math.max(0, Math.floor(asNumber(raw.battlesPlayed, 0))),
      battlesWon: Math.max(0, Math.floor(asNumber(raw.battlesWon, 0))),
      avgBattleDurationSec: Math.max(0, asNumber(raw.avgBattleDurationSec, 0)),
      avgCasualtiesPct: Math.max(0, Math.min(1, asNumber(raw.avgCasualtiesPct, 0))),
      sampleCount: Math.max(0, Math.floor(asNumber(raw.sampleCount, 0))),
    });
  }

  if (buckets.length === 0) {
    return DEFAULT_BUCKETS.map((bucket) => ({ ...bucket }));
  }
  return buckets;
}

function sanitizeLastRun(value: unknown): StatsV1['lastRun'] {
  if (!isObject(value)) {
    return null;
  }

  const difficulty = value.difficulty === 'HARD' ? 'HARD' : 'NORMAL';
  const battleSummariesRaw = Array.isArray(value.battleSummaries) ? value.battleSummaries : [];
  const battleSummaries: NonNullable<StatsV1['lastRun']>['battleSummaries'] = [];
  for (let i = 0; i < battleSummariesRaw.length; i += 1) {
    const entry = battleSummariesRaw[i];
    if (!isObject(entry)) {
      continue;
    }
    battleSummaries.push({
      nodeId: typeof entry.nodeId === 'string' ? entry.nodeId : '',
      nodeType: typeof entry.nodeType === 'string' ? entry.nodeType : '',
      objectiveType: typeof entry.objectiveType === 'string' ? entry.objectiveType : '',
      depth: Math.max(0, Math.floor(asNumber(entry.depth, 0))),
      won: Boolean(entry.won),
      durationSec: Math.max(0, asNumber(entry.durationSec, 0)),
      playerCasualtiesPct: Math.max(0, Math.min(1, asNumber(entry.playerCasualtiesPct, 0))),
    });
  }

  return {
    seed: Math.max(0, Math.floor(asNumber(value.seed, 0))),
    difficulty,
    startedAt: Math.max(0, Math.floor(asNumber(value.startedAt, Date.now()))),
    endedAt: asNumber(value.endedAt, 0) > 0 ? Math.floor(asNumber(value.endedAt, 0)) : undefined,
    outcome: value.outcome === 'WIN' || value.outcome === 'LOSS' || value.outcome === 'ABANDON' ? value.outcome : undefined,
    nodesCleared: Math.max(0, Math.floor(asNumber(value.nodesCleared, 0))),
    perksPicked: Array.isArray(value.perksPicked) ? value.perksPicked.filter((entry) => typeof entry === 'string') : [],
    battleSummaries,
  };
}

function sanitizeStats(value: unknown): StatsV1 | null {
  if (!isObject(value) || value.version !== 1) {
    return null;
  }

  const totalsRaw = isObject(value.totals) ? value.totals : {};
  const byDifficultyRaw = isObject(value.byDifficulty) ? value.byDifficulty : {};
  const normalRaw = isObject(byDifficultyRaw.NORMAL) ? byDifficultyRaw.NORMAL : {};
  const hardRaw = isObject(byDifficultyRaw.HARD) ? byDifficultyRaw.HARD : {};

  const stats: StatsV1 = {
    version: 1,
    createdAt: Math.max(0, Math.floor(asNumber(value.createdAt, Date.now()))),
    lastUpdatedAt: Math.max(0, Math.floor(asNumber(value.lastUpdatedAt, Date.now()))),
    totals: {
      runsStarted: Math.max(0, Math.floor(asNumber(totalsRaw.runsStarted, 0))),
      runsCompleted: Math.max(0, Math.floor(asNumber(totalsRaw.runsCompleted, 0))),
      runsAbandoned: Math.max(0, Math.floor(asNumber(totalsRaw.runsAbandoned, 0))),
      battlesPlayed: Math.max(0, Math.floor(asNumber(totalsRaw.battlesPlayed, 0))),
      battlesWon: Math.max(0, Math.floor(asNumber(totalsRaw.battlesWon, 0))),
      battlesLost: Math.max(0, Math.floor(asNumber(totalsRaw.battlesLost, 0))),
      totalPlayTimeSec: Math.max(0, asNumber(totalsRaw.totalPlayTimeSec, 0)),
      dailyRunsStarted: Math.max(0, Math.floor(asNumber(totalsRaw.dailyRunsStarted, 0))),
      dailyRunsCompleted: Math.max(0, Math.floor(asNumber(totalsRaw.dailyRunsCompleted, 0))),
    },
    byDifficulty: {
      NORMAL: {
        battlesPlayed: Math.max(0, Math.floor(asNumber(normalRaw.battlesPlayed, 0))),
        battlesWon: Math.max(0, Math.floor(asNumber(normalRaw.battlesWon, 0))),
        runsStarted: Math.max(0, Math.floor(asNumber(normalRaw.runsStarted, 0))),
        runsCompleted: Math.max(0, Math.floor(asNumber(normalRaw.runsCompleted, 0))),
      },
      HARD: {
        battlesPlayed: Math.max(0, Math.floor(asNumber(hardRaw.battlesPlayed, 0))),
        battlesWon: Math.max(0, Math.floor(asNumber(hardRaw.battlesWon, 0))),
        runsStarted: Math.max(0, Math.floor(asNumber(hardRaw.runsStarted, 0))),
        runsCompleted: Math.max(0, Math.floor(asNumber(hardRaw.runsCompleted, 0))),
      },
    },
    byDepthBucket: sanitizeDepthBuckets(value.byDepthBucket),
    perks: {
      picks: asRecordNumbers(isObject(value.perks) ? value.perks.picks : {}),
      offered: Math.max(0, Math.floor(asNumber(isObject(value.perks) ? value.perks.offered : 0, 0))),
    },
    orders: {
      issued: asRecordNumbers(isObject(value.orders) ? value.orders.issued : {}),
    },
    archetypes: {
      fielded: asRecordNumbers(isObject(value.archetypes) ? value.archetypes.fielded : {}),
      deaths: asRecordNumbers(isObject(value.archetypes) ? value.archetypes.deaths : {}),
    },
    objectives: {
      played: asRecordNumbers(isObject(value.objectives) ? value.objectives.played : {}),
      wins: asRecordNumbers(isObject(value.objectives) ? value.objectives.wins : {}),
    },
    dailyBestScoreByDateKey: asRecordNumbers(value.dailyBestScoreByDateKey),
    lastRun: sanitizeLastRun(value.lastRun),
  };

  return stats;
}

export function loadStats(): StatsV1 {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaultStats();
  }
  const raw = window.localStorage.getItem(STATS_KEY);
  if (!raw) {
    return createDefaultStats();
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const sanitized = sanitizeStats(parsed);
    if (sanitized !== null) {
      return sanitized;
    }
    console.warn('[Stats] Invalid stats payload. Resetting stats.');
    return createDefaultStats();
  } catch (error) {
    console.warn('[Stats] Failed to parse stats payload. Resetting stats.', error);
    return createDefaultStats();
  }
}

export function saveStats(stats: StatsV1): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  stats.lastUpdatedAt = Date.now();
  window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function resetStats(): StatsV1 {
  const stats = createDefaultStats();
  saveStats(stats);
  return stats;
}

export function cloneStats(stats: StatsV1): StatsV1 {
  return JSON.parse(JSON.stringify(stats)) as StatsV1;
}

export function incrementCounter(map: Record<string, number>, key: string, amount = 1): void {
  const normalized = key.length > 0 ? key : 'unknown';
  map[normalized] = (map[normalized] ?? 0) + amount;
}

export function updateRunningAverage(currentMean: number, count: number, sample: number): number {
  const nextCount = Math.max(1, count);
  return currentMean + (sample - currentMean) / nextCount;
}

export function findDepthBucket(stats: StatsV1, depth: number): DepthBucketStats {
  for (let i = 0; i < stats.byDepthBucket.length; i += 1) {
    const bucket = stats.byDepthBucket[i];
    if (depth >= bucket.depthMin && depth <= bucket.depthMax) {
      return bucket;
    }
  }
  return stats.byDepthBucket[stats.byDepthBucket.length - 1];
}
