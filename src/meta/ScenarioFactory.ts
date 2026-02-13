import type { SquadMeta, ArmyState } from './Army';
import { clampTier, squadPowerScore } from './Progression';
import type { BattleScenario } from './types';
import type { NodeType, RunState } from '../overworld/types';
import { SeededRng } from '../utils/rng';

const ENEMY_ARCHETYPES = ['infantry', 'spearmen', 'cavalry', 'archers'] as const;

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

function scenarioScale(nodeType: NodeType): number {
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
    return 0.78;
  }
  if (nodeType === 'BOSS') {
    return 0.62;
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

export function createScenario(
  nodeId: string,
  nodeType: NodeType,
  runState: RunState,
  armyState: ArmyState,
): BattleScenario {
  const seed = (runState.seed ^ ((runState.step + 1) * 2654435761) ^ hashNodeType(nodeType)) >>> 0;
  const rng = new SeededRng(seed);

  const difficultyTier = Math.max(1, runState.difficultyTier);
  const playerPower = armyState.squads.reduce((sum, squad) => sum + squadPowerScore(squad), 0);

  let enemySquads: SquadMeta[] = [];

  if (nodeType === 'BOSS') {
    enemySquads = generateBossSquads(rng, difficultyTier, runState.step);
  } else {
    const targetPower = playerPower * scenarioScale(nodeType) * (1 + (difficultyTier - 1) * 0.08);
    const squadCount = nodeType === 'ELITE' ? rng.int(2, 3) : rng.int(3, 4);

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

  return {
    nodeId,
    nodeType,
    objectiveType: 'capture',
    captureSpeedMultiplier: captureSpeed(nodeType),
    enemySquads,
    goldReward: rewardGold(nodeType, difficultyTier, rng),
    recruitsReward: rewardRecruits(nodeType, difficultyTier, rng),
    playerHpBuffMultiplier: runState.restBonusBattles > 0 ? 1.08 : 1,
  };
}