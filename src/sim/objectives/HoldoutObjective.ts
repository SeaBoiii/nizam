import type { Graphics } from 'pixi.js';
import type { Camera } from '../../game/Camera';
import { clamp } from '../../utils/math';
import { SeededRng } from '../../utils/rng';
import { Vec2 } from '../../utils/vec2';
import { TeamId } from '../types';
import {
  HOLDOUT_MAX_WAVES,
  HOLDOUT_WAVE_BASE_SIZE,
  HOLDOUT_WAVE_INTERVAL_SECONDS,
  HOLDOUT_WAVE_MAX_SQUADS,
  HOLDOUT_WAVE_MIN_SQUADS,
  HOLDOUT_WAVE_SIZE_PER_DIFFICULTY,
  HOLDOUT_WAVE_SIZE_PER_WAVE,
} from '../rules/ObjectiveTuning';
import type {
  IObjective,
  ObjectiveHUDState,
  ObjectiveMinimapMarker,
  ObjectiveTacticalState,
  ObjectiveWorld,
} from './IObjective';
import { objectiveDisplayName } from './ObjectiveTypes';

const HOLDOUT_ZONE_RADIUS = 180;
const WAVE_ARCHETYPES = ['infantry', 'spearmen', 'cavalry', 'archers'] as const;

interface HoldoutOptions {
  id: string;
  center: Vec2;
  seed: number;
  durationSeconds?: number;
  waveInterval?: number;
  maxWaves?: number;
}

export class HoldoutObjective implements IObjective {
  readonly id: string;
  readonly type = 'HOLDOUT' as const;

  private readonly center: Vec2;
  private readonly rng: SeededRng;
  private readonly durationSeconds: number;
  private readonly waveInterval: number;
  private readonly maxWaves: number;

  private timeRemaining = 0;
  private elapsed = 0;
  private wavesSpawned = 0;
  private winner: 'blue' | 'red' | null = null;

  private readonly hudLines = ['', '', ''];
  private readonly hudState: ObjectiveHUDState = {
    title: objectiveDisplayName('HOLDOUT'),
    lines: this.hudLines,
    timer: 1,
  };
  private readonly tacticalState: ObjectiveTacticalState;

  constructor(options: HoldoutOptions) {
    this.id = options.id;
    this.center = options.center.clone();
    this.rng = new SeededRng(options.seed);
    this.durationSeconds = Math.max(30, options.durationSeconds ?? 120);
    this.waveInterval = Math.max(8, options.waveInterval ?? HOLDOUT_WAVE_INTERVAL_SECONDS);
    this.maxWaves = Math.max(1, options.maxWaves ?? HOLDOUT_MAX_WAVES);

    this.tacticalState = {
      type: this.type,
      focusPosition: this.center,
      captureRadius: HOLDOUT_ZONE_RADIUS,
      blueCommander: null,
      redCommander: null,
      caravan: null,
      exitPosition: null,
      exitRadius: 0,
    };
  }

  onStart(): void {
    this.timeRemaining = this.durationSeconds;
    this.elapsed = 0;
    this.wavesSpawned = 0;
    this.winner = null;
    this.updateHudState(0, 0);
  }

  update(dt: number, world: ObjectiveWorld): void {
    if (this.winner !== null) {
      return;
    }

    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    this.elapsed += dt;

    while (this.wavesSpawned < this.maxWaves && this.elapsed >= (this.wavesSpawned + 1) * this.waveInterval) {
      this.spawnWave(world);
      this.wavesSpawned += 1;
    }

    let blueAlive = 0;
    let redAlive = 0;
    for (let i = 0; i < world.aliveSoldiers.length; i += 1) {
      const soldier = world.aliveSoldiers[i];
      if (!soldier.alive) {
        continue;
      }
      if (soldier.team === TeamId.Blue) {
        blueAlive += 1;
      } else {
        redAlive += 1;
      }
    }

    if (blueAlive <= 0) {
      this.winner = 'red';
    } else if (this.timeRemaining <= 0) {
      this.winner = 'blue';
    }

    this.updateHudState(blueAlive, redAlive);
  }

  isComplete(): boolean {
    return this.winner !== null;
  }

  getWinner(): 'blue' | 'red' | null {
    return this.winner;
  }

  getHUDState(): ObjectiveHUDState {
    return this.hudState;
  }

  getTacticalState(): ObjectiveTacticalState {
    return this.tacticalState;
  }

  getMinimapMarkers(out: ObjectiveMinimapMarker[]): void {
    out.length = 0;
    out.push({
      x: this.center.x,
      y: this.center.y,
      radius: HOLDOUT_ZONE_RADIUS,
      color: 0xf0d28a,
    });
  }

  renderOverlay(gfx: Graphics, camera: Camera): void {
    void camera;
    gfx.clear();
    gfx.circle(this.center.x, this.center.y, HOLDOUT_ZONE_RADIUS);
    gfx.stroke({ color: 0xf3d38f, alpha: 0.72, width: 1.6 });
    gfx.circle(this.center.x, this.center.y, HOLDOUT_ZONE_RADIUS * 0.55);
    gfx.stroke({ color: 0xf3d38f, alpha: 0.45, width: 1 });
  }

  private spawnWave(world: ObjectiveWorld): void {
    const squadsToSpawn = this.rng.int(HOLDOUT_WAVE_MIN_SQUADS, HOLDOUT_WAVE_MAX_SQUADS);
    const difficulty = Math.max(1, world.scenario.difficultyTier);
    const tierCap = Math.max(1, Math.min(3, difficulty));

    for (let i = 0; i < squadsToSpawn; i += 1) {
      const side = this.rng.int(0, 2);
      let x = world.bounds.width - 90;
      let y = this.rng.range(100, world.bounds.height - 100);
      let facing = Math.PI;

      if (side === 1) {
        x = this.rng.range(world.bounds.width * 0.7, world.bounds.width - 90);
        y = 80;
        facing = Math.PI * 0.5;
      } else if (side === 2) {
        x = this.rng.range(world.bounds.width * 0.7, world.bounds.width - 90);
        y = world.bounds.height - 80;
        facing = -Math.PI * 0.5;
      }

      const archetypeId = WAVE_ARCHETYPES[this.rng.int(0, WAVE_ARCHETYPES.length - 1)];
      const tier = this.rng.int(Math.max(1, tierCap - 1), Math.min(3, tierCap + 1));
      const size =
        HOLDOUT_WAVE_BASE_SIZE +
        this.rng.int(0, 4) +
        (difficulty - 1) * HOLDOUT_WAVE_SIZE_PER_DIFFICULTY +
        this.wavesSpawned * HOLDOUT_WAVE_SIZE_PER_WAVE;

      const squad = world.spawnSquad({
        team: TeamId.Red,
        archetypeId,
        tier,
        soldierCount: size,
        x,
        y,
        facing,
      });
      squad.orderCharge();
    }
  }

  private updateHudState(blueAlive: number, redAlive: number): void {
    this.hudLines[0] = `Time Remaining: ${this.timeRemaining.toFixed(1)}s`;
    this.hudLines[1] = `Waves: ${this.wavesSpawned}/${this.maxWaves}`;
    this.hudLines[2] = `Blue Alive: ${blueAlive}  Red Alive: ${redAlive}`;
    this.hudState.timer = clamp(this.timeRemaining / this.durationSeconds, 0, 1);
    this.hudState.progressBlue = undefined;
    this.hudState.progressRed = undefined;
    this.hudState.secondary = undefined;
  }
}
