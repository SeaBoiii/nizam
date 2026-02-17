import { Container, Graphics, Text } from 'pixi.js';
import { clamp, damp, rotateTowardAngle, shortestAngleDelta } from '../utils/math';
import { Vec2 } from '../utils/vec2';
import type { GameEvents } from './events/GameEvents';
import { computeSlotLocal, estimateFormationRadius } from './Formation';
import { BattleMapState } from './map/MapState';
import { FlowField } from './nav/FlowField';
import { NavGrid } from './nav/NavGrid';
import { skirmishThreatRange } from './orders/RangedOrders';
import { DEFAULT_PERK_MODS, type CombinedPerkMods } from './rules/PerkMods';
import { TerrainMods } from './rules/TerrainMods';
import type { Waypoint } from './Orders';
import { SKIRMISH_ADVANCE_SPEED_FACTOR, SKIRMISH_RETREAT_DISTANCE, SKIRMISH_RETREAT_SPEED_FACTOR } from './rules/Constants';
import { Soldier, SOLDIER_RADIUS } from './Soldier';
import { TeamId, type FormationType, type OrderMode, type WorldBounds } from './types';
import type { UnitArchetype } from './types/UnitArchetype';

const ANCHOR_ACCEL = 210;
const ANCHOR_CHARGE_SPEED_BONUS = 1.14;
const ANCHOR_ROUT_SPEED_BONUS = 1.32;
const SOLDIER_ACCEL_BASE = 280;
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
  archetype: UnitArchetype;
  unitLayer: Container;
  overlayLayer: Container;
  commandable?: boolean;
  perkMods?: Readonly<CombinedPerkMods>;
  events?: GameEvents;
  flowField?: FlowField;
  navGrid?: NavGrid;
  terrainMods?: TerrainMods;
}

export interface SquadUpdateContext {
  dt: number;
  simTime: number;
  world: WorldBounds;
  objectivePosition: Vec2;
  allSquads: readonly Squad[];
  mapState: BattleMapState;
  navGrid: NavGrid;
  terrainMods: TerrainMods;
}

export class Squad {
  readonly id: number;
  readonly team: TeamId;
  readonly color: number;
  readonly archetype: UnitArchetype;
  readonly soldiers: Soldier[] = [];
  readonly initialSize: number;
  readonly commandable: boolean;
  readonly perkMods: Readonly<CombinedPerkMods>;
  readonly events: GameEvents | null;
  readonly flowField: FlowField | null;
  readonly navGrid: NavGrid | null;
  readonly terrainMods: TerrainMods | null;
  readonly anchor: Vec2;
  readonly anchorVelocity = new Vec2();
  readonly holdAnchor = new Vec2();
  readonly waypoints: Waypoint[] = [];
  
  // Performance: Use index pointer instead of shift() to avoid O(n) array operations
  private waypointIndex = 0;

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
  private suppressionWindowTimer = 0;
  private suppressionAppliedThisWindow = 0;
  private suppressedTimer = 0;
  private abilityMoraleLossMult = 1;
  private rallyTimer = 0;
  
  // Performance: Cache flanked state to avoid O(n) check every frame
  private cachedFlankedState = false;
  private flankedCheckTimer = 0;
  private static readonly FLANKED_CHECK_INTERVAL = 0.5; // Check every 0.5 seconds

  private readonly slotTemp = new Vec2();
  private readonly worldSlotTemp = new Vec2();
  private readonly steerTargetTemp = new Vec2();
  private readonly flowDirTemp = new Vec2();
  private readonly selectionOutline: Graphics;
  private readonly label: Text;

  constructor(options: SquadOptions) {
    this.id = options.id;
    this.team = options.team;
    this.color = options.color;
    this.archetype = options.archetype;
    this.anchor = options.initialAnchor.clone();
    this.holdAnchor.copy(this.anchor);
    this.facing = options.facing;
    this.initialSize = options.soldierCount;
    this.commandable = options.commandable ?? true;
    this.perkMods = options.perkMods ?? DEFAULT_PERK_MODS;
    this.events = options.events ?? null;
    this.flowField = options.flowField ?? null;
    this.navGrid = options.navGrid ?? null;
    this.terrainMods = options.terrainMods ?? null;

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
        archetype: this.archetype,
      });
      this.soldiers.push(soldier);
      options.unitLayer.addChild(soldier.sprite);
    }

    this.updateLabel(0);
  }

  destroy(): void {
    for (let i = 0; i < this.soldiers.length; i += 1) {
      const soldier = this.soldiers[i];
      soldier.sprite.destroy();
    }
    this.soldiers.length = 0;

    this.selectionOutline.destroy();
    this.label.destroy();
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
    }
  }

  setFormation(formation: FormationType): void {
    this.formation = formation;
  }

  issueMove(destination: Vec2, queue: boolean, facingOverride: number | null): void {
    if (!queue) {
      this.waypoints.length = 0;
      this.waypointIndex = 0;
    }

    this.waypoints.push({
      position: destination.clone(),
      facing: facingOverride,
    });

    this.order = 'move';
    this.reachedMapEdge = false;
    this.chargeTarget = null;

    if (facingOverride !== null) {
      this.desiredFacing = facingOverride;
    }
  }

  holdPosition(): void {
    this.order = 'hold';
    this.waypoints.length = 0;
    this.waypointIndex = 0;
    this.holdAnchor.copy(this.anchor);
    this.anchorVelocity.scale(0.6);
    this.chargeTarget = null;
  }

  orderCharge(): void {
    this.order = 'charge';
    this.waypoints.length = 0;
    this.waypointIndex = 0;
    this.reachedMapEdge = false;
  }

  orderRetreat(world: WorldBounds): void {
    this.order = 'retreat';
    this.waypoints.length = 0;
    this.waypointIndex = 0;
    this.waypoints.push({
      position: this.computeRetreatPoint(world),
      facing: null,
    });
    this.reachedMapEdge = false;
    this.chargeTarget = null;
  }

  orderVolley(): void {
    this.order = 'volley';
    this.waypoints.length = 0;
    this.waypointIndex = 0;
    this.holdAnchor.copy(this.anchor);
    this.anchorVelocity.scale(0.6);
    this.chargeTarget = null;
  }

  orderSkirmish(): void {
    this.order = 'skirmish';
    this.waypoints.length = 0;
    this.waypointIndex = 0;
    this.holdAnchor.copy(this.anchor);
    this.chargeTarget = null;
  }

  isChargingOrder(): boolean {
    return this.order === 'charge';
  }

  getChargeTarget(): Squad | null {
    return this.chargeTarget;
  }

  update(context: SquadUpdateContext): void {
    if (!this.hasLivingSoldiers()) {
      this.selectionOutline.visible = false;
      this.label.visible = false;
      return;
    }
    this.tickSuppression(context.dt);
    this.tickRally(context.dt);

    const usesMorale = !this.archetype.tags.includes('caravan');
    if (usesMorale) {
      this.updateMorale(context);
    } else {
      this.morale = 100;
    }

    const routThreshold = clamp(25 + this.perkMods.routThresholdAdd, 5, 95);
    if (usesMorale && this.order !== 'rout' && this.morale < routThreshold) {
      this.enterRout(context.world);
    }

    this.updateAnchorMotion(context);
    this.anchor.x = clamp(this.anchor.x, EDGE_PADDING, context.world.width - EDGE_PADDING);
    this.anchor.y = clamp(this.anchor.y, EDGE_PADDING, context.world.height - EDGE_PADDING);
    if (context.mapState.pushOutOfObstacles(this.anchor, 16)) {
      this.anchorVelocity.scale(0.72);
    }

    this.updateFacing(context.dt);
    this.updateSoldiers(context);
    this.updateSelectionOverlay();

    const recoverThreshold = clamp(35 + this.perkMods.routThresholdAdd, 10, 100);
    if (usesMorale && this.order === 'rout' && (this.morale > recoverThreshold || this.reachedMapEdge)) {
      this.holdPosition();
    }
  }

  private updateMorale(context: SquadUpdateContext): void {
    const moraleRegenMult = Math.max(0.1, this.perkMods.moraleRegenMult);
    const moraleLossMult = Math.max(0.1, this.perkMods.moraleLossMult * this.abilityMoraleLossMult);

    const alive = this.aliveCount();
    this.casualties = this.initialSize - alive;

    const casualtyDelta = this.casualties - this.lastCasualties;
    if (casualtyDelta > 0) {
      this.morale -= casualtyDelta * 2.8 * moraleLossMult;
    }

    // Performance: Only check flanked state periodically, not every frame
    this.flankedCheckTimer += context.dt;
    if (this.flankedCheckTimer >= Squad.FLANKED_CHECK_INTERVAL) {
      this.flankedCheckTimer = 0;
      this.cachedFlankedState = this.isFlanked(context.allSquads);
    }
    
    if (this.cachedFlankedState) {
      this.morale -= 10 * context.dt * moraleLossMult;
    } else {
      this.morale += 2.6 * context.dt * moraleRegenMult;
    }

    if (this.order === 'hold') {
      this.morale += 1.2 * context.dt * moraleRegenMult;
    }

    if (this.order === 'rout') {
      this.morale += 1 * context.dt * moraleRegenMult;
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
        this.driveAnchorToward(this.holdAnchor, context, this.perkedMoveSpeed(this.archetype.stats.moveSpeed * 0.35));
        break;
      }
      case 'volley': {
        this.chargeTarget = null;
        this.driveAnchorToward(this.holdAnchor, context, this.perkedMoveSpeed(this.archetype.stats.moveSpeed * 0.3));
        break;
      }
      case 'skirmish': {
        this.runSkirmish(context);
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
        this.runCharge(context);
        break;
      }
    }

    this.reachedMapEdge = this.atEdge(context.world);
  }

  private followWaypoints(context: SquadUpdateContext): void {
    const activeWaypointsRemaining = this.waypoints.length - this.waypointIndex;
    
    if (activeWaypointsRemaining === 0) {
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

    if (this.waypoints.length - this.waypointIndex === 0) {
      this.anchorVelocity.scale(0.8);
      return;
    }

    const waypoint = this.waypoints[this.waypointIndex];
    const maxSpeed =
      this.order === 'rout'
        ? this.perkedMoveSpeed(this.archetype.stats.moveSpeed * ANCHOR_ROUT_SPEED_BONUS)
        : this.perkedMoveSpeed(this.archetype.stats.moveSpeed);
    this.driveAnchorToward(waypoint.position, context, maxSpeed);

    const distSq = this.anchor.distanceSqTo(waypoint.position);
    if (distSq <= ARRIVE_RADIUS * ARRIVE_RADIUS) {
      if (waypoint.facing !== null) {
        this.desiredFacing = waypoint.facing;
      }
      // Performance: Use index instead of shift() to avoid O(n) array operation
      this.waypointIndex += 1;

      if (this.order === 'move' && this.waypoints.length - this.waypointIndex === 0) {
        this.holdPosition();
      }

      if (this.order === 'retreat' && this.waypoints.length - this.waypointIndex === 0) {
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

  private runCharge(context: SquadUpdateContext): void {
    const target = this.findNearestEnemy(context.allSquads);
    this.chargeTarget = target;

    if (target === null) {
      this.holdPosition();
      return;
    }

    const toTargetX = target.anchor.x - this.anchor.x;
    const toTargetY = target.anchor.y - this.anchor.y;
    this.desiredFacing = Math.atan2(toTargetY, toTargetX);
    this.driveAnchorToward(target.anchor, context, this.perkedMoveSpeed(this.archetype.stats.moveSpeed * ANCHOR_CHARGE_SPEED_BONUS));
  }

  private runSkirmish(context: SquadUpdateContext): void {
    const target = this.findNearestEnemy(context.allSquads);
    this.chargeTarget = target;

    const moveSpeed = this.perkedMoveSpeed(this.archetype.stats.moveSpeed);
    if (target === null) {
      this.driveAnchorToward(context.objectivePosition, context, moveSpeed * SKIRMISH_ADVANCE_SPEED_FACTOR);
      return;
    }

    const toTargetX = target.anchor.x - this.anchor.x;
    const toTargetY = target.anchor.y - this.anchor.y;
    const targetDist = Math.hypot(toTargetX, toTargetY);
    if (targetDist <= 0.0001) {
      this.anchorVelocity.scale(0.85);
      return;
    }

    this.desiredFacing = Math.atan2(toTargetY, toTargetX);

    const rangedRange = Math.max(130, this.archetype.stats.rangedRange);
    const threatRange = skirmishThreatRange(rangedRange, this.archetype.tags.includes('slinger') ? 0.55 : undefined);
    if (targetDist < threatRange) {
      const invDist = 1 / targetDist;
      this.steerTargetTemp.set(
        this.anchor.x - toTargetX * invDist * SKIRMISH_RETREAT_DISTANCE,
        this.anchor.y - toTargetY * invDist * SKIRMISH_RETREAT_DISTANCE,
      );
      this.driveAnchorToward(this.steerTargetTemp, context, moveSpeed * SKIRMISH_RETREAT_SPEED_FACTOR);
      return;
    }

    this.driveAnchorToward(context.objectivePosition, context, moveSpeed * SKIRMISH_ADVANCE_SPEED_FACTOR);
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

  private findNearestEnemyToPoint(point: Vec2, allSquads: readonly Squad[]): Squad | null {
    let nearest: Squad | null = null;
    let nearestDistSq = Number.POSITIVE_INFINITY;

    for (let i = 0; i < allSquads.length; i += 1) {
      const other = allSquads[i];
      if (other.team === this.team || !other.hasLivingSoldiers()) {
        continue;
      }

      const dx = other.anchor.x - point.x;
      const dy = other.anchor.y - point.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = other;
      }
    }

    return nearest;
  }

  private driveAnchorToward(target: Vec2, context: SquadUpdateContext, maxSpeedBase: number): void {
    const dt = context.dt;
    const dx = target.x - this.anchor.x;
    const dy = target.y - this.anchor.y;
    const dist = Math.hypot(dx, dy);

    const terrainSpeedMult = this.terrainMods ? this.terrainMods.getMoveSpeedMult(this.anchor) : 1;
    const maxSpeed = maxSpeedBase * terrainSpeedMult;

    let flowX = 0;
    let flowY = 0;
    if (this.flowField !== null && this.navGrid !== null) {
      this.flowField.updateTarget(target.x, target.y, context.simTime);
      if (this.flowField.getDirectionAt(this.anchor.x, this.anchor.y, this.flowDirTemp)) {
        flowX = this.flowDirTemp.x;
        flowY = this.flowDirTemp.y;
      }
    }

    let desiredVx = 0;
    let desiredVy = 0;
    if (dist > 0.0001) {
      let speed = maxSpeed;
      if (dist < ARRIVE_RADIUS * 3) {
        speed *= dist / (ARRIVE_RADIUS * 3);
      }
      let dirX = dx / dist;
      let dirY = dy / dist;

      if (flowX * flowX + flowY * flowY > 0.0001) {
        const lineBlocked = context.mapState.isLineBlocked(this.anchor.x, this.anchor.y, target.x, target.y);
        const flowWeight = lineBlocked ? 0.7 : 0.32;
        dirX = dirX * (1 - flowWeight) + flowX * flowWeight;
        dirY = dirY * (1 - flowWeight) + flowY * flowWeight;
        const dirLen = Math.hypot(dirX, dirY);
        if (dirLen > 0.0001) {
          dirX /= dirLen;
          dirY /= dirLen;
        }
      }

      desiredVx = dirX * speed;
      desiredVy = dirY * speed;
    }

    let steerX = desiredVx - this.anchorVelocity.x;
    let steerY = desiredVy - this.anchorVelocity.y;
    const steerLen = Math.hypot(steerX, steerY);
    const maxSteer = ANCHOR_ACCEL * dt;
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
    const chargeOrder = this.order === 'charge';
    const skirmishOrder = this.order === 'skirmish';
    const slotScale =
      (chargeOrder ? 1.2 : skirmishOrder ? 1.08 : 1) * Math.max(0.65, this.perkMods.formationSpacingMult);
    const cohesionMult = Math.max(0.45, this.perkMods.cohesionMult);
    const separationWeight = chargeOrder
      ? (SEPARATION_WEIGHT * 0.8) / cohesionMult
      : skirmishOrder
        ? (SEPARATION_WEIGHT * 0.95) / cohesionMult
        : SEPARATION_WEIGHT / cohesionMult;

    for (let i = 0; i < this.soldiers.length; i += 1) {
      const soldier = this.soldiers[i];
      if (!soldier.alive) {
        continue;
      }

      this.getSlotWorldForIndex(soldier.slotIndex, this.worldSlotTemp, slotScale);
      let targetX = this.worldSlotTemp.x;
      let targetY = this.worldSlotTemp.y;
      let flowX = 0;
      let flowY = 0;
      if (this.flowField !== null && this.flowField.getDirectionAt(soldier.position.x, soldier.position.y, this.flowDirTemp)) {
        flowX = this.flowDirTemp.x;
        flowY = this.flowDirTemp.y;
      }

      if (chargeOrder) {
        const enemySquad = this.findNearestEnemyToPoint(soldier.position, context.allSquads) ?? this.chargeTarget;
        if (enemySquad !== null) {
          const chaseX = enemySquad.anchor.x - soldier.position.x;
          const chaseY = enemySquad.anchor.y - soldier.position.y;
          const chaseLen = Math.hypot(chaseX, chaseY);
          if (chaseLen > 0.0001) {
            const dirX = chaseX / chaseLen;
            const dirY = chaseY / chaseLen;
            const pursuitX = soldier.position.x + dirX * 42;
            const pursuitY = soldier.position.y + dirY * 42;
            targetX = targetX * 0.55 + pursuitX * 0.45;
            targetY = targetY * 0.55 + pursuitY * 0.45;
          }
        }

        targetX += Math.sin(context.simTime * 4 + soldier.jitterPhase) * 3;
        targetY += Math.cos(context.simTime * 4 + soldier.jitterPhase * 1.37) * 3;
      }

      let lineBlockedToSlot = context.mapState.isBlocked(targetX, targetY, SOLDIER_RADIUS + 1);
      if (!lineBlockedToSlot && ((i + Math.floor(context.simTime * 60)) & 3) === 0) {
        lineBlockedToSlot = context.mapState.isLineBlocked(soldier.position.x, soldier.position.y, targetX, targetY);
      }
      if (lineBlockedToSlot && (flowX * flowX + flowY * flowY > 0.0001)) {
        targetX += flowX * 28;
        targetY += flowY * 28;
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

      const toTargetX = targetX - soldier.position.x;
      const toTargetY = targetY - soldier.position.y;
      const targetDist = Math.hypot(toTargetX, toTargetY);

      let moveSpeed = this.perkedMoveSpeed(soldier.baseStats.moveSpeed);
      if (this.terrainMods !== null) {
        moveSpeed *= this.terrainMods.getMoveSpeedMult(soldier.position);
      }
      if (this.order === 'charge') {
        moveSpeed *= 1.1;
      } else if (this.order === 'rout') {
        moveSpeed *= 1.22;
      } else if (this.order === 'skirmish') {
        moveSpeed *= 1.02;
      }

      let desiredVx = 0;
      let desiredVy = 0;
      if (targetDist > 0.0001) {
        let desiredSpeed = moveSpeed;
        if (targetDist < 24) {
          desiredSpeed *= targetDist / 24;
        }
        let dirX = toTargetX / targetDist;
        let dirY = toTargetY / targetDist;
        if (flowX * flowX + flowY * flowY > 0.0001) {
          const flowWeight = lineBlockedToSlot ? 0.65 : 0.2;
          dirX = dirX * (1 - flowWeight) + flowX * flowWeight;
          dirY = dirY * (1 - flowWeight) + flowY * flowWeight;
          const dirLen = Math.hypot(dirX, dirY);
          if (dirLen > 0.0001) {
            dirX /= dirLen;
            dirY /= dirLen;
          }
        }

        desiredVx = dirX * desiredSpeed;
        desiredVy = dirY * desiredSpeed;
      }

      let accelX = desiredVx - soldier.velocity.x + separationX * separationWeight + flowX * 24;
      let accelY = desiredVy - soldier.velocity.y + separationY * separationWeight + flowY * 24;
      const accelLen = Math.hypot(accelX, accelY);
      const accelLimit = (SOLDIER_ACCEL_BASE / soldier.mass) * cohesionMult * context.dt;
      if (accelLen > accelLimit && accelLen > 0.0001) {
        const scale = accelLimit / accelLen;
        accelX *= scale;
        accelY *= scale;
      }

      soldier.velocity.x += accelX;
      soldier.velocity.y += accelY;

      const velocityLen = soldier.velocity.len();
      if (velocityLen > moveSpeed) {
        soldier.velocity.scale(moveSpeed / velocityLen);
      }

      soldier.position.x += soldier.velocity.x * context.dt;
      soldier.position.y += soldier.velocity.y * context.dt;
      soldier.position.x = clamp(soldier.position.x, EDGE_PADDING, context.world.width - EDGE_PADDING);
      soldier.position.y = clamp(soldier.position.y, EDGE_PADDING, context.world.height - EDGE_PADDING);
      if (context.mapState.pushOutOfObstacles(soldier.position, SOLDIER_RADIUS + 0.3)) {
        soldier.velocity.scale(0.7);
      }

      soldier.syncGraphics();
    }
  }

  private updateSelectionOverlay(): void {
    if (!this.hasLivingSoldiers()) {
      this.selectionOutline.visible = false;
      this.label.visible = false;
      return;
    }

    const radius = estimateFormationRadius(this.formation, this.initialSize);
    if (this.isSelected) {
      this.selectionOutline.visible = true;
      this.selectionOutline.clear();
      this.selectionOutline.circle(this.anchor.x, this.anchor.y, radius);
      this.selectionOutline.stroke({
        color: 0xffea8a,
        alpha: 0.9,
        width: 2,
      });
    } else {
      this.selectionOutline.visible = false;
    }

    this.updateLabel(radius);
  }

  private updateLabel(radius: number): void {
    this.label.visible = true;
    this.label.alpha = this.isSelected ? 1 : 0.76;
    this.label.text = `S${this.id} ${this.archetype.name} ${Math.round(this.morale)}%${
      this.isSuppressed() ? ' SUPPRESSED' : ''
    }${this.isRallyActive() ? ' RALLY' : ''}`;
    this.label.position.set(this.anchor.x, this.anchor.y - radius - 8);
  }

  applyMoraleBoost(amount: number): void {
    if (this.archetype.tags.includes('caravan')) {
      return;
    }
    this.morale = clamp(this.morale + Math.max(0, amount), 0, 100);
  }

  setAbilityMoraleLossMult(mult: number): void {
    this.abilityMoraleLossMult = clamp(mult, 0.1, 2.5);
  }

  showRallyIndicator(durationSec: number): void {
    this.rallyTimer = Math.max(this.rallyTimer, Math.max(0, durationSec));
  }

  applySuppression(amount: number, maxPerSecond: number): number {
    if (this.archetype.tags.includes('caravan')) {
      return 0;
    }

    const clampedAmount = Math.max(0, amount);
    const allowed = Math.max(0, maxPerSecond - this.suppressionAppliedThisWindow);
    const applied = Math.min(clampedAmount, allowed);
    if (applied <= 0) {
      return 0;
    }

    this.suppressionAppliedThisWindow += applied;
    this.morale = clamp(this.morale - applied, 0, 100);
    this.suppressedTimer = Math.max(this.suppressedTimer, 1.5);
    return applied;
  }

  isSuppressed(): boolean {
    return this.suppressedTimer > 0;
  }

  private tickSuppression(dt: number): void {
    this.suppressionWindowTimer += dt;
    if (this.suppressionWindowTimer >= 1) {
      this.suppressionWindowTimer -= Math.floor(this.suppressionWindowTimer);
      this.suppressionAppliedThisWindow = 0;
    }
    this.suppressedTimer = Math.max(0, this.suppressedTimer - dt);
  }

  private tickRally(dt: number): void {
    this.rallyTimer = Math.max(0, this.rallyTimer - dt);
  }

  private isRallyActive(): boolean {
    return this.rallyTimer > 0;
  }

  private perkedMoveSpeed(baseSpeed: number): number {
    return baseSpeed * Math.max(0.5, this.perkMods.moveSpeedMult);
  }

  private getSlotWorldForIndex(slotIndex: number, out: Vec2, slotScale = 1): Vec2 {
    computeSlotLocal(this.formation, slotIndex, this.initialSize, this.slotTemp);
    this.slotTemp.scale(slotScale);

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
    this.waypointIndex = 0;
    this.waypoints.push({
      position: this.computeRetreatPoint(world),
      facing: null,
    });
    this.reachedMapEdge = false;
    this.chargeTarget = null;
    if (this.events !== null) {
      this.events.emitSquadRouted(this.team, this.id, this.anchor.x, this.anchor.y);
    }
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
