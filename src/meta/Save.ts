import { contentManager } from '../content/ContentManager';
import type { ArmyState, SquadMeta } from './Army';
import { DifficultyMode, normalizeDifficultyMode } from './Difficulty';
import { createPerkState, type PerkState } from './Perks';
import type { MapState, Node, RunMode, RunScoreBreakdown, RunState } from '../overworld/types';

const NORMAL_SAVE_KEY = 'nizam_save_v1';
const DAILY_SAVE_KEY = 'nizam_save_daily_v1';
const CHALLENGE_SAVE_KEY = 'nizam_save_challenge_v1';
const SAVE_VERSION = 5;
export type SaveSlot = 'normal' | 'daily' | 'challenge';

interface LegacySaveV1 {
  version: number;
  runState: Partial<RunState> & Record<string, unknown>;
  armyState: Partial<ArmyState> & Record<string, unknown>;
  mapState: Partial<MapState> & Record<string, unknown>;
}

interface LegacySaveV2 {
  saveVersion: number;
  contentVersion?: string;
  runState: Partial<RunState> & Record<string, unknown>;
  armyState: Partial<ArmyState> & Record<string, unknown>;
  mapState: Partial<MapState> & Record<string, unknown>;
}

interface LegacySaveV3 {
  saveVersion: number;
  contentVersion?: string;
  runState: Partial<RunState> & Record<string, unknown>;
  armyState: Partial<ArmyState> & Record<string, unknown>;
  perkState?: Partial<PerkState> & Record<string, unknown>;
  mapState: Partial<MapState> & Record<string, unknown>;
}

export interface SaveGameData {
  saveVersion: number;
  contentVersion: string;
  runState: RunState;
  armyState: ArmyState;
  perkState: PerkState;
  mapState: MapState;
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

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  return value.length > 0 ? value : null;
}

function asRunMode(value: unknown): RunMode {
  if (value === 'DAILY') {
    return 'DAILY';
  }
  if (value === 'CHALLENGE') {
    return 'CHALLENGE';
  }
  return 'NORMAL';
}

function sanitizeChallengePayloadSummary(value: unknown): RunState['challengePayload'] {
  if (!isObject(value)) {
    return null;
  }
  if (typeof value.packId !== 'string' || typeof value.packVersion !== 'string') {
    return null;
  }
  return {
    seed: Math.max(0, Math.floor(asNumber(value.seed, 0))) >>> 0,
    difficulty: normalizeDifficultyMode(value.difficulty),
    packId: asString(value.packId, 'base'),
    packVersion: asString(value.packVersion, 'unknown'),
    dateKey: asNullableString(value.dateKey),
    objectiveNoRepeat: typeof value.objectiveNoRepeat === 'boolean' ? value.objectiveNoRepeat : true,
    mapNoRepeat: typeof value.mapNoRepeat === 'boolean' ? value.mapNoRepeat : true,
  };
}

function sanitizeScoreBreakdown(value: unknown): RunScoreBreakdown | null {
  if (!isObject(value)) {
    return null;
  }
  const finalScore = asNumber(value.finalScore, -1);
  if (!Number.isFinite(finalScore) || finalScore < 0) {
    return null;
  }

  return {
    baseScore: Math.max(0, Math.floor(asNumber(value.baseScore, 0))),
    bossBonus: Math.max(0, Math.floor(asNumber(value.bossBonus, 0))),
    nodesScore: Math.max(0, Math.floor(asNumber(value.nodesScore, 0))),
    battlesScore: Math.max(0, Math.floor(asNumber(value.battlesScore, 0))),
    timePenalty: Math.max(0, Math.floor(asNumber(value.timePenalty, 0))),
    casualtyPenalty: Math.max(0, Math.floor(asNumber(value.casualtyPenalty, 0))),
    difficultyMult: Math.max(0.1, asNumber(value.difficultyMult, 1)),
    finalScore: Math.max(0, Math.floor(finalScore)),
    nodesCleared: Math.max(0, Math.floor(asNumber(value.nodesCleared, 0))),
    battlesWon: Math.max(0, Math.floor(asNumber(value.battlesWon, 0))),
    totalBattleDurationSec: Math.max(0, asNumber(value.totalBattleDurationSec, 0)),
    avgCasualtiesPct: Math.max(0, Math.min(1, asNumber(value.avgCasualtiesPct, 0))),
  };
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const result: string[] = [];
  for (let i = 0; i < value.length; i += 1) {
    if (typeof value[i] === 'string') {
      result.push(value[i]);
    }
  }
  return result.length > 0 ? result : fallback;
}

function sanitizeRunState(value: unknown): RunState | null {
  if (!isObject(value)) {
    return null;
  }

  const seed = asNumber(value.seed, Date.now() >>> 0);
  const mode = asRunMode(value.mode);
  const currentNodeId = asString(value.currentNodeId, 'node_0');
  const clearedNodeIds = asStringArray(value.clearedNodeIds, [currentNodeId]);

  const difficultyMode = normalizeDifficultyMode(value.difficultyMode);

  return {
    seed: seed >>> 0,
    mode,
    dateKey: asNullableString(value.dateKey),
    packIdLocked: asNullableString(value.packIdLocked),
    currentNodeId,
    clearedNodeIds,
    step: Math.max(0, Math.floor(asNumber(value.step, 0))),
    difficultyTier: Math.max(1, Math.floor(asNumber(value.difficultyTier, 1))),
    difficultyMode,
    restBonusBattles: Math.max(0, Math.floor(asNumber(value.restBonusBattles, 0))),
    battleNodesCleared: Math.max(0, Math.floor(asNumber(value.battleNodesCleared, 0))),
    lastRewardedNodeId: asString(value.lastRewardedNodeId, ''),
    consecutiveLosses: Math.max(0, Math.floor(asNumber(value.consecutiveLosses, 0))),
    lastObjectiveType: asNullableString(value.lastObjectiveType),
    lastMapId: asNullableString(value.lastMapId),
    finalScore: Number.isFinite(asNumber(value.finalScore, NaN))
      ? Math.max(0, Math.floor(asNumber(value.finalScore, 0)))
      : null,
    scoreBreakdown: sanitizeScoreBreakdown(value.scoreBreakdown),
    objectiveNoRepeat: typeof value.objectiveNoRepeat === 'boolean' ? value.objectiveNoRepeat : true,
    mapNoRepeat: typeof value.mapNoRepeat === 'boolean' ? value.mapNoRepeat : true,
    challengeCode: asNullableString(value.challengeCode),
    challengePayload: sanitizeChallengePayloadSummary(value.challengePayload),
  };
}

function sanitizeNode(value: unknown): Node | null {
  if (!isObject(value) || !Array.isArray(value.edges)) {
    return null;
  }

  const edges: string[] = [];
  for (let i = 0; i < value.edges.length; i += 1) {
    if (typeof value.edges[i] === 'string') {
      edges.push(value.edges[i]);
    }
  }

  const nodeTypeValue = asString(value.type, 'BATTLE');
  const nodeType: Node['type'] =
    nodeTypeValue === 'SHOP' ||
    nodeTypeValue === 'RECRUIT' ||
    nodeTypeValue === 'REST' ||
    nodeTypeValue === 'ELITE' ||
    nodeTypeValue === 'BOSS'
      ? nodeTypeValue
      : 'BATTLE';

  return {
    id: asString(value.id, ''),
    type: nodeType,
    x: asNumber(value.x, 0),
    y: asNumber(value.y, 0),
    edges,
    cleared: Boolean(value.cleared),
  };
}

function sanitizeMapState(value: unknown): MapState | null {
  if (!isObject(value) || !Array.isArray(value.nodes)) {
    return null;
  }

  const nodes: Node[] = [];
  for (let i = 0; i < value.nodes.length; i += 1) {
    const node = sanitizeNode(value.nodes[i]);
    if (node !== null && node.id.length > 0) {
      nodes.push(node);
    }
  }

  if (nodes.length === 0) {
    return null;
  }

  const startNodeId = asString(value.startNodeId, nodes[0].id);
  const bossNodeId = asString(value.bossNodeId, nodes[nodes.length - 1].id);

  return {
    nodes,
    startNodeId,
    bossNodeId,
  };
}

function sanitizeSquad(value: unknown, fallbackArchetypeId: string): SquadMeta | null {
  if (!isObject(value)) {
    return null;
  }
  const id = asString(value.id, '');
  if (id.length === 0) {
    return null;
  }

  const requestedArchetypeId = asString(value.archetypeId, fallbackArchetypeId);
  const archetypeId = contentManager.hasUnitArchetype(requestedArchetypeId) ? requestedArchetypeId : fallbackArchetypeId;
  if (archetypeId !== requestedArchetypeId) {
    console.warn(`[Save] Missing archetype '${requestedArchetypeId}' in content. Replaced with '${archetypeId}'.`);
  }

  return {
    id,
    archetypeId,
    size: Math.max(1, Math.floor(asNumber(value.size, 20))),
    tier: Math.max(1, Math.floor(asNumber(value.tier, 1))),
    name: typeof value.name === 'string' ? value.name : undefined,
    perks: Array.isArray(value.perks) ? value.perks.filter((entry) => typeof entry === 'string') : undefined,
  };
}

function sanitizeArmyState(value: unknown): ArmyState | null {
  if (!isObject(value) || !Array.isArray(value.squads)) {
    return null;
  }
  const fallbackArchetypeId = contentManager.getFallbackArchetypeId();

  const squads: SquadMeta[] = [];
  for (let i = 0; i < value.squads.length; i += 1) {
    const squad = sanitizeSquad(value.squads[i], fallbackArchetypeId);
    if (squad !== null) {
      squads.push(squad);
    }
  }
  if (squads.length === 0) {
    squads.push({
      id: 'squad_1',
      archetypeId: fallbackArchetypeId,
      size: 20,
      tier: 1,
    });
  }

  const nextSquadId = Math.max(
    Math.floor(asNumber(value.nextSquadId, squads.length + 1)),
    squads.length + 1,
  );

  return {
    squads,
    gold: Math.max(0, Math.floor(asNumber(value.gold, 0))),
    supplies: Math.max(0, Math.floor(asNumber(value.supplies, 0))),
    recruits: Math.max(0, Math.floor(asNumber(value.recruits, 0))),
    nextSquadId,
  };
}

function sanitizePerkState(value: unknown): PerkState {
  const defaults = createPerkState();
  if (!isObject(value)) {
    return defaults;
  }
  const pickedPerkIds = asStringArray(value.pickedPerkIds, []);
  return {
    pickedPerkIds,
    lastOfferedAtBattleCount: Math.max(0, Math.floor(asNumber(value.lastOfferedAtBattleCount, 0))),
  };
}

function migrateRunState(runState: RunState, mapState: MapState): RunState {
  let battleNodesCleared = runState.battleNodesCleared;
  if (battleNodesCleared <= 0) {
    let battleCount = 0;
    for (let i = 0; i < mapState.nodes.length; i += 1) {
      const node = mapState.nodes[i];
      if (
        runState.clearedNodeIds.includes(node.id) &&
        (node.type === 'BATTLE' || node.type === 'ELITE' || node.type === 'BOSS')
      ) {
        battleCount += 1;
      }
    }
    battleNodesCleared = battleCount;
  }

  return {
    ...runState,
    mode: runState.mode ?? 'NORMAL',
    dateKey: runState.dateKey ?? null,
    packIdLocked: runState.packIdLocked ?? null,
    difficultyMode: runState.difficultyMode ?? DifficultyMode.NORMAL,
    battleNodesCleared,
    lastRewardedNodeId: runState.lastRewardedNodeId ?? '',
    consecutiveLosses: Math.max(0, Math.floor(runState.consecutiveLosses ?? 0)),
    lastObjectiveType: runState.lastObjectiveType ?? null,
    lastMapId: runState.lastMapId ?? null,
    finalScore:
      typeof runState.finalScore === 'number' && Number.isFinite(runState.finalScore)
        ? Math.max(0, Math.floor(runState.finalScore))
        : null,
    scoreBreakdown: runState.scoreBreakdown ?? null,
    objectiveNoRepeat: typeof runState.objectiveNoRepeat === 'boolean' ? runState.objectiveNoRepeat : true,
    mapNoRepeat: typeof runState.mapNoRepeat === 'boolean' ? runState.mapNoRepeat : true,
    challengeCode: runState.challengeCode ?? null,
    challengePayload: runState.challengePayload ?? null,
  };
}

function normalizeSaveShape(raw: unknown): SaveGameData | null {
  if (!isObject(raw)) {
    return null;
  }

  if (raw.saveVersion === SAVE_VERSION) {
    const runState = sanitizeRunState(raw.runState);
    const armyState = sanitizeArmyState(raw.armyState);
    const mapState = sanitizeMapState(raw.mapState);
    const perkState = sanitizePerkState(raw.perkState);
    if (runState === null || armyState === null || mapState === null) {
      return null;
    }
    return {
      saveVersion: SAVE_VERSION,
      contentVersion: asString(raw.contentVersion, contentManager.getStatus().contentVersion),
      runState: migrateRunState(runState, mapState),
      armyState,
      perkState,
      mapState,
    };
  }

  if (asNumber(raw.saveVersion, -1) === 4) {
    const runState = sanitizeRunState(raw.runState);
    const armyState = sanitizeArmyState(raw.armyState);
    const mapState = sanitizeMapState(raw.mapState);
    const perkState = sanitizePerkState(raw.perkState);
    if (runState === null || armyState === null || mapState === null) {
      return null;
    }
    console.warn('[Save] Migrated save v4 to v5.');
    return {
      saveVersion: SAVE_VERSION,
      contentVersion: asString(raw.contentVersion, contentManager.getStatus().contentVersion),
      runState: migrateRunState(runState, mapState),
      armyState,
      perkState,
      mapState,
    };
  }

  if (asNumber(raw.saveVersion, -1) === 3) {
    const legacy = raw as unknown as LegacySaveV3;
    const runState = sanitizeRunState(legacy.runState);
    const armyState = sanitizeArmyState(legacy.armyState);
    const mapState = sanitizeMapState(legacy.mapState);
    const perkState = sanitizePerkState(legacy.perkState);
    if (runState === null || armyState === null || mapState === null) {
      return null;
    }
    console.warn('[Save] Migrated save v3 to v5.');
    return {
      saveVersion: SAVE_VERSION,
      contentVersion: asString(legacy.contentVersion, contentManager.getStatus().contentVersion),
      runState: migrateRunState(runState, mapState),
      armyState,
      perkState,
      mapState,
    };
  }

  if (asNumber(raw.saveVersion, -1) === 2) {
    const legacy = raw as unknown as LegacySaveV2;
    const runState = sanitizeRunState(legacy.runState);
    const armyState = sanitizeArmyState(legacy.armyState);
    const mapState = sanitizeMapState(legacy.mapState);
    if (runState === null || armyState === null || mapState === null) {
      return null;
    }
    console.warn('[Save] Migrated save v2 to v5.');
    return {
      saveVersion: SAVE_VERSION,
      contentVersion: asString(legacy.contentVersion, contentManager.getStatus().contentVersion),
      runState: migrateRunState(runState, mapState),
      armyState,
      perkState: createPerkState(),
      mapState,
    };
  }

  if (asNumber(raw.version, -1) === 1) {
    const legacy = raw as unknown as LegacySaveV1;
    const runState = sanitizeRunState(legacy.runState);
    const armyState = sanitizeArmyState(legacy.armyState);
    const mapState = sanitizeMapState(legacy.mapState);
    if (runState === null || armyState === null || mapState === null) {
      return null;
    }
    console.warn('[Save] Migrated legacy save v1 to v5.');
    return {
      saveVersion: SAVE_VERSION,
      contentVersion: contentManager.getStatus().contentVersion,
      runState: migrateRunState(runState, mapState),
      armyState,
      perkState: createPerkState(),
      mapState,
    };
  }

  return null;
}

function resolveSaveKey(slot: SaveSlot): string {
  if (slot === 'daily') {
    return DAILY_SAVE_KEY;
  }
  if (slot === 'challenge') {
    return CHALLENGE_SAVE_KEY;
  }
  return NORMAL_SAVE_KEY;
}

export function saveGame(data: Omit<SaveGameData, 'saveVersion' | 'contentVersion'>, slot: SaveSlot = 'normal'): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  const payload: SaveGameData = {
    saveVersion: SAVE_VERSION,
    contentVersion: contentManager.getStatus().contentVersion,
    runState: data.runState,
    armyState: data.armyState,
    perkState: data.perkState,
    mapState: data.mapState,
  };

  window.localStorage.setItem(resolveSaveKey(slot), JSON.stringify(payload));
}

export function loadGame(slot: SaveSlot = 'normal'): SaveGameData | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  const raw = window.localStorage.getItem(resolveSaveKey(slot));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeSaveShape(parsed);
  } catch {
    return null;
  }
}

export function clearSave(slot: SaveSlot = 'normal'): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.removeItem(resolveSaveKey(slot));
}

export function hasSave(slot: SaveSlot = 'normal'): boolean {
  return loadGame(slot) !== null;
}
