import { Graphics } from 'pixi.js';
import { TeamId } from '../types';
import type { Soldier } from '../Soldier';
import { Vec2 } from '../../utils/vec2';
import { clamp } from '../../utils/math';

const CAPTURE_GAIN_RATE = 0.8;
const CONTESTED_DECAY_RATE = 0.35;

export class CapturePoint {
  readonly position: Vec2;
  readonly radius: number;
  readonly radiusSq: number;
  readonly graphics: Graphics;

  progressBlue = 0;
  progressRed = 0;
  blueInside = 0;
  redInside = 0;

  constructor(position: Vec2, radius: number) {
    this.position = position;
    this.radius = radius;
    this.radiusSq = radius * radius;

    this.graphics = new Graphics();
    this.draw();
  }

  reset(): void {
    this.progressBlue = 0;
    this.progressRed = 0;
    this.blueInside = 0;
    this.redInside = 0;
    this.draw();
  }

  update(dt: number, aliveSoldiers: readonly Soldier[]): void {
    this.blueInside = 0;
    this.redInside = 0;

    for (let i = 0; i < aliveSoldiers.length; i += 1) {
      const soldier = aliveSoldiers[i];
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
      this.progressBlue += diff * CAPTURE_GAIN_RATE * dt;
      this.progressRed = Math.max(0, this.progressRed - diff * CAPTURE_GAIN_RATE * 0.45 * dt);
    } else if (diff < 0) {
      const magnitude = -diff;
      this.progressRed += magnitude * CAPTURE_GAIN_RATE * dt;
      this.progressBlue = Math.max(0, this.progressBlue - magnitude * CAPTURE_GAIN_RATE * 0.45 * dt);
    } else if (this.blueInside > 0 && this.redInside > 0) {
      this.progressBlue = Math.max(0, this.progressBlue - CONTESTED_DECAY_RATE * dt);
      this.progressRed = Math.max(0, this.progressRed - CONTESTED_DECAY_RATE * dt);
    }

    this.progressBlue = clamp(this.progressBlue, 0, 100);
    this.progressRed = clamp(this.progressRed, 0, 100);

    this.draw();
  }

  isContested(): boolean {
    return this.blueInside > 0 && this.redInside > 0;
  }

  winner(): TeamId | null {
    if (this.progressBlue >= 100) {
      return TeamId.Blue;
    }
    if (this.progressRed >= 100) {
      return TeamId.Red;
    }
    return null;
  }

  private draw(): void {
    this.graphics.clear();

    this.graphics.circle(this.position.x, this.position.y, this.radius);
    this.graphics.fill({ color: 0x6a5b3a, alpha: 0.12 });
    this.graphics.stroke({ color: 0xd7b06d, alpha: 0.9, width: 2 });

    const blueArc = (Math.PI * 2 * this.progressBlue) / 100;
    if (blueArc > 0.001) {
      this.graphics.moveTo(this.position.x, this.position.y);
      this.graphics.arc(this.position.x, this.position.y, this.radius - 7, -Math.PI / 2, -Math.PI / 2 + blueArc);
      this.graphics.closePath();
      this.graphics.fill({ color: 0x5ba8ff, alpha: 0.2 });
    }

    const redArc = (Math.PI * 2 * this.progressRed) / 100;
    if (redArc > 0.001) {
      this.graphics.moveTo(this.position.x, this.position.y);
      this.graphics.arc(this.position.x, this.position.y, this.radius - 14, -Math.PI / 2, -Math.PI / 2 + redArc);
      this.graphics.closePath();
      this.graphics.fill({ color: 0xff6b6b, alpha: 0.2 });
    }
  }
}
