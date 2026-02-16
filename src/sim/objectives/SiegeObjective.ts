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

type SiegeStage = 'GATEHOUSE' | 'COURTYARD';

interface SiegeObjectiveOptions {
  id: string;
  gateZoneCenter: Vec2;
  gateZoneRadius: number;
  courtyardZoneCenter: Vec2;
  courtyardZoneRadius: number;
  gateId: string;
  timeLimitSeconds: number;
  gateCaptureRate: number;
  courtyardCaptureRate: number;
  contestedDecayRate: number;
  opposingProgressDrainFactor: number;
  attackerTeam?: TeamId;
  defenderTeam?: TeamId;
}

export class SiegeObjective implements IObjective {
  readonly id: string;
  readonly type = 'SIEGE' as const;

  private readonly gateZoneCenter = new Vec2();
  private readonly gateZoneRadius: number;
  private readonly gateZoneRadiusSq: number;
  private readonly courtyardZoneCenter = new Vec2();
  private readonly courtyardZoneRadius: number;
  private readonly courtyardZoneRadiusSq: number;
  private readonly gateId: string;

  private readonly attackerTeam: TeamId;
  private readonly defenderTeam: TeamId;
  private readonly timeLimitSeconds: number;
  private readonly gateCaptureRate: number;
  private readonly courtyardCaptureRate: number;
  private readonly contestedDecayRate: number;
  private readonly opposingProgressDrainFactor: number;

  private stage: SiegeStage = 'GATEHOUSE';
  private attackerProgress = 0;
  private defenderProgress = 0;
  private attackerInside = 0;
  private defenderInside = 0;
  private timeRemaining = 0;
  private winner: 'blue' | 'red' | null = null;

  private readonly hudLines = ['', '', ''];
  private readonly hudState: ObjectiveHUDState = {
    title: objectiveDisplayName('SIEGE'),
    lines: this.hudLines,
    progressBlue: 0,
    progressRed: 0,
    timer: 1,
  };
  private readonly tacticalState: ObjectiveTacticalState;

  constructor(options: SiegeObjectiveOptions) {
    this.id = options.id;
    this.gateZoneCenter.copy(options.gateZoneCenter);
    this.gateZoneRadius = Math.max(60, options.gateZoneRadius);
    this.gateZoneRadiusSq = this.gateZoneRadius * this.gateZoneRadius;
    this.courtyardZoneCenter.copy(options.courtyardZoneCenter);
    this.courtyardZoneRadius = Math.max(70, options.courtyardZoneRadius);
    this.courtyardZoneRadiusSq = this.courtyardZoneRadius * this.courtyardZoneRadius;
    this.gateId = options.gateId;

    this.attackerTeam = options.attackerTeam ?? TeamId.Red;
    this.defenderTeam = options.defenderTeam ?? TeamId.Blue;
    this.timeLimitSeconds = Math.max(30, options.timeLimitSeconds);
    this.gateCaptureRate = Math.max(0.05, options.gateCaptureRate);
    this.courtyardCaptureRate = Math.max(0.05, options.courtyardCaptureRate);
    this.contestedDecayRate = Math.max(0, options.contestedDecayRate);
    this.opposingProgressDrainFactor = clamp(options.opposingProgressDrainFactor, 0, 1);

    this.tacticalState = {
      type: this.type,
      focusPosition: this.gateZoneCenter,
      captureRadius: this.gateZoneRadius,
      blueCommander: null,
      redCommander: null,
      caravan: null,
      exitPosition: null,
      exitRadius: 0,
      siegeStage: 'GATEHOUSE',
      gateZonePosition: this.gateZoneCenter,
      gateZoneRadius: this.gateZoneRadius,
      courtyardZonePosition: this.courtyardZoneCenter,
      courtyardZoneRadius: this.courtyardZoneRadius,
      gateOpen: false,
      attackerTeam: this.attackerTeam,
      defenderTeam: this.defenderTeam,
    };
  }

  onStart(world: ObjectiveWorld): void {
    world.mapState.closeGate(this.gateId);
    this.stage = 'GATEHOUSE';
    this.attackerProgress = 0;
    this.defenderProgress = 0;
    this.attackerInside = 0;
    this.defenderInside = 0;
    this.timeRemaining = this.timeLimitSeconds;
    this.winner = null;
    world.events.emitObjectiveStage(this.type, this.stage, this.attackerProgress);
    this.syncTacticalState(world);
    this.updateHudState(world);
  }

  update(dt: number, world: ObjectiveWorld): void {
    if (this.winner !== null) {
      return;
    }

    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    const stageCenter = this.stage === 'GATEHOUSE' ? this.gateZoneCenter : this.courtyardZoneCenter;
    const stageRadiusSq = this.stage === 'GATEHOUSE' ? this.gateZoneRadiusSq : this.courtyardZoneRadiusSq;
    const stageCaptureRate = this.stage === 'GATEHOUSE' ? this.gateCaptureRate : this.courtyardCaptureRate;

    this.attackerInside = 0;
    this.defenderInside = 0;

    let attackerAlive = 0;
    let defenderAlive = 0;
    for (let i = 0; i < world.aliveSoldiers.length; i += 1) {
      const soldier = world.aliveSoldiers[i];
      if (!soldier.alive) {
        continue;
      }

      if (soldier.team === this.attackerTeam) {
        attackerAlive += 1;
      } else if (soldier.team === this.defenderTeam) {
        defenderAlive += 1;
      }

      const dx = soldier.position.x - stageCenter.x;
      const dy = soldier.position.y - stageCenter.y;
      if (dx * dx + dy * dy > stageRadiusSq) {
        continue;
      }

      if (soldier.team === this.attackerTeam) {
        this.attackerInside += 1;
      } else if (soldier.team === this.defenderTeam) {
        this.defenderInside += 1;
      }
    }

    const diff = this.attackerInside - this.defenderInside;
    if (diff > 0) {
      this.attackerProgress += diff * stageCaptureRate * dt;
      this.defenderProgress = Math.max(
        0,
        this.defenderProgress - diff * stageCaptureRate * this.opposingProgressDrainFactor * dt,
      );
    } else if (diff < 0) {
      const magnitude = -diff;
      this.defenderProgress += magnitude * stageCaptureRate * dt;
      this.attackerProgress = Math.max(
        0,
        this.attackerProgress - magnitude * stageCaptureRate * this.opposingProgressDrainFactor * dt,
      );
    } else if (this.attackerInside > 0 && this.defenderInside > 0) {
      this.attackerProgress = Math.max(0, this.attackerProgress - this.contestedDecayRate * dt);
      this.defenderProgress = Math.max(0, this.defenderProgress - this.contestedDecayRate * dt);
    }

    this.attackerProgress = clamp(this.attackerProgress, 0, 100);
    this.defenderProgress = clamp(this.defenderProgress, 0, 100);

    if (this.stage === 'GATEHOUSE' && this.attackerProgress >= 100) {
      if (world.mapState.openGate(this.gateId)) {
        const gateCenter = new Vec2();
        if (world.mapState.getGateCenter(this.gateId, gateCenter)) {
          world.events.emitGateOpened(this.gateId, gateCenter.x, gateCenter.y);
        }
      }
      this.stage = 'COURTYARD';
      this.attackerProgress = 0;
      this.defenderProgress = 0;
      world.events.emitObjectiveStage(this.type, this.stage, this.attackerProgress);
    } else if (this.stage === 'COURTYARD' && this.attackerProgress >= 100) {
      this.winner = this.attackerTeam === TeamId.Blue ? 'blue' : 'red';
    }

    if (this.winner === null) {
      if (this.timeRemaining <= 0 || attackerAlive <= 0) {
        this.winner = this.defenderTeam === TeamId.Blue ? 'blue' : 'red';
      } else if (defenderAlive <= 0) {
        this.winner = this.attackerTeam === TeamId.Blue ? 'blue' : 'red';
      }
    }

    this.syncTacticalState(world);
    this.updateHudState(world);
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
      x: this.gateZoneCenter.x,
      y: this.gateZoneCenter.y,
      radius: this.gateZoneRadius,
      color: this.stage === 'GATEHOUSE' ? 0xffd183 : 0xb9cde0,
    });
    out.push({
      x: this.courtyardZoneCenter.x,
      y: this.courtyardZoneCenter.y,
      radius: this.courtyardZoneRadius,
      color: this.stage === 'COURTYARD' ? 0xffd183 : 0x98ba85,
    });
  }

  renderOverlay(gfx: Graphics, camera: Camera): void {
    void camera;
    gfx.clear();

    gfx.circle(this.gateZoneCenter.x, this.gateZoneCenter.y, this.gateZoneRadius);
    gfx.fill({ color: this.stage === 'GATEHOUSE' ? 0x9a7437 : 0x455462, alpha: 0.14 });
    gfx.stroke({ color: this.stage === 'GATEHOUSE' ? 0xe2b66e : 0x95a6b8, alpha: 0.9, width: this.stage === 'GATEHOUSE' ? 2.4 : 1.3 });

    gfx.circle(this.courtyardZoneCenter.x, this.courtyardZoneCenter.y, this.courtyardZoneRadius);
    gfx.fill({ color: this.stage === 'COURTYARD' ? 0x7a6235 : 0x3f563b, alpha: 0.12 });
    gfx.stroke({ color: this.stage === 'COURTYARD' ? 0xe2b66e : 0x8eb487, alpha: 0.85, width: this.stage === 'COURTYARD' ? 2.4 : 1.3 });
  }

  private syncTacticalState(world: ObjectiveWorld): void {
    this.tacticalState.focusPosition = this.stage === 'GATEHOUSE' ? this.gateZoneCenter : this.courtyardZoneCenter;
    this.tacticalState.captureRadius = this.stage === 'GATEHOUSE' ? this.gateZoneRadius : this.courtyardZoneRadius;
    this.tacticalState.siegeStage = this.stage;
    this.tacticalState.gateOpen = world.mapState.isGateOpen(this.gateId);
  }

  private updateHudState(world: ObjectiveWorld): void {
    const stageLabel = this.stage === 'GATEHOUSE' ? 'Stage 1: Gatehouse' : 'Stage 2: Courtyard';
    this.hudLines[0] = stageLabel;
    this.hudLines[1] = `Time: ${this.timeRemaining.toFixed(1)}s  Gate: ${world.mapState.isGateOpen(this.gateId) ? 'OPEN' : 'CLOSED'}`;
    this.hudLines[2] = `Attackers in zone: ${this.attackerInside}  Defenders: ${this.defenderInside}`;
    this.hudState.progressBlue = this.defenderProgress;
    this.hudState.progressRed = this.attackerProgress;
    this.hudState.timer = clamp(this.timeRemaining / this.timeLimitSeconds, 0, 1);
    this.hudState.secondary = undefined;
  }
}
