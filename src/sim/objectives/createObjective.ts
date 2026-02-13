import type { BattleScenario } from '../../meta/types';
import { contentManager } from '../../content/ContentManager';
import { SeededRng } from '../../utils/rng';
import { Vec2 } from '../../utils/vec2';
import type { WorldBounds } from '../types';
import type { IObjective } from './IObjective';
import { AssassinateObjective } from './AssassinateObjective';
import { CapturePointObjective } from './CapturePointObjective';
import { EscortObjective } from './EscortObjective';
import { HoldoutObjective } from './HoldoutObjective';

export function createObjectiveForScenario(scenario: BattleScenario, bounds: WorldBounds): IObjective {
  const center = new Vec2(bounds.width * 0.5, bounds.height * 0.5);
  const objectives = contentManager.getObjectiveTuning();

  switch (scenario.objectiveType) {
    case 'CAPTURE':
      return new CapturePointObjective(
        `objective_${scenario.nodeId}`,
        center,
        objectives.capture.radius,
        scenario.captureSpeedMultiplier,
        objectives.capture.baseGainRate,
        objectives.capture.contestedDecayRate,
        objectives.capture.opposingProgressDrainFactor,
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
        zoneRadius: objectives.holdout.zoneRadius,
        waveMinSquads: objectives.holdout.waveMinSquads,
        waveMaxSquads: objectives.holdout.waveMaxSquads,
        waveBaseSize: objectives.holdout.waveBaseSize,
        waveRandomSizeMaxAdd: objectives.holdout.waveRandomSizeMaxAdd,
        waveSizePerDifficulty: objectives.holdout.waveSizePerDifficulty,
        waveSizePerWave: objectives.holdout.waveSizePerWave,
        waveArchetypes: objectives.holdout.waveArchetypes,
      });
    case 'ESCORT': {
      const rng = new SeededRng(scenario.objectiveSeed ^ 0xa51d2f3b);
      const start = new Vec2(
        objectives.escort.startX,
        bounds.height * 0.5 + rng.range(-objectives.escort.startJitterY, objectives.escort.startJitterY),
      );
      const exit = new Vec2(
        bounds.width - objectives.escort.exitXPadding,
        bounds.height * 0.5 + rng.range(-objectives.escort.exitJitterY, objectives.escort.exitJitterY),
      );
      return new EscortObjective({
        id: `objective_${scenario.nodeId}`,
        start,
        exit,
        timeLimitSeconds: scenario.escortTimeLimitSeconds ?? objectives.escort.timeLimitSeconds,
        caravanHp: objectives.escort.caravanHp,
        caravanSpeed: objectives.escort.caravanSpeed,
        caravanRadius: objectives.escort.caravanRadius,
        exitRadius: objectives.escort.exitRadius,
        exitHoldSeconds: objectives.escort.exitHoldSeconds,
      });
    }
  }
}
