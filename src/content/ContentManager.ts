import type {
  AbilityContent,
  AbilityStartRulesContent,
  AbilitiesContent,
  BattleMapContent,
  ContentFileName,
  ContentPackLoadResult,
  ContentPackManifestEntry,
  ContentPacksManifest,
  ContentLoadStatus,
  ContentVersions,
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
  DEFAULT_ABILITIES_CONTENT,
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
    suppression: {
      enabled: content.suppression.enabled,
      stoneMoraleDamage: content.suppression.stoneMoraleDamage,
      stoneMoraleDamageOnShieldFrontMult: content.suppression.stoneMoraleDamageOnShieldFrontMult,
      maxSuppressionPerSecondPerSquad: content.suppression.maxSuppressionPerSecondPerSquad,
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
  abilities: cloneAbilitiesContent(DEFAULT_ABILITIES_CONTENT),
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
    abilities: cloneAbilitiesContent(content.abilities),
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
  const suppression = asObject(candidate.suppression);

  if (!selection || !capture || !holdout || !escort || !siege || !suppression) {
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

  if (
    typeof suppression.enabled !== 'boolean' ||
    !isFiniteNumber(suppression.stoneMoraleDamage) ||
    !isFiniteNumber(suppression.stoneMoraleDamageOnShieldFrontMult) ||
    !isFiniteNumber(suppression.maxSuppressionPerSecondPerSquad)
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

function isValidAbilityContent(value: unknown): value is AbilityContent {
  const candidate = asObject(value);
  if (!candidate) {
    return false;
  }
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    typeof candidate.desc !== 'string' ||
    !isFiniteNumber(candidate.cooldownSec) ||
    !isFiniteNumber(candidate.castTimeSec) ||
    !isFiniteNumber(candidate.range)
  ) {
    return false;
  }
  const effects = asObject(candidate.effects);
  const ai = asObject(candidate.ai);
  if (!effects || !ai) {
    return false;
  }
  if (
    !isFiniteNumber(effects.moraleAdd) ||
    !isFiniteNumber(effects.moraleLossMult) ||
    !isFiniteNumber(effects.durationSec)
  ) {
    return false;
  }
  if (
    typeof ai.useOncePerBattle !== 'boolean' ||
    !isFiniteNumber(ai.triggerMoraleBelow) ||
    !isFiniteNumber(ai.minAlliesInRange)
  ) {
    return false;
  }
  return true;
}

function isValidAbilitiesContent(value: unknown): value is AbilitiesContent {
  const candidate = asObject(value);
  if (!candidate || typeof candidate.version !== 'string' || !Array.isArray(candidate.abilities)) {
    return false;
  }
  const startRules = asObject(candidate.startRules);
  if (
    !startRules ||
    typeof startRules.dailyDefault !== 'string' ||
    typeof startRules.normalDefault !== 'string'
  ) {
    return false;
  }
  if (candidate.abilities.length === 0) {
    return false;
  }
  for (let i = 0; i < candidate.abilities.length; i += 1) {
    if (!isValidAbilityContent(candidate.abilities[i])) {
      return false;
    }
  }
  return true;
}

type Validator<T> = (value: unknown) => value is T;

const DEFAULT_PACKS: ContentPacksManifest = {
  version: 'packs_v1',
  packs: [{ id: 'base', name: 'Base', desc: 'Default balance and content.' }],
};

function cloneSourceByFile(source: 'json' | 'default'): ContentLoadStatus['sourceByFile'] {
  return {
    units: source,
    upgrades: source,
    perks: source,
    abilities: source,
    objectives: source,
    nodes: source,
    scenarios: source,
    maps: source,
  };
}

function cloneAbilitiesContent(content: AbilitiesContent): AbilitiesContent {
  return {
    version: content.version,
    abilities: content.abilities.map((ability) => ({
      id: ability.id,
      name: ability.name,
      desc: ability.desc,
      cooldownSec: ability.cooldownSec,
      castTimeSec: ability.castTimeSec,
      range: ability.range,
      effects: {
        moraleAdd: ability.effects.moraleAdd,
        moraleLossMult: ability.effects.moraleLossMult,
        durationSec: ability.effects.durationSec,
      },
      ai: {
        useOncePerBattle: ability.ai.useOncePerBattle,
        triggerMoraleBelow: ability.ai.triggerMoraleBelow,
        minAlliesInRange: ability.ai.minAlliesInRange,
      },
    })),
    startRules: {
      dailyDefault: content.startRules.dailyDefault,
      normalDefault: content.startRules.normalDefault,
    },
  };
}

function clonePacksManifest(manifest: ContentPacksManifest): ContentPacksManifest {
  return {
    version: manifest.version,
    packs: manifest.packs.map((pack) => ({
      id: pack.id,
      name: pack.name,
      desc: pack.desc,
    })),
  };
}

function isValidPacksManifest(value: unknown): value is ContentPacksManifest {
  const candidate = asObject(value);
  if (!candidate || typeof candidate.version !== 'string' || !Array.isArray(candidate.packs)) {
    return false;
  }
  if (candidate.packs.length === 0) {
    return false;
  }
  for (let i = 0; i < candidate.packs.length; i += 1) {
    const pack = asObject(candidate.packs[i]);
    if (
      !pack ||
      typeof pack.id !== 'string' ||
      pack.id.trim().length === 0 ||
      typeof pack.name !== 'string' ||
      pack.name.trim().length === 0 ||
      typeof pack.desc !== 'string'
    ) {
      return false;
    }
  }
  return true;
}

function resolveVersions(content: LoadedContent): ContentVersions {
  return {
    unitsVersion: content.units.contentVersion,
    upgradesVersion: content.upgrades.contentVersion,
    perksVersion: content.perks.version,
    abilitiesVersion: content.abilities.version,
    objectivesVersion: content.objectives.contentVersion,
    nodesVersion: content.nodes.contentVersion,
    scenariosVersion: content.scenarios.contentVersion,
    mapsVersion: content.maps.version,
  };
}

function cloneVersions(versions: ContentVersions): ContentVersions {
  return { ...versions };
}

function validateCrossReferences(content: LoadedContent): string[] {
  const errors: string[] = [];
  const unitIds = new Set<string>();
  const abilityIds = new Set<string>();
  for (let i = 0; i < content.units.units.length; i += 1) {
    unitIds.add(content.units.units[i].id);
  }
  for (let i = 0; i < content.abilities.abilities.length; i += 1) {
    abilityIds.add(content.abilities.abilities[i].id);
  }
  const mapIds = new Set<string>();
  for (let i = 0; i < content.maps.maps.length; i += 1) {
    mapIds.add(content.maps.maps[i].id);
  }

  if (!unitIds.has(content.units.fallbackArchetypeId)) {
    errors.push(`fallbackArchetypeId '${content.units.fallbackArchetypeId}' is missing in units.json.`);
  }
  if (!abilityIds.has(content.abilities.startRules.dailyDefault)) {
    errors.push(`abilities.startRules.dailyDefault '${content.abilities.startRules.dailyDefault}' is missing in abilities.json.`);
  }
  if (!abilityIds.has(content.abilities.startRules.normalDefault)) {
    errors.push(`abilities.startRules.normalDefault '${content.abilities.startRules.normalDefault}' is missing in abilities.json.`);
  }

  for (let i = 0; i < content.units.startingArmy.squads.length; i += 1) {
    const squad = content.units.startingArmy.squads[i];
    if (!unitIds.has(squad.archetypeId)) {
      errors.push(`startingArmy squad ${i} references missing archetype '${squad.archetypeId}'.`);
    }
  }

  const upgradeIds = Object.keys(content.upgrades.paths);
  for (let i = 0; i < upgradeIds.length; i += 1) {
    if (!unitIds.has(upgradeIds[i])) {
      errors.push(`upgrades.paths references missing archetype '${upgradeIds[i]}'.`);
    }
  }

  const validateTemplateList = (templates: ScenarioDepthBucketContent[], bucketLabel: string): void => {
    for (let i = 0; i < templates.length; i += 1) {
      const bucket = templates[i];
      for (let j = 0; j < bucket.templates.length; j += 1) {
        const template = bucket.templates[j];
        for (let k = 0; k < template.squads.length; k += 1) {
          const squad = template.squads[k];
          if (!unitIds.has(squad.archetypeId)) {
            errors.push(`${bucketLabel} template '${template.id}' references missing archetype '${squad.archetypeId}'.`);
          }
        }
      }
    }
  };

  validateTemplateList(content.scenarios.templatesByNodeType.BATTLE, 'BATTLE');
  validateTemplateList(content.scenarios.templatesByNodeType.ELITE, 'ELITE');
  validateTemplateList(content.scenarios.templatesByNodeType.BOSS, 'BOSS');
  validateTemplateList(content.scenarios.siegeTemplates, 'SIEGE');

  const validateMapPools = (pools: ScenariosContent['mapPoolsByNodeType']['BATTLE'], nodeType: string): void => {
    for (let i = 0; i < pools.length; i += 1) {
      for (let j = 0; j < pools[i].maps.length; j += 1) {
        const entry = pools[i].maps[j];
        if (!mapIds.has(entry.id)) {
          errors.push(`${nodeType} map pool references missing map '${entry.id}'.`);
        }
      }
    }
  };

  validateMapPools(content.scenarios.mapPoolsByNodeType.BATTLE, 'BATTLE');
  validateMapPools(content.scenarios.mapPoolsByNodeType.ELITE, 'ELITE');
  validateMapPools(content.scenarios.mapPoolsByNodeType.BOSS, 'BOSS');

  for (let i = 0; i < content.objectives.holdout.waveArchetypes.length; i += 1) {
    const archetypeId = content.objectives.holdout.waveArchetypes[i];
    if (!unitIds.has(archetypeId)) {
      errors.push(`holdout.waveArchetypes references missing archetype '${archetypeId}'.`);
    }
  }

  return errors;
}

interface PackLoadAttempt {
  ok: boolean;
  content: LoadedContent | null;
  errors: string[];
}

export class ContentManager {
  private content: LoadedContent = cloneLoadedContent(DEFAULT_CONTENT);
  private packsManifest: ContentPacksManifest = clonePacksManifest(DEFAULT_PACKS);
  private manifestErrors: string[] = [];
  private manifestLoaded = false;
  private selectedPackId = 'base';
  private loadedPackId = 'base';
  private status: ContentLoadStatus = {
    loaded: false,
    fallbackUsed: false,
    contentVersion: DEFAULT_CONTENT.units.contentVersion,
    errors: [],
    sourceByFile: cloneSourceByFile('default'),
    selectedPackId: 'base',
    loadedPackId: 'base',
    selectedPackName: 'Base',
    loadedPackName: 'Base',
    versions: resolveVersions(DEFAULT_CONTENT),
    packManifestVersion: DEFAULT_PACKS.version,
  };
  private readonly listeners = new Set<() => void>();

  async loadAll(options: LoadOptions = {}): Promise<ContentLoadStatus> {
    await this.loadAllForPack(this.selectedPackId, options);
    return this.getStatus();
  }

  async loadAllForPack(packId: string, options: LoadOptions = {}): Promise<ContentPackLoadResult> {
    const requestedPackId = typeof packId === 'string' && packId.trim().length > 0 ? packId.trim() : 'base';
    const forceReload = options.forceReload === true;

    if (!forceReload && this.status.loaded && requestedPackId === this.selectedPackId) {
      return this.buildLoadResult(this.loadedPackId !== 'embedded');
    }

    this.selectedPackId = requestedPackId;
    await this.loadPackManifest(forceReload);

    const errors = [...this.manifestErrors];
    const selectedPack = this.findPack(requestedPackId);
    const selectedPackName = selectedPack ? selectedPack.name : `${requestedPackId} (missing)`;
    let fallbackUsed = false;

    if (!selectedPack) {
      errors.push(`Pack '${requestedPackId}' not found in mods/packs.json. Falling back to 'base'.`);
      fallbackUsed = true;
    }

    let loadedContent: LoadedContent | null = null;
    let loadedPackId = selectedPack ? selectedPack.id : 'base';
    let loadedPackName = selectedPack ? selectedPack.name : this.resolvePackName('base');
    let sourceByFile: ContentLoadStatus['sourceByFile'] = cloneSourceByFile('default');

    let selectedAttempt: PackLoadAttempt | null = null;
    if (selectedPack !== null) {
      selectedAttempt = await this.tryLoadPack(selectedPack.id, forceReload);
      errors.push(...selectedAttempt.errors);
      if (selectedAttempt.ok && selectedAttempt.content !== null) {
        loadedContent = selectedAttempt.content;
        sourceByFile = cloneSourceByFile('json');
      } else {
        fallbackUsed = true;
      }
    }

    if (loadedContent === null && requestedPackId !== 'base') {
      const baseAttempt = await this.tryLoadPack('base', forceReload);
      errors.push(...baseAttempt.errors);
      if (baseAttempt.ok && baseAttempt.content !== null) {
        loadedContent = baseAttempt.content;
        loadedPackId = 'base';
        loadedPackName = this.resolvePackName('base');
        sourceByFile = cloneSourceByFile('json');
      } else {
        errors.push('Base pack failed validation. Using embedded defaults.');
      }
    }

    if (loadedContent === null && requestedPackId === 'base' && selectedAttempt !== null && !selectedAttempt.ok) {
      errors.push('Base pack failed validation. Using embedded defaults.');
    }

    if (loadedContent === null) {
      loadedContent = cloneLoadedContent(DEFAULT_CONTENT);
      loadedPackId = 'embedded';
      loadedPackName = 'Embedded Defaults';
      sourceByFile = cloneSourceByFile('default');
      fallbackUsed = true;
    }

    this.loadedPackId = loadedPackId;
    this.content = loadedContent;

    const uniqueErrors = Array.from(new Set(errors));
    const versions = resolveVersions(loadedContent);
    this.status = {
      loaded: true,
      fallbackUsed: fallbackUsed || loadedPackId !== requestedPackId || loadedPackId === 'embedded',
      contentVersion: this.resolveContentVersion(),
      errors: uniqueErrors,
      sourceByFile,
      selectedPackId: requestedPackId,
      loadedPackId,
      selectedPackName,
      loadedPackName,
      versions,
      packManifestVersion: this.packsManifest.version,
    };

    if (uniqueErrors.length > 0) {
      for (let i = 0; i < uniqueErrors.length; i += 1) {
        console.error(`[ContentManager] ${uniqueErrors[i]}`);
      }
    }

    this.emitChange();
    return this.buildLoadResult(loadedPackId !== 'embedded');
  }

  getStatus(): ContentLoadStatus {
    return {
      loaded: this.status.loaded,
      fallbackUsed: this.status.fallbackUsed,
      contentVersion: this.status.contentVersion,
      errors: [...this.status.errors],
      sourceByFile: { ...this.status.sourceByFile },
      selectedPackId: this.status.selectedPackId,
      loadedPackId: this.status.loadedPackId,
      selectedPackName: this.status.selectedPackName,
      loadedPackName: this.status.loadedPackName,
      versions: cloneVersions(this.status.versions),
      packManifestVersion: this.status.packManifestVersion,
    };
  }

  getAvailablePacks(): ContentPackManifestEntry[] {
    return this.packsManifest.packs.map((pack) => ({
      id: pack.id,
      name: pack.name,
      desc: pack.desc,
    }));
  }

  getLoadedPackId(): string {
    return this.loadedPackId;
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

  getAbility(abilityId: string): AbilityContent | null {
    for (let i = 0; i < this.content.abilities.abilities.length; i += 1) {
      const ability = this.content.abilities.abilities[i];
      if (ability.id === abilityId) {
        return {
          id: ability.id,
          name: ability.name,
          desc: ability.desc,
          cooldownSec: ability.cooldownSec,
          castTimeSec: ability.castTimeSec,
          range: ability.range,
          effects: {
            moraleAdd: ability.effects.moraleAdd,
            moraleLossMult: ability.effects.moraleLossMult,
            durationSec: ability.effects.durationSec,
          },
          ai: {
            useOncePerBattle: ability.ai.useOncePerBattle,
            triggerMoraleBelow: ability.ai.triggerMoraleBelow,
            minAlliesInRange: ability.ai.minAlliesInRange,
          },
        };
      }
    }
    return null;
  }

  getStartAbilityRules(): AbilityStartRulesContent {
    return {
      dailyDefault: this.content.abilities.startRules.dailyDefault,
      normalDefault: this.content.abilities.startRules.normalDefault,
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

  private buildLoadResult(ok: boolean): ContentPackLoadResult {
    return {
      ok,
      usingFallback: this.status.fallbackUsed,
      loadedPackId: this.status.loadedPackId,
      errors: [...this.status.errors],
      versions: cloneVersions(this.status.versions),
    };
  }

  private resolveContentVersion(): string {
    const first =
      this.content.units.contentVersion ||
      this.content.upgrades.contentVersion ||
      this.content.perks.version ||
      this.content.abilities.version ||
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

  private findPack(packId: string): ContentPackManifestEntry | null {
    for (let i = 0; i < this.packsManifest.packs.length; i += 1) {
      const pack = this.packsManifest.packs[i];
      if (pack.id === packId) {
        return pack;
      }
    }
    return null;
  }

  private resolvePackName(packId: string): string {
    const pack = this.findPack(packId);
    return pack ? pack.name : packId;
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

  private async loadPackManifest(forceReload: boolean): Promise<void> {
    if (this.manifestLoaded && !forceReload) {
      return;
    }

    const errors: string[] = [];
    const baseUrl = import.meta.env.BASE_URL;
    const suffix = forceReload ? `?ts=${Date.now()}` : '';
    const path = `${baseUrl}mods/packs.json${suffix}`;

    try {
      const response = await fetch(path, { cache: forceReload ? 'no-store' : 'default' });
      if (!response.ok) {
        errors.push(`mods/packs.json request failed (${response.status}). Using built-in pack list.`);
      } else {
        const parsed = (await response.json()) as unknown;
        if (isValidPacksManifest(parsed)) {
          this.packsManifest = clonePacksManifest(parsed);
        } else {
          errors.push('mods/packs.json failed schema validation. Using built-in pack list.');
        }
      }
    } catch (error) {
      errors.push(`mods/packs.json load error (${String(error)}). Using built-in pack list.`);
    }

    if (errors.length > 0) {
      this.packsManifest = clonePacksManifest(DEFAULT_PACKS);
      for (let i = 0; i < errors.length; i += 1) {
        console.error(`[ContentManager] ${errors[i]}`);
      }
    }

    let hasBase = false;
    for (let i = 0; i < this.packsManifest.packs.length; i += 1) {
      if (this.packsManifest.packs[i].id === 'base') {
        hasBase = true;
        break;
      }
    }
    if (!hasBase) {
      this.packsManifest.packs.unshift({ id: 'base', name: 'Base', desc: 'Default balance and content.' });
      errors.push("Pack manifest missing 'base'. Added built-in base fallback.");
    }

    this.manifestErrors = errors;
    this.manifestLoaded = true;
  }

  private async tryLoadPack(packId: string, forceReload: boolean): Promise<PackLoadAttempt> {
    const errors: string[] = [];
    const units = await this.loadFileFromPack('units', isValidUnitsContent, packId, forceReload, errors);
    const upgrades = await this.loadFileFromPack('upgrades', isValidUpgradesContent, packId, forceReload, errors);
    const perks = await this.loadFileFromPack('perks', isValidPerksContent, packId, forceReload, errors);
    const abilities = await this.loadFileFromPack('abilities', isValidAbilitiesContent, packId, forceReload, errors);
    const objectives = await this.loadFileFromPack('objectives', isValidObjectivesContent, packId, forceReload, errors);
    const nodes = await this.loadFileFromPack('nodes', isValidNodesContent, packId, forceReload, errors);
    const scenarios = await this.loadFileFromPack('scenarios', isValidScenariosContent, packId, forceReload, errors);
    const maps = await this.loadFileFromPack('maps', isValidMapsContent, packId, forceReload, errors);

    if (units === null || upgrades === null || perks === null || abilities === null || objectives === null || nodes === null || scenarios === null || maps === null) {
      return {
        ok: false,
        content: null,
        errors,
      };
    }

    const content: LoadedContent = {
      units,
      upgrades,
      perks,
      abilities,
      objectives,
      nodes,
      scenarios,
      maps,
    };

    const crossReferenceErrors = validateCrossReferences(content);
    for (let i = 0; i < crossReferenceErrors.length; i += 1) {
      errors.push(`[${packId}] ${crossReferenceErrors[i]}`);
    }

    if (crossReferenceErrors.length > 0) {
      return {
        ok: false,
        content: null,
        errors,
      };
    }

    return {
      ok: true,
      content: cloneLoadedContent(content),
      errors,
    };
  }

  private async loadFileFromPack<T>(
    fileName: ContentFileName,
    validator: Validator<T>,
    packId: string,
    forceReload: boolean,
    errors: string[],
  ): Promise<T | null> {
    const baseUrl = import.meta.env.BASE_URL;
    const suffix = forceReload ? `?ts=${Date.now()}` : '';
    const path = `${baseUrl}mods/${packId}/${fileName}.json${suffix}`;

    try {
      const response = await fetch(path, { cache: forceReload ? 'no-store' : 'default' });
      if (!response.ok) {
        errors.push(`[${packId}] ${fileName}.json request failed (${response.status}).`);
        return null;
      }

      const parsed = (await response.json()) as unknown;
      if (!validator(parsed)) {
        errors.push(`[${packId}] ${fileName}.json failed schema validation.`);
        return null;
      }

      return parsed;
    } catch (error) {
      errors.push(`[${packId}] ${fileName}.json load error (${String(error)}).`);
      return null;
    }
  }
}

export const contentManager = new ContentManager();


