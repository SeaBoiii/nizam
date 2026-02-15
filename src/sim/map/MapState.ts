import type { BattleMapContent, MapTerrainEntryContent, TerrainRulesContent } from '../../content/ContentTypes';
import { Vec2 } from '../../utils/vec2';
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

  private readonly allTerrain: TerrainFeature[] = [];
  private readonly obstacles: TerrainRect[] = [];
  private readonly forests: TerrainRect[] = [];
  private readonly hills: TerrainRect[] = [];

  private readonly terrainFlags: TerrainFlags = { inForest: false, onHill: false };

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

    for (let i = 0; i < map.terrain.length; i += 1) {
      this.addTerrainEntry(map.terrain[i]);
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

  getObjectivePos(type: 'capturePoint' | 'exitZone', out: Vec2): Vec2 {
    if (type === 'capturePoint') {
      out.set(this.capturePoint.x, this.capturePoint.y);
    } else {
      out.set(this.exitZone.x, this.exitZone.y);
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

  getForestRects(): readonly TerrainRect[] {
    return this.forests;
  }

  getHillRects(): readonly TerrainRect[] {
    return this.hills;
  }

  getAllTerrain(): readonly TerrainFeature[] {
    return this.allTerrain;
  }

  isBlocked(x: number, y: number, padding = 0): boolean {
    for (let i = 0; i < this.obstacles.length; i += 1) {
      const rect = this.obstacles[i];
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
    for (let i = 0; i < this.obstacles.length; i += 1) {
      if (segmentIntersectsRect(x0, y0, x1, y1, this.obstacles[i])) {
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

    for (let pass = 0; pass < 3; pass += 1) {
      let passMoved = false;
      for (let i = 0; i < this.obstacles.length; i += 1) {
        const rect = this.obstacles[i];
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

  private addTerrainEntry(entry: MapTerrainEntryContent): void {
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
    } else if (type === 'FOREST') {
      this.forests.push(rect);
    } else {
      this.hills.push(rect);
    }
  }
}
