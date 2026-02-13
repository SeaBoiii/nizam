import type { Graphics } from 'pixi.js';
import type { BattleScenario } from '../../meta/types';
import type { Camera } from '../../game/Camera';
import type { Soldier } from '../Soldier';
import type { Squad } from '../Squad';
import type { TeamId, WorldBounds } from '../types';
import type { UnitArchetype } from '../types/UnitArchetype';
import type { Vec2 } from '../../utils/vec2';
import type { BattleObjectiveType } from './ObjectiveTypes';

export interface ObjectiveHUDState {
  title: string;
  lines: string[];
  progressBlue?: number;
  progressRed?: number;
  timer?: number;
  secondary?: number;
}

export interface ObjectiveTacticalState {
  type: BattleObjectiveType;
  focusPosition: Vec2;
  captureRadius: number;
  blueCommander: Soldier | null;
  redCommander: Soldier | null;
  caravan: Soldier | null;
  exitPosition: Vec2 | null;
  exitRadius: number;
}

export interface ObjectiveMinimapMarker {
  x: number;
  y: number;
  radius: number;
  color: number;
}

export interface ObjectiveSpawnSquadRequest {
  team: TeamId;
  archetypeId: string;
  tier: number;
  soldierCount: number;
  x: number;
  y: number;
  facing: number;
  commandable?: boolean;
  color?: number;
  archetypeOverride?: UnitArchetype;
}

export interface ObjectiveWorld {
  scenario: BattleScenario;
  bounds: WorldBounds;
  objectiveCenter: Vec2;
  simTime: number;
  squads: Squad[];
  aliveSoldiers: Soldier[];
  spawnSquad(request: ObjectiveSpawnSquadRequest): Squad;
}

export interface IObjective {
  id: string;
  type: BattleObjectiveType;
  onStart(world: ObjectiveWorld): void;
  update(dt: number, world: ObjectiveWorld): void;
  isComplete(): boolean;
  getWinner(): 'blue' | 'red' | null;
  getHUDState(): ObjectiveHUDState;
  getTacticalState(): ObjectiveTacticalState;
  getMinimapMarkers(out: ObjectiveMinimapMarker[]): void;
  renderOverlay?(gfx: Graphics, camera: Camera): void;
}
