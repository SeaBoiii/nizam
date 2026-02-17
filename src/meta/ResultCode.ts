import { DifficultyMode, normalizeDifficultyMode } from './Difficulty';

export type ResultRunMode = 'DAILY' | 'CHALLENGE' | 'NORMAL';

export interface ResultPayloadV1 {
  v: 1;
  kind: 'RESULT';
  mode: ResultRunMode;
  dateKey?: string;
  seed: number;
  difficulty: DifficultyMode;
  pack: {
    id: string;
    version: string;
    name?: string;
  };
  score: number;
  nodesCleared: number;
  wins: number;
  timeSec: number;
  casualtiesPct: number;
  perks: string[];
  bestSquadArchetypeId?: string;
  sig: number;
}

export interface DecodeResultCode {
  ok: boolean;
  payload?: ResultPayloadV1;
  error?: string;
  verified?: boolean;
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

function asMode(value: unknown): ResultRunMode {
  if (value === 'DAILY' || value === 'CHALLENGE' || value === 'NORMAL') {
    return value;
  }
  return 'NORMAL';
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

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, '');
  const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = normalized.length % 4;
  const padded = padLength === 0 ? normalized : normalized + '='.repeat(4 - padLength);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function safeParseJson<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

function normalizePayload(input: Omit<ResultPayloadV1, 'sig'> & Partial<Pick<ResultPayloadV1, 'sig'>>): ResultPayloadV1 {
  return {
    v: 1,
    kind: 'RESULT',
    mode: asMode(input.mode),
    dateKey: typeof input.dateKey === 'string' && input.dateKey.length > 0 ? input.dateKey : undefined,
    seed: (Math.max(0, Math.floor(asNumber(input.seed, 0))) >>> 0),
    difficulty: normalizeDifficultyMode(input.difficulty),
    pack: {
      id: asString(input.pack.id, 'base').trim() || 'base',
      version: asString(input.pack.version, 'unknown').trim() || 'unknown',
      name: typeof input.pack.name === 'string' && input.pack.name.length > 0 ? input.pack.name : undefined,
    },
    score: Math.max(0, Math.floor(asNumber(input.score, 0))),
    nodesCleared: Math.max(0, Math.floor(asNumber(input.nodesCleared, 0))),
    wins: Math.max(0, Math.floor(asNumber(input.wins, 0))),
    timeSec: Math.max(0, asNumber(input.timeSec, 0)),
    casualtiesPct: clamp01(asNumber(input.casualtiesPct, 0)),
    perks: sanitizePerks(input.perks),
    bestSquadArchetypeId:
      typeof input.bestSquadArchetypeId === 'string' && input.bestSquadArchetypeId.length > 0
        ? input.bestSquadArchetypeId
        : undefined,
    sig: Math.max(0, Math.floor(asNumber(input.sig, 0))) >>> 0,
  };
}

function signatureSource(payload: Omit<ResultPayloadV1, 'sig'>): string {
  return [
    payload.v,
    payload.seed >>> 0,
    payload.difficulty,
    payload.pack.id,
    payload.pack.version,
    Math.max(0, Math.floor(payload.score)),
    Math.max(0, Math.floor(payload.timeSec)),
    Math.round(clamp01(payload.casualtiesPct) * 10000),
  ].join('|');
}

function computeSig(payload: Omit<ResultPayloadV1, 'sig'>): number {
  return fnv1a32(signatureSource(payload)) >>> 0;
}

function sanitizeDecodedPayload(value: unknown): ResultPayloadV1 | null {
  if (!isObject(value)) {
    return null;
  }
  if (asNumber(value.v, 0) !== 1 || asString(value.kind, '') !== 'RESULT') {
    return null;
  }
  const pack = isObject(value.pack) ? value.pack : null;
  if (pack === null) {
    return null;
  }
  const payload = normalizePayload({
    v: 1,
    kind: 'RESULT',
    mode: asMode(value.mode),
    dateKey: asString(value.dateKey, ''),
    seed: asNumber(value.seed, 0),
    difficulty: normalizeDifficultyMode(value.difficulty),
    pack: {
      id: asString(pack.id, ''),
      version: asString(pack.version, ''),
      name: asString(pack.name, ''),
    },
    score: asNumber(value.score, 0),
    nodesCleared: asNumber(value.nodesCleared, 0),
    wins: asNumber(value.wins, 0),
    timeSec: asNumber(value.timeSec, 0),
    casualtiesPct: asNumber(value.casualtiesPct, 0),
    perks: sanitizePerks(value.perks),
    bestSquadArchetypeId: asString(value.bestSquadArchetypeId, ''),
    sig: asNumber(value.sig, 0),
  });
  if (payload.pack.id.length === 0 || payload.pack.version.length === 0) {
    return null;
  }
  return payload;
}

export function encodeResult(payload: Omit<ResultPayloadV1, 'sig'>): string {
  const normalized = normalizePayload({
    ...payload,
    sig: 0,
  });
  const result: ResultPayloadV1 = {
    ...normalized,
    sig: computeSig({
      ...normalized,
      sig: undefined as never,
    } as Omit<ResultPayloadV1, 'sig'>),
  };
  return toBase64Url(JSON.stringify(result));
}

export function decodeResult(code: string): DecodeResultCode {
  const trimmed = code.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Result code is empty.' };
  }
  let decoded = '';
  try {
    decoded = fromBase64Url(trimmed);
  } catch {
    return { ok: false, error: 'Result code is not valid base64url.' };
  }

  const parsed = safeParseJson<unknown>(decoded);
  if (parsed === null) {
    return { ok: false, error: 'Result code JSON is invalid.' };
  }

  const payload = sanitizeDecodedPayload(parsed);
  if (payload === null) {
    return { ok: false, error: 'Result payload is malformed.' };
  }

  const expectedSig = computeSig({
    ...payload,
    sig: undefined as never,
  } as Omit<ResultPayloadV1, 'sig'>);
  if ((payload.sig >>> 0) !== expectedSig) {
    return {
      ok: true,
      payload,
      verified: false,
      error: 'Signature mismatch. Showing unverified result.',
    };
  }

  return {
    ok: true,
    payload,
    verified: true,
  };
}

export function resultIdentityKey(payload: ResultPayloadV1): string | null {
  if (payload.mode === 'DAILY') {
    if (!payload.dateKey) {
      return null;
    }
    return `daily|${payload.dateKey}|${payload.pack.id}|${payload.pack.version}|${payload.difficulty}`;
  }
  if (payload.mode === 'CHALLENGE') {
    return `challenge|${payload.seed >>> 0}|${payload.pack.id}|${payload.pack.version}|${payload.difficulty}`;
  }
  return null;
}

export function formatResultSummaryText(payload: ResultPayloadV1): string {
  const minutes = Math.floor(Math.max(0, payload.timeSec) / 60);
  const seconds = Math.floor(Math.max(0, payload.timeSec) % 60);
  const timeText = `${minutes}m${seconds.toString().padStart(2, '0')}s`;
  const casualtiesText = `${Math.round(clamp01(payload.casualtiesPct) * 100)}%`;
  const perks = payload.perks.length > 0 ? payload.perks.join(', ') : 'None';

  return [
    `NIZAM Result (${payload.mode})`,
    `Score: ${payload.score} (${payload.difficulty})`,
    `Nodes: ${payload.nodesCleared} | Wins: ${payload.wins} | Time: ${timeText} | Casualties: ${casualtiesText}`,
    `Perks: ${perks}`,
    `Seed: ${payload.seed} | Pack: ${payload.pack.id} v${payload.pack.version}`,
  ].join('\n');
}
