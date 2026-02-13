import type { ArmyState } from './Army';
import type { MapState, RunState } from '../overworld/types';

const SAVE_KEY = 'nizam_save_v1';
const SAVE_VERSION = 1;

export interface SaveGameData {
  version: number;
  runState: RunState;
  armyState: ArmyState;
  mapState: MapState;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidRunState(value: unknown): value is RunState {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.seed === 'number' &&
    typeof value.currentNodeId === 'string' &&
    Array.isArray(value.clearedNodeIds) &&
    typeof value.step === 'number' &&
    typeof value.difficultyTier === 'number' &&
    typeof value.restBonusBattles === 'number'
  );
}

function isValidArmyState(value: unknown): value is ArmyState {
  if (!isObject(value) || !Array.isArray(value.squads)) {
    return false;
  }

  if (
    typeof value.gold !== 'number' ||
    typeof value.supplies !== 'number' ||
    typeof value.recruits !== 'number' ||
    typeof value.nextSquadId !== 'number'
  ) {
    return false;
  }

  for (let i = 0; i < value.squads.length; i += 1) {
    const squad = value.squads[i];
    if (!isObject(squad)) {
      return false;
    }
    if (
      typeof squad.id !== 'string' ||
      typeof squad.archetypeId !== 'string' ||
      typeof squad.size !== 'number' ||
      typeof squad.tier !== 'number'
    ) {
      return false;
    }
  }

  return true;
}

function isValidMapState(value: unknown): value is MapState {
  if (!isObject(value) || !Array.isArray(value.nodes)) {
    return false;
  }

  if (typeof value.startNodeId !== 'string' || typeof value.bossNodeId !== 'string') {
    return false;
  }

  for (let i = 0; i < value.nodes.length; i += 1) {
    const node = value.nodes[i];
    if (!isObject(node) || !Array.isArray(node.edges)) {
      return false;
    }
    if (
      typeof node.id !== 'string' ||
      typeof node.type !== 'string' ||
      typeof node.x !== 'number' ||
      typeof node.y !== 'number' ||
      typeof node.cleared !== 'boolean'
    ) {
      return false;
    }
  }

  return true;
}

export function saveGame(data: Omit<SaveGameData, 'version'>): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  const payload: SaveGameData = {
    version: SAVE_VERSION,
    runState: data.runState,
    armyState: data.armyState,
    mapState: data.mapState,
  };

  window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
}

export function loadGame(): SaveGameData | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  const raw = window.localStorage.getItem(SAVE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) {
      return null;
    }

    if (parsed.version !== SAVE_VERSION) {
      return null;
    }

    if (!isValidRunState(parsed.runState) || !isValidArmyState(parsed.armyState) || !isValidMapState(parsed.mapState)) {
      return null;
    }

    return {
      version: SAVE_VERSION,
      runState: parsed.runState,
      armyState: parsed.armyState,
      mapState: parsed.mapState,
    };
  } catch {
    return null;
  }
}

export function clearSave(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.removeItem(SAVE_KEY);
}

export function hasSave(): boolean {
  return loadGame() !== null;
}