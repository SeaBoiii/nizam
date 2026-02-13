import type { BattleScenario } from '../../meta/types';
import { SeededRng } from '../../utils/rng';
import { Vec2 } from '../../utils/vec2';
import type { WorldBounds } from '../types';
import {
  ESCORT_TIME_LIMIT_SECONDS,
  HOLDOUT_DURATION_SECONDS,
  HOLDOUT_MAX_WAVES,
  HOLDOUT_WAVE_INTERVAL_SECONDS,
} from '../rules/ObjectiveTuning';
import type { IObjective } from './IObjective';
import { AssassinateObjective } from './AssassinateObjective';
import { CapturePointObjective } from './CapturePointObjective';
import { EscortObjective } from './EscortObjective';
import { HoldoutObjective } from './HoldoutObjective';

export function createObjectiveForScenario(scenario: BattleScenario, bounds: WorldBounds): IObjective {
  const center = new Vec2(bounds.width * 0.5, bounds.height * 0.5);

  switch (scenario.objectiveType) {
    case 'CAPTURE':
      return new CapturePointObjective(`objective_${scenario.nodeId}`, center, 240, scenario.captureSpeedMultiplier);
    case 'ASSASSINATE':
      return new AssassinateObjective(`objective_${scenario.nodeId}`, center);
    case 'HOLDOUT':
      return new HoldoutObjective({
        id: `objective_${scenario.nodeId}`,
        center,
        seed: scenario.objectiveSeed,
        durationSeconds: scenario.holdoutDurationSeconds ?? HOLDOUT_DURATION_SECONDS,
        waveInterval: scenario.holdoutWaveInterval ?? HOLDOUT_WAVE_INTERVAL_SECONDS,
        maxWaves: scenario.holdoutMaxWaves ?? HOLDOUT_MAX_WAVES,
      });
    case 'ESCORT': {
      const rng = new SeededRng(scenario.objectiveSeed ^ 0xa51d2f3b);
      const start = new Vec2(260, bounds.height * 0.5 + rng.range(-180, 180));
      const exit = new Vec2(bounds.width - 220, bounds.height * 0.5 + rng.range(-220, 220));
      return new EscortObjective({
        id: `objective_${scenario.nodeId}`,
        start,
        exit,
        timeLimitSeconds: scenario.escortTimeLimitSeconds ?? ESCORT_TIME_LIMIT_SECONDS,
      });
    }
  }
}
