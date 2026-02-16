import type {
  MapsContent,
  NodesTuningContent,
  ObjectivesTuningContent,
  PerksContent,
  ScenariosContent,
  UnitsContent,
  UpgradePathsContent,
} from './ContentTypes';

export const DEFAULT_UNITS_CONTENT: UnitsContent = {
  contentVersion: '1.0.0',
  fallbackArchetypeId: 'infantry',
  units: [
    {
      id: 'infantry',
      name: 'Infantry',
      recruitable: true,
      tags: ['infantry', 'shield'],
      tiers: {
        '1': {
          hp: 100,
          moveSpeed: 90,
          attackDamage: 10,
          attackRate: 1,
          meleeRange: 13,
          rangedDamage: 0,
          rangedRange: 0,
          projectileSpeed: 0,
          projectileGravity: 0,
          rangedCooldown: 0,
          accuracy: 1,
          armor: 4,
          mass: 1,
          chargePower: 1,
          chargeMinSpeed: 999,
        },
        '2': {
          hp: 114,
          moveSpeed: 92.7,
          attackDamage: 11.2,
          attackRate: 1,
          meleeRange: 13,
          rangedDamage: 0,
          rangedRange: 0,
          projectileSpeed: 0,
          projectileGravity: 0,
          rangedCooldown: 0,
          accuracy: 1,
          armor: 4.48,
          mass: 1,
          chargePower: 1,
          chargeMinSpeed: 999,
        },
        '3': {
          hp: 128,
          moveSpeed: 94.5,
          attackDamage: 12.2,
          attackRate: 1,
          meleeRange: 13,
          rangedDamage: 0,
          rangedRange: 0,
          projectileSpeed: 0,
          projectileGravity: 0,
          rangedCooldown: 0,
          accuracy: 1,
          armor: 4.96,
          mass: 1,
          chargePower: 1,
          chargeMinSpeed: 999,
        },
      },
    },
    {
      id: 'spearmen',
      name: 'Spearmen',
      recruitable: true,
      tags: ['infantry', 'spear'],
      tiers: {
        '1': {
          hp: 95,
          moveSpeed: 85,
          attackDamage: 9,
          attackRate: 1,
          meleeRange: 14,
          rangedDamage: 0,
          rangedRange: 0,
          projectileSpeed: 0,
          projectileGravity: 0,
          rangedCooldown: 0,
          accuracy: 1,
          armor: 3,
          mass: 1,
          chargePower: 1,
          chargeMinSpeed: 999,
        },
        '2': {
          hp: 108.3,
          moveSpeed: 87.55,
          attackDamage: 10.08,
          attackRate: 1,
          meleeRange: 14,
          rangedDamage: 0,
          rangedRange: 0,
          projectileSpeed: 0,
          projectileGravity: 0,
          rangedCooldown: 0,
          accuracy: 1,
          armor: 3.36,
          mass: 1,
          chargePower: 1,
          chargeMinSpeed: 999,
        },
        '3': {
          hp: 121.6,
          moveSpeed: 89.25,
          attackDamage: 10.98,
          attackRate: 1,
          meleeRange: 14,
          rangedDamage: 0,
          rangedRange: 0,
          projectileSpeed: 0,
          projectileGravity: 0,
          rangedCooldown: 0,
          accuracy: 1,
          armor: 3.72,
          mass: 1,
          chargePower: 1,
          chargeMinSpeed: 999,
        },
      },
    },
    {
      id: 'cavalry',
      name: 'Cavalry',
      recruitable: true,
      tags: ['cavalry', 'heavy'],
      tiers: {
        '1': {
          hp: 120,
          moveSpeed: 140,
          attackDamage: 11,
          attackRate: 0.9,
          meleeRange: 14,
          rangedDamage: 0,
          rangedRange: 0,
          projectileSpeed: 0,
          projectileGravity: 0,
          rangedCooldown: 0,
          accuracy: 1,
          armor: 5,
          mass: 1.4,
          chargePower: 2.2,
          chargeMinSpeed: 110,
        },
        '2': {
          hp: 136.8,
          moveSpeed: 144.2,
          attackDamage: 12.32,
          attackRate: 0.9,
          meleeRange: 14,
          rangedDamage: 0,
          rangedRange: 0,
          projectileSpeed: 0,
          projectileGravity: 0,
          rangedCooldown: 0,
          accuracy: 1,
          armor: 5.6,
          mass: 1.4,
          chargePower: 2.2,
          chargeMinSpeed: 110,
        },
        '3': {
          hp: 153.6,
          moveSpeed: 147,
          attackDamage: 13.42,
          attackRate: 0.9,
          meleeRange: 14,
          rangedDamage: 0,
          rangedRange: 0,
          projectileSpeed: 0,
          projectileGravity: 0,
          rangedCooldown: 0,
          accuracy: 1,
          armor: 6.2,
          mass: 1.4,
          chargePower: 2.2,
          chargeMinSpeed: 110,
        },
      },
    },
    {
      id: 'archers',
      name: 'Archers',
      recruitable: true,
      tags: ['archer', 'light'],
      tiers: {
        '1': {
          hp: 75,
          moveSpeed: 95,
          attackDamage: 6,
          attackRate: 1.25,
          meleeRange: 12,
          rangedDamage: 7.2,
          rangedRange: 390,
          projectileSpeed: 340,
          projectileGravity: 150,
          rangedCooldown: 0,
          accuracy: 0.78,
          armor: 1,
          mass: 0.9,
          chargePower: 1,
          chargeMinSpeed: 999,
        },
        '2': {
          hp: 85.5,
          moveSpeed: 97.85,
          attackDamage: 6.72,
          attackRate: 1.25,
          meleeRange: 12,
          rangedDamage: 7.99,
          rangedRange: 390,
          projectileSpeed: 340,
          projectileGravity: 150,
          rangedCooldown: 0,
          accuracy: 0.78,
          armor: 1.12,
          mass: 0.9,
          chargePower: 1,
          chargeMinSpeed: 999,
        },
        '3': {
          hp: 96,
          moveSpeed: 99.75,
          attackDamage: 7.32,
          attackRate: 1.25,
          meleeRange: 12,
          rangedDamage: 8.64,
          rangedRange: 390,
          projectileSpeed: 340,
          projectileGravity: 150,
          rangedCooldown: 0,
          accuracy: 0.78,
          armor: 1.24,
          mass: 0.9,
          chargePower: 1,
          chargeMinSpeed: 999,
        },
      },
    },
  ],
  startingArmy: {
    gold: 55,
    supplies: 35,
    recruits: 12,
    squads: [
      { archetypeId: 'infantry', size: 30, tier: 1, name: 'Vanguard' },
      { archetypeId: 'spearmen', size: 28, tier: 1, name: 'Pikes' },
      { archetypeId: 'archers', size: 24, tier: 1, name: 'Bowline' },
    ],
  },
};

export const DEFAULT_UPGRADES_CONTENT: UpgradePathsContent = {
  contentVersion: '1.0.0',
  maxTier: 3,
  defaultUpgradeCost: 0,
  paths: {
    infantry: {
      nextTierByTier: { '1': 2, '2': 3 },
      costByTier: { '2': 0, '3': 0 },
    },
    spearmen: {
      nextTierByTier: { '1': 2, '2': 3 },
      costByTier: { '2': 0, '3': 0 },
    },
    cavalry: {
      nextTierByTier: { '1': 2, '2': 3 },
      costByTier: { '2': 0, '3': 0 },
    },
    archers: {
      nextTierByTier: { '1': 2, '2': 3 },
      costByTier: { '2': 0, '3': 0 },
    },
  },
};

export const DEFAULT_PERKS_CONTENT: PerksContent = {
  version: 'perks_v1',
  rewardRules: {
    everyNNodes: 3,
    choices: 3,
  },
  perks: [
    {
      id: 'iron_discipline',
      name: 'Iron Discipline',
      desc: 'Rout slower and morale recovers faster.',
      rarity: 'common',
      mods: {
        moraleRegenMult: 1.25,
        routThresholdAdd: -5,
      },
    },
    {
      id: 'tight_ranks',
      name: 'Tight Ranks',
      desc: 'Improved cohesion with denser lines.',
      rarity: 'common',
      mods: {
        cohesionMult: 1.25,
        formationSpacingMult: 0.9,
      },
    },
    {
      id: 'blessed_arrows',
      name: 'Blessed Arrows',
      desc: 'Archers fire truer and faster shots.',
      rarity: 'rare',
      mods: {
        rangedAccuracyAdd: 0.08,
        projectileSpeedMult: 1.15,
      },
    },
    {
      id: 'thunder_charge',
      name: 'Thunder Charge',
      desc: 'Charge impact increases with faster resets.',
      rarity: 'rare',
      mods: {
        chargePowerMult: 1.2,
        chargeCooldownMult: 0.85,
      },
    },
    {
      id: 'brace',
      name: 'Brace',
      desc: 'Spear formations punish cavalry charges harder.',
      rarity: 'common',
      mods: {
        spearCounterDamageMult: 1.25,
      },
    },
    {
      id: 'war_drums',
      name: 'War Drums',
      desc: 'Battle rhythm reduces morale shock.',
      rarity: 'common',
      mods: {
        moraleLossMult: 0.9,
      },
    },
    {
      id: 'swift_muster',
      name: 'Swift Muster',
      desc: 'Faster redeployments with looser staging.',
      rarity: 'common',
      mods: {
        formationSpacingMult: 1.1,
        cohesionMult: 0.95,
        moveSpeedMult: 1.08,
      },
    },
    {
      id: 'siegecraft',
      name: 'Siegecraft',
      desc: 'Capture progress advances more quickly.',
      rarity: 'rare',
      mods: {
        captureRateMult: 1.15,
      },
    },
    {
      id: 'hardened_steel',
      name: 'Hardened Steel',
      desc: 'Armor holds better under pressure.',
      rarity: 'rare',
      mods: {
        armorEffectivenessMult: 1.1,
      },
    },
    {
      id: 'field_medic',
      name: 'Field Medic',
      desc: 'Recover extra recruits from post-battle survivors.',
      rarity: 'common',
      mods: {
        fieldMedicRecruitsPerCasualty: 0.12,
      },
    },
  ],
};

export const DEFAULT_OBJECTIVES_CONTENT: ObjectivesTuningContent = {
  contentVersion: '1.0.0',
  selectionWeightsByNodeType: {
    BATTLE: {
      CAPTURE: 0.55,
      ASSASSINATE: 0.15,
      HOLDOUT: 0.15,
      ESCORT: 0.15,
      SIEGE: 0,
    },
    ELITE: {
      CAPTURE: 0.42,
      ASSASSINATE: 0.42,
      HOLDOUT: 0,
      ESCORT: 0,
      SIEGE: 0.16,
    },
    BOSS: {
      CAPTURE: 0.4,
      ASSASSINATE: 0.6,
      HOLDOUT: 0,
      ESCORT: 0,
      SIEGE: 0,
    },
  },
  capture: {
    radius: 240,
    baseGainRate: 0.8,
    contestedDecayRate: 0.35,
    opposingProgressDrainFactor: 0.45,
    speedMultiplierByNodeType: {
      BATTLE: 1,
      ELITE: 0.78,
      BOSS: 0.62,
    },
  },
  holdout: {
    durationSeconds: 120,
    waveIntervalSeconds: 25,
    maxWaves: 4,
    zoneRadius: 180,
    waveMinSquads: 1,
    waveMaxSquads: 2,
    waveBaseSize: 17,
    waveRandomSizeMaxAdd: 4,
    waveSizePerDifficulty: 2,
    waveSizePerWave: 1,
    waveArchetypes: ['infantry', 'spearmen', 'cavalry', 'archers'],
  },
  escort: {
    timeLimitSeconds: 180,
    caravanHp: 480,
    caravanSpeed: 62,
    caravanRadius: 8,
    exitRadius: 120,
    exitHoldSeconds: 3,
    startX: 260,
    exitXPadding: 220,
    startJitterY: 180,
    exitJitterY: 220,
  },
  siege: {
    timeLimitSeconds: 240,
    gateCaptureRate: 0.95,
    courtyardCaptureRate: 0.82,
    contestedDecayRate: 0.3,
    opposingProgressDrainFactor: 0.42,
    eliteDepthMin: 7,
    eliteChance: 0.38,
  },
};

export const DEFAULT_NODES_CONTENT: NodesTuningContent = {
  contentVersion: '1.0.0',
  mapGeneration: {
    minNodes: 18,
    maxNodes: 24,
    layerCountMin: 5,
    layerCountMax: 6,
    middleLayerMin: 3,
    middleLayerMax: 5,
    middleLayerCap: 6,
    linkExtraChance: 0.35,
    nodeJitterY: 18,
  },
  nodeTypeWeightsByDepth: [
    {
      depthMin: 0,
      depthMax: 3,
      weights: {
        BATTLE: 0.54,
        SHOP: 0.16,
        RECRUIT: 0.13,
        REST: 0.13,
        ELITE: 0.04,
      },
    },
    {
      depthMin: 4,
      depthMax: 8,
      weights: {
        BATTLE: 0.5,
        SHOP: 0.12,
        RECRUIT: 0.12,
        REST: 0.12,
        ELITE: 0.14,
      },
    },
    {
      depthMin: 9,
      depthMax: 99,
      weights: {
        BATTLE: 0.46,
        SHOP: 0.1,
        RECRUIT: 0.1,
        REST: 0.1,
        ELITE: 0.24,
      },
    },
  ],
  rewardsByNodeType: {
    BATTLE: {
      gold: { min: 30, max: 52 },
      recruits: { min: 5, max: 10 },
      supplies: { min: 0, max: 2 },
    },
    SHOP: {
      gold: { min: 0, max: 0 },
      recruits: { min: 0, max: 0 },
      supplies: { min: 0, max: 0 },
    },
    RECRUIT: {
      gold: { min: 0, max: 0 },
      recruits: { min: 7, max: 14 },
      supplies: { min: 0, max: 0 },
    },
    REST: {
      gold: { min: 0, max: 0 },
      recruits: { min: 0, max: 0 },
      supplies: { min: 8, max: 16 },
    },
    ELITE: {
      gold: { min: 45, max: 70 },
      recruits: { min: 8, max: 13 },
      supplies: { min: 1, max: 4 },
    },
    BOSS: {
      gold: { min: 60, max: 80 },
      recruits: { min: 10, max: 15 },
      supplies: { min: 2, max: 6 },
    },
  },
  shop: {
    sizeUpgradeCost: 35,
    sizeUpgradeAmount: 5,
    suppliesCost: 22,
    suppliesAmount: 20,
  },
  recruit: {
    baseRecruits: 9,
    recruitsPerDifficulty: 2,
    recruitsBonusCap: 6,
    discountHireCost: 15,
    discountSizeMin: 18,
    discountSizeMax: 22,
  },
  rest: {
    suppliesGain: 12,
    restBonusBattles: 1,
  },
  lossProtection: {
    enabled: true,
    goldPctOfNormalReward: 0.6,
    recruitsPctOfNormalReward: 0.8,
    suppliesFlat: 10,
    maxConsecutiveLossBoost: 2,
  },
};

export const DEFAULT_MAPS_CONTENT: MapsContent = {
  version: 'maps_v1',
  nav: {
    cellSize: 40,
  },
  terrainRules: {
    forest: {
      moveSpeedMult: 0.82,
      rangedAccuracyAdd: -0.06,
      projectileSpeedMult: 0.95,
    },
    hill: {
      rangedRangeMult: 1.1,
      rangedAccuracyAdd: 0.06,
    },
  },
  maps: [
    {
      id: 'open_field',
      name: 'Open Field',
      size: { w: 2200, h: 1400 },
      spawns: {
        blue: [
          { x: 350, y: 700 },
          { x: 420, y: 520 },
          { x: 420, y: 880 },
        ],
        red: [
          { x: 1850, y: 700 },
          { x: 1780, y: 520 },
          { x: 1780, y: 880 },
        ],
      },
      objectives: {
        capturePoint: { x: 1100, y: 700, radius: 170 },
        exitZone: { x: 2030, y: 700, radius: 160 },
      },
      terrain: [
        { type: 'OBSTACLE_RECT', x: 980, y: 350, w: 140, h: 210 },
        { type: 'OBSTACLE_RECT', x: 1120, y: 860, w: 120, h: 190 },
        { type: 'FOREST_RECT', x: 720, y: 930, w: 360, h: 250 },
        { type: 'FOREST_RECT', x: 1410, y: 210, w: 290, h: 220 },
        { type: 'HILL_RECT', x: 1330, y: 460, w: 300, h: 220 },
      ],
    },
    {
      id: 'bridge_crossing',
      name: 'Bridge Crossing',
      size: { w: 2200, h: 1400 },
      spawns: {
        blue: [
          { x: 300, y: 700 },
          { x: 360, y: 540 },
          { x: 360, y: 860 },
        ],
        red: [
          { x: 1900, y: 700 },
          { x: 1840, y: 540 },
          { x: 1840, y: 860 },
        ],
      },
      objectives: {
        capturePoint: { x: 1100, y: 700, radius: 155 },
        exitZone: { x: 2020, y: 700, radius: 150 },
      },
      terrain: [
        { type: 'OBSTACLE_RECT', x: 940, y: 0, w: 320, h: 520 },
        { type: 'OBSTACLE_RECT', x: 940, y: 650, w: 320, h: 750 },
        { type: 'OBSTACLE_RECT', x: 1050, y: 520, w: 100, h: 130 },
        { type: 'FOREST_RECT', x: 520, y: 220, w: 280, h: 220 },
        { type: 'FOREST_RECT', x: 1440, y: 960, w: 260, h: 220 },
        { type: 'HILL_RECT', x: 760, y: 980, w: 240, h: 170 },
      ],
    },
    {
      id: 'forest_pass',
      name: 'Forest Pass',
      size: { w: 2200, h: 1400 },
      spawns: {
        blue: [
          { x: 330, y: 700 },
          { x: 380, y: 550 },
          { x: 380, y: 850 },
        ],
        red: [
          { x: 1880, y: 700 },
          { x: 1820, y: 550 },
          { x: 1820, y: 850 },
        ],
      },
      objectives: {
        capturePoint: { x: 1110, y: 700, radius: 165 },
        exitZone: { x: 2020, y: 700, radius: 160 },
      },
      terrain: [
        { type: 'OBSTACLE_RECT', x: 850, y: 0, w: 230, h: 560 },
        { type: 'OBSTACLE_RECT', x: 850, y: 820, w: 230, h: 580 },
        { type: 'OBSTACLE_RECT', x: 1240, y: 0, w: 230, h: 560 },
        { type: 'OBSTACLE_RECT', x: 1240, y: 820, w: 230, h: 580 },
        { type: 'FOREST_RECT', x: 560, y: 230, w: 280, h: 360 },
        { type: 'FOREST_RECT', x: 1460, y: 790, w: 300, h: 360 },
        { type: 'FOREST_RECT', x: 1010, y: 590, w: 330, h: 230 },
        { type: 'HILL_RECT', x: 1500, y: 420, w: 250, h: 200 },
      ],
    },
    {
      id: 'siege_gatehouse',
      name: 'Siege Gatehouse',
      size: { w: 2400, h: 1500 },
      spawns: {
        blue: [
          { x: 1480, y: 740 },
          { x: 1600, y: 610 },
          { x: 1600, y: 870 },
          { x: 1730, y: 740 },
        ],
        red: [
          { x: 360, y: 740 },
          { x: 280, y: 610 },
          { x: 280, y: 870 },
          { x: 180, y: 740 },
          { x: 450, y: 520 },
        ],
      },
      objectives: {
        capturePoint: { x: 1110, y: 740, radius: 140 },
        exitZone: { x: 2190, y: 740, radius: 150 },
        gateZone: { x: 1110, y: 740, radius: 145 },
        courtyardZone: { x: 1650, y: 740, radius: 180 },
      },
      terrain: [
        { type: 'OBSTACLE_RECT', x: 0, y: 0, w: 2400, h: 48 },
        { type: 'OBSTACLE_RECT', x: 0, y: 1452, w: 2400, h: 48 },
        { type: 'OBSTACLE_RECT', x: 0, y: 48, w: 48, h: 1404 },
        { type: 'OBSTACLE_RECT', x: 2352, y: 48, w: 48, h: 1404 },
        { type: 'OBSTACLE_RECT', x: 980, y: 220, w: 190, h: 430 },
        { type: 'OBSTACLE_RECT', x: 980, y: 840, w: 190, h: 430 },
        { type: 'OBSTACLE_RECT', x: 1180, y: 220, w: 190, h: 430 },
        { type: 'OBSTACLE_RECT', x: 1180, y: 840, w: 190, h: 430 },
        { type: 'OBSTACLE_RECT', x: 980, y: 48, w: 390, h: 172 },
        { type: 'OBSTACLE_RECT', x: 980, y: 1270, w: 390, h: 182 },
        { type: 'GATE_RECT', id: 'main_gate', x: 1085, y: 650, w: 180, h: 190 },
        { type: 'HILL_RECT', x: 1500, y: 260, w: 250, h: 170 },
        { type: 'HILL_RECT', x: 1500, y: 1070, w: 250, h: 170 },
        { type: 'FOREST_RECT', x: 300, y: 250, w: 260, h: 230 },
        { type: 'FOREST_RECT', x: 300, y: 1020, w: 260, h: 230 },
      ],
    },
  ],
};

export const DEFAULT_SCENARIOS_CONTENT: ScenariosContent = {
  contentVersion: '1.0.0',
  objectivePowerScale: {
    CAPTURE: 1,
    ASSASSINATE: 1,
    HOLDOUT: 0.72,
    ESCORT: 0.9,
    SIEGE: 1.08,
  },
  mapPoolsByNodeType: {
    BATTLE: [
      {
        depthMin: 0,
        depthMax: 4,
        maps: [
          { id: 'open_field', weight: 0.65 },
          { id: 'bridge_crossing', weight: 0.2 },
          { id: 'forest_pass', weight: 0.15 },
        ],
      },
      {
        depthMin: 5,
        depthMax: 9,
        maps: [
          { id: 'open_field', weight: 0.35 },
          { id: 'bridge_crossing', weight: 0.35 },
          { id: 'forest_pass', weight: 0.3 },
        ],
      },
      {
        depthMin: 10,
        depthMax: 99,
        maps: [
          { id: 'open_field', weight: 0.2 },
          { id: 'bridge_crossing', weight: 0.45 },
          { id: 'forest_pass', weight: 0.35 },
        ],
      },
    ],
    ELITE: [
      {
        depthMin: 0,
        depthMax: 6,
        maps: [
          { id: 'open_field', weight: 0.3 },
          { id: 'bridge_crossing', weight: 0.35 },
          { id: 'forest_pass', weight: 0.35 },
        ],
      },
      {
        depthMin: 7,
        depthMax: 99,
        maps: [
          { id: 'open_field', weight: 0.18 },
          { id: 'bridge_crossing', weight: 0.32 },
          { id: 'forest_pass', weight: 0.3 },
          { id: 'siege_gatehouse', weight: 0.2 },
        ],
      },
    ],
    BOSS: [
      {
        depthMin: 0,
        depthMax: 99,
        maps: [
          { id: 'bridge_crossing', weight: 0.5 },
          { id: 'forest_pass', weight: 0.5 },
        ],
      },
    ],
  },
  templatesByNodeType: {
    BATTLE: [
      {
        depthMin: 0,
        depthMax: 5,
        templates: [
          {
            id: 'battle_early_a',
            squads: [
              { archetypeId: 'infantry', tier: 1, size: 24 },
              { archetypeId: 'spearmen', tier: 1, size: 22 },
              { archetypeId: 'archers', tier: 1, size: 20 },
            ],
          },
          {
            id: 'battle_early_b',
            squads: [
              { archetypeId: 'infantry', tier: 1, size: 26 },
              { archetypeId: 'cavalry', tier: 1, size: 18 },
              { archetypeId: 'archers', tier: 1, size: 20 },
            ],
          },
        ],
      },
      {
        depthMin: 6,
        depthMax: 10,
        templates: [
          {
            id: 'battle_mid_a',
            squads: [
              { archetypeId: 'infantry', tier: 2, size: 26 },
              { archetypeId: 'spearmen', tier: 2, size: 24 },
              { archetypeId: 'archers', tier: 1, size: 22 },
            ],
          },
          {
            id: 'battle_mid_b',
            squads: [
              { archetypeId: 'infantry', tier: 2, size: 24 },
              { archetypeId: 'cavalry', tier: 2, size: 20 },
              { archetypeId: 'archers', tier: 2, size: 22 },
            ],
          },
        ],
      },
      {
        depthMin: 11,
        depthMax: 99,
        templates: [
          {
            id: 'battle_late_a',
            squads: [
              { archetypeId: 'infantry', tier: 2, size: 28 },
              { archetypeId: 'spearmen', tier: 3, size: 24 },
              { archetypeId: 'archers', tier: 2, size: 24 },
            ],
          },
          {
            id: 'battle_late_b',
            squads: [
              { archetypeId: 'infantry', tier: 3, size: 26 },
              { archetypeId: 'cavalry', tier: 3, size: 20 },
              { archetypeId: 'archers', tier: 2, size: 24 },
            ],
          },
        ],
      },
    ],
    ELITE: [
      {
        depthMin: 0,
        depthMax: 6,
        templates: [
          {
            id: 'elite_early_a',
            squads: [
              { archetypeId: 'infantry', tier: 2, size: 28 },
              { archetypeId: 'cavalry', tier: 2, size: 22 },
              { archetypeId: 'archers', tier: 2, size: 20 },
            ],
          },
          {
            id: 'elite_early_b',
            squads: [
              { archetypeId: 'spearmen', tier: 2, size: 28 },
              { archetypeId: 'infantry', tier: 2, size: 28 },
              { archetypeId: 'archers', tier: 2, size: 20 },
            ],
          },
        ],
      },
      {
        depthMin: 7,
        depthMax: 99,
        templates: [
          {
            id: 'elite_late_a',
            squads: [
              { archetypeId: 'infantry', tier: 3, size: 30 },
              { archetypeId: 'cavalry', tier: 3, size: 24 },
              { archetypeId: 'archers', tier: 2, size: 22 },
            ],
          },
          {
            id: 'elite_late_b',
            squads: [
              { archetypeId: 'spearmen', tier: 3, size: 30 },
              { archetypeId: 'infantry', tier: 3, size: 28 },
              { archetypeId: 'archers', tier: 3, size: 22 },
            ],
          },
        ],
      },
    ],
    BOSS: [
      {
        depthMin: 0,
        depthMax: 99,
        templates: [
          {
            id: 'boss_a',
            squads: [
              { archetypeId: 'infantry', tier: 3, size: 38 },
              { archetypeId: 'cavalry', tier: 3, size: 28 },
              { archetypeId: 'spearmen', tier: 3, size: 34 },
            ],
          },
          {
            id: 'boss_b',
            squads: [
              { archetypeId: 'infantry', tier: 3, size: 36 },
              { archetypeId: 'archers', tier: 3, size: 30 },
              { archetypeId: 'cavalry', tier: 3, size: 26 },
            ],
          },
        ],
      },
    ],
  },
  siegeTemplates: [
    {
      depthMin: 0,
      depthMax: 6,
      templates: [
        {
          id: 'siege_early_a',
          squads: [
            { archetypeId: 'infantry', tier: 2, size: 30 },
            { archetypeId: 'infantry', tier: 2, size: 28 },
            { archetypeId: 'spearmen', tier: 2, size: 26 },
            { archetypeId: 'archers', tier: 2, size: 24 },
          ],
        },
      ],
    },
    {
      depthMin: 7,
      depthMax: 99,
      templates: [
        {
          id: 'siege_late_a',
          squads: [
            { archetypeId: 'infantry', tier: 3, size: 34 },
            { archetypeId: 'infantry', tier: 3, size: 30 },
            { archetypeId: 'spearmen', tier: 3, size: 28 },
            { archetypeId: 'archers', tier: 2, size: 26 },
            { archetypeId: 'cavalry', tier: 2, size: 18 },
          ],
        },
        {
          id: 'siege_late_b',
          squads: [
            { archetypeId: 'infantry', tier: 3, size: 32 },
            { archetypeId: 'spearmen', tier: 3, size: 30 },
            { archetypeId: 'archers', tier: 3, size: 26 },
            { archetypeId: 'archers', tier: 2, size: 22 },
            { archetypeId: 'cavalry', tier: 2, size: 20 },
          ],
        },
      ],
    },
  ],
};
