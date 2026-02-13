import { Application, Container, Graphics } from 'pixi.js';
import { Camera } from './Camera';
import { formationLabel } from '../sim/Formation';
import { CombatSystem } from '../sim/CombatSystem';
import { Squad, type SquadUpdateContext } from '../sim/Squad';
import { TeamId, type FormationType, type OrderMode, type WorldBounds } from '../sim/types';
import { Hud } from '../ui/Hud';
import { SelectionBox } from '../ui/SelectionBox';
import { Vec2 } from '../utils/vec2';

const FIXED_DT = 1 / 60;
const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 2400;
const SOLDIERS_PER_SQUAD = 30;
const CLICK_RADIUS_SQ = 42 * 42;
const DRAG_THRESHOLD_SQ = 8 * 8;

function orderLabel(order: OrderMode): string {
  switch (order) {
    case 'move':
      return 'Move';
    case 'hold':
      return 'Hold';
    case 'charge':
      return 'Charge';
    case 'retreat':
      return 'Retreat';
    case 'rout':
      return 'Rout';
  }
}

export class Game {
  private readonly app: Application;

  private readonly worldBounds: WorldBounds = {
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
  };

  private readonly worldLayer = new Container();
  private readonly mapLayer = new Graphics();
  private readonly waypointLayer = new Graphics();
  private readonly unitLayer = new Container();
  private readonly overlayLayer = new Container();
  private readonly uiLayer = new Container();

  private readonly camera: Camera;
  private readonly hud: Hud;
  private readonly selectionBox: SelectionBox;
  private readonly combat = new CombatSystem();

  private readonly squads: Squad[] = [];
  private readonly selectedSquads = new Set<Squad>();
  private readonly keys = new Set<string>();

  private readonly pointerScreen = new Vec2();
  private readonly pointerWorld = new Vec2();
  private readonly dragStartScreen = new Vec2();
  private readonly dragStartWorld = new Vec2();
  private readonly dragEndWorld = new Vec2();

  private readonly squadUpdateContext: SquadUpdateContext;

  private leftMouseDown = false;
  private dragSelecting = false;
  private dragAdditive = false;

  private lastFrameTime = performance.now();
  private accumulator = 0;
  private simTime = 0;
  private fps = 60;
  private lastOrderMode = 'Idle';

  constructor(app: Application) {
    this.app = app;

    this.app.stage.addChild(this.worldLayer);
    this.worldLayer.addChild(this.mapLayer);
    this.worldLayer.addChild(this.waypointLayer);
    this.worldLayer.addChild(this.unitLayer);
    this.worldLayer.addChild(this.overlayLayer);
    this.app.stage.addChild(this.uiLayer);

    this.camera = new Camera(this.worldBounds);
    this.hud = new Hud(this.uiLayer);
    this.selectionBox = new SelectionBox(this.uiLayer);

    this.drawMap();
    this.spawnTeams();

    this.squadUpdateContext = {
      dt: FIXED_DT,
      simTime: 0,
      world: this.worldBounds,
      allSquads: this.squads,
    };

    this.camera.position.set(this.worldBounds.width * 0.5, this.worldBounds.height * 0.5);
    this.camera.setViewport(this.app.screen.width, this.app.screen.height);
    this.camera.applyTo(this.worldLayer);

    this.bindInput();
    this.app.ticker.add(this.tick);
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
    const blueY = [700, 1200, 1700];
    const redY = [700, 1200, 1700];
    let squadId = 1;

    for (let i = 0; i < 3; i += 1) {
      const squad = new Squad({
        id: squadId,
        team: TeamId.Blue,
        color: 0x58aefc,
        initialAnchor: new Vec2(850, blueY[i]),
        facing: 0,
        soldierCount: SOLDIERS_PER_SQUAD,
        unitLayer: this.unitLayer,
        overlayLayer: this.overlayLayer,
      });
      this.squads.push(squad);
      squadId += 1;
    }

    for (let i = 0; i < 3; i += 1) {
      const squad = new Squad({
        id: squadId,
        team: TeamId.Red,
        color: 0xff7c7c,
        initialAnchor: new Vec2(3150, redY[i]),
        facing: Math.PI,
        soldierCount: SOLDIERS_PER_SQUAD,
        unitLayer: this.unitLayer,
        overlayLayer: this.overlayLayer,
      });
      this.squads.push(squad);
      squadId += 1;
    }
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

  private readonly onResize = (): void => {
    this.camera.setViewport(this.app.screen.width, this.app.screen.height);
    this.camera.applyTo(this.worldLayer);
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
      this.lastOrderMode = queue ? 'Queue Move + Face' : 'Move + Face';
    } else {
      this.lastOrderMode = queue ? 'Queue Move' : 'Move';
    }
  };

  private commandFormation(formation: FormationType): void {
    if (this.selectedSquads.size === 0) {
      return;
    }

    for (const squad of this.selectedSquads) {
      squad.setFormation(formation);
    }

    this.lastOrderMode = `Formation ${formationLabel(formation)}`;
  }

  private commandHold(): void {
    if (this.selectedSquads.size === 0) {
      return;
    }

    for (const squad of this.selectedSquads) {
      squad.holdPosition();
    }

    this.lastOrderMode = 'Hold';
  }

  private commandCharge(): void {
    if (this.selectedSquads.size === 0) {
      return;
    }

    for (const squad of this.selectedSquads) {
      squad.orderCharge();
    }

    this.lastOrderMode = 'Charge';
  }

  private commandRetreat(): void {
    if (this.selectedSquads.size === 0) {
      return;
    }

    for (const squad of this.selectedSquads) {
      squad.orderRetreat(this.worldBounds);
    }

    this.lastOrderMode = 'Retreat';
  }

  private performClickSelection(worldPoint: Vec2, additive: boolean): void {
    let clicked: Squad | null = null;
    let nearestDistSq = CLICK_RADIUS_SQ;

    for (let i = 0; i < this.squads.length; i += 1) {
      const squad = this.squads[i];
      if (!squad.hasLivingSoldiers()) {
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
      if (!squad.hasLivingSoldiers()) {
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

  private readonly tick = (): void => {
    const now = performance.now();
    let frameTime = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    if (frameTime > 0.25) {
      frameTime = 0.25;
    }

    this.accumulator += frameTime;
    if (frameTime > 0.00001) {
      const rawFps = 1 / frameTime;
      this.fps = this.fps * 0.9 + rawFps * 0.1;
    }

    while (this.accumulator >= FIXED_DT) {
      this.fixedUpdate(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }

    this.renderFrame();
  };

  private fixedUpdate(dt: number): void {
    this.simTime += dt;
    this.updateCameraPan(dt);

    this.combat.update(dt, this.squads);

    this.squadUpdateContext.dt = dt;
    this.squadUpdateContext.simTime = this.simTime;

    for (let i = 0; i < this.squads.length; i += 1) {
      this.squads[i].update(this.squadUpdateContext);
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

    this.hud.update({
      fps: this.fps,
      selectedCount: this.selectedSquads.size,
      formation: this.currentSelectedFormationLabel(),
      orderMode: this.currentSelectedOrderLabel(),
    });
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

  private currentSelectedOrderLabel(): string {
    if (this.selectedSquads.size === 0) {
      return this.lastOrderMode;
    }

    let current: OrderMode | null = null;
    for (const squad of this.selectedSquads) {
      if (current === null) {
        current = squad.order;
      } else if (current !== squad.order) {
        return 'Mixed';
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