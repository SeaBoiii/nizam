import { DifficultyMode, normalizeDifficultyMode } from './Difficulty';

export interface DailyBestResult {
  score: number;
  difficulty: DifficultyMode;
  timeSec: number;
  casualtiesPct: number;
  seed: number;
}

export interface DailyHistoryEntry {
  dateKey: string;
  score: number;
  difficulty: DifficultyMode;
  nodesCleared: number;
  wins: number;
  timeSec: number;
  casualtiesPct: number;
  perks: string[];
  seed: number;
  packName: string;
  packVersion: string;
  ts: number;
}

export interface DailyResultsV1 {
  version: 1;
  bestByDate: Record<string, DailyBestResult>;
  history: DailyHistoryEntry[];
}

const DAILY_RESULTS_KEY = 'nizam_daily_results_v1';
const DAILY_RESULTS_VERSION = 1;
const HISTORY_LIMIT = 20;

function createDefaultDailyResults(): DailyResultsV1 {
  return {
    version: DAILY_RESULTS_VERSION,
    bestByDate: {},
    history: [],
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
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

function sanitizePerks(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const perks: string[] = [];
  for (let i = 0; i < value.length; i += 1) {
    if (typeof value[i] === 'string' && value[i].trim().length > 0) {
      perks.push(value[i]);
    }
  }
  return perks;
}

function sanitizeHistoryEntry(value: unknown): DailyHistoryEntry | null {
  if (!isObject(value)) {
    return null;
  }
  const dateKey = asString(value.dateKey).trim();
  if (dateKey.length < 8) {
    return null;
  }

  return {
    dateKey,
    score: Math.max(0, Math.floor(asFiniteNumber(value.score, 0))),
    difficulty: normalizeDifficultyMode(value.difficulty),
    nodesCleared: Math.max(0, Math.floor(asFiniteNumber(value.nodesCleared, 0))),
    wins: Math.max(0, Math.floor(asFiniteNumber(value.wins, 0))),
    timeSec: Math.max(0, asFiniteNumber(value.timeSec, 0)),
    casualtiesPct: clamp01(asFiniteNumber(value.casualtiesPct, 0)),
    perks: sanitizePerks(value.perks),
    seed: Math.max(0, Math.floor(asFiniteNumber(value.seed, 0))) >>> 0,
    packName: asString(value.packName, 'Base'),
    packVersion: asString(value.packVersion, 'unknown'),
    ts: Math.max(0, Math.floor(asFiniteNumber(value.ts, Date.now()))),
  };
}

function sanitizeBestEntry(value: unknown): DailyBestResult | null {
  if (!isObject(value)) {
    return null;
  }
  return {
    score: Math.max(0, Math.floor(asFiniteNumber(value.score, 0))),
    difficulty: normalizeDifficultyMode(value.difficulty),
    timeSec: Math.max(0, asFiniteNumber(value.timeSec, 0)),
    casualtiesPct: clamp01(asFiniteNumber(value.casualtiesPct, 0)),
    seed: Math.max(0, Math.floor(asFiniteNumber(value.seed, 0))) >>> 0,
  };
}

function sanitizeResults(value: unknown): DailyResultsV1 | null {
  if (!isObject(value) || value.version !== DAILY_RESULTS_VERSION) {
    return null;
  }

  const historyRaw = Array.isArray(value.history) ? value.history : [];
  const history: DailyHistoryEntry[] = [];
  for (let i = 0; i < historyRaw.length && history.length < HISTORY_LIMIT; i += 1) {
    const entry = sanitizeHistoryEntry(historyRaw[i]);
    if (entry !== null) {
      history.push(entry);
    }
  }

  const bestByDate: Record<string, DailyBestResult> = {};
  if (isObject(value.bestByDate)) {
    const keys = Object.keys(value.bestByDate);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const best = sanitizeBestEntry(value.bestByDate[key]);
      if (best !== null) {
        bestByDate[key] = best;
      }
    }
  }

  return {
    version: DAILY_RESULTS_VERSION,
    bestByDate,
    history,
  };
}

function cloneEntry(entry: DailyHistoryEntry): DailyHistoryEntry {
  return {
    dateKey: entry.dateKey,
    score: entry.score,
    difficulty: entry.difficulty,
    nodesCleared: entry.nodesCleared,
    wins: entry.wins,
    timeSec: entry.timeSec,
    casualtiesPct: entry.casualtiesPct,
    perks: [...entry.perks],
    seed: entry.seed,
    packName: entry.packName,
    packVersion: entry.packVersion,
    ts: entry.ts,
  };
}

function cloneBest(best: DailyBestResult): DailyBestResult {
  return {
    score: best.score,
    difficulty: best.difficulty,
    timeSec: best.timeSec,
    casualtiesPct: best.casualtiesPct,
    seed: best.seed,
  };
}

function cloneResults(results: DailyResultsV1): DailyResultsV1 {
  const bestByDate: DailyResultsV1['bestByDate'] = {};
  const keys = Object.keys(results.bestByDate);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    bestByDate[key] = cloneBest(results.bestByDate[key]);
  }

  return {
    version: DAILY_RESULTS_VERSION,
    bestByDate,
    history: results.history.map((entry) => cloneEntry(entry)),
  };
}

function normalizeEntry(entry: DailyHistoryEntry): DailyHistoryEntry {
  const sanitized = sanitizeHistoryEntry(entry);
  if (sanitized !== null) {
    return sanitized;
  }

  return {
    dateKey: '1970-01-01',
    score: 0,
    difficulty: DifficultyMode.NORMAL,
    nodesCleared: 0,
    wins: 0,
    timeSec: 0,
    casualtiesPct: 0,
    perks: [],
    seed: 0,
    packName: 'Base',
    packVersion: 'unknown',
    ts: Date.now(),
  };
}

function samePerks(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function isSameResult(a: DailyHistoryEntry, b: DailyHistoryEntry): boolean {
  return (
    a.dateKey === b.dateKey &&
    a.score === b.score &&
    a.difficulty === b.difficulty &&
    a.nodesCleared === b.nodesCleared &&
    a.wins === b.wins &&
    Math.abs(a.timeSec - b.timeSec) < 0.001 &&
    Math.abs(a.casualtiesPct - b.casualtiesPct) < 0.0001 &&
    a.seed === b.seed &&
    a.packName === b.packName &&
    a.packVersion === b.packVersion &&
    samePerks(a.perks, b.perks)
  );
}

function updateBestForDate(results: DailyResultsV1, entry: DailyHistoryEntry): void {
  const current = results.bestByDate[entry.dateKey];
  if (
    current === undefined ||
    entry.score > current.score ||
    (entry.score === current.score && entry.timeSec < current.timeSec)
  ) {
    results.bestByDate[entry.dateKey] = {
      score: entry.score,
      difficulty: entry.difficulty,
      timeSec: entry.timeSec,
      casualtiesPct: entry.casualtiesPct,
      seed: entry.seed,
    };
  }
}

export function loadDailyResults(): DailyResultsV1 {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaultDailyResults();
  }

  const raw = window.localStorage.getItem(DAILY_RESULTS_KEY);
  if (!raw) {
    return createDefaultDailyResults();
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const sanitized = sanitizeResults(parsed);
    if (sanitized !== null) {
      return sanitized;
    }
    console.warn('[DailyResults] Invalid payload. Resetting daily history.');
    return createDefaultDailyResults();
  } catch (error) {
    console.warn('[DailyResults] Failed to parse payload. Resetting daily history.', error);
    return createDefaultDailyResults();
  }
}

export function saveDailyResults(results: DailyResultsV1): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(DAILY_RESULTS_KEY, JSON.stringify(cloneResults(results)));
}

export function recordDailyResult(entry: DailyHistoryEntry): DailyResultsV1 {
  const results = loadDailyResults();
  const normalized = normalizeEntry(entry);

  const nextHistory: DailyHistoryEntry[] = [normalized];
  for (let i = 0; i < results.history.length && nextHistory.length < HISTORY_LIMIT; i += 1) {
    const existing = results.history[i];
    if (!isSameResult(existing, normalized)) {
      nextHistory.push(existing);
    }
  }
  results.history = nextHistory;
  updateBestForDate(results, normalized);
  saveDailyResults(results);
  return cloneResults(results);
}

export function getBestForDate(dateKey: string): DailyBestResult | null {
  const results = loadDailyResults();
  const best = results.bestByDate[dateKey];
  return best ? cloneBest(best) : null;
}

export function resetDailyResults(): DailyResultsV1 {
  const results = createDefaultDailyResults();
  saveDailyResults(results);
  return results;
}
