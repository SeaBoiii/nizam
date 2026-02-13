import type { SquadMeta, ArmyState } from './Army';
import { clampTier, squadPowerScore } from './Progression';
import type { BattleScenario } from './types';
import type { NodeType, RunState } from '../overworld/types';
import { SeededRng } from '../utils/rng';
import { objectiveDisplayName, type BattleObjectiveType } from '../sim/objectives/ObjectiveTypes';
import {
  CAPTURE_SPEED_BOSS,
  CAPTURE_SPEED_ELITE,
  ESCORT_TIME_LIMIT_SECONDS,
  HOLDOUT_DURATION_SECONDS,
  HOLDOUT_MAX_WAVES,
  HOLDOUT_WAVE_INTERVAL_SECONDS,
  OBJECTIVE_BATTLE_CAPTURE_CHANCE,
  OBJECTIVE_BATTLE_ESCORT_CHANCE,
  OBJECTIVE_BATTLE_HOLDOUT_CHANCE,
  OBJECTIVE_BOSS_CAPTURE_CHANCE,
  OBJECTIVE_ELITE_CAPTURE_CHANCE,
} from '../sim/rules/ObjectiveTuning';

const ENEMY_ARCHETYPES = ['infantry', 'spearmen', 'cavalry', 'archers'] as const;

function hashText(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function hashNodeType(nodeType: NodeType): number {
  let hash = 0;
  for (let i = 0; i < nodeType.length; i += 1) {
    hash = (hash * 31 + nodeType.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function createEnemySquad(
  id: string,
  archetypeId: string,
  size: number,
  tier: number,
): SquadMeta {
  return {
    id,
    archetypeId,
    size,
    tier: clampTier(tier),
  };
}

function scenarioScale(nodeType: NodeType, objectiveType: BattleObjectiveType): number {
  if (objectiveType === 'HOLDOUT') {
    return 0.68;
  }
  if (objectiveType === 'ESCORT') {
    return 0.88;
  }

  switch (nodeType) {
    case 'BATTLE':
      return 0.97;
    case 'ELITE':
      return 1.2;
    case 'BOSS':
      return 1.38;
    default:
      return 1;
  }
}

function captureSpeed(nodeType: NodeType): number {
  if (nodeType === 'ELITE') {
    return CAPTURE_SPEED_ELITE;
  }
  if (nodeType === 'BOSS') {
    return CAPTURE_SPEED_BOSS;
  }
  return 1;
}

function rewardGold(nodeType: NodeType, difficultyTier: number, rng: SeededRng): number {
  const base = nodeType === 'BOSS' ? 66 : nodeType === 'ELITE' ? 52 : 34;
  const variance = rng.int(0, 18);
  return Math.min(80, Math.max(30, Math.round(base + variance + difficultyTier * 4.5)));
}

function rewardRecruits(nodeType: NodeType, difficultyTier: number, rng: SeededRng): number {
  const base = nodeType === 'BOSS' ? 11 : nodeType === 'ELITE' ? 9 : 6;
  const variance = rng.int(0, 5);
  return Math.min(15, Math.max(5, Math.round(base + variance + difficultyTier * 0.6)));
}

function generateBossSquads(rng: SeededRng, tier: number, step: number): SquadMeta[] {
  return [
    createEnemySquad(`enemy_${step}_boss_a`, 'infantry', rng.int(34, 40), tier + 1),
    createEnemySquad(`enemy_${step}_boss_b`, 'cavalry', rng.int(26, 32), tier + 1),
    createEnemySquad(`enemy_${step}_boss_c`, 'spearmen', rng.int(30, 36), tier),
  ];
}

function objectiveSeed(nodeId: string, nodeType: NodeType, runState: RunState): number {
  return (runState.seed ^ hashText(nodeId) ^ hashNodeType(nodeType) ^ 0x5f3759df) >>> 0;
}

export function selectObjectiveType(nodeId: string, nodeType: NodeType, runState: RunState): BattleObjectiveType {
  const seed = objectiveSeed(nodeId, nodeType, runState);
  const rng = new SeededRng(seed);

  if (nodeType === 'BATTLE') {
    const roll = rng.next();
    if (roll < OBJECTIVE_BATTLE_HOLDOUT_CHANCE) {
      return 'HOLDOUT';
    }
    if (roll < OBJECTIVE_BATTLE_HOLDOUT_CHANCE + OBJECTIVE_BATTLE_ESCORT_CHANCE) {
      return 'ESCORT';
    }
    return rng.chance(OBJECTIVE_BATTLE_CAPTURE_CHANCE) ? 'CAPTURE' : 'ASSASSINATE';
  }

  if (nodeType === 'ELITE') {
    return rng.chance(OBJECTIVE_ELITE_CAPTURE_CHANCE) ? 'CAPTURE' : 'ASSASSINATE';
  }

  if (nodeType === 'BOSS') {
    return rng.chance(OBJECTIVE_BOSS_CAPTURE_CHANCE) ? 'CAPTURE' : 'ASSASSINATE';
  }

  return 'CAPTURE';
}

export function objectivePreviewLabel(nodeId: string, nodeType: NodeType, runState: RunState): string {
  return objectiveDisplayName(selectObjectiveType(nodeId, nodeType, runState));
}

export function createScenario(
  nodeId: string,
  nodeType: NodeType,
  runState: RunState,
  armyState: ArmyState,
): BattleScenario {
  const scenarioSeed =
    (runState.seed ^ ((runState.step + 1) * 2654435761) ^ hashNodeType(nodeType) ^ hashText(nodeId)) >>> 0;
  const rng = new SeededRng(scenarioSeed);

  const difficultyTier = Math.max(1, runState.difficultyTier);
  const objectiveType = selectObjectiveType(nodeId, nodeType, runState);
  const selectedObjectiveSeed = objectiveSeed(nodeId, nodeType, runState);
  const playerPower = armyState.squads.reduce((sum, squad) => sum + squadPowerScore(squad), 0);

  let enemySquads: SquadMeta[] = [];

  if (nodeType === 'BOSS') {
    enemySquads = generateBossSquads(rng, difficultyTier, runState.step);
  } else {
    const targetPower = playerPower * scenarioScale(nodeType, objectiveType) * (1 + (difficultyTier - 1) * 0.08);
    const baseSquadCount = nodeType === 'ELITE' ? rng.int(2, 3) : rng.int(3, 4);
    const squadCount = objectiveType === 'HOLDOUT' ? Math.max(1, baseSquadCount - 1) : baseSquadCount;

    let power = 0;
    for (let i = 0; i < squadCount; i += 1) {
      const archetype = ENEMY_ARCHETYPES[rng.int(0, ENEMY_ARCHETYPES.length - 1)];
      const size = nodeType === 'ELITE' ? rng.int(24, 32) : rng.int(20, 30);
      const tierBoost = nodeType === 'ELITE' ? 1 : 0;
      const tier = clampTier(rng.int(Math.max(1, difficultyTier - 1), difficultyTier + tierBoost));

      const squad = createEnemySquad(`enemy_${runState.step}_${i}`, archetype, size, tier);
      enemySquads.push(squad);
      power += squadPowerScore(squad);

      if (power >= targetPower && enemySquads.length >= 2) {
        break;
      }
    }
  }

  const holdoutDurationSeconds =
    objectiveType === 'HOLDOUT' ? Math.max(95, HOLDOUT_DURATION_SECONDS - difficultyTier * 3) : undefined;
  const holdoutWaveInterval =
    objectiveType === 'HOLDOUT' ? Math.max(17, HOLDOUT_WAVE_INTERVAL_SECONDS - difficultyTier * 0.75) : undefined;
  const holdoutMaxWaves = objectiveType === 'HOLDOUT' ? HOLDOUT_MAX_WAVES : undefined;
  const escortTimeLimitSeconds =
    objectiveType === 'ESCORT' ? Math.max(130, ESCORT_TIME_LIMIT_SECONDS - difficultyTier * 4) : undefined;

  return {
    nodeId,
    nodeType,
    objectiveType,
    captureSpeedMultiplier: captureSpeed(nodeType),
    holdoutDurationSeconds,
    holdoutWaveInterval,
    holdoutMaxWaves,
    escortTimeLimitSeconds,
    objectiveSeed: selectedObjectiveSeed,
    difficultyTier,
    enemySquads,
    goldReward: rewardGold(nodeType, difficultyTier, rng),
    recruitsReward: rewardRecruits(nodeType, difficultyTier, rng),
    playerHpBuffMultiplier: runState.restBonusBattles > 0 ? 1.08 : 1,
  };
}
