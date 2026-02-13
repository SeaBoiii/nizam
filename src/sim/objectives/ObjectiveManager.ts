import { TeamId } from '../types';
import type { Soldier } from '../Soldier';
import { CapturePoint } from './CapturePoint';
import { Vec2 } from '../../utils/vec2';

export interface ObjectiveStatus {
  progressBlue: number;
  progressRed: number;
  blueInside: number;
  redInside: number;
  contested: boolean;
  winner: TeamId | null;
}

export class ObjectiveManager {
  readonly capturePoint: CapturePoint;

  private status: ObjectiveStatus = {
    progressBlue: 0,
    progressRed: 0,
    blueInside: 0,
    redInside: 0,
    contested: false,
    winner: null,
  };

  constructor(position: Vec2, radius: number) {
    this.capturePoint = new CapturePoint(position, radius);
  }

  reset(): void {
    this.capturePoint.reset();
    this.status.progressBlue = 0;
    this.status.progressRed = 0;
    this.status.blueInside = 0;
    this.status.redInside = 0;
    this.status.contested = false;
    this.status.winner = null;
  }

  update(dt: number, aliveSoldiers: readonly Soldier[]): void {
    this.capturePoint.update(dt, aliveSoldiers);

    this.status.progressBlue = this.capturePoint.progressBlue;
    this.status.progressRed = this.capturePoint.progressRed;
    this.status.blueInside = this.capturePoint.blueInside;
    this.status.redInside = this.capturePoint.redInside;
    this.status.contested = this.capturePoint.isContested();
    this.status.winner = this.capturePoint.winner();
  }

  getStatus(): ObjectiveStatus {
    return this.status;
  }
}