import type { Graphics } from 'pixi.js';
import type { Camera } from '../../game/Camera';
import { clamp } from '../../utils/math';
import { Vec2 } from '../../utils/vec2';
import { TeamId } from '../types';
import type {
  IObjective,
  ObjectiveHUDState,
  ObjectiveMinimapMarker,
  ObjectiveTacticalState,
  ObjectiveWorld,
} from './IObjective';
import { objectiveDisplayName } from './ObjectiveTypes';

const CAPTURE_GAIN_RATE = 0.8;
const CONTESTED_DECAY_RATE = 0.35;

export class CapturePointObjective implements IObjective {
  readonly id: string;
  readonly type = 'CAPTURE' as const;

  readonly position: Vec2;
  readonly radius: number;
  private readonly radiusSq: number;
  private captureRateMultiplier: number;

  progressBlue = 0;
  progressRed = 0;
  blueInside = 0;
  redInside = 0;

  private winner: 'blue' | 'red' | null = null;
  private readonly hudLines = ['', '', ''];
  private readonly hudState: ObjectiveHUDState = {
    title: objectiveDisplayName('CAPTURE'),
    lines: this.hudLines,
    progressBlue: 0,
    progressRed: 0,
  };
  private readonly tacticalState: ObjectiveTacticalState;

  constructor(id: string, position: Vec2, radius: number, captureRateMultiplier: number) {
    this.id = id;
    this.position = position.clone();
    this.radius = radius;
    this.radiusSq = radius * radius;
    this.captureRateMultiplier = Math.max(0.1, captureRateMultiplier);

    this.tacticalState = {
      type: this.type,
      focusPosition: this.position,
      captureRadius: this.radius,
      blueCommander: null,
      redCommander: null,
      caravan: null,
      exitPosition: null,
      exitRadius: 0,
    };
  }

  onStart(): void {
    this.progressBlue = 0;
    this.progressRed = 0;
    this.blueInside = 0;
    this.redInside = 0;
    this.winner = null;
    this.updateHudState();
  }

  update(dt: number, world: ObjectiveWorld): void {
    this.blueInside = 0;
    this.redInside = 0;

    for (let i = 0; i < world.aliveSoldiers.length; i += 1) {
      const soldier = world.aliveSoldiers[i];
      if (!soldier.alive) {
        continue;
      }

      const dx = soldier.position.x - this.position.x;
      const dy = soldier.position.y - this.position.y;
      if (dx * dx + dy * dy > this.radiusSq) {
        continue;
      }

      if (soldier.team === TeamId.Blue) {
        this.blueInside += 1;
      } else {
        this.redInside += 1;
      }
    }

    const diff = this.blueInside - this.redInside;
    if (diff > 0) {
      this.progressBlue += diff * CAPTURE_GAIN_RATE * this.captureRateMultiplier * dt;
      this.progressRed = Math.max(
        0,
        this.progressRed - diff * CAPTURE_GAIN_RATE * 0.45 * this.captureRateMultiplier * dt,
      );
    } else if (diff < 0) {
      const magnitude = -diff;
      this.progressRed += magnitude * CAPTURE_GAIN_RATE * this.captureRateMultiplier * dt;
      this.progressBlue = Math.max(
        0,
        this.progressBlue - magnitude * CAPTURE_GAIN_RATE * 0.45 * this.captureRateMultiplier * dt,
      );
    } else if (this.blueInside > 0 && this.redInside > 0) {
      this.progressBlue = Math.max(0, this.progressBlue - CONTESTED_DECAY_RATE * this.captureRateMultiplier * dt);
      this.progressRed = Math.max(0, this.progressRed - CONTESTED_DECAY_RATE * this.captureRateMultiplier * dt);
    }

    this.progressBlue = clamp(this.progressBlue, 0, 100);
    this.progressRed = clamp(this.progressRed, 0, 100);

    if (this.progressBlue >= 100) {
      this.winner = 'blue';
    } else if (this.progressRed >= 100) {
      this.winner = 'red';
    } else {
      this.winner = null;
    }

    this.updateHudState();
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
      x: this.position.x,
      y: this.position.y,
      radius: this.radius,
      color: 0xf4cf86,
    });
  }

  renderOverlay(gfx: Graphics, camera: Camera): void {
    void camera;
    gfx.clear();

    gfx.circle(this.position.x, this.position.y, this.radius);
    gfx.fill({ color: 0x6a5b3a, alpha: 0.12 });
    gfx.stroke({ color: 0xd7b06d, alpha: 0.9, width: 2 });

    const blueArc = (Math.PI * 2 * this.progressBlue) / 100;
    if (blueArc > 0.001) {
      gfx.moveTo(this.position.x, this.position.y);
      gfx.arc(this.position.x, this.position.y, this.radius - 7, -Math.PI / 2, -Math.PI / 2 + blueArc);
      gfx.closePath();
      gfx.fill({ color: 0x5ba8ff, alpha: 0.2 });
    }

    const redArc = (Math.PI * 2 * this.progressRed) / 100;
    if (redArc > 0.001) {
      gfx.moveTo(this.position.x, this.position.y);
      gfx.arc(this.position.x, this.position.y, this.radius - 14, -Math.PI / 2, -Math.PI / 2 + redArc);
      gfx.closePath();
      gfx.fill({ color: 0xff6b6b, alpha: 0.2 });
    }
  }

  setCaptureRateMultiplier(value: number): void {
    this.captureRateMultiplier = Math.max(0.1, value);
  }

  private updateHudState(): void {
    this.hudLines[0] = `Blue: ${this.progressBlue.toFixed(1)}% (${this.blueInside})`;
    this.hudLines[1] = `Red:  ${this.progressRed.toFixed(1)}% (${this.redInside})`;
    this.hudLines[2] = this.blueInside > 0 && this.redInside > 0 ? 'Status: CONTESTED' : 'Status: Stable';

    this.hudState.progressBlue = this.progressBlue;
    this.hudState.progressRed = this.progressRed;
    this.hudState.timer = undefined;
    this.hudState.secondary = undefined;
  }
}
