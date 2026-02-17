import { Vec2 } from '../utils/vec2';
import type { FormationType } from './types';

const BASE_SPACING = 18;
const BASE_DEPTH = 18;

// Performance: Pre-computed formation radii to avoid recalculating every frame
const FORMATION_RADIUS_CACHE = new Map<string, number>();

function getCachedFormationRadius(formation: FormationType, unitCount: number): number {
  const key = `${formation}-${unitCount}`;
  let radius = FORMATION_RADIUS_CACHE.get(key);
  
  if (radius === undefined) {
    radius = computeFormationRadius(formation, unitCount);
    FORMATION_RADIUS_CACHE.set(key, radius);
  }
  
  return radius;
}

function computeFormationRadius(formation: FormationType, unitCount: number): number {
  const temp = new Vec2();
  let maxDistance = 0;

  for (let i = 0; i < unitCount; i += 1) {
    computeSlotLocal(formation, i, unitCount, temp);
    const distance = Math.hypot(temp.x, temp.y);
    if (distance > maxDistance) {
      maxDistance = distance;
    }
  }

  return maxDistance + 24;
}

function lineSlot(slotIndex: number, unitCount: number, spacing: number, depth: number, out: Vec2): Vec2 {
  const ranks = 2;
  const perRank = Math.ceil(unitCount / ranks);
  const row = Math.floor(slotIndex / perRank);
  const col = slotIndex % perRank;

  out.x = (col - (perRank - 1) * 0.5) * spacing;
  out.y = -row * depth;
  return out;
}

function columnSlot(slotIndex: number, spacing: number, depth: number, out: Vec2): Vec2 {
  const columns = 3;
  const row = Math.floor(slotIndex / columns);
  const col = slotIndex % columns;

  out.x = (col - (columns - 1) * 0.5) * spacing;
  out.y = -row * depth;
  return out;
}

function wedgeSlot(slotIndex: number, spacing: number, depth: number, out: Vec2): Vec2 {
  let row = 0;
  let rowStart = 0;

  while (rowStart + row + 1 <= slotIndex) {
    rowStart += row + 1;
    row += 1;
  }

  const indexInRow = slotIndex - rowStart;
  out.x = (indexInRow - row * 0.5) * spacing;
  out.y = -row * depth;
  return out;
}

export function computeSlotLocal(
  formation: FormationType,
  slotIndex: number,
  unitCount: number,
  out: Vec2,
): Vec2 {
  switch (formation) {
    case 'line': {
      return lineSlot(slotIndex, unitCount, BASE_SPACING, BASE_DEPTH, out);
    }
    case 'column': {
      return columnSlot(slotIndex, BASE_SPACING * 0.9, BASE_DEPTH * 0.95, out);
    }
    case 'wedge': {
      return wedgeSlot(slotIndex, BASE_SPACING * 1.05, BASE_DEPTH * 1.05, out);
    }
    case 'loose': {
      return lineSlot(slotIndex, unitCount, BASE_SPACING * 1.6, BASE_DEPTH * 1.45, out);
    }
    default: {
      return lineSlot(slotIndex, unitCount, BASE_SPACING, BASE_DEPTH, out);
    }
  }
}

export function formationLabel(formation: FormationType): string {
  switch (formation) {
    case 'line':
      return 'Line';
    case 'column':
      return 'Column';
    case 'wedge':
      return 'Wedge';
    case 'loose':
      return 'Loose';
  }
}

export function estimateFormationRadius(formation: FormationType, unitCount: number): number {
  return getCachedFormationRadius(formation, unitCount);
}