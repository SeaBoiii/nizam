import { SeededRng } from '../utils/rng';
import type { MapState, Node, NodeType } from './types';

const MAP_WIDTH = 980;
const MAP_HEIGHT = 560;
const MAP_PADDING_X = 60;
const MAP_PADDING_Y = 54;

function pickNodeType(rng: SeededRng): NodeType {
  const roll = rng.next();
  if (roll < 0.52) {
    return 'BATTLE';
  }
  if (roll < 0.65) {
    return 'SHOP';
  }
  if (roll < 0.79) {
    return 'RECRUIT';
  }
  if (roll < 0.92) {
    return 'REST';
  }
  return 'ELITE';
}

function ensurePath(layers: Node[][]): void {
  for (let i = 0; i < layers.length - 1; i += 1) {
    const from = layers[i][0];
    const to = layers[i + 1][0];
    if (!from.edges.includes(to.id)) {
      from.edges.push(to.id);
    }
  }
}

function connectLayers(rng: SeededRng, fromLayer: Node[], toLayer: Node[]): void {
  for (let i = 0; i < fromLayer.length; i += 1) {
    const from = fromLayer[i];
    const sorted = toLayer
      .slice()
      .sort((a, b) => Math.abs(a.y - from.y) - Math.abs(b.y - from.y));

    const maxLinks = Math.min(3, sorted.length);
    const linkCount = rng.int(1, maxLinks);

    for (let linkIndex = 0; linkIndex < linkCount; linkIndex += 1) {
      const node = sorted[linkIndex];
      if (!from.edges.includes(node.id)) {
        from.edges.push(node.id);
      }
    }

    if (maxLinks > 1 && rng.chance(0.35)) {
      const randomNode = sorted[rng.int(0, maxLinks - 1)];
      if (!from.edges.includes(randomNode.id)) {
        from.edges.push(randomNode.id);
      }
    }
  }

  for (let targetIndex = 0; targetIndex < toLayer.length; targetIndex += 1) {
    const target = toLayer[targetIndex];
    let hasIncoming = false;

    for (let fromIndex = 0; fromIndex < fromLayer.length; fromIndex += 1) {
      if (fromLayer[fromIndex].edges.includes(target.id)) {
        hasIncoming = true;
        break;
      }
    }

    if (hasIncoming) {
      continue;
    }

    let closest = fromLayer[0];
    let closestDist = Math.abs(closest.y - target.y);

    for (let fromIndex = 1; fromIndex < fromLayer.length; fromIndex += 1) {
      const candidate = fromLayer[fromIndex];
      const dist = Math.abs(candidate.y - target.y);
      if (dist < closestDist) {
        closest = candidate;
        closestDist = dist;
      }
    }

    closest.edges.push(target.id);
  }
}

export function generateMap(seed: number): MapState {
  const rng = new SeededRng(seed);

  const targetNodes = rng.int(18, 24);
  const layerCount = rng.int(5, 6);
  const middleLayers = layerCount - 2;

  const layerSizes: number[] = [1];
  let remaining = targetNodes - 2;

  for (let layerIndex = 0; layerIndex < middleLayers; layerIndex += 1) {
    const layersRemaining = middleLayers - layerIndex - 1;
    const minForFuture = layersRemaining * 3;
    const maxForCurrent = Math.max(3, Math.min(6, remaining - minForFuture));
    const desired = rng.int(3, 5);
    const value = Math.min(maxForCurrent, Math.max(3, desired));
    layerSizes.push(value);
    remaining -= value;
  }

  let pointer = 1;
  while (remaining > 0 && pointer < layerSizes.length) {
    if (layerSizes[pointer] < 6) {
      layerSizes[pointer] += 1;
      remaining -= 1;
    }
    pointer += 1;
    if (pointer >= layerSizes.length) {
      pointer = 1;
    }
  }

  layerSizes.push(1);

  const layers: Node[][] = [];
  let nodeCounter = 0;

  for (let layerIndex = 0; layerIndex < layerSizes.length; layerIndex += 1) {
    const count = layerSizes[layerIndex];
    const nodes: Node[] = [];

    const x = MAP_PADDING_X + (layerIndex / (layerSizes.length - 1)) * (MAP_WIDTH - MAP_PADDING_X * 2);
    const rowSpan = MAP_HEIGHT - MAP_PADDING_Y * 2;

    for (let i = 0; i < count; i += 1) {
      const yBase = count === 1 ? MAP_HEIGHT * 0.5 : MAP_PADDING_Y + (i / (count - 1)) * rowSpan;
      const jitter = count === 1 ? 0 : rng.range(-18, 18);
      const type =
        layerIndex === 0
          ? 'REST'
          : layerIndex === layerSizes.length - 1
            ? 'BOSS'
            : pickNodeType(rng);

      nodes.push({
        id: `node_${nodeCounter}`,
        type,
        x,
        y: yBase + jitter,
        edges: [],
        cleared: false,
      });

      nodeCounter += 1;
    }

    layers.push(nodes);
  }

  ensurePath(layers);

  for (let layerIndex = 0; layerIndex < layers.length - 1; layerIndex += 1) {
    connectLayers(rng, layers[layerIndex], layers[layerIndex + 1]);
  }

  const nodes: Node[] = [];
  for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
    const layer = layers[layerIndex];
    for (let i = 0; i < layer.length; i += 1) {
      nodes.push(layer[i]);
    }
  }

  return {
    nodes,
    startNodeId: layers[0][0].id,
    bossNodeId: layers[layers.length - 1][0].id,
  };
}