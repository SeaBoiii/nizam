import type {
  BattleMapContent,
  ContentFileName,
  ContentLoadStatus,
  MapsContent,
  LoadedContent,
  NodeDepthWeightsContent,
  NodesTuningContent,
  ObjectivesTuningContent,
  PerkContent,
  PerkRewardRulesContent,
  PerksContent,
  ScenarioDepthBucketContent,
  ScenariosContent,
  UnitArchetypeContent,
  UnitsContent,
  UpgradePathsContent,
} from './ContentTypes';
import {
  DEFAULT_NODES_CONTENT,
  DEFAULT_OBJECTIVES_CONTENT,
  DEFAULT_PERKS_CONTENT,
  DEFAULT_MAPS_CONTENT,
  DEFAULT_SCENARIOS_CONTENT,
  DEFAULT_UNITS_CONTENT,
  DEFAULT_UPGRADES_CONTENT,
} from './DefaultContent';
import type { UnitArchetype, UnitStats } from '../sim/types/UnitArchetype';

interface LoadOptions {
  forceReload?: boolean;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  return value as Record<string, unknown>;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function cloneStats(stats: UnitStats): UnitStats {
  return {
    hp: stats.hp,
    moveSpeed: stats.moveSpeed,
    attackDamage: stats.attackDamage,
    attackRate: stats.attackRate,
    meleeRange: stats.meleeRange,
    rangedDamage: stats.rangedDamage,
    rangedRange: stats.rangedRange,
    projectileSpeed: stats.projectileSpeed,
    projectileGravity: stats.projectileGravity,
    rangedCooldown: stats.rangedCooldown,
    accuracy: stats.accuracy,
    armor: stats.armor,
    mass: stats.mass,
    chargePower: stats.chargePower,
    chargeMinSpeed: stats.chargeMinSpeed,
  };
}

function cloneObjectiveWeights(content: ObjectivesTuningContent['selectionWeightsByNodeType']) {
  return {
    BATTLE: { ...content.BATTLE },
    ELITE: { ...content.ELITE },
    BOSS: { ...content.BOSS },
  };
}

function cloneUnitsContent(content: UnitsContent): UnitsContent {
  return {
    contentVersion: content.contentVersion,
    fallbackArchetypeId: content.fallbackArchetypeId,
    units: content.units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      tags: [...unit.tags],
      recruitable: unit.recruitable,
      tiers: {
        '1': cloneStats(unit.tiers['1']),
        '2': cloneStats(unit.tiers['2']),
        '3': cloneStats(unit.tiers['3']),
      },
    })),
    startingArmy: {
      gold: content.startingArmy.gold,
      supplies: content.startingArmy.supplies,
      recruits: content.startingArmy.recruits,
      squads: content.startingArmy.squads.map((squad) => ({
        archetypeId: squad.archetypeId,
        size: squad.size,
        tier: squad.tier,
        name: squad.name,
      })),
    },
  };
}

function cloneUpgradesContent(content: UpgradePathsContent): UpgradePathsContent {
  const paths: UpgradePathsContent['paths'] = {};
  const keys = Object.keys(content.paths);
  for (let i = 0; i < keys.length; i += 1) {
    const id = keys[i];
    paths[id] = {
      nextTierByTier: { ...content.paths[id].nextTierByTier },
      costByTier: { ...content.paths[id].costByTier },
    };
  }
  return {
    contentVersion: content.contentVersion,
    maxTier: content.maxTier,
    defaultUpgradeCost: content.defaultUpgradeCost,
    paths,
  };
}

function clonePerksContent(content: PerksContent): PerksContent {
  return {
    version: content.version,
    perks: content.perks.map((perk) => ({
      id: perk.id,
      name: perk.name,
      desc: perk.desc,
      rarity: perk.rarity,
      mods: { ...perk.mods },
    })),
    rewardRules: {
      everyNNodes: content.rewardRules.everyNNodes,
      choices: content.rewardRules.choices,
    },
  };
}

function cloneObjectivesContent(content: ObjectivesTuningContent): ObjectivesTuningContent {
  return {
    contentVersion: content.contentVersion,
    selectionWeightsByNodeType: cloneObjectiveWeights(content.selectionWeightsByNodeType),
    capture: {
      radius: content.capture.radius,
      baseGainRate: content.capture.baseGainRate,
      contestedDecayRate: content.capture.contestedDecayRate,
      opposingProgressDrainFactor: content.capture.opposingProgressDrainFactor,
      speedMultiplierByNodeType: { ...content.capture.speedMultiplierByNodeType },
    },
    holdout: {
      durationSeconds: content.holdout.durationSeconds,
      waveIntervalSeconds: content.holdout.waveIntervalSeconds,
      maxWaves: content.holdout.maxWaves,
      zoneRadius: content.holdout.zoneRadius,
      waveMinSquads: content.holdout.waveMinSquads,
      waveMaxSquads: content.holdout.waveMaxSquads,
      waveBaseSize: content.holdout.waveBaseSize,
      waveRandomSizeMaxAdd: content.holdout.waveRandomSizeMaxAdd,
      waveSizePerDifficulty: content.holdout.waveSizePerDifficulty,
      waveSizePerWave: content.holdout.waveSizePerWave,
      waveArchetypes: [...content.holdout.waveArchetypes],
    },
    escort: {
      timeLimitSeconds: content.escort.timeLimitSeconds,
      caravanHp: content.escort.caravanHp,
      caravanSpeed: content.escort.caravanSpeed,
      caravanRadius: content.escort.caravanRadius,
      exitRadius: content.escort.exitRadius,
      exitHoldSeconds: content.escort.exitHoldSeconds,
      startX: content.escort.startX,
      exitXPadding: content.escort.exitXPadding,
      startJitterY: content.escort.startJitterY,
      exitJitterY: content.escort.exitJitterY,
    },
    siege: {
      timeLimitSeconds: content.siege.timeLimitSeconds,
      gateCaptureRate: content.siege.gateCaptureRate,
      courtyardCaptureRate: content.siege.courtyardCaptureRate,
      contestedDecayRate: content.siege.contestedDecayRate,
      opposingProgressDrainFactor: content.siege.opposingProgressDrainFactor,
      eliteDepthMin: content.siege.eliteDepthMin,
      eliteChance: content.siege.eliteChance,
    },
  };
}

function cloneNodesContent(content: NodesTuningContent): NodesTuningContent {
  return {
    contentVersion: content.contentVersion,
    mapGeneration: { ...content.mapGeneration },
    nodeTypeWeightsByDepth: content.nodeTypeWeightsByDepth.map((entry) => ({
      depthMin: entry.depthMin,
      depthMax: entry.depthMax,
      weights: { ...entry.weights },
    })),
    rewardsByNodeType: {
      BATTLE: {
        gold: { ...content.rewardsByNodeType.BATTLE.gold },
        recruits: { ...content.rewardsByNodeType.BATTLE.recruits },
        supplies: { ...content.rewardsByNodeType.BATTLE.supplies },
      },
      SHOP: {
        gold: { ...content.rewardsByNodeType.SHOP.gold },
        recruits: { ...content.rewardsByNodeType.SHOP.recruits },
        supplies: { ...content.rewardsByNodeType.SHOP.supplies },
      },
      RECRUIT: {
        gold: { ...content.rewardsByNodeType.RECRUIT.gold },
        recruits: { ...content.rewardsByNodeType.RECRUIT.recruits },
        supplies: { ...content.rewardsByNodeType.RECRUIT.supplies },
      },
      REST: {
        gold: { ...content.rewardsByNodeType.REST.gold },
        recruits: { ...content.rewardsByNodeType.REST.recruits },
        supplies: { ...content.rewardsByNodeType.REST.supplies },
      },
      ELITE: {
        gold: { ...content.rewardsByNodeType.ELITE.gold },
        recruits: { ...content.rewardsByNodeType.ELITE.recruits },
        supplies: { ...content.rewardsByNodeType.ELITE.supplies },
      },
      BOSS: {
        gold: { ...content.rewardsByNodeType.BOSS.gold },
        recruits: { ...content.rewardsByNodeType.BOSS.recruits },
        supplies: { ...content.rewardsByNodeType.BOSS.supplies },
      },
    },
    shop: { ...content.shop },
    recruit: { ...content.recruit },
    rest: { ...content.rest },
    lossProtection: { ...content.lossProtection },
  };
}

function cloneScenariosContent(content: ScenariosContent): ScenariosContent {
  const cloneBuckets = (buckets: ScenarioDepthBucketContent[]): ScenarioDepthBucketContent[] =>
    buckets.map((bucket) => ({
      depthMin: bucket.depthMin,
      depthMax: bucket.depthMax,
      templates: bucket.templates.map((template) => ({
        id: template.id,
        squads: template.squads.map((squad) => ({
          archetypeId: squad.archetypeId,
          tier: squad.tier,
          size: squad.size,
        })),
      })),
    }));

  const cloneMapBuckets = (buckets: ScenariosContent['mapPoolsByNodeType']['BATTLE']) =>
    buckets.map((bucket) => ({
      depthMin: bucket.depthMin,
      depthMax: bucket.depthMax,
      maps: bucket.maps.map((entry) => ({
        id: entry.id,
        weight: entry.weight,
      })),
    }));

  return {
    contentVersion: content.contentVersion,
    objectivePowerScale: { ...content.objectivePowerScale },
    mapPoolsByNodeType: {
      BATTLE: cloneMapBuckets(content.mapPoolsByNodeType.BATTLE),
      ELITE: cloneMapBuckets(content.mapPoolsByNodeType.ELITE),
      BOSS: cloneMapBuckets(content.mapPoolsByNodeType.BOSS),
    },
    templatesByNodeType: {
      BATTLE: cloneBuckets(content.templatesByNodeType.BATTLE),
      ELITE: cloneBuckets(content.templatesByNodeType.ELITE),
      BOSS: cloneBuckets(content.templatesByNodeType.BOSS),
    },
    siegeTemplates: cloneBuckets(content.siegeTemplates),
  };
}

function cloneMapEntry(map: BattleMapContent): BattleMapContent {
  return {
    id: map.id,
    name: map.name,
    size: {
      w: map.size.w,
      h: map.size.h,
    },
    spawns: {
      blue: map.spawns.blue.map((spawn) => ({
        x: spawn.x,
        y: spawn.y,
      })),
      red: map.spawns.red.map((spawn) => ({
        x: spawn.x,
        y: spawn.y,
      })),
    },
    objectives: {
      capturePoint: { ...map.objectives.capturePoint },
      exitZone: { ...map.objectives.exitZone },
      gateZone: map.objectives.gateZone ? { ...map.objectives.gateZone } : undefined,
      courtyardZone: map.objectives.courtyardZone ? { ...map.objectives.courtyardZone } : undefined,
    },
    terrain: map.terrain.map((terrain) => ({
      type: terrain.type,
      id: terrain.id,
      x: terrain.x,
      y: terrain.y,
      w: terrain.w,
      h: terrain.h,
    })),
  };
}

function cloneMapsContent(content: MapsContent): MapsContent {
  return {
    version: content.version,
    maps: content.maps.map((map) => cloneMapEntry(map)),
    terrainRules: {
      forest: { ...content.terrainRules.forest },
      hill: { ...content.terrainRules.hill },
    },
    nav: {
      cellSize: content.nav.cellSize,
    },
  };
}

const DEFAULT_CONTENT: LoadedContent = {
  units: cloneUnitsContent(DEFAULT_UNITS_CONTENT),
  upgrades: cloneUpgradesContent(DEFAULT_UPGRADES_CONTENT),
  perks: clonePerksContent(DEFAULT_PERKS_CONTENT),
  objectives: cloneObjectivesContent(DEFAULT_OBJECTIVES_CONTENT),
  nodes: cloneNodesContent(DEFAULT_NODES_CONTENT),
  scenarios: cloneScenariosContent(DEFAULT_SCENARIOS_CONTENT),
  maps: cloneMapsContent(DEFAULT_MAPS_CONTENT),
};

function cloneLoadedContent(content: LoadedContent): LoadedContent {
  return {
    units: cloneUnitsContent(content.units),
    upgrades: cloneUpgradesContent(content.upgrades),
    perks: clonePerksContent(content.perks),
    objectives: cloneObjectivesContent(content.objectives),
    nodes: cloneNodesContent(content.nodes),
    scenarios: cloneScenariosContent(content.scenarios),
    maps: cloneMapsContent(content.maps),
  };
}

function hasTierStats(value: unknown): boolean {
  const candidate = asObject(value);
  if (!candidate) {
    return false;
  }
  const keys = [
    'hp',
    'moveSpeed',
    'attackDamage',
    'attackRate',
    'meleeRange',
    'rangedDamage',
    'rangedRange',
    'projectileSpeed',
    'projectileGravity',
    'rangedCooldown',
    'accuracy',
    'armor',
    'mass',
    'chargePower',
    'chargeMinSpeed',
  ];
  for (let i = 0; i < keys.length; i += 1) {
    if (!isFiniteNumber(candidate[keys[i]])) {
      return false;
    }
  }
  return true;
}

function isValidUnit(unit: unknown): unit is UnitArchetypeContent {
  const candidate = asObject(unit);
  if (!candidate) {
    return false;
  }

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    !Array.isArray(candidate.tags) ||
    typeof candidate.recruitable !== 'boolean'
  ) {
    return false;
  }

  const tiers = asObject(candidate.tiers);
  if (!tiers) {
    return false;
  }
  return hasTierStats(tiers['1']) && hasTierStats(tiers['2']) && hasTierStats(tiers['3']);
}

function isValidUnitsContent(value: unknown): value is UnitsContent {
  const candidate = asObject(value);
  if (!candidate) {
    return false;
  }
  if (
    typeof candidate.contentVersion !== 'string' ||
    typeof candidate.fallbackArchetypeId !== 'string' ||
    !Array.isArray(candidate.units)
  ) {
    return false;
  }
  for (let i = 0; i < candidate.units.length; i += 1) {
    if (!isValidUnit(candidate.units[i])) {
      return false;
    }
  }

  const startingArmy = asObject(candidate.startingArmy);
  if (!startingArmy || !Array.isArray(startingArmy.squads)) {
    return false;
  }
  if (
    !isFiniteNumber(startingArmy.gold) ||
    !isFiniteNumber(startingArmy.supplies) ||
    !isFiniteNumber(startingArmy.recruits)
  ) {
    return false;
  }

  for (let i = 0; i < startingArmy.squads.length; i += 1) {
    const squad = asObject(startingArmy.squads[i]);
    if (
      !squad ||
      typeof squad.archetypeId !== 'string' ||
      !isFiniteNumber(squad.size) ||
      !isFiniteNumber(squad.tier)
    ) {
      return false;
    }
  }

  return true;
}

function isValidUpgradesContent(value: unknown): value is UpgradePathsContent {
  const candidate = asObject(value);
  if (!candidate) {
    return false;
  }
  if (
    typeof candidate.contentVersion !== 'string' ||
    !isFiniteNumber(candidate.maxTier) ||
    !isFiniteNumber(candidate.defaultUpgradeCost)
  ) {
    return false;
  }

  const paths = asObject(candidate.paths);
  if (!paths) {
    return false;
  }

  const ids = Object.keys(paths);
  for (let i = 0; i < ids.length; i += 1) {
    const path = asObject(paths[ids[i]]);
    if (!path) {
      return false;
    }
    if (!asObject(path.nextTierByTier) || !asObject(path.costByTier)) {
      return false;
    }
  }
  return true;
}

function isValidPerkContent(value: unknown): value is PerkContent {
  const candidate = asObject(value);
  if (!candidate) {
    return false;
  }
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    typeof candidate.desc !== 'string' ||
    (candidate.rarity !== 'common' && candidate.rarity !== 'rare')
  ) {
    return false;
  }
  const mods = asObject(candidate.mods);
  if (!mods) {
    return false;
  }

  const modKeys = Object.keys(mods);
  for (let i = 0; i < modKeys.length; i += 1) {
    if (!isFiniteNumber(mods[modKeys[i]])) {
      return false;
    }
  }
  return true;
}

function isValidPerksContent(value: unknown): value is PerksContent {
  const candidate = asObject(value);
  if (!candidate || typeof candidate.version !== 'string' || !Array.isArray(candidate.perks)) {
    return false;
  }

  const rewardRules = asObject(candidate.rewardRules);
  if (!rewardRules || !isFiniteNumber(rewardRules.everyNNodes) || !isFiniteNumber(rewardRules.choices)) {
    return false;
  }

  for (let i = 0; i < candidate.perks.length; i += 1) {
    if (!isValidPerkContent(candidate.perks[i])) {
      return false;
    }
  }
  return true;
}

function hasObjectiveWeights(value: unknown): boolean {
  const candidate = asObject(value);
  if (!candidate) {
    return false;
  }
  return (
    isFiniteNumber(candidate.CAPTURE) &&
    isFiniteNumber(candidate.ASSASSINATE) &&
    isFiniteNumber(candidate.HOLDOUT) &&
    isFiniteNumber(candidate.ESCORT) &&
    isFiniteNumber(candidate.SIEGE)
  );
}

function isValidObjectivesContent(value: unknown): value is ObjectivesTuningContent {
  const candidate = asObject(value);
  if (!candidate || typeof candidate.contentVersion !== 'string') {
    return false;
  }

  const selection = asObject(candidate.selectionWeightsByNodeType);
  const capture = asObject(candidate.capture);
  const holdout = asObject(candidate.holdout);
  const escort = asObject(candidate.escort);
  const siege = asObject(candidate.siege);

  if (!selection || !capture || !holdout || !escort || !siege) {
    return false;
  }

  if (!hasObjectiveWeights(selection.BATTLE) || !hasObjectiveWeights(selection.ELITE) || !hasObjectiveWeights(selection.BOSS)) {
    return false;
  }

  if (
    !isFiniteNumber(capture.radius) ||
    !isFiniteNumber(capture.baseGainRate) ||
    !isFiniteNumber(capture.contestedDecayRate) ||
    !isFiniteNumber(capture.opposingProgressDrainFactor)
  ) {
    return false;
  }

  const captureSpeeds = asObject(capture.speedMultiplierByNodeType);
  if (
    !captureSpeeds ||
    !isFiniteNumber(captureSpeeds.BATTLE) ||
    !isFiniteNumber(captureSpeeds.ELITE) ||
    !isFiniteNumber(captureSpeeds.BOSS)
  ) {
    return false;
  }

  if (
    !isFiniteNumber(holdout.durationSeconds) ||
    !isFiniteNumber(holdout.waveIntervalSeconds) ||
    !isFiniteNumber(holdout.maxWaves) ||
    !isFiniteNumber(holdout.zoneRadius) ||
    !isFiniteNumber(holdout.waveMinSquads) ||
    !isFiniteNumber(holdout.waveMaxSquads) ||
    !isFiniteNumber(holdout.waveBaseSize) ||
    !isFiniteNumber(holdout.waveRandomSizeMaxAdd) ||
    !isFiniteNumber(holdout.waveSizePerDifficulty) ||
    !isFiniteNumber(holdout.waveSizePerWave) ||
    !Array.isArray(holdout.waveArchetypes)
  ) {
    return false;
  }

  if (
    !isFiniteNumber(escort.timeLimitSeconds) ||
    !isFiniteNumber(escort.caravanHp) ||
    !isFiniteNumber(escort.caravanSpeed) ||
    !isFiniteNumber(escort.caravanRadius) ||
    !isFiniteNumber(escort.exitRadius) ||
    !isFiniteNumber(escort.exitHoldSeconds) ||
    !isFiniteNumber(escort.startX) ||
    !isFiniteNumber(escort.exitXPadding) ||
    !isFiniteNumber(escort.startJitterY) ||
    !isFiniteNumber(escort.exitJitterY)
  ) {
    return false;
  }

  if (
    !isFiniteNumber(siege.timeLimitSeconds) ||
    !isFiniteNumber(siege.gateCaptureRate) ||
    !isFiniteNumber(siege.courtyardCaptureRate) ||
    !isFiniteNumber(siege.contestedDecayRate) ||
    !isFiniteNumber(siege.opposingProgressDrainFactor) ||
    !isFiniteNumber(siege.eliteDepthMin) ||
    !isFiniteNumber(siege.eliteChance)
  ) {
    return false;
  }

  return true;
}

function isValidDepthWeights(entry: unknown): entry is NodeDepthWeightsContent {
  const candidate = asObject(entry);
  if (!candidate) {
    return false;
  }
  if (!isFiniteNumber(candidate.depthMin) || !isFiniteNumber(candidate.depthMax)) {
    return false;
  }
  const weights = asObject(candidate.weights);
  if (!weights) {
    return false;
  }
  return (
    isFiniteNumber(weights.BATTLE) &&
    isFiniteNumber(weights.SHOP) &&
    isFiniteNumber(weights.RECRUIT) &&
    isFiniteNumber(weights.REST) &&
    isFiniteNumber(weights.ELITE)
  );
}

function hasReward(value: unknown): boolean {
  const candidate = asObject(value);
  if (!candidate) {
    return false;
  }
  return isFiniteNumber(candidate.min) && isFiniteNumber(candidate.max);
}

function hasNodeReward(value: unknown): boolean {
  const candidate = asObject(value);
  if (!candidate) {
    return false;
  }
  return hasReward(candidate.gold) && hasReward(candidate.recruits) && hasReward(candidate.supplies);
}

function isValidNodesContent(value: unknown): value is NodesTuningContent {
  const candidate = asObject(value);
  if (!candidate || typeof candidate.contentVersion !== 'string') {
    return false;
  }
  const mapGeneration = asObject(candidate.mapGeneration);
  const weights = candidate.nodeTypeWeightsByDepth;
  const rewardsByNodeType = asObject(candidate.rewardsByNodeType);
  if (!mapGeneration || !Array.isArray(weights) || !rewardsByNodeType) {
    return false;
  }
  const mapKeys = [
    'minNodes',
    'maxNodes',
    'layerCountMin',
    'layerCountMax',
    'middleLayerMin',
    'middleLayerMax',
    'middleLayerCap',
    'linkExtraChance',
    'nodeJitterY',
  ];
  for (let i = 0; i < mapKeys.length; i += 1) {
    if (!isFiniteNumber(mapGeneration[mapKeys[i]])) {
      return false;
    }
  }
  for (let i = 0; i < weights.length; i += 1) {
    if (!isValidDepthWeights(weights[i])) {
      return false;
    }
  }

  const rewardNodeTypes = ['BATTLE', 'SHOP', 'RECRUIT', 'REST', 'ELITE', 'BOSS'];
  for (let i = 0; i < rewardNodeTypes.length; i += 1) {
    if (!hasNodeReward(rewardsByNodeType[rewardNodeTypes[i]])) {
      return false;
    }
  }

  if (!asObject(candidate.shop) || !asObject(candidate.recruit) || !asObject(candidate.rest)) {
    return false;
  }

  const lossProtection = asObject(candidate.lossProtection);
  if (
    !lossProtection ||
    typeof lossProtection.enabled !== 'boolean' ||
    !isFiniteNumber(lossProtection.goldPctOfNormalReward) ||
    !isFiniteNumber(lossProtection.recruitsPctOfNormalReward) ||
    !isFiniteNumber(lossProtection.suppliesFlat) ||
    !isFiniteNumber(lossProtection.maxConsecutiveLossBoost)
  ) {
    return false;
  }
  return true;
}

function isValidScenariosContent(value: unknown): value is ScenariosContent {
  const candidate = asObject(value);
  if (!candidate || typeof candidate.contentVersion !== 'string') {
    return false;
  }
  const objectivePowerScale = asObject(candidate.objectivePowerScale);
  const mapPoolsByNodeType = asObject(candidate.mapPoolsByNodeType);
  const templatesByNodeType = asObject(candidate.templatesByNodeType);
  if (!objectivePowerScale || !templatesByNodeType || !mapPoolsByNodeType) {
    return false;
  }
  if (
    !isFiniteNumber(objectivePowerScale.CAPTURE) ||
    !isFiniteNumber(objectivePowerScale.ASSASSINATE) ||
    !isFiniteNumber(objectivePowerScale.HOLDOUT) ||
    !isFiniteNumber(objectivePowerScale.ESCORT) ||
    !isFiniteNumber(objectivePowerScale.SIEGE)
  ) {
    return false;
  }

  const nodeTypes = ['BATTLE', 'ELITE', 'BOSS'];
  for (let i = 0; i < nodeTypes.length; i += 1) {
    const list = mapPoolsByNodeType[nodeTypes[i]];
    if (!Array.isArray(list) || list.length === 0) {
      return false;
    }
    for (let j = 0; j < list.length; j += 1) {
      const bucket = asObject(list[j]);
      if (!bucket || !Array.isArray(bucket.maps) || bucket.maps.length === 0) {
        return false;
      }
      if (!isFiniteNumber(bucket.depthMin) || !isFiniteNumber(bucket.depthMax)) {
        return false;
      }
      for (let k = 0; k < bucket.maps.length; k += 1) {
        const mapEntry = asObject(bucket.maps[k]);
        if (
          !mapEntry ||
          typeof mapEntry.id !== 'string' ||
          mapEntry.id.length === 0 ||
          !isFiniteNumber(mapEntry.weight)
        ) {
          return false;
        }
      }
    }
  }

  for (let i = 0; i < nodeTypes.length; i += 1) {
    const list = templatesByNodeType[nodeTypes[i]];
    if (!Array.isArray(list) || list.length === 0) {
      return false;
    }
    for (let j = 0; j < list.length; j += 1) {
      const bucket = asObject(list[j]);
      if (!bucket || !Array.isArray(bucket.templates) || bucket.templates.length === 0) {
        return false;
      }
      if (!isFiniteNumber(bucket.depthMin) || !isFiniteNumber(bucket.depthMax)) {
        return false;
      }
      for (let k = 0; k < bucket.templates.length; k += 1) {
        const template = asObject(bucket.templates[k]);
        if (!template || typeof template.id !== 'string' || !Array.isArray(template.squads)) {
          return false;
        }
        for (let m = 0; m < template.squads.length; m += 1) {
          const squad = asObject(template.squads[m]);
          if (
            !squad ||
            typeof squad.archetypeId !== 'string' ||
            !isFiniteNumber(squad.tier) ||
            !isFiniteNumber(squad.size)
          ) {
            return false;
          }
        }
      }
    }
  }

  if (!Array.isArray(candidate.siegeTemplates) || candidate.siegeTemplates.length === 0) {
    return false;
  }
  const siegeTemplates = candidate.siegeTemplates;
  for (let j = 0; j < siegeTemplates.length; j += 1) {
    const bucket = asObject(siegeTemplates[j]);
    if (!bucket || !Array.isArray(bucket.templates) || bucket.templates.length === 0) {
      return false;
    }
    if (!isFiniteNumber(bucket.depthMin) || !isFiniteNumber(bucket.depthMax)) {
      return false;
    }
    for (let k = 0; k < bucket.templates.length; k += 1) {
      const template = asObject(bucket.templates[k]);
      if (!template || typeof template.id !== 'string' || !Array.isArray(template.squads)) {
        return false;
      }
      for (let m = 0; m < template.squads.length; m += 1) {
        const squad = asObject(template.squads[m]);
        if (
          !squad ||
          typeof squad.archetypeId !== 'string' ||
          !isFiniteNumber(squad.tier) ||
          !isFiniteNumber(squad.size)
        ) {
          return false;
        }
      }
    }
  }
  return true;
}

function isValidMapTerrainEntry(value: unknown): boolean {
  const entry = asObject(value);
  if (!entry) {
    return false;
  }
  if (
    entry.type !== 'OBSTACLE_RECT' &&
    entry.type !== 'FOREST_RECT' &&
    entry.type !== 'HILL_RECT' &&
    entry.type !== 'GATE_RECT'
  ) {
    return false;
  }
  if (entry.type === 'GATE_RECT' && (typeof entry.id !== 'string' || entry.id.length === 0)) {
    return false;
  }
  return (
    isFiniteNumber(entry.x) &&
    isFiniteNumber(entry.y) &&
    isFiniteNumber(entry.w) &&
    isFiniteNumber(entry.h)
  );
}

function isValidSpawnList(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  for (let i = 0; i < value.length; i += 1) {
    const spawn = asObject(value[i]);
    if (!spawn || !isFiniteNumber(spawn.x) || !isFiniteNumber(spawn.y)) {
      return false;
    }
  }
  return true;
}

function isValidObjectiveCircle(value: unknown): boolean {
  const circle = asObject(value);
  if (!circle) {
    return false;
  }
  return isFiniteNumber(circle.x) && isFiniteNumber(circle.y) && isFiniteNumber(circle.radius);
}

function isValidMapEntry(value: unknown): value is BattleMapContent {
  const map = asObject(value);
  if (!map || typeof map.id !== 'string' || typeof map.name !== 'string') {
    return false;
  }

  const size = asObject(map.size);
  const spawns = asObject(map.spawns);
  const objectives = asObject(map.objectives);
  if (!size || !spawns || !objectives || !Array.isArray(map.terrain)) {
    return false;
  }

  if (!isFiniteNumber(size.w) || !isFiniteNumber(size.h)) {
    return false;
  }
  if (!isValidSpawnList(spawns.blue) || !isValidSpawnList(spawns.red)) {
    return false;
  }
  if (!isValidObjectiveCircle(objectives.capturePoint) || !isValidObjectiveCircle(objectives.exitZone)) {
    return false;
  }
  if (objectives.gateZone !== undefined && !isValidObjectiveCircle(objectives.gateZone)) {
    return false;
  }
  if (objectives.courtyardZone !== undefined && !isValidObjectiveCircle(objectives.courtyardZone)) {
    return false;
  }

  let hasGateTerrain = false;
  for (let i = 0; i < map.terrain.length; i += 1) {
    if (!isValidMapTerrainEntry(map.terrain[i])) {
      return false;
    }
    const terrain = asObject(map.terrain[i]);
    if (terrain && terrain.type === 'GATE_RECT') {
      hasGateTerrain = true;
    }
  }
  if (hasGateTerrain && (!isValidObjectiveCircle(objectives.gateZone) || !isValidObjectiveCircle(objectives.courtyardZone))) {
    return false;
  }
  return true;
}

function isValidMapsContent(value: unknown): value is MapsContent {
  const candidate = asObject(value);
  if (!candidate || typeof candidate.version !== 'string' || !Array.isArray(candidate.maps) || candidate.maps.length === 0) {
    return false;
  }

  const rules = asObject(candidate.terrainRules);
  const nav = asObject(candidate.nav);
  if (!rules || !nav) {
    return false;
  }
  const forest = asObject(rules.forest);
  const hill = asObject(rules.hill);
  if (!forest || !hill) {
    return false;
  }
  if (
    !isFiniteNumber(forest.moveSpeedMult) ||
    !isFiniteNumber(forest.rangedAccuracyAdd) ||
    !isFiniteNumber(forest.projectileSpeedMult) ||
    !isFiniteNumber(hill.rangedRangeMult) ||
    !isFiniteNumber(hill.rangedAccuracyAdd) ||
    !isFiniteNumber(nav.cellSize)
  ) {
    return false;
  }

  for (let i = 0; i < candidate.maps.length; i += 1) {
    if (!isValidMapEntry(candidate.maps[i])) {
      return false;
    }
  }

  return true;
}

type Validator<T> = (value: unknown) => value is T;

export class ContentManager {
  private content: LoadedContent = cloneLoadedContent(DEFAULT_CONTENT);
  private status: ContentLoadStatus = {
      loaded: false,
      fallbackUsed: false,
      contentVersion: DEFAULT_CONTENT.units.contentVersion,
      errors: [],
      sourceByFile: {
        units: 'default',
        upgrades: 'default',
        perks: 'default',
        objectives: 'default',
        nodes: 'default',
        scenarios: 'default',
        maps: 'default',
      },
    };
  private readonly listeners = new Set<() => void>();

  async loadAll(options: LoadOptions = {}): Promise<ContentLoadStatus> {
    const forceReload = options.forceReload === true;
    const errors: string[] = [];
    const sourceByFile: ContentLoadStatus['sourceByFile'] = {
      units: 'json',
      upgrades: 'json',
      perks: 'json',
      objectives: 'json',
      nodes: 'json',
      scenarios: 'json',
      maps: 'json',
    };

    const units = await this.loadFile('units', isValidUnitsContent, cloneUnitsContent(DEFAULT_UNITS_CONTENT), forceReload, errors);
    if (units.source === 'default') {
      sourceByFile.units = 'default';
    }
    const upgrades = await this.loadFile(
      'upgrades',
      isValidUpgradesContent,
      cloneUpgradesContent(DEFAULT_UPGRADES_CONTENT),
      forceReload,
      errors,
    );
    if (upgrades.source === 'default') {
      sourceByFile.upgrades = 'default';
    }
    const perks = await this.loadFile('perks', isValidPerksContent, clonePerksContent(DEFAULT_PERKS_CONTENT), forceReload, errors);
    if (perks.source === 'default') {
      sourceByFile.perks = 'default';
    }
    const objectives = await this.loadFile(
      'objectives',
      isValidObjectivesContent,
      cloneObjectivesContent(DEFAULT_OBJECTIVES_CONTENT),
      forceReload,
      errors,
    );
    if (objectives.source === 'default') {
      sourceByFile.objectives = 'default';
    }
    const nodes = await this.loadFile('nodes', isValidNodesContent, cloneNodesContent(DEFAULT_NODES_CONTENT), forceReload, errors);
    if (nodes.source === 'default') {
      sourceByFile.nodes = 'default';
    }
    const scenarios = await this.loadFile(
      'scenarios',
      isValidScenariosContent,
      cloneScenariosContent(DEFAULT_SCENARIOS_CONTENT),
      forceReload,
      errors,
    );
    if (scenarios.source === 'default') {
      sourceByFile.scenarios = 'default';
    }
    const maps = await this.loadFile('maps', isValidMapsContent, cloneMapsContent(DEFAULT_MAPS_CONTENT), forceReload, errors);
    if (maps.source === 'default') {
      sourceByFile.maps = 'default';
    }

    this.content = {
      units: units.value,
      upgrades: upgrades.value,
      perks: perks.value,
      objectives: objectives.value,
      nodes: nodes.value,
      scenarios: scenarios.value,
      maps: maps.value,
    };

    const fallbackUsed =
      sourceByFile.units === 'default' ||
      sourceByFile.upgrades === 'default' ||
      sourceByFile.perks === 'default' ||
      sourceByFile.objectives === 'default' ||
      sourceByFile.nodes === 'default' ||
      sourceByFile.scenarios === 'default' ||
      sourceByFile.maps === 'default';

    this.status = {
      loaded: true,
      fallbackUsed,
      contentVersion: this.resolveContentVersion(),
      errors,
      sourceByFile,
    };

    if (errors.length > 0) {
      for (let i = 0; i < errors.length; i += 1) {
        console.error(`[ContentManager] ${errors[i]}`);
      }
    }

    this.emitChange();
    return this.getStatus();
  }

  getStatus(): ContentLoadStatus {
    return {
      loaded: this.status.loaded,
      fallbackUsed: this.status.fallbackUsed,
      contentVersion: this.status.contentVersion,
      errors: [...this.status.errors],
      sourceByFile: { ...this.status.sourceByFile },
    };
  }

  onDidReload(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getFallbackArchetypeId(): string {
    return this.content.units.fallbackArchetypeId;
  }

  hasUnitArchetype(archetypeId: string): boolean {
    return this.findUnit(archetypeId) !== null;
  }

  getUnit(archetypeId: string, tier: number): UnitArchetype {
    const resolvedTier = this.normalizeTier(tier);
    const unit = this.findUnit(archetypeId) ?? this.findUnit(this.getFallbackArchetypeId()) ?? this.content.units.units[0];
    const tierKey = `${resolvedTier}` as '1' | '2' | '3';
    const stats = unit.tiers[tierKey];
    const name = resolvedTier > 1 ? `${unit.name} T${resolvedTier}` : `${unit.name} T1`;

    return {
      id: `${unit.id}_t${resolvedTier}`,
      name,
      tags: [...unit.tags],
      stats: cloneStats(stats),
    };
  }

  getBaseUnit(archetypeId: string): UnitArchetype {
    const unit = this.findUnit(archetypeId) ?? this.findUnit(this.getFallbackArchetypeId()) ?? this.content.units.units[0];
    return {
      id: unit.id,
      name: unit.name,
      tags: [...unit.tags],
      stats: cloneStats(unit.tiers['1']),
    };
  }

  getRecruitableArchetypeIds(): string[] {
    const ids: string[] = [];
    for (let i = 0; i < this.content.units.units.length; i += 1) {
      const unit = this.content.units.units[i];
      if (unit.recruitable) {
        ids.push(unit.id);
      }
    }
    if (ids.length === 0) {
      ids.push(this.getFallbackArchetypeId());
    }
    return ids;
  }

  getStartingArmy(): UnitsContent['startingArmy'] {
    return {
      gold: this.content.units.startingArmy.gold,
      supplies: this.content.units.startingArmy.supplies,
      recruits: this.content.units.startingArmy.recruits,
      squads: this.content.units.startingArmy.squads.map((squad) => ({
        archetypeId: squad.archetypeId,
        size: squad.size,
        tier: squad.tier,
        name: squad.name,
      })),
    };
  }

  getMaxTier(): number {
    return Math.max(1, Math.floor(this.content.upgrades.maxTier));
  }

  getNextTier(archetypeId: string, tier: number): number | null {
    const normalizedTier = this.normalizeTier(tier);
    const path = this.content.upgrades.paths[archetypeId];
    if (!path) {
      return null;
    }
    const key = `${normalizedTier}`;
    const nextTier = path.nextTierByTier[key];
    if (!isFiniteNumber(nextTier)) {
      return null;
    }
    return this.normalizeTier(nextTier);
  }

  getUpgradeCost(archetypeId: string, nextTier: number): number {
    const path = this.content.upgrades.paths[archetypeId];
    const key = `${this.normalizeTier(nextTier)}`;
    if (!path) {
      return this.content.upgrades.defaultUpgradeCost;
    }
    const cost = path.costByTier[key];
    if (!isFiniteNumber(cost)) {
      return this.content.upgrades.defaultUpgradeCost;
    }
    return Math.max(0, cost);
  }

  getPerk(perkId: string): PerkContent | null {
    for (let i = 0; i < this.content.perks.perks.length; i += 1) {
      if (this.content.perks.perks[i].id === perkId) {
        const perk = this.content.perks.perks[i];
        return {
          id: perk.id,
          name: perk.name,
          desc: perk.desc,
          rarity: perk.rarity,
          mods: { ...perk.mods },
        };
      }
    }
    return null;
  }

  getPerkPool(): PerkContent[] {
    return this.content.perks.perks.map((perk) => ({
      id: perk.id,
      name: perk.name,
      desc: perk.desc,
      rarity: perk.rarity,
      mods: { ...perk.mods },
    }));
  }

  getPerkRewardRules(): PerkRewardRulesContent {
    return {
      everyNNodes: this.content.perks.rewardRules.everyNNodes,
      choices: this.content.perks.rewardRules.choices,
    };
  }

  getObjectiveTuning(): ObjectivesTuningContent {
    return cloneObjectivesContent(this.content.objectives);
  }

  getNodeTuning(): NodesTuningContent {
    return cloneNodesContent(this.content.nodes);
  }

  getScenarioTuning(): ScenariosContent {
    return cloneScenariosContent(this.content.scenarios);
  }

  getMap(mapId: string): BattleMapContent | null {
    for (let i = 0; i < this.content.maps.maps.length; i += 1) {
      const map = this.content.maps.maps[i];
      if (map.id === mapId) {
        return cloneMapEntry(map);
      }
    }
    return null;
  }

  getAllMaps(): BattleMapContent[] {
    return this.content.maps.maps.map((map) => cloneMapEntry(map));
  }

  getTerrainRules(): MapsContent['terrainRules'] {
    return {
      forest: { ...this.content.maps.terrainRules.forest },
      hill: { ...this.content.maps.terrainRules.hill },
    };
  }

  getNavCellSize(): number {
    return Math.max(16, this.content.maps.nav.cellSize);
  }

  private resolveContentVersion(): string {
    const first =
      this.content.units.contentVersion ||
      this.content.upgrades.contentVersion ||
      this.content.perks.version ||
      this.content.objectives.contentVersion ||
      this.content.nodes.contentVersion ||
      this.content.scenarios.contentVersion ||
      this.content.maps.version;
    return first || 'builtin';
  }

  private findUnit(archetypeId: string): UnitArchetypeContent | null {
    for (let i = 0; i < this.content.units.units.length; i += 1) {
      if (this.content.units.units[i].id === archetypeId) {
        return this.content.units.units[i];
      }
    }
    return null;
  }

  private normalizeTier(tier: number): 1 | 2 | 3 {
    const clamped = Math.max(1, Math.min(this.getMaxTier(), Math.floor(tier)));
    if (clamped <= 1) {
      return 1;
    }
    if (clamped >= 3) {
      return 3;
    }
    return 2;
  }

  private emitChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private async loadFile<T>(
    fileName: ContentFileName,
    validator: Validator<T>,
    defaultValue: T,
    forceReload: boolean,
    errors: string[],
  ): Promise<{ value: T; source: 'json' | 'default' }> {
    const baseUrl = import.meta.env.BASE_URL;
    const suffix = forceReload ? `?ts=${Date.now()}` : '';
    const path = `${baseUrl}content/${fileName}.json${suffix}`;

    try {
      const response = await fetch(path, { cache: forceReload ? 'no-store' : 'default' });
      if (!response.ok) {
        errors.push(`${fileName}.json request failed (${response.status}) - using defaults.`);
        return {
          value: defaultValue,
          source: 'default',
        };
      }

      const parsed = (await response.json()) as unknown;
      if (!validator(parsed)) {
        errors.push(`${fileName}.json failed schema validation - using defaults.`);
        return {
          value: defaultValue,
          source: 'default',
        };
      }

      return {
        value: parsed,
        source: 'json',
      };
    } catch (error) {
      errors.push(`${fileName}.json load error (${String(error)}) - using defaults.`);
      return {
        value: defaultValue,
        source: 'default',
      };
    }
  }
}

export const contentManager = new ContentManager();
