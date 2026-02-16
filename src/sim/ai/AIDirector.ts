import { Vec2 } from '../../utils/vec2';
import { BattleMapState } from '../map/MapState';
import { NavGrid } from '../nav/NavGrid';
import { TeamId, type WorldBounds } from '../types';
import type { Squad } from '../Squad';
import type { ObjectiveTacticalState } from '../objectives/IObjective';
import {
  computeFlankPoint,
  distanceSq,
  findRoutingEnemy,
  livingTeamSquads,
  nearestEnemyByRole,
  nearestEnemySquad,
  objectiveAnchor,
  squadRole,
} from './Tactics';

const BASE_AI_ORDER_INTERVAL = 1;
const CLOSE_TO_POINT_SQ = 70 * 70;

interface AIDirectorContext {
  world: WorldBounds;
  squads: readonly Squad[];
  objective: ObjectiveTacticalState;
  mapState: BattleMapState;
  navGrid: NavGrid;
}

export class AIDirector {
  private decisionTimer = 0;
  private orderFrequencyMult = 1;

  private readonly enemySquads: Squad[] = [];
  private readonly playerSquads: Squad[] = [];
  private readonly archerGuards: Squad[] = [];
  private readonly flankPoint = new Vec2();
  private readonly protectPoint = new Vec2();
  private readonly hillPoint = new Vec2();
  private readonly siegeTargetPoint = new Vec2();
  private readonly commandMemory = new Map<number, string>();

  update(dt: number, context: AIDirectorContext): void {
    this.decisionTimer -= dt;
    if (this.decisionTimer > 0) {
      return;
    }
    this.decisionTimer = BASE_AI_ORDER_INTERVAL / this.orderFrequencyMult;

    livingTeamSquads(context.squads, TeamId.Red, this.enemySquads);
    livingTeamSquads(context.squads, TeamId.Blue, this.playerSquads);

    if (this.enemySquads.length === 0 || this.playerSquads.length === 0) {
      return;
    }

    this.archerGuards.length = 0;
    for (let i = 0; i < this.enemySquads.length; i += 1) {
      if (squadRole(this.enemySquads[i]) === 'ARCHER') {
        this.archerGuards.push(this.enemySquads[i]);
      }
    }

    const objectiveType = context.objective.type;
    const objectivePoint = objectiveAnchor(context.objective);
    const routingEnemy = findRoutingEnemy(this.playerSquads);

    const assassinSquad = this.pickAssassinSquad();

    for (let i = 0; i < this.enemySquads.length; i += 1) {
      const squad = this.enemySquads[i];
      if (!squad.hasLivingSoldiers() || squad.order === 'rout') {
        continue;
      }

      const role = squadRole(squad);
      const nearestEnemy = nearestEnemySquad(squad, this.playerSquads);
      if (nearestEnemy === null) {
        continue;
      }

      if (objectiveType === 'CAPTURE') {
        this.runCaptureTactic(squad, role, nearestEnemy, objectivePoint, context);
      } else if (objectiveType === 'ASSASSINATE') {
        this.runAssassinateTactic(squad, role, nearestEnemy, assassinSquad, context.objective, context);
      } else if (objectiveType === 'HOLDOUT') {
        this.runHoldoutTactic(squad, role, nearestEnemy, context);
      } else if (objectiveType === 'SIEGE') {
        this.runSiegeTactic(squad, role, nearestEnemy, context.objective, context);
      } else {
        this.runEscortTactic(squad, role, nearestEnemy, context.objective, context);
      }

      if (routingEnemy !== null && role === 'CAVALRY') {
        this.commandCharge(squad);
        this.commandMove(squad, routingEnemy.anchor, null);
      }
    }
  }

  private pickAssassinSquad(): Squad | null {
    let fallbackInfantry: Squad | null = null;
    for (let i = 0; i < this.enemySquads.length; i += 1) {
      const squad = this.enemySquads[i];
      const role = squadRole(squad);
      if (role === 'CAVALRY') {
        return squad;
      }
      if (role === 'INFANTRY' && fallbackInfantry === null) {
        fallbackInfantry = squad;
      }
    }
    return fallbackInfantry ?? (this.enemySquads.length > 0 ? this.enemySquads[0] : null);
  }

  private runCaptureTactic(
    squad: Squad,
    role: ReturnType<typeof squadRole>,
    nearestEnemy: Squad,
    objectivePoint: Vec2,
    context: AIDirectorContext,
  ): void {
    if (role === 'INFANTRY') {
      if (distanceSq(squad.anchor, objectivePoint) < CLOSE_TO_POINT_SQ) {
        this.commandHold(squad);
      } else {
        this.commandMove(squad, objectivePoint, this.angleTo(nearestEnemy.anchor, squad.anchor));
      }
      return;
    }

    if (role === 'SPEAR') {
      const protector = this.closestArcherAnchor(squad);
      if (protector !== null) {
        this.protectPoint.x = protector.x - 64;
        this.protectPoint.y = protector.y;
        if (distanceSq(squad.anchor, this.protectPoint) < 90 * 90) {
          this.commandHold(squad);
        } else {
          this.commandMove(squad, this.protectPoint, this.angleTo(nearestEnemy.anchor, squad.anchor));
        }
      } else {
        this.commandMove(squad, objectivePoint, this.angleTo(nearestEnemy.anchor, squad.anchor));
      }
      return;
    }

    if (role === 'ARCHER') {
      const foundHill = context.mapState.getNearestHillCenter(squad.anchor, this.hillPoint);
      if (
        foundHill &&
        !context.mapState.isInForest(squad.anchor.x, squad.anchor.y) &&
        distanceSq(squad.anchor, this.hillPoint) > 110 * 110
      ) {
        this.commandMove(squad, this.hillPoint, this.angleTo(nearestEnemy.anchor, this.hillPoint));
        return;
      }
      if (context.mapState.isInForest(squad.anchor.x, squad.anchor.y) && foundHill) {
        this.commandMove(squad, this.hillPoint, this.angleTo(nearestEnemy.anchor, this.hillPoint));
        return;
      }

      const maxRange = Math.max(120, squad.archetype.stats.rangedRange);
      if (
        this.isThreatened(squad, this.playerSquads, maxRange * this.rangedThreatFactor(squad, 0.6)) ||
        distanceSq(squad.anchor, objectivePoint) > (maxRange * 0.9) * (maxRange * 0.9)
      ) {
        this.commandSkirmish(squad);
      } else {
        this.commandVolley(squad);
      }
      return;
    }

    computeFlankPoint(nearestEnemy, context.world, this.flankPoint);
    const flankPath = context.navGrid.estimatePathDistance(
      squad.anchor.x,
      squad.anchor.y,
      this.flankPoint.x,
      this.flankPoint.y,
      120,
    );
    const direct = Math.hypot(this.flankPoint.x - squad.anchor.x, this.flankPoint.y - squad.anchor.y);
    if (flankPath > direct * 1.9) {
      this.commandMove(squad, objectivePoint, this.angleTo(nearestEnemy.anchor, objectivePoint));
      return;
    }

    this.commandMove(squad, this.flankPoint, this.angleTo(nearestEnemy.anchor, this.flankPoint));
    if (distanceSq(squad.anchor, nearestEnemy.anchor) < 240 * 240 && !context.mapState.isInForest(squad.anchor.x, squad.anchor.y)) {
      this.commandCharge(squad);
    }
  }

  private runAssassinateTactic(
    squad: Squad,
    role: ReturnType<typeof squadRole>,
    nearestEnemy: Squad,
    assassinSquad: Squad | null,
    objective: ObjectiveTacticalState,
    context: AIDirectorContext,
  ): void {
    const commanderTarget = objective.blueCommander?.alive ? objective.blueCommander.position : nearestEnemy.anchor;

    if (assassinSquad !== null && squad.id === assassinSquad.id) {
      this.commandMove(squad, commanderTarget, this.angleTo(commanderTarget, squad.anchor));
      this.commandCharge(squad);
      return;
    }

    if (role === 'ARCHER') {
      const foundHill = context.mapState.getNearestHillCenter(squad.anchor, this.hillPoint);
      if (foundHill && distanceSq(squad.anchor, this.hillPoint) > 120 * 120) {
        this.commandMove(squad, this.hillPoint, this.angleTo(commanderTarget, this.hillPoint));
        return;
      }
      const maxRange = Math.max(120, squad.archetype.stats.rangedRange);
      if (
        this.isThreatened(squad, this.playerSquads, maxRange * this.rangedThreatFactor(squad, 0.55)) ||
        distanceSq(squad.anchor, commanderTarget) > (maxRange * 0.92) * (maxRange * 0.92)
      ) {
        this.commandSkirmish(squad);
      } else {
        this.commandVolley(squad);
      }
      return;
    }

    if (role === 'SPEAR') {
      const anchor = this.closestArcherAnchor(squad);
      if (anchor !== null) {
        this.protectPoint.x = anchor.x - 56;
        this.protectPoint.y = anchor.y;
        if (distanceSq(squad.anchor, this.protectPoint) < 80 * 80) {
          this.commandHold(squad);
        } else {
          this.commandMove(squad, this.protectPoint, this.angleTo(commanderTarget, this.protectPoint));
        }
      } else {
        this.commandMove(squad, commanderTarget, this.angleTo(commanderTarget, squad.anchor));
      }
      return;
    }

    if (role === 'CAVALRY') {
      computeFlankPoint(nearestEnemy, context.world, this.flankPoint, 190);
      const flankPath = context.navGrid.estimatePathDistance(
        squad.anchor.x,
        squad.anchor.y,
        this.flankPoint.x,
        this.flankPoint.y,
        120,
      );
      const direct = Math.hypot(this.flankPoint.x - squad.anchor.x, this.flankPoint.y - squad.anchor.y);
      if (flankPath > direct * 2) {
        this.commandMove(squad, commanderTarget, this.angleTo(commanderTarget, squad.anchor));
        this.commandCharge(squad);
        return;
      }
      this.commandMove(squad, this.flankPoint, this.angleTo(commanderTarget, this.flankPoint));
      if (distanceSq(squad.anchor, commanderTarget) < 260 * 260) {
        this.commandCharge(squad);
      }
      return;
    }

    this.commandMove(squad, commanderTarget, this.angleTo(commanderTarget, squad.anchor));
    this.commandCharge(squad);
  }

  private runHoldoutTactic(
    squad: Squad,
    role: ReturnType<typeof squadRole>,
    nearestEnemy: Squad,
    context: AIDirectorContext,
  ): void {
    if (role === 'ARCHER') {
      const foundHill = context.mapState.getNearestHillCenter(squad.anchor, this.hillPoint);
      if (foundHill && !context.mapState.isInForest(squad.anchor.x, squad.anchor.y) && distanceSq(squad.anchor, this.hillPoint) > 130 * 130) {
        this.commandMove(squad, this.hillPoint, this.angleTo(nearestEnemy.anchor, this.hillPoint));
        return;
      }
      const maxRange = Math.max(120, squad.archetype.stats.rangedRange);
      if (
        this.isThreatened(squad, this.playerSquads, maxRange * this.rangedThreatFactor(squad, 0.55)) ||
        distanceSq(squad.anchor, nearestEnemy.anchor) > maxRange * maxRange
      ) {
        this.commandSkirmish(squad);
      } else {
        this.commandVolley(squad);
      }
      return;
    }

    if (role === 'CAVALRY') {
      computeFlankPoint(nearestEnemy, context.world, this.flankPoint);
      const flankPath = context.navGrid.estimatePathDistance(
        squad.anchor.x,
        squad.anchor.y,
        this.flankPoint.x,
        this.flankPoint.y,
        120,
      );
      const direct = Math.hypot(this.flankPoint.x - squad.anchor.x, this.flankPoint.y - squad.anchor.y);
      if (flankPath > direct * 1.95) {
        this.commandMove(squad, nearestEnemy.anchor, this.angleTo(nearestEnemy.anchor, squad.anchor));
        this.commandCharge(squad);
        return;
      }
      this.commandMove(squad, this.flankPoint, this.angleTo(nearestEnemy.anchor, this.flankPoint));
      this.commandCharge(squad);
      return;
    }

    this.commandMove(squad, nearestEnemy.anchor, this.angleTo(nearestEnemy.anchor, squad.anchor));
    this.commandCharge(squad);
  }

  private runEscortTactic(
    squad: Squad,
    role: ReturnType<typeof squadRole>,
    nearestEnemy: Squad,
    objective: ObjectiveTacticalState,
    context: AIDirectorContext,
  ): void {
    const caravan = objective.caravan;
    const exit = objective.exitPosition ?? objective.focusPosition;
    const targetPoint = caravan !== null && caravan.alive ? caravan.position : nearestEnemy.anchor;

    if (role === 'ARCHER') {
      const foundHill = context.mapState.getNearestHillCenter(squad.anchor, this.hillPoint);
      if (foundHill && distanceSq(squad.anchor, this.hillPoint) > 110 * 110) {
        this.commandMove(squad, this.hillPoint, this.angleTo(targetPoint, this.hillPoint));
        return;
      }
      const maxRange = Math.max(120, squad.archetype.stats.rangedRange);
      if (
        this.isThreatened(squad, this.playerSquads, maxRange * this.rangedThreatFactor(squad, 0.55)) ||
        distanceSq(squad.anchor, targetPoint) > maxRange * maxRange
      ) {
        this.commandSkirmish(squad);
      } else {
        this.commandVolley(squad);
      }
      return;
    }

    if (role === 'CAVALRY') {
      if (caravan !== null && caravan.alive) {
        const dirX = exit.x - caravan.position.x;
        const dirY = exit.y - caravan.position.y;
        const len = Math.hypot(dirX, dirY);
        if (len > 0.0001) {
          const invLen = 1 / len;
          this.flankPoint.x = caravan.position.x + dirX * invLen * 90;
          this.flankPoint.y = caravan.position.y + dirY * invLen * 90;
        } else {
          this.flankPoint.copy(caravan.position);
        }
        this.flankPoint.x = Math.max(44, Math.min(context.world.width - 44, this.flankPoint.x));
        this.flankPoint.y = Math.max(44, Math.min(context.world.height - 44, this.flankPoint.y));
        const flankPath = context.navGrid.estimatePathDistance(
          squad.anchor.x,
          squad.anchor.y,
          this.flankPoint.x,
          this.flankPoint.y,
          120,
        );
        const direct = Math.hypot(this.flankPoint.x - squad.anchor.x, this.flankPoint.y - squad.anchor.y);
        if (flankPath > direct * 1.9) {
          this.commandMove(squad, targetPoint, this.angleTo(targetPoint, squad.anchor));
          this.commandCharge(squad);
          return;
        }
        this.commandMove(squad, this.flankPoint, this.angleTo(targetPoint, this.flankPoint));
        this.commandCharge(squad);
        return;
      }
    }

    this.commandMove(squad, targetPoint, this.angleTo(targetPoint, squad.anchor));
    if (role !== 'SPEAR') {
      this.commandCharge(squad);
    } else {
      this.commandHold(squad);
    }
  }

  private runSiegeTactic(
    squad: Squad,
    role: ReturnType<typeof squadRole>,
    nearestEnemy: Squad,
    objective: ObjectiveTacticalState,
    context: AIDirectorContext,
  ): void {
    const attackerTeam = objective.attackerTeam ?? TeamId.Red;
    if (attackerTeam === TeamId.Red) {
      this.runSiegeAttackerTactic(squad, role, nearestEnemy, objective, context);
      return;
    }
    this.runSiegeDefenderTactic(squad, role, nearestEnemy, objective, context);
  }

  private runSiegeAttackerTactic(
    squad: Squad,
    role: ReturnType<typeof squadRole>,
    nearestEnemy: Squad,
    objective: ObjectiveTacticalState,
    context: AIDirectorContext,
  ): void {
    const stageGate = objective.siegeStage !== 'COURTYARD';
    const gatePos = objective.gateZonePosition ?? objective.focusPosition;
    const courtyardPos = objective.courtyardZonePosition ?? objective.focusPosition;
    const targetZone = stageGate ? gatePos : courtyardPos;
    this.siegeTargetPoint.copy(targetZone);

    if (role === 'INFANTRY') {
      this.commandMove(squad, this.siegeTargetPoint, this.angleTo(nearestEnemy.anchor, this.siegeTargetPoint));
      if (distanceSq(squad.anchor, nearestEnemy.anchor) < 180 * 180) {
        this.commandCharge(squad);
      } else if (distanceSq(squad.anchor, this.siegeTargetPoint) < CLOSE_TO_POINT_SQ) {
        this.commandHold(squad);
      }
      return;
    }

    if (role === 'SPEAR') {
      const anchorOffset = stageGate ? 80 : 60;
      this.protectPoint.x = this.siegeTargetPoint.x - anchorOffset;
      this.protectPoint.y = this.siegeTargetPoint.y + ((squad.id & 1) === 0 ? -46 : 46);
      if (distanceSq(squad.anchor, this.protectPoint) < 86 * 86) {
        this.commandHold(squad);
      } else {
        this.commandMove(squad, this.protectPoint, this.angleTo(nearestEnemy.anchor, this.protectPoint));
      }
      return;
    }

    if (role === 'ARCHER') {
      const foundHill = context.mapState.getNearestHillCenter(squad.anchor, this.hillPoint);
      if (foundHill && distanceSq(squad.anchor, this.hillPoint) > 110 * 110) {
        this.commandMove(squad, this.hillPoint, this.angleTo(nearestEnemy.anchor, this.hillPoint));
        return;
      }
      const maxRange = Math.max(120, squad.archetype.stats.rangedRange);
      if (
        this.isThreatened(squad, this.playerSquads, maxRange * this.rangedThreatFactor(squad, 0.56)) ||
        distanceSq(squad.anchor, nearestEnemy.anchor) > (maxRange * 0.92) * (maxRange * 0.92)
      ) {
        this.commandSkirmish(squad);
      } else {
        this.commandVolley(squad);
      }
      return;
    }

    if (stageGate && !objective.gateOpen) {
      computeFlankPoint(nearestEnemy, context.world, this.flankPoint, 210);
      const flankPath = context.navGrid.estimatePathDistance(
        squad.anchor.x,
        squad.anchor.y,
        this.flankPoint.x,
        this.flankPoint.y,
        130,
      );
      const direct = Math.hypot(this.flankPoint.x - squad.anchor.x, this.flankPoint.y - squad.anchor.y);
      if (flankPath > direct * 1.8) {
        this.protectPoint.x = gatePos.x - 92;
        this.protectPoint.y = gatePos.y + ((squad.id & 1) === 0 ? -90 : 90);
        this.commandMove(squad, this.protectPoint, this.angleTo(nearestEnemy.anchor, this.protectPoint));
        this.commandHold(squad);
        return;
      }

      this.commandMove(squad, this.flankPoint, this.angleTo(nearestEnemy.anchor, this.flankPoint));
      if (distanceSq(squad.anchor, nearestEnemy.anchor) < 235 * 235 && !context.mapState.isInForest(squad.anchor.x, squad.anchor.y)) {
        this.commandCharge(squad);
      }
      return;
    }

    computeFlankPoint(nearestEnemy, context.world, this.flankPoint, 190);
    this.commandMove(squad, this.flankPoint, this.angleTo(nearestEnemy.anchor, this.flankPoint));
    if (distanceSq(squad.anchor, nearestEnemy.anchor) < 250 * 250) {
      this.commandCharge(squad);
    }
  }

  private runSiegeDefenderTactic(
    squad: Squad,
    role: ReturnType<typeof squadRole>,
    nearestEnemy: Squad,
    objective: ObjectiveTacticalState,
    context: AIDirectorContext,
  ): void {
    const stageGate = objective.siegeStage !== 'COURTYARD';
    const gatePos = objective.gateZonePosition ?? objective.focusPosition;
    const courtyardPos = objective.courtyardZonePosition ?? objective.focusPosition;
    const defendZone = stageGate ? gatePos : courtyardPos;
    const holdOffset = stageGate ? 100 : 45;
    this.siegeTargetPoint.x = defendZone.x + holdOffset;
    this.siegeTargetPoint.y = defendZone.y;

    if (role === 'ARCHER') {
      const foundHill = context.mapState.getNearestHillCenter(squad.anchor, this.hillPoint);
      if (foundHill && distanceSq(squad.anchor, this.hillPoint) > 90 * 90) {
        this.commandMove(squad, this.hillPoint, this.angleTo(nearestEnemy.anchor, this.hillPoint));
        return;
      }
      if (this.isThreatened(squad, this.playerSquads, 180)) {
        this.commandSkirmish(squad);
      } else {
        this.commandVolley(squad);
      }
      return;
    }

    if (role === 'CAVALRY') {
      if (distanceSq(squad.anchor, nearestEnemy.anchor) < 210 * 210) {
        this.commandCharge(squad);
      } else {
        computeFlankPoint(nearestEnemy, context.world, this.flankPoint, 160);
        this.commandMove(squad, this.flankPoint, this.angleTo(nearestEnemy.anchor, this.flankPoint));
      }
      return;
    }

    if (role === 'SPEAR') {
      this.protectPoint.x = this.siegeTargetPoint.x + 35;
      this.protectPoint.y = this.siegeTargetPoint.y + ((squad.id & 1) === 0 ? -52 : 52);
      if (distanceSq(squad.anchor, this.protectPoint) < 90 * 90) {
        this.commandHold(squad);
      } else {
        this.commandMove(squad, this.protectPoint, this.angleTo(nearestEnemy.anchor, this.protectPoint));
      }
      return;
    }

    this.commandMove(squad, this.siegeTargetPoint, this.angleTo(nearestEnemy.anchor, this.siegeTargetPoint));
    if (distanceSq(squad.anchor, nearestEnemy.anchor) < 190 * 190) {
      this.commandCharge(squad);
    } else {
      this.commandHold(squad);
    }
  }

  private closestArcherAnchor(from: Squad): Vec2 | null {
    const nearestArcher = nearestEnemyByRole(from, this.enemySquads, 'ARCHER');
    return nearestArcher ? nearestArcher.anchor : null;
  }

  private isThreatened(squad: Squad, enemies: readonly Squad[], range: number): boolean {
    const rangeSq = range * range;
    for (let i = 0; i < enemies.length; i += 1) {
      const enemy = enemies[i];
      if (!enemy.hasLivingSoldiers()) {
        continue;
      }
      if (distanceSq(squad.anchor, enemy.anchor) <= rangeSq) {
        return true;
      }
    }
    return false;
  }

  private rangedThreatFactor(squad: Squad, defaultFactor: number): number {
    if (squad.archetype.tags.includes('slinger')) {
      return 0.55;
    }
    return defaultFactor;
  }

  private commandMove(squad: Squad, target: Vec2, facing: number | null): void {
    const key = `M:${Math.round(target.x / 24)}:${Math.round(target.y / 24)}:${facing === null ? 'n' : Math.round(facing * 20)}`;
    if (this.commandMemory.get(squad.id) === key) {
      return;
    }
    squad.issueMove(target, false, facing);
    this.commandMemory.set(squad.id, key);
  }

  private commandHold(squad: Squad): void {
    this.issueSimpleCommand(squad, 'H', () => squad.holdPosition());
  }

  private commandCharge(squad: Squad): void {
    this.issueSimpleCommand(squad, 'C', () => squad.orderCharge());
  }

  private commandVolley(squad: Squad): void {
    this.issueSimpleCommand(squad, 'V', () => squad.orderVolley());
  }

  private commandSkirmish(squad: Squad): void {
    this.issueSimpleCommand(squad, 'K', () => squad.orderSkirmish());
  }

  private issueSimpleCommand(squad: Squad, key: string, action: () => void): void {
    if (this.commandMemory.get(squad.id) === key) {
      return;
    }
    action();
    this.commandMemory.set(squad.id, key);
  }

  private angleTo(target: Vec2, from: Vec2): number {
    return Math.atan2(target.y - from.y, target.x - from.x);
  }

  setOrderFrequencyMultiplier(multiplier: number): void {
    this.orderFrequencyMult = Math.max(0.5, Math.min(2.5, multiplier));
  }
}
