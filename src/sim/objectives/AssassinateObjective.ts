import type { Graphics } from 'pixi.js';
import type { Camera } from '../../game/Camera';
import { Vec2 } from '../../utils/vec2';
import type { Soldier } from '../Soldier';
import { TeamId } from '../types';
import type {
  IObjective,
  ObjectiveHUDState,
  ObjectiveMinimapMarker,
  ObjectiveTacticalState,
  ObjectiveWorld,
} from './IObjective';
import { objectiveDisplayName } from './ObjectiveTypes';

export class AssassinateObjective implements IObjective {
  readonly id: string;
  readonly type = 'ASSASSINATE' as const;

  private blueCommander: Soldier | null = null;
  private redCommander: Soldier | null = null;
  private winner: 'blue' | 'red' | null = null;

  private readonly hudLines = ['', ''];
  private readonly hudState: ObjectiveHUDState = {
    title: objectiveDisplayName('ASSASSINATE'),
    lines: this.hudLines,
  };
  private readonly tacticalState: ObjectiveTacticalState;

  private readonly fallbackFocus: Vec2;

  constructor(id: string, fallbackFocus: Vec2) {
    this.id = id;
    this.fallbackFocus = fallbackFocus.clone();
    this.tacticalState = {
      type: this.type,
      focusPosition: this.fallbackFocus,
      captureRadius: 0,
      blueCommander: null,
      redCommander: null,
      caravan: null,
      exitPosition: null,
      exitRadius: 0,
      siegeStage: null,
      gateZonePosition: null,
      gateZoneRadius: 0,
      courtyardZonePosition: null,
      courtyardZoneRadius: 0,
      gateOpen: false,
      attackerTeam: null,
      defenderTeam: null,
    };
  }

  onStart(world: ObjectiveWorld): void {
    this.blueCommander = this.findCommander(TeamId.Blue, world);
    this.redCommander = this.findCommander(TeamId.Red, world);
    this.winner = null;
    this.syncTacticalState();
    this.updateHudState();
  }

  update(_dt: number, world: ObjectiveWorld): void {
    if (this.blueCommander !== null && !this.blueCommander.alive) {
      this.blueCommander = null;
      this.winner = 'red';
    }

    if (this.redCommander !== null && !this.redCommander.alive) {
      this.redCommander = null;
      this.winner = 'blue';
    }

    if (this.blueCommander === null && this.winner === null) {
      this.blueCommander = this.findCommander(TeamId.Blue, world);
      if (this.blueCommander === null) {
        this.winner = 'red';
      }
    }

    if (this.redCommander === null && this.winner === null) {
      this.redCommander = this.findCommander(TeamId.Red, world);
      if (this.redCommander === null) {
        this.winner = 'blue';
      }
    }

    this.syncTacticalState();
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
    if (this.blueCommander !== null && this.blueCommander.alive) {
      out.push({
        x: this.blueCommander.position.x,
        y: this.blueCommander.position.y,
        radius: 26,
        color: 0x70b8ff,
      });
    }
    if (this.redCommander !== null && this.redCommander.alive) {
      out.push({
        x: this.redCommander.position.x,
        y: this.redCommander.position.y,
        radius: 26,
        color: 0xff8f8f,
      });
    }
  }

  renderOverlay(gfx: Graphics, camera: Camera): void {
    void camera;
    gfx.clear();

    this.drawCommanderMarker(gfx, this.blueCommander, 0x75bcff);
    this.drawCommanderMarker(gfx, this.redCommander, 0xff9b9b);
  }

  getBlueCommander(): Soldier | null {
    return this.blueCommander;
  }

  getRedCommander(): Soldier | null {
    return this.redCommander;
  }

  private findCommander(team: TeamId, world: ObjectiveWorld): Soldier | null {
    for (let i = 0; i < world.squads.length; i += 1) {
      const squad = world.squads[i];
      if (squad.team !== team || !squad.hasLivingSoldiers()) {
        continue;
      }

      for (let j = 0; j < squad.soldiers.length; j += 1) {
        const soldier = squad.soldiers[j];
        if (soldier.alive) {
          return soldier;
        }
      }
    }

    return null;
  }

  private drawCommanderMarker(gfx: Graphics, commander: Soldier | null, color: number): void {
    if (commander === null || !commander.alive) {
      return;
    }

    const x = commander.position.x;
    const y = commander.position.y - 13;
    gfx.moveTo(x, y - 8);
    gfx.lineTo(x + 7, y + 4);
    gfx.lineTo(x - 7, y + 4);
    gfx.closePath();
    gfx.fill({ color, alpha: 0.95 });
    gfx.stroke({ color: 0x1f1f1f, alpha: 0.92, width: 1.1 });
  }

  private syncTacticalState(): void {
    this.tacticalState.blueCommander = this.blueCommander;
    this.tacticalState.redCommander = this.redCommander;

    if (this.redCommander !== null && this.redCommander.alive) {
      this.tacticalState.focusPosition = this.redCommander.position;
      return;
    }

    if (this.blueCommander !== null && this.blueCommander.alive) {
      this.tacticalState.focusPosition = this.blueCommander.position;
      return;
    }

    this.tacticalState.focusPosition = this.fallbackFocus;
  }

  private updateHudState(): void {
    this.hudLines[0] = `Blue Commander: ${this.blueCommander !== null && this.blueCommander.alive ? 'Alive' : 'Dead'}`;
    this.hudLines[1] = `Red Commander:  ${this.redCommander !== null && this.redCommander.alive ? 'Alive' : 'Dead'}`;
    this.hudState.progressBlue = undefined;
    this.hudState.progressRed = undefined;
    this.hudState.timer = undefined;
    this.hudState.secondary = undefined;
  }
}
