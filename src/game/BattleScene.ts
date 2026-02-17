import { Application, Container, Graphics } from 'pixi.js';
import { audioManager } from '../audio/AudioManager';
import { contentManager } from '../content/ContentManager';
import type { GameSettings } from '../meta/Settings';
import { Camera } from './Camera';
import { formationLabel } from '../sim/Formation';
import { CombatSystem } from '../sim/CombatSystem';
import { GameEvents } from '../sim/events/GameEvents';
import { HitFlashSystem } from '../sim/fx/HitFlashSystem';
import { RoutBurstSystem } from '../sim/fx/RoutBurstSystem';
import { TrailSystem } from '../sim/fx/TrailSystem';
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
import { MapOverlay } from '../ui/widgets/MapOverlay';
import type { BattleResult, BattleScenario } from '../meta/types';
import type { ArmyState, SquadMeta } from '../meta/Army';
import { getTieredArchetype } from '../meta/Progression';
import { BattleMapState } from '../sim/map/MapState';
import { FlowField } from '../sim/nav/FlowField';
import { NavGrid } from '../sim/nav/NavGrid';
import { TerrainMods } from '../sim/rules/TerrainMods';
import type { UnitArchetype } from '../sim/types/UnitArchetype';
import { createObjectiveForScenario } from '../sim/objectives/createObjective';
import type { ObjectiveMinimapMarker, ObjectiveSpawnSquadRequest, ObjectiveWorld } from '../sim/objectives/IObjective';
import { AIDirector } from '../sim/ai/AIDirector';
import { AbilitySystem } from '../sim/abilities/AbilitySystem';
import type { CombinedPerkMods } from '../sim/rules/PerkMods';
import { DEFAULT_PERK_MODS } from '../sim/rules/PerkMods';
import { AbilityBar } from '../ui/widgets/AbilityBar';

const FIXED_DT = 1 / 60;
const CLICK_RADIUS_SQ = 42 * 42;
const DRAG_THRESHOLD_SQ = 8 * 8;

interface BattleSceneOptions {
  app: Application;
  parent: Container;
  scenario: BattleScenario;
  armyState: ArmyState;
  playerPerkMods: Readonly<CombinedPerkMods>;
  selectedAbilityId: string;
  settings: GameSettings;
  onEventsReady?: (events: GameEvents) => void;
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
  private readonly playerPerkMods: Readonly<CombinedPerkMods>;
  private readonly onFinished: (result: BattleResult) => void;
  private readonly worldBounds: WorldBounds;
  private readonly battleMap: BattleMapState;
  private readonly navGrid: NavGrid;
  private readonly terrainMods: TerrainMods;
  private mapNavRevision = 0;

  private readonly root = new Container();
  private readonly worldLayer = new Container();
  private readonly mapLayer = new Graphics();
  private readonly terrainLayer = new Container();
  private readonly objectiveLayer = new Container();
  private readonly objectiveGraphics = new Graphics();
  private readonly abilityGraphics = new Graphics();
  private readonly waypointLayer = new Graphics();
  private readonly trailLayer = new Container();
  private readonly unitLayer = new Container();
  private readonly projectileLayer = new Container();
  private readonly overlayLayer = new Container();
  private readonly uiLayer = new Container();

  private readonly camera: Camera;
  private readonly hud: Hud;
  private readonly abilityBar: AbilityBar;
  private readonly objectiveHud: ObjectiveHUD;
  private readonly minimap: Minimap;
  private readonly selectionBox: SelectionBox;
  private readonly squadIndicators: SquadIndicators;
  private readonly mapOverlay: MapOverlay;
  private readonly combat = new CombatSystem();
  private readonly rangedSystem = new RangedSystem();
  private readonly unitGrid = new SpatialHash(32);
  private readonly aiDirector = new AIDirector();
  private readonly abilitySystem: AbilitySystem;
  private readonly gameEvents = new GameEvents();
  private readonly trailSystem: TrailSystem;
  private readonly hitFlashSystem: HitFlashSystem;
  private readonly routBurstSystem: RoutBurstSystem;

  private readonly objectiveManager: ObjectiveManager;
  private readonly projectileSystem: ProjectileSystem;
  private readonly objectiveWorld: ObjectiveWorld;

  private readonly squads: Squad[] = [];
  private readonly selectedSquads = new Set<Squad>();
  private readonly keys = new Set<string>();
  private readonly aliveSoldiers: Soldier[] = [];
  private readonly minimapMarkers: ObjectiveMinimapMarker[] = [];
  private readonly orderEmitIds: number[] = [];
  private readonly spawnTemp = new Vec2();

  private readonly pointerScreen = new Vec2();
  private readonly pointerWorld = new Vec2();
  private readonly abilityCastTarget = new Vec2();
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
  private nextSquadId = 1;
  private paused = false;
  private cameraSpeed = 1;
  private showMinimap = true;
  private reduceScreenShake = false;

  private playerInitial = 0;
  private enemyInitial = 0;

  constructor(options: BattleSceneOptions) {
    this.app = options.app;
    this.parent = options.parent;
    this.scenario = options.scenario;
    this.armyState = options.armyState;
    this.playerPerkMods = options.playerPerkMods;
    this.onFinished = options.onFinished;

    const allMaps = contentManager.getAllMaps();
    const mapContent = contentManager.getMap(this.scenario.mapId) ?? allMaps[0];
    if (!mapContent) {
      throw new Error('No battle maps available.');
    }
    this.battleMap = new BattleMapState(mapContent, contentManager.getTerrainRules(), contentManager.getNavCellSize());
    this.worldBounds = {
      width: this.battleMap.width,
      height: this.battleMap.height,
    };
    this.navGrid = new NavGrid(
      this.worldBounds.width,
      this.worldBounds.height,
      this.battleMap.cellSize,
      this.battleMap.getBlockedObstacleRects(),
    );
    this.mapNavRevision = this.battleMap.getNavRevision();
    this.terrainMods = new TerrainMods(this.battleMap);

    this.objectiveManager = new ObjectiveManager(
      createObjectiveForScenario(this.scenario, this.battleMap, this.playerPerkMods),
    );

    this.root.addChild(this.worldLayer);
    this.worldLayer.addChild(this.mapLayer);
    this.worldLayer.addChild(this.terrainLayer);
    this.worldLayer.addChild(this.objectiveLayer);
    this.worldLayer.addChild(this.waypointLayer);
    this.worldLayer.addChild(this.trailLayer);
    this.worldLayer.addChild(this.unitLayer);
    this.worldLayer.addChild(this.projectileLayer);
    this.worldLayer.addChild(this.overlayLayer);
    this.root.addChild(this.uiLayer);
    this.parent.addChild(this.root);

    this.overlayLayer.addChild(this.objectiveGraphics);
    this.overlayLayer.addChild(this.abilityGraphics);

    this.camera = new Camera(this.worldBounds);
    this.hud = new Hud(this.uiLayer);
    this.abilityBar = new AbilityBar({
      parent: this.uiLayer,
      onCast: () => this.commandRally(),
    });
    this.objectiveHud = new ObjectiveHUD(this.uiLayer);
    this.minimap = new Minimap(this.uiLayer, this.worldBounds);
    this.selectionBox = new SelectionBox(this.uiLayer);
    this.squadIndicators = new SquadIndicators(this.overlayLayer);
    this.mapOverlay = new MapOverlay(this.terrainLayer);
    this.mapOverlay.draw(this.battleMap);
    this.projectileSystem = new ProjectileSystem(
      this.projectileLayer,
      contentManager.getObjectiveTuning().suppression,
    );
    this.trailSystem = new TrailSystem(this.trailLayer);
    this.hitFlashSystem = new HitFlashSystem(this.overlayLayer);
    this.routBurstSystem = new RoutBurstSystem(this.overlayLayer);
    this.abilitySystem = new AbilitySystem({
      squads: this.squads,
      events: this.gameEvents,
      selectedAbilityId: options.selectedAbilityId,
    });
    this.bindEventChannels();
    if (options.onEventsReady) {
      options.onEventsReady(this.gameEvents);
    }

    this.drawMap();

    this.squadUpdateContext = {
      dt: FIXED_DT,
      simTime: 0,
      world: this.worldBounds,
      objectivePosition: new Vec2(this.battleMap.getCapturePoint().x, this.battleMap.getCapturePoint().y),
      allSquads: this.squads,
      mapState: this.battleMap,
      navGrid: this.navGrid,
      terrainMods: this.terrainMods,
    };

    this.objectiveWorld = {
      scenario: this.scenario,
      bounds: this.worldBounds,
      mapState: this.battleMap,
      events: this.gameEvents,
      objectiveCenter: new Vec2(this.battleMap.getCapturePoint().x, this.battleMap.getCapturePoint().y),
      simTime: 0,
      squads: this.squads,
      aliveSoldiers: this.aliveSoldiers,
      spawnSquad: (request) => this.spawnObjectiveSquad(request),
    };

    this.camera.position.set(this.battleMap.getCapturePoint().x, this.battleMap.getCapturePoint().y);
    this.camera.setViewport(this.app.screen.width, this.app.screen.height);
    this.camera.applyTo(this.worldLayer);
    this.minimap.resize(this.app.screen.width, this.app.screen.height);
    this.aiDirector.setOrderFrequencyMultiplier(this.scenario.enemyAIFrequencyMult);
    this.aiDirector.resetBattle();
    this.applySettings(options.settings);

    this.spawnTeams();
    this.objectiveManager.onStart(this.objectiveWorld);
    this.collectAliveSoldiers();
    this.rebuildUnitGrid();

    this.bindInput();
  }

  destroy(): void {
    this.unbindInput();
    this.abilitySystem.destroy();

    for (let i = 0; i < this.squads.length; i += 1) {
      this.squads[i].destroy();
    }
    this.squads.length = 0;
    this.selectedSquads.clear();
    this.aliveSoldiers.length = 0;

    this.projectileSystem.clear();
    this.trailSystem.clear();
    this.hitFlashSystem.clear();
    this.routBurstSystem.clear();
    this.root.destroy({ children: true });
  }

  update(frameDt: number): void {
    if (this.finished || this.root.destroyed) {
      return;
    }

    if (this.paused || frameDt <= 0) {
      this.renderFrame();
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
    const playerSquads = this.armyState.squads;
    this.playerInitial = 0;
    this.enemyInitial = 0;
    this.nextSquadId = 1;

    for (let i = 0; i < playerSquads.length; i += 1) {
      const squadMeta = playerSquads[i];
      const archetype = this.makeArchetypeForMeta(squadMeta, true);
      const position = this.computeFormationSpawn(i, TeamId.Blue);
      this.spawnRuntimeSquad(
        TeamId.Blue,
        archetype,
        squadMeta.size,
        position.x,
        position.y,
        0,
        undefined,
        true,
        this.playerPerkMods,
      );
    }

    const enemySquads = this.scenario.enemySquads;
    for (let i = 0; i < enemySquads.length; i += 1) {
      const squadMeta = enemySquads[i];
      const archetype = this.makeArchetypeForMeta(squadMeta, false);
      const position = this.computeFormationSpawn(i, TeamId.Red);
      this.spawnRuntimeSquad(
        TeamId.Red,
        archetype,
        squadMeta.size,
        position.x,
        position.y,
        Math.PI,
        undefined,
        true,
        DEFAULT_PERK_MODS,
      );
    }
  }

  private spawnObjectiveSquad(request: ObjectiveSpawnSquadRequest): Squad {
    let archetype = request.archetypeOverride ?? getTieredArchetype(request.archetypeId, Math.max(1, request.tier));
    if (
      request.archetypeOverride === undefined &&
      request.team === TeamId.Blue &&
      this.scenario.playerHpBuffMultiplier > 1
    ) {
      archetype = {
        id: archetype.id,
        name: archetype.name,
        tags: [...archetype.tags],
        stats: {
          ...archetype.stats,
          hp: archetype.stats.hp * this.scenario.playerHpBuffMultiplier,
        },
      };
    }

    this.spawnTemp.set(request.x, request.y);
    this.battleMap.pushOutOfObstacles(this.spawnTemp, 16);

    return this.spawnRuntimeSquad(
      request.team,
      archetype,
      request.soldierCount,
      this.spawnTemp.x,
      this.spawnTemp.y,
      request.facing,
      request.color,
      request.commandable ?? true,
      request.team === TeamId.Blue ? this.playerPerkMods : DEFAULT_PERK_MODS,
    );
  }

  private spawnRuntimeSquad(
    team: TeamId,
    archetype: UnitArchetype,
    soldierCount: number,
    x: number,
    y: number,
    facing: number,
    color: number | undefined,
    commandable: boolean,
    perkMods: Readonly<CombinedPerkMods>,
  ): Squad {
    const squad = new Squad({
      id: this.nextSquadId,
      team,
      color: color ?? this.teamColor(archetype.id, team),
      initialAnchor: new Vec2(x, y),
      facing,
      soldierCount,
      archetype,
      unitLayer: this.unitLayer,
      overlayLayer: this.overlayLayer,
      commandable,
      perkMods,
      events: this.gameEvents,
      flowField: new FlowField(this.navGrid),
      navGrid: this.navGrid,
      terrainMods: this.terrainMods,
    });
    this.nextSquadId += 1;
    this.squads.push(squad);

    if (team === TeamId.Blue) {
      this.playerInitial += soldierCount;
    } else {
      this.enemyInitial += soldierCount;
    }

    return squad;
  }

  private teamColor(archetypeId: string, team: TeamId): number {
    const isArcher = archetypeId.includes('archer') || archetypeId.includes('slinger');
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

  private computeFormationSpawn(index: number, team: TeamId): Vec2 {
    const spawnTeam = team === TeamId.Blue ? 'blue' : 'red';
    const spawnCount = this.battleMap.getSpawnCount(spawnTeam);
    const baseIndex = ((index % spawnCount) + spawnCount) % spawnCount;
    const wave = Math.floor(index / spawnCount);

    this.battleMap.getSpawn(spawnTeam, baseIndex, this.spawnTemp);

    const localRow = wave % 3;
    const localCol = Math.floor(wave / 3);
    const rowOffset = (localRow - 1) * 94;
    const dir = team === TeamId.Blue ? 1 : -1;
    const colOffset = localCol * 106 * dir;

    this.spawnTemp.x += colOffset;
    this.spawnTemp.y += rowOffset;
    this.spawnTemp.x = Math.max(56, Math.min(this.worldBounds.width - 56, this.spawnTemp.x));
    this.spawnTemp.y = Math.max(56, Math.min(this.worldBounds.height - 56, this.spawnTemp.y));
    this.battleMap.pushOutOfObstacles(this.spawnTemp, 18);

    return this.spawnTemp.clone();
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
    if (this.paused) {
      return;
    }
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
        if (event.shiftKey) {
          this.commandRetreat();
        } else {
          this.commandRally();
        }
        break;
      case 'KeyT':
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
    if (this.paused) {
      return;
    }
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
    if (this.paused) {
      return;
    }
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
    if (this.paused) {
      return;
    }
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
    if (this.paused) {
      return;
    }
    event.preventDefault();
    this.toCanvasPoint(event.clientX, event.clientY, this.pointerScreen);

    const zoomFactor = Math.exp(-event.deltaY * 0.0014);
    this.camera.zoomAt(this.pointerScreen.x, this.pointerScreen.y, zoomFactor);
    this.camera.applyTo(this.worldLayer);
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    if (this.paused) {
      return;
    }
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
    this.emitOrderIssued('move');

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
    this.emitOrderIssued('hold');

    this.lastOrderMode = `FORMATION ${formationLabel(formation).toUpperCase()}`;
  }

  private commandHold(): void {
    if (this.selectedSquads.size === 0) {
      return;
    }

    for (const squad of this.selectedSquads) {
      squad.holdPosition();
    }
    this.emitOrderIssued('hold');

    this.lastOrderMode = 'HOLD';
  }

  private commandCharge(): void {
    if (this.selectedSquads.size === 0) {
      return;
    }

    for (const squad of this.selectedSquads) {
      squad.orderCharge();
    }
    this.emitOrderIssued('charge');

    this.lastOrderMode = 'CHARGE';
  }

  private commandRetreat(): void {
    if (this.selectedSquads.size === 0) {
      return;
    }

    for (const squad of this.selectedSquads) {
      squad.orderRetreat(this.worldBounds);
    }
    this.emitOrderIssued('retreat');

    this.lastOrderMode = 'RETREAT';
  }

  private commandRally(): void {
    this.getAbilityCastTarget(this.abilityCastTarget);
    if (!this.abilitySystem.cast(TeamId.Blue, this.abilityCastTarget)) {
      const cooldown = this.abilitySystem.getCooldownRemaining(TeamId.Blue);
      this.lastOrderMode = cooldown > 0 ? `RALLY CD ${cooldown.toFixed(1)}s` : 'RALLY UNAVAILABLE';
      return;
    }
    this.lastOrderMode = 'RALLY';
  }

  private commandVolley(): void {
    if (this.selectedSquads.size === 0) {
      return;
    }

    for (const squad of this.selectedSquads) {
      squad.orderVolley();
    }
    this.emitOrderIssued('volley');

    this.lastOrderMode = 'VOLLEY';
  }

  private commandSkirmish(): void {
    if (this.selectedSquads.size === 0) {
      return;
    }

    for (const squad of this.selectedSquads) {
      squad.orderSkirmish();
    }
    this.emitOrderIssued('skirmish');

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

      if (squad.team !== TeamId.Blue || !squad.commandable) {
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
      if (!squad.hasLivingSoldiers() || squad.team !== TeamId.Blue || !squad.commandable) {
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
    this.gameEvents.beginTick();
    this.syncNavToMapState();
    this.simTime += dt;
    this.abilitySystem.update(dt);
    this.updateCameraPan(dt);
    this.objectiveWorld.simTime = this.simTime;

    const tacticalBefore = this.objectiveManager.getTacticalState();
    this.squadUpdateContext.objectivePosition = tacticalBefore.focusPosition;

    this.squadUpdateContext.dt = dt;
    this.squadUpdateContext.simTime = this.simTime;

    for (let i = 0; i < this.squads.length; i += 1) {
      this.squads[i].update(this.squadUpdateContext);
    }

    this.collectAliveSoldiers();
    this.rebuildUnitGrid();

    this.rangedSystem.update(
      dt,
      this.squads,
      this.aliveSoldiers,
      this.unitGrid,
      this.projectileSystem,
      this.gameEvents,
      this.terrainMods,
    );
    this.combat.update(dt, this.aliveSoldiers, this.unitGrid, this.gameEvents);
    this.projectileSystem.update(dt, this.aliveSoldiers, this.unitGrid, this.gameEvents);

    this.collectAliveSoldiers();
    this.objectiveManager.update(dt, this.objectiveWorld);
    this.syncNavToMapState();

    const winnerByObjective = this.objectiveManager.getWinner();
    if (winnerByObjective !== null) {
      this.finishBattle(winnerByObjective === 'blue');
      return;
    }

    this.aiDirector.update(dt, {
      world: this.worldBounds,
      squads: this.squads,
      objective: this.objectiveManager.getTacticalState(),
      mapState: this.battleMap,
      navGrid: this.navGrid,
      abilitySystem: this.abilitySystem,
    });

    const playerRemaining = this.countTeamAlive(TeamId.Blue);
    const enemyRemaining = this.countTeamAlive(TeamId.Red);

    const objectiveType = this.objectiveManager.getType();
    if (objectiveType === 'HOLDOUT' || objectiveType === 'ESCORT') {
      if (playerRemaining <= 0) {
        this.finishBattle(false);
        return;
      }
    } else if (objectiveType === 'SIEGE') {
      if (playerRemaining <= 0) {
        this.finishBattle(false);
        return;
      }
      if (enemyRemaining <= 0) {
        this.finishBattle(true);
        return;
      }
    } else {
      if (enemyRemaining <= 0) {
        this.finishBattle(true);
        return;
      } else if (playerRemaining <= 0) {
        this.finishBattle(false);
        return;
      }
    }

    this.gameEvents.dispatch();
    this.trailSystem.update(dt, this.aliveSoldiers);
    this.hitFlashSystem.update(dt);
    this.routBurstSystem.update(dt);
  }

  private finishBattle(playerWon: boolean): void {
    if (this.finished) {
      return;
    }

    this.finished = true;
    this.gameEvents.emitBattleEnd(playerWon ? TeamId.Blue : TeamId.Red);
    this.gameEvents.dispatch();

    const playerRemaining = this.countTeamAlive(TeamId.Blue);
    const enemyRemaining = this.countTeamAlive(TeamId.Red);

    const result: BattleResult = {
      scenario: this.scenario,
      victory: playerWon,
      durationSec: this.simTime,
      playerInitial: this.playerInitial,
      playerRemaining,
      enemyInitial: this.enemyInitial,
      enemyRemaining,
      playerCasualties: Math.max(0, this.playerInitial - playerRemaining),
      enemyCasualties: Math.max(0, this.enemyInitial - enemyRemaining),
      archetypeDeaths: this.computeArchetypeDeaths(),
    };

    this.onFinished(result);
  }

  private computeArchetypeDeaths(): Record<string, number> {
    const deaths: Record<string, number> = {};

    for (let i = 0; i < this.squads.length; i += 1) {
      const squad = this.squads[i];
      let alive = 0;
      const soldiers = squad.soldiers;
      for (let j = 0; j < soldiers.length; j += 1) {
        if (soldiers[j].alive) {
          alive += 1;
        }
      }
      const dead = soldiers.length - alive;
      if (dead > 0) {
        deaths[squad.archetype.id] = (deaths[squad.archetype.id] ?? 0) + dead;
      }
    }

    return deaths;
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
    const speed = (780 * this.cameraSpeed) / this.camera.zoom;

    this.camera.pan(dirX * speed * dt, dirY * speed * dt);
  }

  private renderFrame(): void {
    this.mapOverlay.draw(this.battleMap);
    this.camera.applyTo(this.worldLayer);
    this.objectiveManager.renderOverlay(this.objectiveGraphics, this.camera);
    this.abilitySystem.renderOverlay(this.abilityGraphics);
    this.drawWaypointPaths();
    this.squadIndicators.update(this.squads);

    this.hud.update({
      fps: this.fps,
      selectedCount: this.selectedSquads.size,
      selectedArchetypes: this.currentSelectedArchetypeLabel(),
      formation: this.currentSelectedFormationLabel(),
      orderMode: this.currentSelectedOrderLabel(),
    });

    this.objectiveHud.update(this.objectiveManager.getHUDState());

    const ability = this.abilitySystem.getAbility(TeamId.Blue);
    this.abilityBar.update({
      abilityName: ability ? ability.name : '-',
      cooldownRemaining: this.abilitySystem.getCooldownRemaining(TeamId.Blue),
      cooldownDuration: this.abilitySystem.getCooldownDuration(TeamId.Blue),
      canCast: this.abilitySystem.canCast(TeamId.Blue),
    });
    this.abilityBar.layout(this.app.screen.width, this.app.screen.height);

    this.objectiveManager.getMinimapMarkers(this.minimapMarkers);
    if (this.showMinimap) {
      this.minimap.update(this.squads, this.aliveSoldiers, this.minimapMarkers, this.battleMap);
    }
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

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.keys.clear();
      this.leftMouseDown = false;
      this.dragSelecting = false;
      this.selectionBox.hide();
    }
  }

  applySettings(settings: GameSettings): void {
    this.cameraSpeed = settings.cameraSpeed;
    this.showMinimap = settings.showMinimap;
    this.reduceScreenShake = settings.reduceScreenShake;
    this.minimap.setVisible(this.showMinimap);
    this.trailSystem.setEnabled(settings.showTrails);
  }

  private bindEventChannels(): void {
    this.gameEvents.onOrderIssued((event) => {
      if (event.teamId === TeamId.Blue && event.orderType === 'charge') {
        audioManager.play('horn_charge', 1, 220);
      }
    });
    this.gameEvents.onProjectileFired(() => {
      audioManager.play('arrow_shoot', 0.55, 180);
    });
    this.gameEvents.onDamage((event) => {
      this.hitFlashSystem.spawn(event.x, event.y, event.amount);
      audioManager.play('hit_impact', 0.7, 70);
    });
    this.gameEvents.onSquadRouted((event) => {
      this.routBurstSystem.spawn(
        event.x,
        event.y,
        event.teamId === TeamId.Blue ? 0x7fc9ff : 0xffa4a4,
        this.reduceScreenShake ? 0.65 : 1,
      );
      audioManager.play('morale_break', 0.9, 250);
    });
    this.gameEvents.onBattleEnd((event) => {
      audioManager.play(event.winnerTeamId === TeamId.Blue ? 'victory' : 'defeat', 1, 0);
    });
    this.gameEvents.onGateOpened(() => {
      audioManager.play('horn_charge', 0.85, 300);
    });
    this.gameEvents.onAbilityCast(() => {
      audioManager.play('horn_charge', 0.8, 180);
    });
  }

  private toCanvasPoint(clientX: number, clientY: number, out: Vec2): Vec2 {
    const rect = this.app.canvas.getBoundingClientRect();
    out.x = clientX - rect.left;
    out.y = clientY - rect.top;
    return out;
  }

  private getAbilityCastTarget(out: Vec2): Vec2 {
    let selected: Squad | null = null;
    for (const squad of this.selectedSquads) {
      if (selected === null || squad.id < selected.id) {
        selected = squad;
      }
    }
    if (selected !== null) {
      out.copy(selected.anchor);
      return out;
    }
    out.copy(this.camera.position);
    return out;
  }

  private emitOrderIssued(orderType: OrderMode): void {
    this.orderEmitIds.length = 0;
    for (const squad of this.selectedSquads) {
      this.orderEmitIds.push(squad.id);
    }
    if (this.orderEmitIds.length === 0) {
      return;
    }
    this.gameEvents.emitOrderIssued(TeamId.Blue, orderType, this.orderEmitIds);
  }

  private syncNavToMapState(): void {
    const revision = this.battleMap.getNavRevision();
    if (revision === this.mapNavRevision) {
      return;
    }
    this.mapNavRevision = revision;
    this.navGrid.rebuild(this.battleMap.getBlockedObstacleRects());
    for (let i = 0; i < this.squads.length; i += 1) {
      const flowField = this.squads[i].flowField;
      if (flowField !== null) {
        flowField.clear();
      }
    }
  }
}
