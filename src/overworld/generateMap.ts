import { contentManager } from '../content/ContentManager';
import { SeededRng } from '../utils/rng';
import type { MapState, Node, NodeType } from './types';

const MAP_WIDTH = 980;
const MAP_HEIGHT = 560;
const MAP_PADDING_X = 60;
const MAP_PADDING_Y = 54;

function pickNodeType(rng: SeededRng, depth: number): NodeType {
  const nodeTuning = contentManager.getNodeTuning();
  let weights = nodeTuning.nodeTypeWeightsByDepth[0].weights;
  for (let i = 0; i < nodeTuning.nodeTypeWeightsByDepth.length; i += 1) {
    const band = nodeTuning.nodeTypeWeightsByDepth[i];
    if (depth >= band.depthMin && depth <= band.depthMax) {
      weights = band.weights;
      break;
    }
  }

  const total = Math.max(0.0001, weights.BATTLE + weights.SHOP + weights.RECRUIT + weights.REST + weights.ELITE);
  const roll = rng.range(0, total);
  let acc = weights.BATTLE;
  if (roll <= acc) {
    return 'BATTLE';
  }
  acc += weights.SHOP;
  if (roll <= acc) {
    return 'SHOP';
  }
  acc += weights.RECRUIT;
  if (roll <= acc) {
    return 'RECRUIT';
  }
  acc += weights.REST;
  if (roll <= acc) {
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

    const linkExtraChance = contentManager.getNodeTuning().mapGeneration.linkExtraChance;
    if (maxLinks > 1 && rng.chance(linkExtraChance)) {
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
  const tuning = contentManager.getNodeTuning();
  const mapTuning = tuning.mapGeneration;

  const targetNodes = rng.int(mapTuning.minNodes, mapTuning.maxNodes);
  const layerCount = rng.int(mapTuning.layerCountMin, mapTuning.layerCountMax);
  const middleLayers = layerCount - 2;

  const layerSizes: number[] = [1];
  let remaining = targetNodes - 2;

  for (let layerIndex = 0; layerIndex < middleLayers; layerIndex += 1) {
    const layersRemaining = middleLayers - layerIndex - 1;
    const minForFuture = layersRemaining * mapTuning.middleLayerMin;
    const maxForCurrent = Math.max(
      mapTuning.middleLayerMin,
      Math.min(mapTuning.middleLayerCap, remaining - minForFuture),
    );
    const desired = rng.int(mapTuning.middleLayerMin, mapTuning.middleLayerMax);
    const value = Math.min(maxForCurrent, Math.max(mapTuning.middleLayerMin, desired));
    layerSizes.push(value);
    remaining -= value;
  }

  let pointer = 1;
  while (remaining > 0 && pointer < layerSizes.length) {
    if (layerSizes[pointer] < mapTuning.middleLayerCap) {
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
      const jitter = count === 1 ? 0 : rng.range(-mapTuning.nodeJitterY, mapTuning.nodeJitterY);
      const type =
        layerIndex === 0
          ? 'REST'
          : layerIndex === layerSizes.length - 1
            ? 'BOSS'
            : pickNodeType(rng, layerIndex - 1);

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
