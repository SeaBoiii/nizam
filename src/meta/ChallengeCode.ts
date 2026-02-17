import type { ContentManager } from '../content/ContentManager';
import type { ContentPackManifestEntry } from '../content/ContentTypes';
import { DifficultyMode } from './Difficulty';

export interface ChallengeRulesV1 {
  objectiveNoRepeat?: boolean;
  mapNoRepeat?: boolean;
}

export interface ChallengePayloadV1 {
  v: 1;
  mode: 'CHALLENGE';
  seed: number;
  difficulty: DifficultyMode;
  dateKey?: string;
  pack: {
    id: string;
    name?: string;
    version: string;
  };
  rules?: ChallengeRulesV1;
  sig?: string;
}

export type ChallengeCompatibilityStatus =
  | 'OK'
  | 'PACK_NOT_FOUND'
  | 'PACK_MISMATCH'
  | 'VERSION_MISMATCH'
  | 'INVALID_SIGNATURE';

export interface ChallengeCompatibilityResult {
  status: ChallengeCompatibilityStatus;
  message: string;
}

export interface DecodeChallengeResult {
  ok: boolean;
  payload?: ChallengePayloadV1;
  error?: string;
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

function asDifficulty(value: unknown): DifficultyMode {
  return value === DifficultyMode.HARD ? DifficultyMode.HARD : DifficultyMode.NORMAL;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function toHex32(value: number): string {
  return (value >>> 0).toString(16).padStart(8, '0');
}

function fromUtf8ToBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64UrlToUtf8(value: string): string {
  const normalized = normalizeBase64Url(value);
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function normalizeChallengePayload(input: ChallengePayloadV1): ChallengePayloadV1 {
  return {
    v: 1,
    mode: 'CHALLENGE',
    seed: (Math.max(0, Math.floor(input.seed)) >>> 0),
    difficulty: asDifficulty(input.difficulty),
    dateKey: typeof input.dateKey === 'string' && input.dateKey.length > 0 ? input.dateKey : undefined,
    pack: {
      id: input.pack.id.trim(),
      name: typeof input.pack.name === 'string' && input.pack.name.length > 0 ? input.pack.name : undefined,
      version: input.pack.version.trim(),
    },
    rules: input.rules
      ? {
          objectiveNoRepeat: asOptionalBoolean(input.rules.objectiveNoRepeat),
          mapNoRepeat: asOptionalBoolean(input.rules.mapNoRepeat),
        }
      : undefined,
    sig: typeof input.sig === 'string' ? input.sig.toLowerCase() : undefined,
  };
}

function buildSignature(payload: ChallengePayloadV1): string {
  const normalized = normalizeChallengePayload(payload);
  const signatureBase = [
    normalized.v,
    normalized.seed >>> 0,
    normalized.difficulty,
    normalized.pack.id,
    normalized.pack.version,
  ].join('|');
  return toHex32(fnv1a32(signatureBase));
}

function sanitizeDecodedPayload(value: unknown): ChallengePayloadV1 | null {
  if (!isObject(value)) {
    return null;
  }
  const pack = isObject(value.pack) ? value.pack : null;
  if (!pack) {
    return null;
  }
  if (asNumber(value.v, 0) !== 1) {
    return null;
  }

  const rules = isObject(value.rules) ? value.rules : undefined;
  const candidate: ChallengePayloadV1 = {
    v: 1,
    mode: asString(value.mode) === 'CHALLENGE' ? 'CHALLENGE' : 'CHALLENGE',
    seed: asNumber(value.seed, -1),
    difficulty: asDifficulty(value.difficulty),
    dateKey: asString(value.dateKey, '').trim() || undefined,
    pack: {
      id: asString(pack.id).trim(),
      name: asString(pack.name, '').trim() || undefined,
      version: asString(pack.version).trim(),
    },
    rules: rules
      ? {
          objectiveNoRepeat: asOptionalBoolean(rules.objectiveNoRepeat),
          mapNoRepeat: asOptionalBoolean(rules.mapNoRepeat),
        }
      : undefined,
    sig: asString(value.sig, '').trim().toLowerCase() || undefined,
  };

  if (candidate.v !== 1) {
    return null;
  }
  if (candidate.seed < 0) {
    return null;
  }
  if (candidate.pack.id.length === 0 || candidate.pack.version.length === 0) {
    return null;
  }
  return normalizeChallengePayload(candidate);
}

export function normalizeBase64Url(str: string): string {
  const trimmed = str.trim().replace(/\s+/g, '');
  const replaced = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = replaced.length % 4;
  if (padLength === 0) {
    return replaced;
  }
  return replaced + '='.repeat(4 - padLength);
}

export function safeParseJson<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

export function encodeChallenge(payload: ChallengePayloadV1): string {
  const normalized = normalizeChallengePayload(payload);
  const encodedPayload: ChallengePayloadV1 = {
    ...normalized,
    sig: buildSignature(normalized),
  };
  const json = JSON.stringify(encodedPayload);
  return fromUtf8ToBase64Url(json);
}

export function decodeChallenge(code: string): DecodeChallengeResult {
  const trimmed = code.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Challenge code is empty.' };
  }

  let decodedText = '';
  try {
    decodedText = fromBase64UrlToUtf8(trimmed);
  } catch {
    return { ok: false, error: 'Challenge code is not valid base64url.' };
  }

  const parsed = safeParseJson<unknown>(decodedText);
  if (parsed === null) {
    return { ok: false, error: 'Challenge code JSON is invalid.' };
  }

  const payload = sanitizeDecodedPayload(parsed);
  if (payload === null) {
    return { ok: false, error: 'Challenge payload is malformed.' };
  }

  const sig = payload.sig ?? '';
  const expected = buildSignature(payload);
  if (sig !== expected) {
    return { ok: false, payload, error: 'Invalid signature.' };
  }

  return { ok: true, payload: { ...payload, sig: expected } };
}

export function validatePayloadAgainstContent(
  payload: ChallengePayloadV1,
  manager: ContentManager,
  packsList: ContentPackManifestEntry[],
): ChallengeCompatibilityResult {
  const normalized = normalizeChallengePayload(payload);
  const expectedSig = buildSignature(normalized);
  if ((normalized.sig ?? '').toLowerCase() !== expectedSig) {
    return {
      status: 'INVALID_SIGNATURE',
      message: 'Challenge signature failed integrity check.',
    };
  }

  const packInstalled = packsList.some((pack) => pack.id === normalized.pack.id);
  if (!packInstalled) {
    return {
      status: 'PACK_NOT_FOUND',
      message: `Pack '${normalized.pack.id}' is not installed.`,
    };
  }

  const contentStatus = manager.getStatus();
  if (contentStatus.loadedPackId !== normalized.pack.id) {
    return {
      status: 'PACK_MISMATCH',
      message: `Challenge expects pack '${normalized.pack.id}', but current pack is '${contentStatus.loadedPackId}'.`,
    };
  }

  if (contentStatus.contentVersion !== normalized.pack.version) {
    return {
      status: 'VERSION_MISMATCH',
      message: `Challenge expects pack version '${normalized.pack.version}', current is '${contentStatus.contentVersion}'.`,
    };
  }

  return {
    status: 'OK',
    message: 'Challenge code is compatible with current content.',
  };
}
