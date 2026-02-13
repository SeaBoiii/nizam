import type { Graphics } from 'pixi.js';
import type { Camera } from '../../game/Camera';
import { clamp } from '../../utils/math';
import { Vec2 } from '../../utils/vec2';
import type { Soldier } from '../Soldier';
import { TeamId } from '../types';
import {
  ESCORT_CARAVAN_HP,
  ESCORT_CARAVAN_RADIUS,
  ESCORT_CARAVAN_SPEED,
  ESCORT_EXIT_HOLD_SECONDS,
  ESCORT_EXIT_RADIUS,
  ESCORT_TIME_LIMIT_SECONDS,
} from '../rules/ObjectiveTuning';
import type { UnitArchetype } from '../types/UnitArchetype';
import type {
  IObjective,
  ObjectiveHUDState,
  ObjectiveMinimapMarker,
  ObjectiveTacticalState,
  ObjectiveWorld,
} from './IObjective';
import { objectiveDisplayName } from './ObjectiveTypes';

interface EscortOptions {
  id: string;
  start: Vec2;
  exit: Vec2;
  timeLimitSeconds?: number;
  caravanHp?: number;
  caravanSpeed?: number;
}

function buildCaravanArchetype(hp: number, speed: number): UnitArchetype {
  return {
    id: 'caravan',
    name: 'Caravan',
    tags: ['light', 'caravan'],
    stats: {
      hp,
      moveSpeed: speed,
      attackDamage: 0,
      attackRate: 0.2,
      meleeRange: 0,
      rangedDamage: 0,
      rangedRange: 0,
      projectileSpeed: 0,
      projectileGravity: 0,
      rangedCooldown: 0,
      accuracy: 1,
      armor: 2,
      mass: 3.2,
      chargePower: 0,
      chargeMinSpeed: 999,
    },
  };
}

export class EscortObjective implements IObjective {
  readonly id: string;
  readonly type = 'ESCORT' as const;

  private readonly start = new Vec2();
  private readonly exit = new Vec2();
  private readonly timeLimitSeconds: number;
  private readonly caravanArchetype: UnitArchetype;
  private readonly holdSeconds: number;
  private readonly exitRadius: number;
  private readonly startDistance: number;

  private caravan: Soldier | null = null;
  private timeRemaining = 0;
  private holdProgress = 0;
  private winner: 'blue' | 'red' | null = null;

  private readonly hudLines = ['', '', ''];
  private readonly hudState: ObjectiveHUDState = {
    title: objectiveDisplayName('ESCORT'),
    lines: this.hudLines,
    timer: 1,
    secondary: 1,
  };
  private readonly tacticalState: ObjectiveTacticalState;

  constructor(options: EscortOptions) {
    this.id = options.id;
    this.start.copy(options.start);
    this.exit.copy(options.exit);
    this.timeLimitSeconds = Math.max(60, options.timeLimitSeconds ?? ESCORT_TIME_LIMIT_SECONDS);
    this.exitRadius = ESCORT_EXIT_RADIUS;
    this.holdSeconds = ESCORT_EXIT_HOLD_SECONDS;
    this.caravanArchetype = buildCaravanArchetype(
      options.caravanHp ?? ESCORT_CARAVAN_HP,
      options.caravanSpeed ?? ESCORT_CARAVAN_SPEED,
    );
    this.startDistance = Math.max(1, this.start.distanceTo(this.exit));

    this.tacticalState = {
      type: this.type,
      focusPosition: this.start,
      captureRadius: 0,
      blueCommander: null,
      redCommander: null,
      caravan: null,
      exitPosition: this.exit,
      exitRadius: this.exitRadius,
    };
  }

  onStart(world: ObjectiveWorld): void {
    const squad = world.spawnSquad({
      team: TeamId.Blue,
      archetypeId: this.caravanArchetype.id,
      tier: 1,
      soldierCount: 1,
      x: this.start.x,
      y: this.start.y,
      facing: 0,
      commandable: false,
      color: 0xd9c98b,
      archetypeOverride: this.caravanArchetype,
    });
    squad.holdPosition();
    squad.issueMove(this.exit, false, 0);
    this.caravan = squad.soldiers.length > 0 ? squad.soldiers[0] : null;

    this.timeRemaining = this.timeLimitSeconds;
    this.holdProgress = 0;
    this.winner = null;
    this.syncTacticalState();
    this.updateHudState();
  }

  update(dt: number, world: ObjectiveWorld): void {
    if (this.winner !== null) {
      return;
    }

    this.timeRemaining = Math.max(0, this.timeRemaining - dt);

    if (this.caravan === null || !this.caravan.alive) {
      this.winner = 'red';
      this.syncTacticalState();
      this.updateHudState();
      return;
    }

    const caravanSquad = this.caravan.squad;
    const distance = this.caravan.position.distanceTo(this.exit);
    if (distance > this.exitRadius * 0.8 && caravanSquad.order !== 'move') {
      caravanSquad.issueMove(this.exit, false, 0);
    }

    if (distance <= this.exitRadius) {
      this.holdProgress += dt;
    } else {
      this.holdProgress = 0;
    }

    if (this.holdProgress >= this.holdSeconds) {
      this.winner = 'blue';
    } else if (this.timeRemaining <= 0) {
      this.winner = 'red';
    }

    this.syncTacticalState();
    this.updateHudState();

    void world;
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
      x: this.exit.x,
      y: this.exit.y,
      radius: this.exitRadius,
      color: 0xd2eaa7,
    });
    if (this.caravan !== null && this.caravan.alive) {
      out.push({
        x: this.caravan.position.x,
        y: this.caravan.position.y,
        radius: 18,
        color: 0xe5d0a2,
      });
    }
  }

  renderOverlay(gfx: Graphics, camera: Camera): void {
    void camera;
    gfx.clear();

    gfx.circle(this.exit.x, this.exit.y, this.exitRadius);
    gfx.fill({ color: 0x8cad63, alpha: 0.14 });
    gfx.stroke({ color: 0xc6e08a, alpha: 0.88, width: 2 });

    if (this.caravan !== null && this.caravan.alive) {
      gfx.moveTo(this.caravan.position.x, this.caravan.position.y);
      gfx.lineTo(this.exit.x, this.exit.y);
      gfx.stroke({ color: 0xd9d9aa, alpha: 0.45, width: 1.2 });

      gfx.circle(this.caravan.position.x, this.caravan.position.y, ESCORT_CARAVAN_RADIUS + 2);
      gfx.stroke({ color: 0xe9dab0, alpha: 0.85, width: 1.2 });
    }
  }

  getCaravanUnit(): Soldier | null {
    return this.caravan;
  }

  private syncTacticalState(): void {
    this.tacticalState.caravan = this.caravan;
    this.tacticalState.focusPosition = this.caravan !== null && this.caravan.alive ? this.caravan.position : this.start;
  }

  private updateHudState(): void {
    const caravanHp = this.caravan !== null && this.caravan.alive ? this.caravan.hp : 0;
    const caravanHpMax = this.caravan !== null ? this.caravan.hpMax : this.caravanArchetype.stats.hp;
    const hpNorm = clamp(caravanHp / Math.max(1, caravanHpMax), 0, 1);

    let progress = 0;
    if (this.caravan !== null && this.caravan.alive) {
      const dist = this.caravan.position.distanceTo(this.exit);
      progress = clamp(1 - dist / this.startDistance, 0, 1);
    }

    this.hudLines[0] = `Caravan HP: ${caravanHp.toFixed(0)} / ${caravanHpMax.toFixed(0)}`;
    this.hudLines[1] = `To Exit: ${(progress * 100).toFixed(0)}%`;
    this.hudLines[2] = `Exit Hold: ${this.holdProgress.toFixed(1)} / ${this.holdSeconds.toFixed(1)}s`;
    this.hudState.timer = clamp(this.timeRemaining / this.timeLimitSeconds, 0, 1);
    this.hudState.secondary = hpNorm;
    this.hudState.progressBlue = undefined;
    this.hudState.progressRed = undefined;
  }
}
