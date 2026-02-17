import type { ResultPayloadV1 } from './ResultCode';
import { resultIdentityKey } from './ResultCode';
import { DifficultyMode } from './Difficulty';

export interface LocalLeaderboardEntry {
  name?: string;
  ts: number;
  result: ResultPayloadV1;
  verified: boolean;
}

export interface LocalLeaderboardBucket {
  key: string;
  entries: LocalLeaderboardEntry[];
}

export interface LocalLeaderboardsV1 {
  version: 1;
  byKey: Record<string, LocalLeaderboardBucket>;
}

const LEADERBOARDS_KEY = 'nizam_leaderboards_v1';
const LEADERBOARDS_VERSION = 1;
const MAX_ENTRIES_PER_KEY = 20;

function createDefaults(): LocalLeaderboardsV1 {
  return {
    version: LEADERBOARDS_VERSION,
    byKey: {},
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizeResult(value: unknown): ResultPayloadV1 | null {
  if (!isObject(value)) {
    return null;
  }
  if (value.v !== 1 || value.kind !== 'RESULT') {
    return null;
  }
  const pack = isObject(value.pack) ? value.pack : null;
  if (!pack) {
    return null;
  }
  const mode = value.mode === 'DAILY' || value.mode === 'CHALLENGE' || value.mode === 'NORMAL' ? value.mode : 'NORMAL';
  const difficulty = value.difficulty === DifficultyMode.HARD ? DifficultyMode.HARD : DifficultyMode.NORMAL;
  const perks: string[] = Array.isArray(value.perks) ? value.perks.filter((entry) => typeof entry === 'string') : [];

  return {
    v: 1,
    kind: 'RESULT',
    mode,
    dateKey: typeof value.dateKey === 'string' && value.dateKey.length > 0 ? value.dateKey : undefined,
    seed: Math.max(0, Math.floor(asNumber(value.seed, 0))) >>> 0,
    difficulty,
    pack: {
      id: asString(pack.id, 'base'),
      version: asString(pack.version, 'unknown'),
      name: typeof pack.name === 'string' && pack.name.length > 0 ? pack.name : undefined,
    },
    score: Math.max(0, Math.floor(asNumber(value.score, 0))),
    nodesCleared: Math.max(0, Math.floor(asNumber(value.nodesCleared, 0))),
    wins: Math.max(0, Math.floor(asNumber(value.wins, 0))),
    timeSec: Math.max(0, asNumber(value.timeSec, 0)),
    casualtiesPct: Math.max(0, Math.min(1, asNumber(value.casualtiesPct, 0))),
    perks,
    bestSquadArchetypeId:
      typeof value.bestSquadArchetypeId === 'string' && value.bestSquadArchetypeId.length > 0
        ? value.bestSquadArchetypeId
        : undefined,
    sig: Math.max(0, Math.floor(asNumber(value.sig, 0))) >>> 0,
  };
}

function sanitizeEntry(value: unknown): LocalLeaderboardEntry | null {
  if (!isObject(value)) {
    return null;
  }
  const result = sanitizeResult(value.result);
  if (result === null) {
    return null;
  }
  return {
    name: typeof value.name === 'string' && value.name.length > 0 ? value.name : undefined,
    ts: Math.max(0, Math.floor(asNumber(value.ts, Date.now()))),
    result,
    verified: value.verified !== false,
  };
}

function sanitizeBucket(value: unknown): LocalLeaderboardBucket | null {
  if (!isObject(value)) {
    return null;
  }
  const key = asString(value.key, '').trim();
  if (key.length === 0 || !Array.isArray(value.entries)) {
    return null;
  }
  const entries: LocalLeaderboardEntry[] = [];
  for (let i = 0; i < value.entries.length && entries.length < MAX_ENTRIES_PER_KEY; i += 1) {
    const entry = sanitizeEntry(value.entries[i]);
    if (entry !== null) {
      entries.push(entry);
    }
  }
  entries.sort((a, b) => b.result.score - a.result.score || a.result.timeSec - b.result.timeSec || b.ts - a.ts);
  return {
    key,
    entries,
  };
}

function sanitizeLeaderboards(value: unknown): LocalLeaderboardsV1 | null {
  if (!isObject(value) || value.version !== LEADERBOARDS_VERSION || !isObject(value.byKey)) {
    return null;
  }
  const byKey: Record<string, LocalLeaderboardBucket> = {};
  const keys = Object.keys(value.byKey);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const bucket = sanitizeBucket(value.byKey[key]);
    if (bucket !== null) {
      byKey[key] = bucket;
    }
  }
  return {
    version: LEADERBOARDS_VERSION,
    byKey,
  };
}

function cloneResult(result: ResultPayloadV1): ResultPayloadV1 {
  return {
    ...result,
    pack: {
      ...result.pack,
    },
    perks: [...result.perks],
  };
}

function cloneEntry(entry: LocalLeaderboardEntry): LocalLeaderboardEntry {
  return {
    name: entry.name,
    ts: entry.ts,
    result: cloneResult(entry.result),
    verified: entry.verified,
  };
}

function cloneBucket(bucket: LocalLeaderboardBucket): LocalLeaderboardBucket {
  return {
    key: bucket.key,
    entries: bucket.entries.map((entry) => cloneEntry(entry)),
  };
}

function cloneLeaderboards(boards: LocalLeaderboardsV1): LocalLeaderboardsV1 {
  const byKey: Record<string, LocalLeaderboardBucket> = {};
  const keys = Object.keys(boards.byKey);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    byKey[key] = cloneBucket(boards.byKey[key]);
  }
  return {
    version: LEADERBOARDS_VERSION,
    byKey,
  };
}

export function loadLocalLeaderboards(): LocalLeaderboardsV1 {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaults();
  }
  const raw = window.localStorage.getItem(LEADERBOARDS_KEY);
  if (!raw) {
    return createDefaults();
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    const sanitized = sanitizeLeaderboards(parsed);
    if (sanitized !== null) {
      return sanitized;
    }
    console.warn('[LocalLeaderboard] Invalid payload. Resetting local leaderboards.');
    return createDefaults();
  } catch (error) {
    console.warn('[LocalLeaderboard] Failed to parse payload. Resetting local leaderboards.', error);
    return createDefaults();
  }
}

export function saveLocalLeaderboards(boards: LocalLeaderboardsV1): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(LEADERBOARDS_KEY, JSON.stringify(cloneLeaderboards(boards)));
}

export function leaderboardKeyForResult(result: ResultPayloadV1): string | null {
  return resultIdentityKey(result);
}

export function addEntry(
  key: string,
  entry: LocalLeaderboardEntry,
): LocalLeaderboardsV1 {
  const boards = loadLocalLeaderboards();
  const normalizedKey = key.trim();
  if (normalizedKey.length === 0) {
    return boards;
  }

  const bucket = boards.byKey[normalizedKey] ?? {
    key: normalizedKey,
    entries: [],
  };

  bucket.entries.push(cloneEntry(entry));
  bucket.entries.sort((a, b) => b.result.score - a.result.score || a.result.timeSec - b.result.timeSec || b.ts - a.ts);
  if (bucket.entries.length > MAX_ENTRIES_PER_KEY) {
    bucket.entries.length = MAX_ENTRIES_PER_KEY;
  }
  boards.byKey[normalizedKey] = bucket;
  saveLocalLeaderboards(boards);
  return boards;
}

export function getEntries(key: string): LocalLeaderboardEntry[] {
  const boards = loadLocalLeaderboards();
  const bucket = boards.byKey[key];
  if (!bucket) {
    return [];
  }
  return bucket.entries.map((entry) => cloneEntry(entry));
}

export function getAllKeys(): string[] {
  const boards = loadLocalLeaderboards();
  return Object.keys(boards.byKey);
}

export function removeEntry(key: string, index: number): LocalLeaderboardsV1 {
  const boards = loadLocalLeaderboards();
  const bucket = boards.byKey[key];
  if (!bucket) {
    return boards;
  }
  if (index >= 0 && index < bucket.entries.length) {
    bucket.entries.splice(index, 1);
  }
  if (bucket.entries.length === 0) {
    delete boards.byKey[key];
  } else {
    boards.byKey[key] = bucket;
  }
  saveLocalLeaderboards(boards);
  return boards;
}

export function resetAll(): LocalLeaderboardsV1 {
  const boards = createDefaults();
  saveLocalLeaderboards(boards);
  return boards;
}
