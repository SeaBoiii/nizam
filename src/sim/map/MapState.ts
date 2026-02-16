import type { BattleMapContent, MapTerrainEntryContent, TerrainRulesContent } from '../../content/ContentTypes';
import { Vec2 } from '../../utils/vec2';
import { Gates, type GateState } from './Gates';
import {
  containsRectPoint,
  mapEntryToTerrainType,
  segmentIntersectsRect,
  type TerrainFeature,
  type TerrainFlags,
  type TerrainRect,
} from './Terrain';

export interface MapObjectiveCircle {
  x: number;
  y: number;
  radius: number;
}

export type MapObjectiveKey = 'capturePoint' | 'exitZone' | 'gateZone' | 'courtyardZone';

export class BattleMapState {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;

  readonly terrainRules: TerrainRulesContent;
  readonly cellSize: number;

  private readonly blueSpawns: Vec2[];
  private readonly redSpawns: Vec2[];
  private readonly capturePoint: MapObjectiveCircle;
  private readonly exitZone: MapObjectiveCircle;
  private readonly gateZone: MapObjectiveCircle;
  private readonly courtyardZone: MapObjectiveCircle;

  private readonly allTerrain: TerrainFeature[] = [];
  private readonly obstacles: TerrainRect[] = [];
  private readonly forests: TerrainRect[] = [];
  private readonly hills: TerrainRect[] = [];
  private readonly gates = new Gates();

  private readonly blockedObstacleRects: TerrainRect[] = [];
  private blockedCacheDirty = true;

  private readonly terrainFlags: TerrainFlags = { inForest: false, onHill: false };
  private navRevision = 0;
  private visualRevision = 0;

  constructor(map: BattleMapContent, terrainRules: TerrainRulesContent, cellSize: number) {
    this.id = map.id;
    this.name = map.name;
    this.width = Math.max(300, map.size.w);
    this.height = Math.max(300, map.size.h);
    this.terrainRules = {
      forest: { ...terrainRules.forest },
      hill: { ...terrainRules.hill },
    };
    this.cellSize = Math.max(16, cellSize);

    this.blueSpawns = map.spawns.blue.map((spawn) => new Vec2(spawn.x, spawn.y));
    this.redSpawns = map.spawns.red.map((spawn) => new Vec2(spawn.x, spawn.y));

    if (this.blueSpawns.length === 0) {
      this.blueSpawns.push(new Vec2(180, this.height * 0.5));
    }
    if (this.redSpawns.length === 0) {
      this.redSpawns.push(new Vec2(this.width - 180, this.height * 0.5));
    }

    this.capturePoint = {
      x: map.objectives.capturePoint.x,
      y: map.objectives.capturePoint.y,
      radius: Math.max(40, map.objectives.capturePoint.radius),
    };
    this.exitZone = {
      x: map.objectives.exitZone.x,
      y: map.objectives.exitZone.y,
      radius: Math.max(40, map.objectives.exitZone.radius),
    };

    const gateSource = map.objectives.gateZone ?? map.objectives.capturePoint;
    this.gateZone = {
      x: gateSource.x,
      y: gateSource.y,
      radius: Math.max(40, gateSource.radius),
    };

    const courtyardSource = map.objectives.courtyardZone ?? map.objectives.capturePoint;
    this.courtyardZone = {
      x: courtyardSource.x,
      y: courtyardSource.y,
      radius: Math.max(40, courtyardSource.radius),
    };

    for (let i = 0; i < map.terrain.length; i += 1) {
      this.addTerrainEntry(map.terrain[i], i);
    }
  }

  getCapturePoint(): MapObjectiveCircle {
    return {
      x: this.capturePoint.x,
      y: this.capturePoint.y,
      radius: this.capturePoint.radius,
    };
  }

  getExitZone(): MapObjectiveCircle {
    return {
      x: this.exitZone.x,
      y: this.exitZone.y,
      radius: this.exitZone.radius,
    };
  }

  getGateZone(): MapObjectiveCircle {
    return {
      x: this.gateZone.x,
      y: this.gateZone.y,
      radius: this.gateZone.radius,
    };
  }

  getCourtyardZone(): MapObjectiveCircle {
    return {
      x: this.courtyardZone.x,
      y: this.courtyardZone.y,
      radius: this.courtyardZone.radius,
    };
  }

  getObjectivePos(type: MapObjectiveKey, out: Vec2): Vec2 {
    if (type === 'capturePoint') {
      out.set(this.capturePoint.x, this.capturePoint.y);
    } else if (type === 'exitZone') {
      out.set(this.exitZone.x, this.exitZone.y);
    } else if (type === 'gateZone') {
      out.set(this.gateZone.x, this.gateZone.y);
    } else {
      out.set(this.courtyardZone.x, this.courtyardZone.y);
    }
    return out;
  }

  getSpawn(team: 'blue' | 'red', index: number, out: Vec2): Vec2 {
    const list = team === 'blue' ? this.blueSpawns : this.redSpawns;
    const safeIndex = ((index % list.length) + list.length) % list.length;
    out.copy(list[safeIndex]);
    return out;
  }

  getSpawnCount(team: 'blue' | 'red'): number {
    return team === 'blue' ? this.blueSpawns.length : this.redSpawns.length;
  }

  getObstacleRects(): readonly TerrainRect[] {
    return this.obstacles;
  }

  getBlockedObstacleRects(): readonly TerrainRect[] {
    if (this.blockedCacheDirty) {
      this.rebuildBlockedObstacleCache();
    }
    return this.blockedObstacleRects;
  }

  getForestRects(): readonly TerrainRect[] {
    return this.forests;
  }

  getHillRects(): readonly TerrainRect[] {
    return this.hills;
  }

  getGateStates(): readonly GateState[] {
    return this.gates.getAll();
  }

  getPrimaryGateId(fallback = 'main_gate'): string {
    const gates = this.gates.getAll();
    if (gates.length > 0) {
      return gates[0].id;
    }
    return fallback;
  }

  getAllTerrain(): readonly TerrainFeature[] {
    return this.allTerrain;
  }

  getNavRevision(): number {
    return this.navRevision;
  }

  getVisualRevision(): number {
    return this.visualRevision;
  }

  isGateOpen(gateId: string): boolean {
    return this.gates.isOpen(gateId);
  }

  openGate(gateId: string): boolean {
    const changed = this.gates.setOpen(gateId, true);
    if (changed) {
      this.markGateStateChanged();
    }
    return changed;
  }

  closeGate(gateId: string): boolean {
    const changed = this.gates.setOpen(gateId, false);
    if (changed) {
      this.markGateStateChanged();
    }
    return changed;
  }

  getGateCenter(gateId: string, out: Vec2): boolean {
    const gate = this.gates.getById(gateId);
    if (gate === null) {
      return false;
    }
    out.x = gate.rect.x + gate.rect.w * 0.5;
    out.y = gate.rect.y + gate.rect.h * 0.5;
    return true;
  }

  isBlocked(x: number, y: number, padding = 0): boolean {
    const rects = this.getBlockedObstacleRects();
    for (let i = 0; i < rects.length; i += 1) {
      const rect = rects[i];
      if (
        x >= rect.x - padding &&
        x <= rect.x + rect.w + padding &&
        y >= rect.y - padding &&
        y <= rect.y + rect.h + padding
      ) {
        return true;
      }
    }
    return false;
  }

  isLineBlocked(x0: number, y0: number, x1: number, y1: number): boolean {
    const rects = this.getBlockedObstacleRects();
    for (let i = 0; i < rects.length; i += 1) {
      if (segmentIntersectsRect(x0, y0, x1, y1, rects[i])) {
        return true;
      }
    }
    return false;
  }

  getTerrainFlags(x: number, y: number): TerrainFlags {
    this.terrainFlags.inForest = false;
    this.terrainFlags.onHill = false;

    for (let i = 0; i < this.forests.length; i += 1) {
      if (containsRectPoint(this.forests[i], x, y)) {
        this.terrainFlags.inForest = true;
        break;
      }
    }

    for (let i = 0; i < this.hills.length; i += 1) {
      if (containsRectPoint(this.hills[i], x, y)) {
        this.terrainFlags.onHill = true;
        break;
      }
    }

    return this.terrainFlags;
  }

  isInForest(x: number, y: number): boolean {
    for (let i = 0; i < this.forests.length; i += 1) {
      if (containsRectPoint(this.forests[i], x, y)) {
        return true;
      }
    }
    return false;
  }

  isOnHill(x: number, y: number): boolean {
    for (let i = 0; i < this.hills.length; i += 1) {
      if (containsRectPoint(this.hills[i], x, y)) {
        return true;
      }
    }
    return false;
  }

  getNearestHillCenter(from: Vec2, out: Vec2): boolean {
    let found = false;
    let nearestDistSq = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.hills.length; i += 1) {
      const hill = this.hills[i];
      const centerX = hill.x + hill.w * 0.5;
      const centerY = hill.y + hill.h * 0.5;
      const dx = centerX - from.x;
      const dy = centerY - from.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        out.x = centerX;
        out.y = centerY;
        found = true;
      }
    }
    return found;
  }

  pushOutOfObstacles(pos: Vec2, radius: number): boolean {
    let moved = false;
    const inflation = Math.max(0, radius);
    const rects = this.getBlockedObstacleRects();

    for (let pass = 0; pass < 3; pass += 1) {
      let passMoved = false;
      for (let i = 0; i < rects.length; i += 1) {
        const rect = rects[i];
        const left = rect.x - inflation;
        const right = rect.x + rect.w + inflation;
        const top = rect.y - inflation;
        const bottom = rect.y + rect.h + inflation;

        if (pos.x < left || pos.x > right || pos.y < top || pos.y > bottom) {
          continue;
        }

        const penLeft = pos.x - left;
        const penRight = right - pos.x;
        const penTop = pos.y - top;
        const penBottom = bottom - pos.y;
        const minPen = Math.min(penLeft, penRight, penTop, penBottom);

        if (minPen === penLeft) {
          pos.x = left;
        } else if (minPen === penRight) {
          pos.x = right;
        } else if (minPen === penTop) {
          pos.y = top;
        } else {
          pos.y = bottom;
        }

        passMoved = true;
        moved = true;
      }

      if (!passMoved) {
        break;
      }
    }

    return moved;
  }

  private addTerrainEntry(entry: MapTerrainEntryContent, index: number): void {
    const rect: TerrainRect = {
      x: entry.x,
      y: entry.y,
      w: Math.max(4, entry.w),
      h: Math.max(4, entry.h),
    };
    const type = mapEntryToTerrainType(entry.type);
    this.allTerrain.push({
      type,
      rect,
    });

    if (type === 'OBSTACLE') {
      this.obstacles.push(rect);
      this.blockedCacheDirty = true;
      return;
    }
    if (type === 'FOREST') {
      this.forests.push(rect);
      return;
    }
    if (type === 'HILL') {
      this.hills.push(rect);
      return;
    }

    const gateId = entry.id ?? `gate_${index}`;
    this.gates.addGate(gateId, rect, false);
    this.blockedCacheDirty = true;
  }

  private markGateStateChanged(): void {
    this.blockedCacheDirty = true;
    this.navRevision += 1;
    this.visualRevision += 1;
  }

  private rebuildBlockedObstacleCache(): void {
    this.blockedObstacleRects.length = 0;
    for (let i = 0; i < this.obstacles.length; i += 1) {
      this.blockedObstacleRects.push(this.obstacles[i]);
    }

    const closedGates = this.gates.getClosedRects();
    for (let i = 0; i < closedGates.length; i += 1) {
      this.blockedObstacleRects.push(closedGates[i]);
    }

    this.blockedCacheDirty = false;
  }
}
