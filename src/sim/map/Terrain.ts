import type { MapTerrainEntryContent } from '../../content/ContentTypes';
import type { Vec2 } from '../../utils/vec2';

export type TerrainType = 'OBSTACLE' | 'FOREST' | 'HILL' | 'GATE';

export interface TerrainRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TerrainFeature {
  type: TerrainType;
  rect: TerrainRect;
}

export interface TerrainFlags {
  inForest: boolean;
  onHill: boolean;
}

export function mapEntryToTerrainType(type: MapTerrainEntryContent['type']): TerrainType {
  if (type === 'OBSTACLE_RECT') {
    return 'OBSTACLE';
  }
  if (type === 'FOREST_RECT') {
    return 'FOREST';
  }
  if (type === 'GATE_RECT') {
    return 'GATE';
  }
  return 'HILL';
}

export function containsRectPoint(rect: TerrainRect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function containsPoint(feature: TerrainFeature, pos: Vec2): boolean {
  return containsRectPoint(feature.rect, pos.x, pos.y);
}

export function rectIntersectsRect(a: TerrainRect, b: TerrainRect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function segmentIntersectsRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rect: TerrainRect,
  sampleStep = 24,
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.0001) {
    return containsRectPoint(rect, x0, y0);
  }

  const steps = Math.max(1, Math.ceil(distance / Math.max(4, sampleStep)));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    if (containsRectPoint(rect, px, py)) {
      return true;
    }
  }
  return false;
}
