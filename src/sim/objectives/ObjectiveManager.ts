import type { Graphics } from 'pixi.js';
import type { Camera } from '../../game/Camera';
import type { IObjective, ObjectiveHUDState, ObjectiveMinimapMarker, ObjectiveTacticalState, ObjectiveWorld } from './IObjective';
import type { BattleObjectiveType } from './ObjectiveTypes';

export class ObjectiveManager {
  constructor(private readonly objective: IObjective) {}

  onStart(world: ObjectiveWorld): void {
    this.objective.onStart(world);
  }

  update(dt: number, world: ObjectiveWorld): void {
    this.objective.update(dt, world);
  }

  isComplete(): boolean {
    return this.objective.isComplete();
  }

  getWinner(): 'blue' | 'red' | null {
    return this.objective.getWinner();
  }

  getHUDState(): ObjectiveHUDState {
    return this.objective.getHUDState();
  }

  getType(): BattleObjectiveType {
    return this.objective.type;
  }

  getTacticalState(): ObjectiveTacticalState {
    return this.objective.getTacticalState();
  }

  getMinimapMarkers(out: ObjectiveMinimapMarker[]): void {
    this.objective.getMinimapMarkers(out);
  }

  renderOverlay(gfx: Graphics, camera: Camera): void {
    if (this.objective.renderOverlay) {
      this.objective.renderOverlay(gfx, camera);
      return;
    }
    gfx.clear();
  }
}
