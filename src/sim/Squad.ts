import { Container, Graphics, Text } from 'pixi.js';
import { clamp, damp, rotateTowardAngle, shortestAngleDelta } from '../utils/math';
import { Vec2 } from '../utils/vec2';
import { computeSlotLocal, estimateFormationRadius } from './Formation';
import type { Waypoint } from './Orders';
import { Soldier } from './Soldier';
import { TeamId, type FormationType, type OrderMode, type WorldBounds } from './types';

const ANCHOR_MAX_SPEED = 95;
const ANCHOR_MAX_SPEED_CHARGE = 120;
const ANCHOR_MAX_SPEED_ROUT = 140;
const ANCHOR_MAX_ACCEL = 200;
const SOLDIER_MAX_SPEED = 104;
const SOLDIER_MAX_SPEED_CHARGE = 128;
const SOLDIER_MAX_SPEED_ROUT = 142;
const SOLDIER_MAX_ACCEL = 280;
const ARRIVE_RADIUS = 26;
const SEPARATION_RADIUS = 12;
const SEPARATION_RADIUS_SQ = SEPARATION_RADIUS * SEPARATION_RADIUS;
const SEPARATION_WEIGHT = 130;
const ROTATE_SPEED = 2.8;
const REAR_FLANK_RADIUS_SQ = 235 * 235;
const EDGE_PADDING = 36;

interface SquadOptions {
  id: number;
  team: TeamId;
  color: number;
  initialAnchor: Vec2;
  facing: number;
  soldierCount: number;
  unitLayer: Container;
  overlayLayer: Container;
}

export interface SquadUpdateContext {
  dt: number;
  simTime: number;
  world: WorldBounds;
  allSquads: readonly Squad[];
}

export class Squad {
  readonly id: number;
  readonly team: TeamId;
  readonly color: number;
  readonly soldiers: Soldier[] = [];
  readonly initialSize: number;
  readonly anchor: Vec2;
  readonly anchorVelocity = new Vec2();
  readonly holdAnchor = new Vec2();
  readonly waypoints: Waypoint[] = [];

  formation: FormationType = 'line';
  order: OrderMode = 'hold';
  facing: number;
  morale = 100;
  casualties = 0;
  isSelected = false;

  private lastCasualties = 0;
  private desiredFacing: number | null = null;
  private reachedMapEdge = false;
  private chargeTarget: Squad | null = null;

  private readonly slotTemp = new Vec2();
  private readonly worldSlotTemp = new Vec2();
  private readonly selectionOutline: Graphics;
  private readonly label: Text;

  constructor(options: SquadOptions) {
    this.id = options.id;
    this.team = options.team;
    this.color = options.color;
    this.anchor = options.initialAnchor.clone();
    this.holdAnchor.copy(this.anchor);
    this.facing = options.facing;
    this.initialSize = options.soldierCount;

    this.selectionOutline = new Graphics();
    this.selectionOutline.visible = false;
    options.overlayLayer.addChild(this.selectionOutline);

    this.label = new Text({
      text: '',
      style: {
        fill: 0xf2f7ff,
        fontFamily: 'monospace',
        fontSize: 11,
      },
    });
    this.label.anchor.set(0.5, 1);
    this.label.visible = false;
    options.overlayLayer.addChild(this.label);

    for (let i = 0; i < options.soldierCount; i += 1) {
      this.getSlotWorldForIndex(i, this.worldSlotTemp);
      const soldier = new Soldier({
        id: this.id * 1000 + i,
        squad: this,
        team: this.team,
        slotIndex: i,
        color: this.color,
        initialPosition: this.worldSlotTemp,
      });
      this.soldiers.push(soldier);
      options.unitLayer.addChild(soldier.sprite);
    }
  }

  hasLivingSoldiers(): boolean {
    for (let i = 0; i < this.soldiers.length; i += 1) {
      if (this.soldiers[i].alive) {
        return true;
      }
    }
    return false;
  }

  aliveCount(): number {
    let count = 0;
    for (let i = 0; i < this.soldiers.length; i += 1) {
      if (this.soldiers[i].alive) {
        count += 1;
      }
    }
    return count;
  }

  setSelected(selected: boolean): void {
    this.isSelected = selected;
    if (!selected) {
      this.selectionOutline.visible = false;
      this.label.visible = false;
    }
  }

  setFormation(formation: FormationType): void {
    this.formation = formation;
  }

  issueMove(destination: Vec2, queue: boolean, facingOverride: number | null): void {
    if (!queue) {
      this.waypoints.length = 0;
    }

    this.waypoints.push({
      position: destination.clone(),
      facing: facingOverride,
    });

    this.order = 'move';
    this.reachedMapEdge = false;

    if (facingOverride !== null) {
      this.desiredFacing = facingOverride;
    }
  }

  holdPosition(): void {
    this.order = 'hold';
    this.waypoints.length = 0;
    this.holdAnchor.copy(this.anchor);
    this.anchorVelocity.scale(0.6);
    this.chargeTarget = null;
  }

  orderCharge(): void {
    this.order = 'charge';
    this.waypoints.length = 0;
    this.reachedMapEdge = false;
  }

  orderRetreat(world: WorldBounds): void {
    this.order = 'retreat';
    this.waypoints.length = 0;
    this.waypoints.push({
      position: this.computeRetreatPoint(world),
      facing: null,
    });
    this.reachedMapEdge = false;
    this.chargeTarget = null;
  }

  update(context: SquadUpdateContext): void {
    if (!this.hasLivingSoldiers()) {
      this.selectionOutline.visible = false;
      this.label.visible = false;
      return;
    }

    this.updateMorale(context);

    if (this.order !== 'rout' && this.morale < 25) {
      this.enterRout(context.world);
    }

    this.updateAnchorMotion(context);
    this.anchor.x = clamp(this.anchor.x, EDGE_PADDING, context.world.width - EDGE_PADDING);
    this.anchor.y = clamp(this.anchor.y, EDGE_PADDING, context.world.height - EDGE_PADDING);

    this.updateFacing(context.dt);
    this.updateSoldiers(context);
    this.updateSelectionOverlay();

    if (this.order === 'rout' && (this.morale > 35 || this.reachedMapEdge)) {
      this.holdPosition();
    }
  }

  private updateMorale(context: SquadUpdateContext): void {
    const alive = this.aliveCount();
    this.casualties = this.initialSize - alive;

    const casualtyDelta = this.casualties - this.lastCasualties;
    if (casualtyDelta > 0) {
      this.morale -= casualtyDelta * 2.8;
    }

    const flanked = this.isFlanked(context.allSquads);
    if (flanked) {
      this.morale -= 10 * context.dt;
    } else {
      this.morale += 2.6 * context.dt;
    }

    if (this.order === 'hold') {
      this.morale += 1.2 * context.dt;
    }

    if (this.order === 'rout') {
      this.morale += 1 * context.dt;
    }

    this.morale = clamp(this.morale, 0, 100);
    this.lastCasualties = this.casualties;
  }

  private isFlanked(allSquads: readonly Squad[]): boolean {
    const forwardX = Math.cos(this.facing);
    const forwardY = Math.sin(this.facing);

    for (let i = 0; i < allSquads.length; i += 1) {
      const other = allSquads[i];
      if (other === this || other.team === this.team || !other.hasLivingSoldiers()) {
        continue;
      }

      const dx = other.anchor.x - this.anchor.x;
      const dy = other.anchor.y - this.anchor.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > REAR_FLANK_RADIUS_SQ || distSq < 0.0001) {
        continue;
      }

      const invDist = 1 / Math.sqrt(distSq);
      const dot = (dx * invDist) * forwardX + (dy * invDist) * forwardY;
      if (dot < -0.25) {
        return true;
      }
    }

    return false;
  }

  private updateAnchorMotion(context: SquadUpdateContext): void {
    this.reachedMapEdge = this.atEdge(context.world);

    switch (this.order) {
      case 'hold': {
        this.chargeTarget = null;
        this.driveAnchorToward(this.holdAnchor, context.dt, ANCHOR_MAX_SPEED * 0.35);
        break;
      }
      case 'move':
      case 'retreat':
      case 'rout': {
        this.chargeTarget = null;
        this.followWaypoints(context);
        break;
      }
      case 'charge': {
        this.runCharge(context.dt, context.allSquads);
        break;
      }
    }

    this.reachedMapEdge = this.atEdge(context.world);
  }

  private followWaypoints(context: SquadUpdateContext): void {
    if (this.waypoints.length === 0) {
      if (this.order === 'move') {
        this.holdPosition();
        return;
      }

      if (this.order === 'retreat' || this.order === 'rout') {
        this.waypoints.push({
          position: this.computeRetreatPoint(context.world),
          facing: null,
        });
      }
    }

    if (this.waypoints.length === 0) {
      this.anchorVelocity.scale(0.8);
      return;
    }

    const waypoint = this.waypoints[0];
    const maxSpeed = this.order === 'rout' ? ANCHOR_MAX_SPEED_ROUT : ANCHOR_MAX_SPEED;
    this.driveAnchorToward(waypoint.position, context.dt, maxSpeed);

    const distSq = this.anchor.distanceSqTo(waypoint.position);
    if (distSq <= ARRIVE_RADIUS * ARRIVE_RADIUS) {
      if (waypoint.facing !== null) {
        this.desiredFacing = waypoint.facing;
      }
      this.waypoints.shift();

      if (this.order === 'move' && this.waypoints.length === 0) {
        this.holdPosition();
      }

      if (this.order === 'retreat' && this.waypoints.length === 0) {
        this.holdPosition();
      }
    }

    if ((this.order === 'retreat' || this.order === 'rout') && this.atEdge(context.world)) {
      this.reachedMapEdge = true;
      if (this.order === 'retreat') {
        this.holdPosition();
      }
    }
  }

  private runCharge(dt: number, allSquads: readonly Squad[]): void {
    const target = this.findNearestEnemy(allSquads);
    this.chargeTarget = target;

    if (target === null) {
      this.holdPosition();
      return;
    }

    const toTargetX = target.anchor.x - this.anchor.x;
    const toTargetY = target.anchor.y - this.anchor.y;
    this.desiredFacing = Math.atan2(toTargetY, toTargetX);
    this.driveAnchorToward(target.anchor, dt, ANCHOR_MAX_SPEED_CHARGE);
  }

  private findNearestEnemy(allSquads: readonly Squad[]): Squad | null {
    let nearest: Squad | null = null;
    let nearestDistSq = Number.POSITIVE_INFINITY;

    for (let i = 0; i < allSquads.length; i += 1) {
      const other = allSquads[i];
      if (other === this || other.team === this.team || !other.hasLivingSoldiers()) {
        continue;
      }

      const distSq = this.anchor.distanceSqTo(other.anchor);
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = other;
      }
    }

    return nearest;
  }

  private driveAnchorToward(target: Vec2, dt: number, maxSpeed: number): void {
    const dx = target.x - this.anchor.x;
    const dy = target.y - this.anchor.y;
    const dist = Math.hypot(dx, dy);

    let desiredVx = 0;
    let desiredVy = 0;
    if (dist > 0.0001) {
      let speed = maxSpeed;
      if (dist < ARRIVE_RADIUS * 3) {
        speed *= dist / (ARRIVE_RADIUS * 3);
      }
      desiredVx = (dx / dist) * speed;
      desiredVy = (dy / dist) * speed;
    }

    let steerX = desiredVx - this.anchorVelocity.x;
    let steerY = desiredVy - this.anchorVelocity.y;
    const steerLen = Math.hypot(steerX, steerY);
    const maxSteer = ANCHOR_MAX_ACCEL * dt;
    if (steerLen > maxSteer && steerLen > 0.0001) {
      const scale = maxSteer / steerLen;
      steerX *= scale;
      steerY *= scale;
    }

    this.anchorVelocity.x += steerX;
    this.anchorVelocity.y += steerY;

    const speed = this.anchorVelocity.len();
    if (speed > maxSpeed) {
      this.anchorVelocity.scale(maxSpeed / speed);
    }

    this.anchor.x += this.anchorVelocity.x * dt;
    this.anchor.y += this.anchorVelocity.y * dt;

    if (dist < 2) {
      this.anchorVelocity.x = damp(this.anchorVelocity.x, 0.7);
      this.anchorVelocity.y = damp(this.anchorVelocity.y, 0.7);
    }
  }

  private updateFacing(dt: number): void {
    if (this.desiredFacing !== null) {
      this.facing = rotateTowardAngle(this.facing, this.desiredFacing, ROTATE_SPEED * dt);
      if (Math.abs(shortestAngleDelta(this.facing, this.desiredFacing)) < 0.03) {
        this.desiredFacing = null;
      }
      return;
    }

    if (this.anchorVelocity.lenSq() > 36) {
      const velocityAngle = Math.atan2(this.anchorVelocity.y, this.anchorVelocity.x);
      this.facing = rotateTowardAngle(this.facing, velocityAngle, ROTATE_SPEED * dt);
    }
  }

  private updateSoldiers(context: SquadUpdateContext): void {
    const maxSpeed =
      this.order === 'rout'
        ? SOLDIER_MAX_SPEED_ROUT
        : this.order === 'charge'
          ? SOLDIER_MAX_SPEED_CHARGE
          : SOLDIER_MAX_SPEED;

    const chargeBiasX =
      this.chargeTarget !== null ? this.chargeTarget.anchor.x - this.anchor.x : Math.cos(this.facing);
    const chargeBiasY =
      this.chargeTarget !== null ? this.chargeTarget.anchor.y - this.anchor.y : Math.sin(this.facing);
    const chargeBiasLen = Math.hypot(chargeBiasX, chargeBiasY) || 1;
    const chargeDirX = chargeBiasX / chargeBiasLen;
    const chargeDirY = chargeBiasY / chargeBiasLen;

    for (let i = 0; i < this.soldiers.length; i += 1) {
      const soldier = this.soldiers[i];
      if (!soldier.alive) {
        continue;
      }

      this.getSlotWorldForIndex(soldier.slotIndex, this.worldSlotTemp);

      if (this.order === 'charge') {
        this.worldSlotTemp.x += chargeDirX * 16;
        this.worldSlotTemp.y += chargeDirY * 16;
        this.worldSlotTemp.x += Math.sin(context.simTime * 4 + soldier.jitterPhase) * 6;
        this.worldSlotTemp.y += Math.cos(context.simTime * 4 + soldier.jitterPhase * 1.37) * 6;
      }

      let separationX = 0;
      let separationY = 0;
      for (let j = 0; j < this.soldiers.length; j += 1) {
        if (i === j) {
          continue;
        }

        const other = this.soldiers[j];
        if (!other.alive) {
          continue;
        }

        const dx = soldier.position.x - other.position.x;
        const dy = soldier.position.y - other.position.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= 0.00001 || distSq >= SEPARATION_RADIUS_SQ) {
          continue;
        }

        const dist = Math.sqrt(distSq);
        const strength = (SEPARATION_RADIUS - dist) / SEPARATION_RADIUS;
        separationX += (dx / dist) * strength;
        separationY += (dy / dist) * strength;
      }

      const toTargetX = this.worldSlotTemp.x - soldier.position.x;
      const toTargetY = this.worldSlotTemp.y - soldier.position.y;
      const targetDist = Math.hypot(toTargetX, toTargetY);

      let desiredVx = 0;
      let desiredVy = 0;
      if (targetDist > 0.0001) {
        let desiredSpeed = maxSpeed;
        if (targetDist < 24) {
          desiredSpeed *= targetDist / 24;
        }

        desiredVx = (toTargetX / targetDist) * desiredSpeed;
        desiredVy = (toTargetY / targetDist) * desiredSpeed;
      }

      let accelX = desiredVx - soldier.velocity.x + separationX * SEPARATION_WEIGHT;
      let accelY = desiredVy - soldier.velocity.y + separationY * SEPARATION_WEIGHT;
      const accelLen = Math.hypot(accelX, accelY);
      const accelLimit = SOLDIER_MAX_ACCEL * context.dt;
      if (accelLen > accelLimit && accelLen > 0.0001) {
        const scale = accelLimit / accelLen;
        accelX *= scale;
        accelY *= scale;
      }

      soldier.velocity.x += accelX;
      soldier.velocity.y += accelY;

      const velocityLen = soldier.velocity.len();
      if (velocityLen > maxSpeed) {
        soldier.velocity.scale(maxSpeed / velocityLen);
      }

      soldier.position.x += soldier.velocity.x * context.dt;
      soldier.position.y += soldier.velocity.y * context.dt;
      soldier.position.x = clamp(soldier.position.x, EDGE_PADDING, context.world.width - EDGE_PADDING);
      soldier.position.y = clamp(soldier.position.y, EDGE_PADDING, context.world.height - EDGE_PADDING);

      soldier.syncGraphics();
    }
  }

  private updateSelectionOverlay(): void {
    if (!this.isSelected || !this.hasLivingSoldiers()) {
      this.selectionOutline.visible = false;
      this.label.visible = false;
      return;
    }

    const radius = estimateFormationRadius(this.formation, this.initialSize);
    this.selectionOutline.visible = true;
    this.selectionOutline.clear();
    this.selectionOutline.circle(this.anchor.x, this.anchor.y, radius);
    this.selectionOutline.stroke({
      color: 0xffea8a,
      alpha: 0.9,
      width: 2,
    });

    this.label.visible = true;
    this.label.text = `S${this.id}  ${Math.round(this.morale)}%`;
    this.label.position.set(this.anchor.x, this.anchor.y - radius - 8);
  }

  private getSlotWorldForIndex(slotIndex: number, out: Vec2): Vec2 {
    computeSlotLocal(this.formation, slotIndex, this.initialSize, this.slotTemp);

    const rightX = -Math.sin(this.facing);
    const rightY = Math.cos(this.facing);
    const forwardX = Math.cos(this.facing);
    const forwardY = Math.sin(this.facing);

    out.x = this.anchor.x + rightX * this.slotTemp.x + forwardX * this.slotTemp.y;
    out.y = this.anchor.y + rightY * this.slotTemp.x + forwardY * this.slotTemp.y;
    return out;
  }

  private enterRout(world: WorldBounds): void {
    this.order = 'rout';
    this.waypoints.length = 0;
    this.waypoints.push({
      position: this.computeRetreatPoint(world),
      facing: null,
    });
    this.reachedMapEdge = false;
    this.chargeTarget = null;
  }

  private computeRetreatPoint(world: WorldBounds): Vec2 {
    const retreatX = this.team === TeamId.Blue ? EDGE_PADDING : world.width - EDGE_PADDING;
    return new Vec2(retreatX, clamp(this.anchor.y, EDGE_PADDING, world.height - EDGE_PADDING));
  }

  private atEdge(world: WorldBounds): boolean {
    return (
      this.anchor.x <= EDGE_PADDING ||
      this.anchor.x >= world.width - EDGE_PADDING ||
      this.anchor.y <= EDGE_PADDING ||
      this.anchor.y >= world.height - EDGE_PADDING
    );
  }
}
