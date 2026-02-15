import type { Vec2 } from '../../utils/vec2';
import { NavGrid } from './NavGrid';

const INF = 1e9;

export class FlowField {
  private readonly cost: Float32Array;
  private readonly dirX: Float32Array;
  private readonly dirY: Float32Array;
  private readonly queue: Int32Array;
  private readonly neighbors: Int32Array;

  private targetCell = -1;
  private lastBuildTime = -999;
  private readonly rebuildIntervalSec: number;

  constructor(private readonly navGrid: NavGrid, rebuildIntervalSec = 1) {
    this.cost = new Float32Array(navGrid.cellCount);
    this.dirX = new Float32Array(navGrid.cellCount);
    this.dirY = new Float32Array(navGrid.cellCount);
    this.queue = new Int32Array(navGrid.cellCount);
    this.neighbors = new Int32Array(8);
    this.rebuildIntervalSec = Math.max(0.25, rebuildIntervalSec);
    this.clear();
  }

  clear(): void {
    this.cost.fill(INF);
    this.dirX.fill(0);
    this.dirY.fill(0);
    this.targetCell = -1;
    this.lastBuildTime = -999;
  }

  updateTarget(targetX: number, targetY: number, simTime: number): void {
    const rawTarget = this.navGrid.worldToCell(targetX, targetY);
    const target = this.navGrid.findNearestOpenCell(rawTarget, 10);

    if (target === this.targetCell && simTime - this.lastBuildTime < this.rebuildIntervalSec) {
      return;
    }

    this.targetCell = target;
    this.lastBuildTime = simTime;
    this.rebuild();
  }

  getDirectionAt(x: number, y: number, out: Vec2): boolean {
    if (this.targetCell < 0) {
      out.set(0, 0);
      return false;
    }

    let cell = this.navGrid.worldToCell(x, y);
    if (this.navGrid.isCellBlocked(cell)) {
      cell = this.navGrid.findNearestOpenCell(cell, 6);
    }

    const dx = this.dirX[cell];
    const dy = this.dirY[cell];
    out.set(dx, dy);
    return dx * dx + dy * dy > 0.00001;
  }

  private rebuild(): void {
    this.cost.fill(INF);
    this.dirX.fill(0);
    this.dirY.fill(0);
    if (this.targetCell < 0 || this.navGrid.isCellBlocked(this.targetCell)) {
      return;
    }

    let head = 0;
    let tail = 0;
    this.queue[tail] = this.targetCell;
    tail += 1;
    this.cost[this.targetCell] = 0;

    while (head < tail) {
      const cell = this.queue[head];
      head += 1;
      const baseCost = this.cost[cell];

      const neighborCount = this.navGrid.getNeighborIndices(cell, this.neighbors);
      for (let i = 0; i < neighborCount; i += 1) {
        const neighbor = this.neighbors[i];
        if (this.navGrid.isCellBlocked(neighbor)) {
          continue;
        }
        const nextCost = baseCost + 1;
        if (nextCost >= this.cost[neighbor]) {
          continue;
        }
        this.cost[neighbor] = nextCost;
        this.queue[tail] = neighbor;
        tail += 1;
      }
    }

    for (let cell = 0; cell < this.navGrid.cellCount; cell += 1) {
      if (this.navGrid.isCellBlocked(cell)) {
        continue;
      }
      const currentCost = this.cost[cell];
      if (currentCost >= INF || cell === this.targetCell) {
        continue;
      }

      let bestNeighbor = -1;
      let bestCost = currentCost;
      const neighborCount = this.navGrid.getNeighborIndices(cell, this.neighbors);
      for (let i = 0; i < neighborCount; i += 1) {
        const neighbor = this.neighbors[i];
        const neighborCost = this.cost[neighbor];
        if (neighborCost < bestCost) {
          bestCost = neighborCost;
          bestNeighbor = neighbor;
        }
      }

      if (bestNeighbor < 0) {
        continue;
      }

      const fromX = this.navGrid.cellCenterX(cell);
      const fromY = this.navGrid.cellCenterY(cell);
      const toX = this.navGrid.cellCenterX(bestNeighbor);
      const toY = this.navGrid.cellCenterY(bestNeighbor);
      const dx = toX - fromX;
      const dy = toY - fromY;
      const len = Math.hypot(dx, dy);
      if (len <= 0.0001) {
        continue;
      }
      this.dirX[cell] = dx / len;
      this.dirY[cell] = dy / len;
    }
  }
}

