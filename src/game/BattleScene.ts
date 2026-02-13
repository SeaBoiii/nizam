import { Application, Container, Graphics } from 'pixi.js';
import { Camera } from './Camera';
import { formationLabel } from '../sim/Formation';
import { CombatSystem } from '../sim/CombatSystem';
import { Squad, type SquadUpdateContext } from '../sim/Squad';
import { TeamId, type FormationType, type OrderMode, type WorldBounds } from '../sim/types';
import { Hud } from '../ui/Hud';
import { SelectionBox } from '../ui/SelectionBox';
import { Vec2 } from '../utils/vec2';
import { ObjectiveManager } from '../sim/objectives/ObjectiveManager';
import { ObjectiveHUD } from '../ui/widgets/ObjectiveHUD';
import type { Soldier } from '../sim/Soldier';
import { SpatialHash } from '../sim/SpatialHash';
import { ProjectileSystem } from '../sim/combat/ProjectileSystem';
import { RangedSystem } from '../sim/combat/RangedSystem';
import { Minimap } from '../ui/widgets/Minimap';
import { SquadIndicators } from '../ui/widgets/SquadIndicators';
import type { BattleResult, BattleScenario } from '../meta/types';
import type { ArmyState, SquadMeta } from '../meta/Army';
import { getTieredArchetype } from '../meta/Progression';
import type { UnitArchetype } from '../sim/types/UnitArchetype';

const FIXED_DT = 1 / 60;
const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 2400;
const CLICK_RADIUS_SQ = 42 * 42;
const DRAG_THRESHOLD_SQ = 8 * 8;

interface BattleSceneOptions {
  app: Application;
  parent: Container;
  scenario: BattleScenario;
  armyState: ArmyState;
  onFinished: (result: BattleResult) => void;
}

function orderLabel(order: OrderMode): string {
  switch (order) {
    case 'move':
      return 'MOVE';
    case 'hold':
      return 'HOLD';
    case 'charge':
      return 'CHARGE';
    case 'retreat':
      return 'RETREAT';
    case 'rout':
      return 'ROUT';
    case 'volley':
      return 'VOLLEY';
    case 'skirmish':
      return 'SKIRMISH';
  }
}

export class BattleScene {
  private readonly app: Application;
  private readonly parent: Container;
  private readonly scenario: BattleScenario;
  private readonly armyState: ArmyState;
  private readonly onFinished: (result: BattleResult) => void;

  private readonly worldBounds: WorldBounds = {
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
  };

  private readonly root = new Container();
  private readonly worldLayer = new Container();
  private readonly mapLayer = new Graphics();
  private readonly objectiveLayer = new Container();
  private readonly waypointLayer = new Graphics();
  private readonly unitLayer = new Container();
  private readonly projectileLayer = new Container();
  private readonly overlayLayer = new Container();
  private readonly uiLayer = new Container();

  private readonly camera: Camera;
  private readonly hud: Hud;
  private readonly objectiveHud: ObjectiveHUD;
  private readonly minimap: Minimap;
  private readonly selectionBox: SelectionBox;
  private readonly squadIndicators: SquadIndicators;
  private readonly combat = new CombatSystem();
  private readonly rangedSystem = new RangedSystem();
  private readonly unitGrid = new SpatialHash(32);

  private readonly objectiveManager: ObjectiveManager;
  private readonly projectileSystem: ProjectileSystem;

  private readonly squads: Squad[] = [];
  private readonly selectedSquads = new Set<Squad>();
  private readonly keys = new Set<string>();
  private readonly aliveSoldiers: Soldier[] = [];

  private readonly pointerScreen = new Vec2();
  private readonly pointerWorld = new Vec2();
  private readonly dragStartScreen = new Vec2();
  private readonly dragStartWorld = new Vec2();
  private readonly dragEndWorld = new Vec2();

  private readonly squadUpdateContext: SquadUpdateContext;

  private leftMouseDown = false;
  private dragSelecting = false;
  private dragAdditive = false;

  private accumulator = 0;
  private simTime = 0;
  private fps = 60;
  private lastOrderMode = 'IDLE';
  private finished = false;

  private playerInitial = 0;
  private enemyInitial = 0;

  constructor(options: BattleSceneOptions) {
    this.app = options.app;
    this.parent = options.parent;
    this.scenario = options.scenario;
    this.armyState = options.armyState;
    this.onFinished = options.onFinished;

    this.objectiveManager = new ObjectiveManager(
      new Vec2(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5),
      240,
      this.scenario.captureSpeedMultiplier,
    );

    this.root.addChild(this.worldLayer);
    this.worldLayer.addChild(this.mapLayer);
    this.worldLayer.addChild(this.objectiveLayer);
    this.worldLayer.addChild(this.waypointLayer);
    this.worldLayer.addChild(this.unitLayer);
    this.worldLayer.addChild(this.projectileLayer);
    this.worldLayer.addChild(this.overlayLayer);
    this.root.addChild(this.uiLayer);
    this.parent.addChild(this.root);

    this.objectiveLayer.addChild(this.objectiveManager.capturePoint.graphics);

    this.camera = new Camera(this.worldBounds);
    this.hud = new Hud(this.uiLayer);
    this.objectiveHud = new ObjectiveHUD(this.uiLayer);
    this.minimap = new Minimap(this.uiLayer, this.worldBounds);
    this.selectionBox = new SelectionBox(this.uiLayer);
    this.squadIndicators = new SquadIndicators(this.overlayLayer);
    this.projectileSystem = new ProjectileSystem(this.projectileLayer);

    this.drawMap();

    this.squadUpdateContext = {
      dt: FIXED_DT,
      simTime: 0,
      world: this.worldBounds,
      objectivePosition: this.objectiveManager.capturePoint.position,
      allSquads: this.squads,
    };

    this.camera.position.set(this.worldBounds.width * 0.5, this.worldBounds.height * 0.5);
    this.camera.setViewport(this.app.screen.width, this.app.screen.height);
    this.camera.applyTo(this.worldLayer);
    this.minimap.resize(this.app.screen.width, this.app.screen.height);

    this.spawnTeams();
    this.collectAliveSoldiers();
    this.rebuildUnitGrid();

    this.bindInput();
  }

  destroy(): void {
    this.unbindInput();

    for (let i = 0; i < this.squads.length; i += 1) {
      this.squads[i].destroy();
    }
    this.squads.length = 0;
    this.selectedSquads.clear();
    this.aliveSoldiers.length = 0;

    this.projectileSystem.clear();
    this.root.destroy({ children: true });
  }

  update(frameDt: number): void {
    if (this.finished || this.root.destroyed) {
      return;
    }

    const clampedDt = Math.min(frameDt, 0.25);
    this.accumulator += clampedDt;

    if (clampedDt > 0.00001) {
      const rawFps = 1 / clampedDt;
      this.fps = this.fps * 0.9 + rawFps * 0.1;
    }

    while (this.accumulator >= FIXED_DT) {
      this.fixedUpdate(FIXED_DT);
      this.accumulator -= FIXED_DT;

      if (this.finished || this.root.destroyed) {
        return;
      }
    }

    if (this.finished || this.root.destroyed) {
      return;
    }

    this.renderFrame();
  }

  private drawMap(): void {
    this.mapLayer.clear();
    this.mapLayer.rect(0, 0, this.worldBounds.width, this.worldBounds.height);
    this.mapLayer.fill({ color: 0x263428, alpha: 1 });

    const gridStep = 120;
    for (let x = 0; x <= this.worldBounds.width; x += gridStep) {
      this.mapLayer.moveTo(x, 0);
      this.mapLayer.lineTo(x, this.worldBounds.height);
    }
    for (let y = 0; y <= this.worldBounds.height; y += gridStep) {
      this.mapLayer.moveTo(0, y);
      this.mapLayer.lineTo(this.worldBounds.width, y);
    }
    this.mapLayer.stroke({ color: 0x33483a, width: 1, alpha: 0.45 });

    this.mapLayer.rect(0, 0, this.worldBounds.width, this.worldBounds.height);
    this.mapLayer.stroke({ color: 0xa7c296, width: 2, alpha: 0.5 });
  }

  private spawnTeams(): void {
    let squadId = 1;

    const playerSquads = this.armyState.squads;
    this.playerInitial = 0;
    for (let i = 0; i < playerSquads.length; i += 1) {
      const squadMeta = playerSquads[i];
      const archetype = this.makeArchetypeForMeta(squadMeta, true);
      const position = this.computeFormationSpawn(i, playerSquads.length, TeamId.Blue);
      const squad = new Squad({
        id: squadId,
        team: TeamId.Blue,
        color: this.teamColor(archetype.id, TeamId.Blue),
        initialAnchor: position,
        facing: 0,
        soldierCount: squadMeta.size,
        archetype,
        unitLayer: this.unitLayer,
        overlayLayer: this.overlayLayer,
      });
      this.squads.push(squad);
      this.playerInitial += squadMeta.size;
      squadId += 1;
    }

    const enemySquads = this.scenario.enemySquads;
    this.enemyInitial = 0;
    for (let i = 0; i < enemySquads.length; i += 1) {
      const squadMeta = enemySquads[i];
      const archetype = this.makeArchetypeForMeta(squadMeta, false);
      const position = this.computeFormationSpawn(i, enemySquads.length, TeamId.Red);
      const squad = new Squad({
        id: squadId,
        team: TeamId.Red,
        color: this.teamColor(archetype.id, TeamId.Red),
        initialAnchor: position,
        facing: Math.PI,
        soldierCount: squadMeta.size,
        archetype,
        unitLayer: this.unitLayer,
        overlayLayer: this.overlayLayer,
      });
      this.squads.push(squad);
      this.enemyInitial += squadMeta.size;
      squadId += 1;
    }
  }

  private teamColor(archetypeId: string, team: TeamId): number {
    const isArcher = archetypeId.includes('archer');
    const isCavalry = archetypeId.includes('cavalry');

    if (team === TeamId.Blue) {
      if (isArcher) {
        return 0x8cc8ff;
      }
      if (isCavalry) {
        return 0x6db8ff;
      }
      return 0x58aefc;
    }

    if (isArcher) {
      return 0xffb399;
    }
    if (isCavalry) {
      return 0xff8a8a;
    }
    return 0xff7c7c;
  }

  private makeArchetypeForMeta(meta: SquadMeta, playerTeam: boolean): UnitArchetype {
    const tiered = getTieredArchetype(meta.archetypeId, meta.tier);
    if (!playerTeam || this.scenario.playerHpBuffMultiplier <= 1) {
      return tiered;
    }

    return {
      id: tiered.id,
      name: tiered.name,
      tags: [...tiered.tags],
      stats: {
        ...tiered.stats,
        hp: tiered.stats.hp * this.scenario.playerHpBuffMultiplier,
      },
    };
  }

  private computeFormationSpawn(index: number, total: number, team: TeamId): Vec2 {
    const rowCount = Math.max(1, Math.ceil(Math.sqrt(total)));
    const colCount = Math.max(1, Math.ceil(total / rowCount));

    const row = index % rowCount;
    const col = Math.floor(index / rowCount);

    const yRange = WORLD_HEIGHT - 740;
    const yStep = rowCount > 1 ? yRange / (rowCount - 1) : 0;
    const y = 370 + row * yStep;

    const xSpacing = colCount > 1 ? 155 : 0;
    const xOffset = col * xSpacing;

    const x = team === TeamId.Blue ? 620 + xOffset : WORLD_WIDTH - 620 - xOffset;
    return new Vec2(x, y);
  }

  private bindInput(): void {
    const canvas = this.app.canvas;

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('resize', this.onResize);

    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  private unbindInput(): void {
    const canvas = this.app.canvas;

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('resize', this.onResize);

    canvas.removeEventListener('mousedown', this.onMouseDown);
    canvas.removeEventListener('wheel', this.onWheel);
    canvas.removeEventListener('contextmenu', this.onContextMenu);
  }

  private readonly onResize = (): void => {
    this.camera.setViewport(this.app.screen.width, this.app.screen.height);
    this.camera.applyTo(this.worldLayer);
    this.minimap.resize(this.app.screen.width, this.app.screen.height);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code);

    if (event.repeat) {
      return;
    }

    switch (event.code) {
      case 'Digit1':
        this.commandFormation('line');
        break;
      case 'Digit2':
        this.commandFormation('column');
        break;
      case 'Digit3':
        this.commandFormation('wedge');
        break;
      case 'Digit4':
        this.commandFormation('loose');
        break;
      case 'KeyH':
        this.commandHold();
        break;
      case 'KeyC':
        this.commandCharge();
        break;
      case 'KeyR':
        this.commandRetreat();
        break;
      case 'KeyV':
        this.commandVolley();
        break;
      case 'KeyK':
        this.commandSkirmish();
        break;
      default:
        break;
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) {
      return;
    }

    this.leftMouseDown = true;
    this.dragSelecting = false;
    this.dragAdditive = event.shiftKey;

    this.toCanvasPoint(event.clientX, event.clientY, this.dragStartScreen);
    this.camera.screenToWorld(this.dragStartScreen.x, this.dragStartScreen.y, this.dragStartWorld);
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    this.toCanvasPoint(event.clientX, event.clientY, this.pointerScreen);

    if (!this.leftMouseDown) {
      return;
    }

    const dx = this.pointerScreen.x - this.dragStartScreen.x;
    const dy = this.pointerScreen.y - this.dragStartScreen.y;
    if (!this.dragSelecting && dx * dx + dy * dy > DRAG_THRESHOLD_SQ) {
      this.dragSelecting = true;
      this.selectionBox.begin(this.dragStartScreen.x, this.dragStartScreen.y);
    }

    if (this.dragSelecting) {
      this.selectionBox.update(this.pointerScreen.x, this.pointerScreen.y);
    }
  };

  private readonly onMouseUp = (event: MouseEvent): void => {
    if (event.button !== 0 || !this.leftMouseDown) {
      return;
    }

    this.leftMouseDown = false;
    this.toCanvasPoint(event.clientX, event.clientY, this.pointerScreen);
    this.camera.screenToWorld(this.pointerScreen.x, this.pointerScreen.y, this.dragEndWorld);

    if (this.dragSelecting) {
      this.performBoxSelection(this.dragEndWorld, this.dragAdditive);
    } else {
      this.performClickSelection(this.dragEndWorld, event.shiftKey);
    }

    this.dragSelecting = false;
    this.selectionBox.hide();
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.toCanvasPoint(event.clientX, event.clientY, this.pointerScreen);

    const zoomFactor = Math.exp(-event.deltaY * 0.0014);
    this.camera.zoomAt(this.pointerScreen.x, this.pointerScreen.y, zoomFactor);
    this.camera.applyTo(this.worldLayer);
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    if (this.selectedSquads.size === 0) {
      return;
    }

    this.toCanvasPoint(event.clientX, event.clientY, this.pointerScreen);
    this.camera.screenToWorld(this.pointerScreen.x, this.pointerScreen.y, this.pointerWorld);

    const queue = event.shiftKey;
    const setFacing = event.altKey;

    for (const squad of this.selectedSquads) {
      let facingOverride: number | null = null;
      if (setFacing) {
        const dx = this.pointerWorld.x - squad.anchor.x;
        const dy = this.pointerWorld.y - squad.anchor.y;
        if (dx * dx + dy * dy > 0.0001) {
          facingOverride = Math.atan2(dy, dx);
        }
      }
      squad.issueMove(this.pointerWorld, queue, facingOverride);
    }

    if (setFacing) {
      this.lastOrderMode = queue ? 'QUEUE MOVE+FACE' : 'MOVE+FACE';
    } else {
      this.lastOrderMode = queue ? 'QUEUE MOVE' : 'MOVE';
    }
  };

  private commandFormation(formation: FormationType): void {
    if (this.selectedSquads.size === 0) {
      return;
    }

    for (const squad of this.selectedSquads) {
      squad.setFormation(formation);
    }

    this.lastOrderMode = `FORMATION ${formationLabel(formation).toUpperCase()}`;
  }

  private commandHold(): void {
    if (this.selectedSquads.size === 0) {
      return;
    }

    for (const squad of this.selectedSquads) {
      squad.holdPosition();
    }

    this.lastOrderMode = 'HOLD';
  }

  private commandCharge(): void {
    if (this.selectedSquads.size === 0) {
      return;
    }

    for (const squad of this.selectedSquads) {
      squad.orderCharge();
    }

    this.lastOrderMode = 'CHARGE';
  }

  private commandRetreat(): void {
    if (this.selectedSquads.size === 0) {
      return;
    }

    for (const squad of this.selectedSquads) {
      squad.orderRetreat(this.worldBounds);
    }

    this.lastOrderMode = 'RETREAT';
  }

  private commandVolley(): void {
    if (this.selectedSquads.size === 0) {
      return;
    }

    for (const squad of this.selectedSquads) {
      squad.orderVolley();
    }

    this.lastOrderMode = 'VOLLEY';
  }

  private commandSkirmish(): void {
    if (this.selectedSquads.size === 0) {
      return;
    }

    for (const squad of this.selectedSquads) {
      squad.orderSkirmish();
    }

    this.lastOrderMode = 'SKIRMISH';
  }

  private performClickSelection(worldPoint: Vec2, additive: boolean): void {
    let clicked: Squad | null = null;
    let nearestDistSq = CLICK_RADIUS_SQ;

    for (let i = 0; i < this.squads.length; i += 1) {
      const squad = this.squads[i];
      if (!squad.hasLivingSoldiers()) {
        continue;
      }

      if (squad.team !== TeamId.Blue) {
        continue;
      }

      const distSq = squad.anchor.distanceSqTo(worldPoint);
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        clicked = squad;
      }
    }

    if (!additive) {
      this.selectedSquads.clear();
    }

    if (clicked !== null) {
      if (additive && this.selectedSquads.has(clicked)) {
        this.selectedSquads.delete(clicked);
      } else {
        this.selectedSquads.add(clicked);
      }
    }

    this.syncSelectionState();
  }

  private performBoxSelection(endWorld: Vec2, additive: boolean): void {
    const minX = Math.min(this.dragStartWorld.x, endWorld.x);
    const maxX = Math.max(this.dragStartWorld.x, endWorld.x);
    const minY = Math.min(this.dragStartWorld.y, endWorld.y);
    const maxY = Math.max(this.dragStartWorld.y, endWorld.y);

    if (!additive) {
      this.selectedSquads.clear();
    }

    for (let i = 0; i < this.squads.length; i += 1) {
      const squad = this.squads[i];
      if (!squad.hasLivingSoldiers() || squad.team !== TeamId.Blue) {
        continue;
      }

      if (
        squad.anchor.x >= minX &&
        squad.anchor.x <= maxX &&
        squad.anchor.y >= minY &&
        squad.anchor.y <= maxY
      ) {
        this.selectedSquads.add(squad);
      }
    }

    this.syncSelectionState();
  }

  private syncSelectionState(): void {
    for (let i = 0; i < this.squads.length; i += 1) {
      const squad = this.squads[i];
      squad.setSelected(this.selectedSquads.has(squad));
    }
  }

  private fixedUpdate(dt: number): void {
    this.simTime += dt;
    this.updateCameraPan(dt);

    this.squadUpdateContext.dt = dt;
    this.squadUpdateContext.simTime = this.simTime;

    for (let i = 0; i < this.squads.length; i += 1) {
      this.squads[i].update(this.squadUpdateContext);
    }

    this.collectAliveSoldiers();
    this.rebuildUnitGrid();

    this.rangedSystem.update(dt, this.squads, this.aliveSoldiers, this.unitGrid, this.projectileSystem);
    this.combat.update(dt, this.aliveSoldiers, this.unitGrid);
    this.projectileSystem.update(dt, this.aliveSoldiers, this.unitGrid);

    this.collectAliveSoldiers();
    this.objectiveManager.update(dt, this.aliveSoldiers);

    const winnerByObjective = this.objectiveManager.getStatus().winner;
    if (winnerByObjective !== null) {
      this.finishBattle(winnerByObjective === TeamId.Blue);
      return;
    }

    const playerRemaining = this.countTeamAlive(TeamId.Blue);
    const enemyRemaining = this.countTeamAlive(TeamId.Red);

    if (enemyRemaining <= 0) {
      this.finishBattle(true);
    } else if (playerRemaining <= 0) {
      this.finishBattle(false);
    }
  }

  private finishBattle(playerWon: boolean): void {
    if (this.finished) {
      return;
    }

    this.finished = true;

    const playerRemaining = this.countTeamAlive(TeamId.Blue);
    const enemyRemaining = this.countTeamAlive(TeamId.Red);

    const result: BattleResult = {
      scenario: this.scenario,
      victory: playerWon,
      playerInitial: this.playerInitial,
      playerRemaining,
      enemyInitial: this.enemyInitial,
      enemyRemaining,
      playerCasualties: Math.max(0, this.playerInitial - playerRemaining),
      enemyCasualties: Math.max(0, this.enemyInitial - enemyRemaining),
    };

    this.onFinished(result);
  }

  private countTeamAlive(team: TeamId): number {
    let count = 0;
    for (let i = 0; i < this.aliveSoldiers.length; i += 1) {
      if (this.aliveSoldiers[i].team === team) {
        count += 1;
      }
    }
    return count;
  }

  private collectAliveSoldiers(): void {
    this.aliveSoldiers.length = 0;

    for (let i = 0; i < this.squads.length; i += 1) {
      const soldiers = this.squads[i].soldiers;
      for (let j = 0; j < soldiers.length; j += 1) {
        if (soldiers[j].alive) {
          this.aliveSoldiers.push(soldiers[j]);
        }
      }
    }
  }

  private rebuildUnitGrid(): void {
    this.unitGrid.clear();

    for (let i = 0; i < this.aliveSoldiers.length; i += 1) {
      this.unitGrid.insert(this.aliveSoldiers[i]);
    }
  }

  private updateCameraPan(dt: number): void {
    let axisX = 0;
    let axisY = 0;

    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) {
      axisX -= 1;
    }
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) {
      axisX += 1;
    }
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
      axisY -= 1;
    }
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
      axisY += 1;
    }

    if (axisX === 0 && axisY === 0) {
      return;
    }

    const axisLen = Math.hypot(axisX, axisY);
    const dirX = axisX / axisLen;
    const dirY = axisY / axisLen;
    const speed = 780 / this.camera.zoom;

    this.camera.pan(dirX * speed * dt, dirY * speed * dt);
  }

  private renderFrame(): void {
    this.camera.applyTo(this.worldLayer);
    this.drawWaypointPaths();
    this.squadIndicators.update(this.squads);

    const objectiveStatus = this.objectiveManager.getStatus();

    this.hud.update({
      fps: this.fps,
      selectedCount: this.selectedSquads.size,
      selectedArchetypes: this.currentSelectedArchetypeLabel(),
      formation: this.currentSelectedFormationLabel(),
      orderMode: this.currentSelectedOrderLabel(),
    });

    this.objectiveHud.update({
      blueProgress: objectiveStatus.progressBlue,
      redProgress: objectiveStatus.progressRed,
      blueInside: objectiveStatus.blueInside,
      redInside: objectiveStatus.redInside,
      contested: objectiveStatus.contested,
    });

    this.minimap.update(
      this.squads,
      this.aliveSoldiers,
      this.objectiveManager.capturePoint.position,
      this.objectiveManager.capturePoint.radius,
    );
  }

  private drawWaypointPaths(): void {
    this.waypointLayer.clear();
    if (this.selectedSquads.size === 0) {
      return;
    }

    for (const squad of this.selectedSquads) {
      if (squad.waypoints.length === 0) {
        continue;
      }

      const color = squad.team === TeamId.Blue ? 0x9dd3ff : 0xffc0c0;
      this.waypointLayer.moveTo(squad.anchor.x, squad.anchor.y);

      let prevX = squad.anchor.x;
      let prevY = squad.anchor.y;
      for (let i = 0; i < squad.waypoints.length; i += 1) {
        const waypoint = squad.waypoints[i];
        this.waypointLayer.lineTo(waypoint.position.x, waypoint.position.y);
        prevX = waypoint.position.x;
        prevY = waypoint.position.y;
      }
      this.waypointLayer.stroke({ color, width: 2, alpha: 0.95 });

      for (let i = 0; i < squad.waypoints.length; i += 1) {
        const waypoint = squad.waypoints[i];
        this.waypointLayer.circle(waypoint.position.x, waypoint.position.y, 5);
        this.waypointLayer.fill({ color, alpha: 0.24 });
        this.waypointLayer.stroke({ color, width: 1.5, alpha: 0.95 });
      }

      if (squad.waypoints.length > 0) {
        this.waypointLayer.circle(prevX, prevY, 7);
        this.waypointLayer.stroke({ color, width: 1.8, alpha: 0.95 });
      }
    }
  }

  private currentSelectedFormationLabel(): string {
    if (this.selectedSquads.size === 0) {
      return '-';
    }

    let current: FormationType | null = null;
    for (const squad of this.selectedSquads) {
      if (current === null) {
        current = squad.formation;
      } else if (current !== squad.formation) {
        return 'Mixed';
      }
    }

    return current === null ? '-' : formationLabel(current);
  }

  private currentSelectedArchetypeLabel(): string {
    if (this.selectedSquads.size === 0) {
      return '-';
    }

    let name: string | null = null;
    for (const squad of this.selectedSquads) {
      if (name === null) {
        name = squad.archetype.name;
      } else if (name !== squad.archetype.name) {
        return 'Mixed';
      }
    }

    return name ?? '-';
  }

  private currentSelectedOrderLabel(): string {
    if (this.selectedSquads.size === 0) {
      return this.lastOrderMode;
    }

    let current: OrderMode | null = null;
    for (const squad of this.selectedSquads) {
      if (current === null) {
        current = squad.order;
      } else if (current !== squad.order) {
        return 'MIXED';
      }
    }

    return current === null ? this.lastOrderMode : orderLabel(current);
  }

  private toCanvasPoint(clientX: number, clientY: number, out: Vec2): Vec2 {
    const rect = this.app.canvas.getBoundingClientRect();
    out.x = clientX - rect.left;
    out.y = clientY - rect.top;
    return out;
  }
}
