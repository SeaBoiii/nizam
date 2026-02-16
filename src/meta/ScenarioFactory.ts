import { contentManager } from '../content/ContentManager';
import type { SquadMeta, ArmyState } from './Army';
import { getScaling } from './Difficulty';
import { clampTier } from './Progression';
import type { BattleScenario } from './types';
import type { NodeType, RunState } from '../overworld/types';
import { SeededRng } from '../utils/rng';
import { objectiveDisplayName, type BattleObjectiveType } from '../sim/objectives/ObjectiveTypes';

const OBJECTIVE_TYPES: BattleObjectiveType[] = ['CAPTURE', 'ASSASSINATE', 'HOLDOUT', 'ESCORT', 'SIEGE'];

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

function objectiveSeed(nodeId: string, nodeType: NodeType, runState: RunState): number {
  return (runState.seed ^ hashText(nodeId) ^ hashNodeType(nodeType) ^ 0x5f3759df) >>> 0;
}

function scenarioSeed(nodeId: string, nodeType: NodeType, runState: RunState): number {
  return (runState.seed ^ ((runState.step + 1) * 2654435761) ^ hashNodeType(nodeType) ^ hashText(nodeId)) >>> 0;
}

function weightedObjective(rng: SeededRng, weights: Record<BattleObjectiveType, number>): BattleObjectiveType {
  const total = Math.max(0.0001, weights.CAPTURE + weights.ASSASSINATE + weights.HOLDOUT + weights.ESCORT + weights.SIEGE);
  const roll = rng.range(0, total);

  let acc = weights.CAPTURE;
  if (roll <= acc) {
    return 'CAPTURE';
  }
  acc += weights.ASSASSINATE;
  if (roll <= acc) {
    return 'ASSASSINATE';
  }
  acc += weights.HOLDOUT;
  if (roll <= acc) {
    return 'HOLDOUT';
  }
  acc += weights.ESCORT;
  if (roll <= acc) {
    return 'ESCORT';
  }
  return 'SIEGE';
}

function isObjectiveType(value: string | null): value is BattleObjectiveType {
  if (value === null) {
    return false;
  }
  for (let i = 0; i < OBJECTIVE_TYPES.length; i += 1) {
    if (OBJECTIVE_TYPES[i] === value) {
      return true;
    }
  }
  return false;
}

function shouldApplyStreakProtection(nodeId: string, runState: RunState): boolean {
  return nodeId !== runState.currentNodeId;
}

function cloneObjectiveWeights(weights: Record<BattleObjectiveType, number>): Record<BattleObjectiveType, number> {
  return {
    CAPTURE: weights.CAPTURE,
    ASSASSINATE: weights.ASSASSINATE,
    HOLDOUT: weights.HOLDOUT,
    ESCORT: weights.ESCORT,
    SIEGE: weights.SIEGE,
  };
}

function hasPositiveAlternativeWeight(
  weights: Record<BattleObjectiveType, number>,
  excludedType: BattleObjectiveType,
): boolean {
  for (let i = 0; i < OBJECTIVE_TYPES.length; i += 1) {
    const type = OBJECTIVE_TYPES[i];
    if (type === excludedType) {
      continue;
    }
    if (Math.max(0, weights[type]) > 0.0001) {
      return true;
    }
  }
  return false;
}

function applyObjectiveStreakProtection(
  weights: Record<BattleObjectiveType, number>,
  lastObjectiveType: string | null,
): Record<BattleObjectiveType, number> {
  const adjusted = cloneObjectiveWeights(weights);
  if (!isObjectiveType(lastObjectiveType)) {
    return adjusted;
  }
  if (!hasPositiveAlternativeWeight(adjusted, lastObjectiveType)) {
    return adjusted;
  }
  adjusted[lastObjectiveType] = 0;
  return adjusted;
}

function nodeWeightsForObjective(nodeType: NodeType): 'BATTLE' | 'ELITE' | 'BOSS' | null {
  if (nodeType === 'BATTLE' || nodeType === 'ELITE' || nodeType === 'BOSS') {
    return nodeType;
  }
  return null;
}

function createEnemySquad(id: string, archetypeId: string, size: number, tier: number): SquadMeta {
  return {
    id,
    archetypeId,
    size: Math.max(6, Math.round(size)),
    tier: clampTier(tier),
  };
}

function weightedMapId(rng: SeededRng, entries: ReadonlyArray<{ id: string; weight: number }>, fallbackId: string): string {
  if (entries.length === 0) {
    return fallbackId;
  }
  let total = 0;
  for (let i = 0; i < entries.length; i += 1) {
    total += Math.max(0, entries[i].weight);
  }
  if (total <= 0.0001) {
    return entries[rng.int(0, entries.length - 1)].id;
  }

  const roll = rng.range(0, total);
  let acc = 0;
  for (let i = 0; i < entries.length; i += 1) {
    acc += Math.max(0, entries[i].weight);
    if (roll <= acc) {
      return entries[i].id;
    }
  }
  return entries[entries.length - 1].id;
}

function applyMapStreakProtection(
  entries: ReadonlyArray<{ id: string; weight: number }>,
  lastMapId: string | null,
): Array<{ id: string; weight: number }> {
  if (lastMapId === null || entries.length < 2) {
    return [...entries];
  }

  let hasAlternative = false;
  for (let i = 0; i < entries.length; i += 1) {
    if (entries[i].id !== lastMapId) {
      hasAlternative = true;
      break;
    }
  }
  if (!hasAlternative) {
    return [...entries];
  }

  const filtered: Array<{ id: string; weight: number }> = [];
  for (let i = 0; i < entries.length; i += 1) {
    if (entries[i].id !== lastMapId) {
      filtered.push(entries[i]);
    }
  }
  return filtered.length > 0 ? filtered : [...entries];
}

function sampleReward(
  rng: SeededRng,
  range: { min: number; max: number },
  difficultyTier: number,
  nodeType: NodeType,
): number {
  const min = Math.min(range.min, range.max);
  const max = Math.max(range.min, range.max);
  const base = rng.range(min, max);
  const nodeBonus = nodeType === 'BOSS' ? 4 : nodeType === 'ELITE' ? 2 : 0;
  const scaled = base + difficultyTier * 0.75 + nodeBonus;
  return Math.max(min, Math.min(max, Math.round(scaled)));
}

function pickTemplateBucket<T extends { depthMin: number; depthMax: number }>(step: number, buckets: T[]): T | null {
  for (let i = 0; i < buckets.length; i += 1) {
    if (step >= buckets[i].depthMin && step <= buckets[i].depthMax) {
      return buckets[i];
    }
  }
  return buckets.length > 0 ? buckets[buckets.length - 1] : null;
}

export function selectObjectiveType(nodeId: string, nodeType: NodeType, runState: RunState): BattleObjectiveType {
  const objectives = contentManager.getObjectiveTuning();
  const selectionKey = nodeWeightsForObjective(nodeType);
  if (selectionKey === null) {
    return 'CAPTURE';
  }

  const weights = objectives.selectionWeightsByNodeType[selectionKey];
  const useStreakProtection = shouldApplyStreakProtection(nodeId, runState);
  const lastObjectiveType = useStreakProtection ? runState.lastObjectiveType : null;
  const adjustedWeights = useStreakProtection
    ? applyObjectiveStreakProtection(weights, lastObjectiveType)
    : cloneObjectiveWeights(weights);
  const rng = new SeededRng(objectiveSeed(nodeId, nodeType, runState));
  if (
    nodeType === 'ELITE' &&
    runState.step >= objectives.siege.eliteDepthMin &&
    rng.range(0, 1) <= objectives.siege.eliteChance
  ) {
    if (lastObjectiveType !== 'SIEGE' || !hasPositiveAlternativeWeight(weights, 'SIEGE')) {
      return 'SIEGE';
    }
  }
  return weightedObjective(rng, adjustedWeights);
}

export function objectivePreviewLabel(nodeId: string, nodeType: NodeType, runState: RunState): string {
  return objectiveDisplayName(selectObjectiveType(nodeId, nodeType, runState));
}

function resolveEnemySquads(
  nodeType: NodeType,
  objectiveType: BattleObjectiveType,
  runState: RunState,
  enemySizeMult: number,
  enemyTierBonus: number,
  rng: SeededRng,
): SquadMeta[] {
  const scenarios = contentManager.getScenarioTuning();
  const templateBuckets =
    objectiveType === 'SIEGE'
      ? scenarios.siegeTemplates
      : scenarios.templatesByNodeType[nodeType === 'BOSS' ? 'BOSS' : nodeType === 'ELITE' ? 'ELITE' : 'BATTLE'];
  const bucket = pickTemplateBucket(runState.step, templateBuckets);
  if (!bucket || bucket.templates.length === 0) {
    return [
      createEnemySquad(`enemy_${runState.step}_fallback_0`, 'infantry', 24, 1),
      createEnemySquad(`enemy_${runState.step}_fallback_1`, 'spearmen', 22, 1),
      createEnemySquad(`enemy_${runState.step}_fallback_2`, 'archers', 20, 1),
    ];
  }

  const template = bucket.templates[rng.int(0, bucket.templates.length - 1)];
  const difficultyTier = Math.max(1, runState.difficultyTier);
  const objectiveScale = scenarios.objectivePowerScale[objectiveType];
  const difficultyScale = 1 + (difficultyTier - 1) * 0.06;
  const nodeScale = nodeType === 'BOSS' ? 1.16 : nodeType === 'ELITE' ? 1.08 : 1;
  const totalScale = Math.max(0.45, objectiveScale * difficultyScale * nodeScale * enemySizeMult);

  const squads: SquadMeta[] = [];
  for (let i = 0; i < template.squads.length; i += 1) {
    const source = template.squads[i];
    const bonusTier = (nodeType === 'BOSS' ? 1 : nodeType === 'ELITE' && difficultyTier >= 3 ? 1 : 0) + enemyTierBonus;
    squads.push(
      createEnemySquad(
        `enemy_${runState.step}_${i}`,
        source.archetypeId,
        source.size * totalScale,
        source.tier + bonusTier,
      ),
    );
  }

  return squads;
}

function resolveMapId(
  nodeId: string,
  nodeType: NodeType,
  objectiveType: BattleObjectiveType,
  runState: RunState,
  rng: SeededRng,
): string {
  const allMaps = contentManager.getAllMaps();
  const fallbackMapId = allMaps.length > 0 ? allMaps[0].id : 'open_field';
  if (objectiveType === 'SIEGE') {
    const siegeMap = contentManager.getMap('siege_gatehouse');
    if (siegeMap !== null) {
      return siegeMap.id;
    }
  }
  const scenarios = contentManager.getScenarioTuning();
  const poolBuckets =
    scenarios.mapPoolsByNodeType[nodeType === 'BOSS' ? 'BOSS' : nodeType === 'ELITE' ? 'ELITE' : 'BATTLE'];
  const bucket = pickTemplateBucket(runState.step, poolBuckets);
  if (!bucket || bucket.maps.length === 0) {
    return fallbackMapId;
  }

  const mapIds = new Set<string>();
  for (let i = 0; i < allMaps.length; i += 1) {
    mapIds.add(allMaps[i].id);
  }

  const validEntries: Array<{ id: string; weight: number }> = [];
  for (let i = 0; i < bucket.maps.length; i += 1) {
    const entry = bucket.maps[i];
    if (mapIds.has(entry.id)) {
      validEntries.push(entry);
    }
  }
  if (validEntries.length === 0) {
    return fallbackMapId;
  }

  const useStreakProtection = shouldApplyStreakProtection(nodeId, runState);
  const mapEntries = useStreakProtection ? applyMapStreakProtection(validEntries, runState.lastMapId) : [...validEntries];
  return weightedMapId(rng, mapEntries, fallbackMapId);
}

export function createScenario(
  nodeId: string,
  nodeType: NodeType,
  runState: RunState,
  _armyState: ArmyState,
): BattleScenario {
  const rng = new SeededRng(scenarioSeed(nodeId, nodeType, runState));
  const nodeTuning = contentManager.getNodeTuning();
  const objectives = contentManager.getObjectiveTuning();
  const scaling = getScaling(runState.step, runState.difficultyMode);

  const difficultyTier = Math.max(1, runState.difficultyTier);
  const objectiveType = selectObjectiveType(nodeId, nodeType, runState);
  const selectedObjectiveSeed = objectiveSeed(nodeId, nodeType, runState);
  const mapId = resolveMapId(nodeId, nodeType, objectiveType, runState, rng);
  const enemySquads = resolveEnemySquads(
    nodeType,
    objectiveType,
    runState,
    scaling.enemySizeMult,
    scaling.enemyTierBonus,
    rng,
  );

  const rewards = nodeTuning.rewardsByNodeType[nodeType];
  const goldReward = sampleReward(rng, rewards.gold, difficultyTier, nodeType);
  const recruitsReward = sampleReward(rng, rewards.recruits, difficultyTier, nodeType);

  const holdoutDurationSeconds =
    objectiveType === 'HOLDOUT' ? Math.max(80, objectives.holdout.durationSeconds - difficultyTier * 3) : undefined;
  const holdoutWaveInterval =
    objectiveType === 'HOLDOUT' ? Math.max(12, objectives.holdout.waveIntervalSeconds - difficultyTier * 0.75) : undefined;
  const holdoutMaxWaves = objectiveType === 'HOLDOUT' ? objectives.holdout.maxWaves : undefined;
  const escortTimeLimitSeconds =
    objectiveType === 'ESCORT' ? Math.max(110, objectives.escort.timeLimitSeconds - difficultyTier * 4) : undefined;
  const siegeTimeLimitSeconds =
    objectiveType === 'SIEGE' ? Math.max(120, objectives.siege.timeLimitSeconds - difficultyTier * 4) : undefined;

  return {
    nodeId,
    nodeType,
    mapId,
    objectiveType,
    captureSpeedMultiplier: objectives.capture.speedMultiplierByNodeType[nodeType === 'ELITE' ? 'ELITE' : nodeType === 'BOSS' ? 'BOSS' : 'BATTLE'],
    holdoutDurationSeconds,
    holdoutWaveInterval,
    holdoutMaxWaves,
    escortTimeLimitSeconds,
    siegeTimeLimitSeconds,
    objectiveSeed: selectedObjectiveSeed,
    difficultyTier,
    difficultyMode: runState.difficultyMode,
    enemyAIFrequencyMult: scaling.enemyAIFrequencyMult,
    holdoutWaveStrengthMult: scaling.enemySizeMult,
    enemySquads,
    goldReward,
    recruitsReward,
    playerHpBuffMultiplier: runState.restBonusBattles > 0 ? 1.08 : 1,
  };
}
