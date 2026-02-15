import type { BattleScenario } from '../../meta/types';
import { contentManager } from '../../content/ContentManager';
import { SeededRng } from '../../utils/rng';
import { Vec2 } from '../../utils/vec2';
import { BattleMapState } from '../map/MapState';
import { DEFAULT_PERK_MODS, type CombinedPerkMods } from '../rules/PerkMods';
import type { IObjective } from './IObjective';
import { AssassinateObjective } from './AssassinateObjective';
import { CapturePointObjective } from './CapturePointObjective';
import { EscortObjective } from './EscortObjective';
import { HoldoutObjective } from './HoldoutObjective';

export function createObjectiveForScenario(
  scenario: BattleScenario,
  mapState: BattleMapState,
  playerPerkMods: Readonly<CombinedPerkMods> = DEFAULT_PERK_MODS,
): IObjective {
  const capturePoint = mapState.getCapturePoint();
  const center = new Vec2(capturePoint.x, capturePoint.y);
  const objectives = contentManager.getObjectiveTuning();

  switch (scenario.objectiveType) {
    case 'CAPTURE':
      return new CapturePointObjective(
        `objective_${scenario.nodeId}`,
        center,
        capturePoint.radius,
        scenario.captureSpeedMultiplier,
        objectives.capture.baseGainRate,
        objectives.capture.contestedDecayRate,
        objectives.capture.opposingProgressDrainFactor,
        playerPerkMods.captureRateMult,
      );
    case 'ASSASSINATE':
      return new AssassinateObjective(`objective_${scenario.nodeId}`, center);
    case 'HOLDOUT':
      return new HoldoutObjective({
        id: `objective_${scenario.nodeId}`,
        center,
        seed: scenario.objectiveSeed,
        durationSeconds: scenario.holdoutDurationSeconds ?? objectives.holdout.durationSeconds,
        waveInterval: scenario.holdoutWaveInterval ?? objectives.holdout.waveIntervalSeconds,
        maxWaves: scenario.holdoutMaxWaves ?? objectives.holdout.maxWaves,
        zoneRadius: capturePoint.radius,
        waveMinSquads: objectives.holdout.waveMinSquads,
        waveMaxSquads: objectives.holdout.waveMaxSquads,
        waveBaseSize: objectives.holdout.waveBaseSize,
        waveRandomSizeMaxAdd: objectives.holdout.waveRandomSizeMaxAdd,
        waveSizePerDifficulty: objectives.holdout.waveSizePerDifficulty,
        waveSizePerWave: objectives.holdout.waveSizePerWave,
        waveArchetypes: objectives.holdout.waveArchetypes,
        waveStrengthMultiplier:
          scenario.holdoutWaveStrengthMult / Math.max(0.25, playerPerkMods.waveStrengthMult),
      });
    case 'ESCORT': {
      const rng = new SeededRng(scenario.objectiveSeed ^ 0xa51d2f3b);
      const start = new Vec2();
      mapState.getSpawn('blue', 0, start);
      start.y += rng.range(-objectives.escort.startJitterY * 0.2, objectives.escort.startJitterY * 0.2);
      const exitObj = mapState.getExitZone();
      const exit = new Vec2(exitObj.x, exitObj.y + rng.range(-objectives.escort.exitJitterY * 0.15, objectives.escort.exitJitterY * 0.15));
      return new EscortObjective({
        id: `objective_${scenario.nodeId}`,
        start,
        exit,
        timeLimitSeconds: scenario.escortTimeLimitSeconds ?? objectives.escort.timeLimitSeconds,
        caravanHp: objectives.escort.caravanHp,
        caravanSpeed: objectives.escort.caravanSpeed,
        caravanRadius: objectives.escort.caravanRadius,
        exitRadius: exitObj.radius,
        exitHoldSeconds: objectives.escort.exitHoldSeconds,
      });
    }
  }
}
