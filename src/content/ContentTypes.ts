import type { BattleObjectiveType } from '../sim/objectives/ObjectiveTypes';
import type { UnitStats, UnitTag } from '../sim/types/UnitArchetype';
import type { NodeType } from '../overworld/types';

export type TierKey = '1' | '2' | '3';

export interface UnitArchetypeContent {
  id: string;
  name: string;
  tags: UnitTag[];
  recruitable: boolean;
  tiers: Record<TierKey, UnitStats>;
}

export interface StartingArmySquadContent {
  archetypeId: string;
  size: number;
  tier: number;
  name?: string;
}

export interface StartingArmyContent {
  gold: number;
  supplies: number;
  recruits: number;
  squads: StartingArmySquadContent[];
}

export interface UnitsContent {
  contentVersion: string;
  fallbackArchetypeId: string;
  units: UnitArchetypeContent[];
  startingArmy: StartingArmyContent;
}

export interface UpgradePathContent {
  nextTierByTier: Record<string, number>;
  costByTier: Record<string, number>;
}

export interface UpgradePathsContent {
  contentVersion: string;
  maxTier: number;
  defaultUpgradeCost: number;
  paths: Record<string, UpgradePathContent>;
}

export type PerkRarity = 'common' | 'rare';

export interface PerkModsContent {
  moraleRegenMult?: number;
  moraleLossMult?: number;
  routThresholdAdd?: number;
  cohesionMult?: number;
  formationSpacingMult?: number;
  chargePowerMult?: number;
  chargeCooldownMult?: number;
  rangedAccuracyAdd?: number;
  projectileSpeedMult?: number;
  captureRateMult?: number;
  waveStrengthMult?: number;
  spearCounterDamageMult?: number;
  armorEffectivenessMult?: number;
  moveSpeedMult?: number;
  fieldMedicRecruitsPerCasualty?: number;
}

export interface PerkContent {
  id: string;
  name: string;
  desc: string;
  rarity: PerkRarity;
  mods: PerkModsContent;
}

export interface PerkRewardRulesContent {
  everyNNodes: number;
  choices: number;
}

export interface PerksContent {
  version: string;
  perks: PerkContent[];
  rewardRules: PerkRewardRulesContent;
}

export interface ObjectiveSelectionWeights {
  CAPTURE: number;
  ASSASSINATE: number;
  HOLDOUT: number;
  ESCORT: number;
}

export interface CaptureObjectiveTuningContent {
  radius: number;
  baseGainRate: number;
  contestedDecayRate: number;
  opposingProgressDrainFactor: number;
  speedMultiplierByNodeType: Record<'BATTLE' | 'ELITE' | 'BOSS', number>;
}

export interface HoldoutObjectiveTuningContent {
  durationSeconds: number;
  waveIntervalSeconds: number;
  maxWaves: number;
  zoneRadius: number;
  waveMinSquads: number;
  waveMaxSquads: number;
  waveBaseSize: number;
  waveRandomSizeMaxAdd: number;
  waveSizePerDifficulty: number;
  waveSizePerWave: number;
  waveArchetypes: string[];
}

export interface EscortObjectiveTuningContent {
  timeLimitSeconds: number;
  caravanHp: number;
  caravanSpeed: number;
  caravanRadius: number;
  exitRadius: number;
  exitHoldSeconds: number;
  startX: number;
  exitXPadding: number;
  startJitterY: number;
  exitJitterY: number;
}

export interface ObjectivesTuningContent {
  contentVersion: string;
  selectionWeightsByNodeType: Record<'BATTLE' | 'ELITE' | 'BOSS', ObjectiveSelectionWeights>;
  capture: CaptureObjectiveTuningContent;
  holdout: HoldoutObjectiveTuningContent;
  escort: EscortObjectiveTuningContent;
}

export interface NodeTypeWeights {
  BATTLE: number;
  SHOP: number;
  RECRUIT: number;
  REST: number;
  ELITE: number;
}

export interface NodeDepthWeightsContent {
  depthMin: number;
  depthMax: number;
  weights: NodeTypeWeights;
}

export interface RewardRangeContent {
  min: number;
  max: number;
}

export interface NodeRewardContent {
  gold: RewardRangeContent;
  recruits: RewardRangeContent;
  supplies: RewardRangeContent;
}

export interface ShopNodeTuningContent {
  sizeUpgradeCost: number;
  sizeUpgradeAmount: number;
  suppliesCost: number;
  suppliesAmount: number;
}

export interface RecruitNodeTuningContent {
  baseRecruits: number;
  recruitsPerDifficulty: number;
  recruitsBonusCap: number;
  discountHireCost: number;
  discountSizeMin: number;
  discountSizeMax: number;
}

export interface RestNodeTuningContent {
  suppliesGain: number;
  restBonusBattles: number;
}

export interface NodesMapGenerationTuningContent {
  minNodes: number;
  maxNodes: number;
  layerCountMin: number;
  layerCountMax: number;
  middleLayerMin: number;
  middleLayerMax: number;
  middleLayerCap: number;
  linkExtraChance: number;
  nodeJitterY: number;
}

export interface NodesTuningContent {
  contentVersion: string;
  mapGeneration: NodesMapGenerationTuningContent;
  nodeTypeWeightsByDepth: NodeDepthWeightsContent[];
  rewardsByNodeType: Record<NodeType, NodeRewardContent>;
  shop: ShopNodeTuningContent;
  recruit: RecruitNodeTuningContent;
  rest: RestNodeTuningContent;
}

export interface ScenarioSquadTemplateContent {
  archetypeId: string;
  tier: number;
  size: number;
}

export interface ScenarioTemplateContent {
  id: string;
  squads: ScenarioSquadTemplateContent[];
}

export interface ScenarioDepthBucketContent {
  depthMin: number;
  depthMax: number;
  templates: ScenarioTemplateContent[];
}

export interface ScenariosContent {
  contentVersion: string;
  objectivePowerScale: Record<BattleObjectiveType, number>;
  mapPoolsByNodeType: Record<'BATTLE' | 'ELITE' | 'BOSS', ScenarioDepthBucketMapPoolContent[]>;
  templatesByNodeType: Record<'BATTLE' | 'ELITE' | 'BOSS', ScenarioDepthBucketContent[]>;
}

export type MapTerrainEntryType = 'OBSTACLE_RECT' | 'FOREST_RECT' | 'HILL_RECT';

export interface MapTerrainEntryContent {
  type: MapTerrainEntryType;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapSpawnPointContent {
  x: number;
  y: number;
}

export interface MapObjectiveCircleContent {
  x: number;
  y: number;
  radius: number;
}

export interface BattleMapContent {
  id: string;
  name: string;
  size: {
    w: number;
    h: number;
  };
  spawns: {
    blue: MapSpawnPointContent[];
    red: MapSpawnPointContent[];
  };
  objectives: {
    capturePoint: MapObjectiveCircleContent;
    exitZone: MapObjectiveCircleContent;
  };
  terrain: MapTerrainEntryContent[];
}

export interface TerrainRulesContent {
  forest: {
    moveSpeedMult: number;
    rangedAccuracyAdd: number;
    projectileSpeedMult: number;
  };
  hill: {
    rangedRangeMult: number;
    rangedAccuracyAdd: number;
  };
}

export interface MapsContent {
  version: string;
  maps: BattleMapContent[];
  terrainRules: TerrainRulesContent;
  nav: {
    cellSize: number;
  };
}

export interface ScenarioMapPoolEntryContent {
  id: string;
  weight: number;
}

export interface ScenarioDepthBucketMapPoolContent {
  depthMin: number;
  depthMax: number;
  maps: ScenarioMapPoolEntryContent[];
}

export interface LoadedContent {
  units: UnitsContent;
  upgrades: UpgradePathsContent;
  perks: PerksContent;
  objectives: ObjectivesTuningContent;
  nodes: NodesTuningContent;
  scenarios: ScenariosContent;
  maps: MapsContent;
}

export type ContentFileName = keyof LoadedContent;

export interface ContentLoadStatus {
  loaded: boolean;
  fallbackUsed: boolean;
  contentVersion: string;
  errors: string[];
  sourceByFile: Record<ContentFileName, 'json' | 'default'>;
}
