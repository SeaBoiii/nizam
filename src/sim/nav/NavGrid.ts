import type { TerrainRect } from '../map/Terrain';
import { rectIntersectsRect } from '../map/Terrain';

export class NavGrid {
  readonly width: number;
  readonly height: number;
  readonly cellSize: number;
  readonly cols: number;
  readonly rows: number;
  readonly cellCount: number;

  private readonly blocked: Uint8Array;
  private readonly visit: Int32Array;
  private readonly queue: Int32Array;
  private readonly distance: Float32Array;
  private readonly neighbors: Int32Array;
  private searchToken = 1;
  private version = 0;

  constructor(width: number, height: number, cellSize: number, obstacles: readonly TerrainRect[]) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.cellSize = Math.max(8, cellSize);
    this.cols = Math.max(1, Math.ceil(this.width / this.cellSize));
    this.rows = Math.max(1, Math.ceil(this.height / this.cellSize));
    this.cellCount = this.cols * this.rows;

    this.blocked = new Uint8Array(this.cellCount);
    this.visit = new Int32Array(this.cellCount);
    this.queue = new Int32Array(this.cellCount);
    this.distance = new Float32Array(this.cellCount);
    this.neighbors = new Int32Array(8);

    this.rebuild(obstacles);
  }

  rebuild(obstacles: readonly TerrainRect[]): void {
    this.blocked.fill(0);
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        const index = this.cellIndex(col, row);
        const cellRect = this.getCellRect(col, row);
        for (let i = 0; i < obstacles.length; i += 1) {
          if (rectIntersectsRect(cellRect, obstacles[i])) {
            this.blocked[index] = 1;
            break;
          }
        }
      }
    }
    this.version += 1;
  }

  getVersion(): number {
    return this.version;
  }

  worldToCell(x: number, y: number): number {
    const col = this.clampCol(Math.floor(x / this.cellSize));
    const row = this.clampRow(Math.floor(y / this.cellSize));
    return this.cellIndex(col, row);
  }

  cellCenterX(index: number): number {
    const col = index % this.cols;
    return col * this.cellSize + this.cellSize * 0.5;
  }

  cellCenterY(index: number): number {
    const row = Math.floor(index / this.cols);
    return row * this.cellSize + this.cellSize * 0.5;
  }

  isCellBlocked(index: number): boolean {
    return index < 0 || index >= this.cellCount || this.blocked[index] !== 0;
  }

  isWorldBlocked(x: number, y: number): boolean {
    return this.isCellBlocked(this.worldToCell(x, y));
  }

  forEachNeighbor(index: number, callback: (neighborIndex: number) => void): void {
    const count = this.getNeighbors(index, this.neighbors);
    for (let i = 0; i < count; i += 1) {
      callback(this.neighbors[i]);
    }
  }

  getNeighborIndices(index: number, out: Int32Array): number {
    return this.getNeighbors(index, out);
  }

  findNearestOpenCell(startIndex: number, maxDepth = 8): number {
    if (!this.isCellBlocked(startIndex)) {
      return startIndex;
    }

    this.searchToken += 1;
    const token = this.searchToken;
    let head = 0;
    let tail = 0;
    this.queue[tail] = startIndex;
    tail += 1;
    this.visit[startIndex] = token;
    this.distance[startIndex] = 0;

    while (head < tail) {
      const index = this.queue[head];
      head += 1;
      const depth = this.distance[index];
      if (depth > maxDepth) {
        continue;
      }

      const count = this.getNeighbors(index, this.neighbors);
      for (let i = 0; i < count; i += 1) {
        const neighbor = this.neighbors[i];
        if (this.visit[neighbor] === token) {
          continue;
        }
        this.visit[neighbor] = token;
        this.distance[neighbor] = depth + 1;
        if (!this.isCellBlocked(neighbor)) {
          return neighbor;
        }
        this.queue[tail] = neighbor;
        tail += 1;
      }
    }

    return startIndex;
  }

  estimatePathDistance(startX: number, startY: number, targetX: number, targetY: number, maxDepth = 80): number {
    let start = this.worldToCell(startX, startY);
    let target = this.worldToCell(targetX, targetY);
    start = this.findNearestOpenCell(start, 6);
    target = this.findNearestOpenCell(target, 6);
    if (start === target) {
      return 0;
    }

    this.searchToken += 1;
    const token = this.searchToken;
    let head = 0;
    let tail = 0;
    this.queue[tail] = start;
    tail += 1;
    this.visit[start] = token;
    this.distance[start] = 0;

    while (head < tail) {
      const index = this.queue[head];
      head += 1;
      const depth = this.distance[index];
      if (depth >= maxDepth) {
        continue;
      }

      const count = this.getNeighbors(index, this.neighbors);
      for (let i = 0; i < count; i += 1) {
        const neighbor = this.neighbors[i];
        if (this.visit[neighbor] === token || this.isCellBlocked(neighbor)) {
          continue;
        }
        this.visit[neighbor] = token;
        const neighborDepth = depth + 1;
        this.distance[neighbor] = neighborDepth;
        if (neighbor === target) {
          return neighborDepth * this.cellSize;
        }
        this.queue[tail] = neighbor;
        tail += 1;
      }
    }

    const dx = targetX - startX;
    const dy = targetY - startY;
    return Math.hypot(dx, dy) * 2.2;
  }

  private cellIndex(col: number, row: number): number {
    return row * this.cols + col;
  }

  private clampCol(col: number): number {
    if (col < 0) {
      return 0;
    }
    if (col >= this.cols) {
      return this.cols - 1;
    }
    return col;
  }

  private clampRow(row: number): number {
    if (row < 0) {
      return 0;
    }
    if (row >= this.rows) {
      return this.rows - 1;
    }
    return row;
  }

  private getCellRect(col: number, row: number): TerrainRect {
    return {
      x: col * this.cellSize,
      y: row * this.cellSize,
      w: this.cellSize,
      h: this.cellSize,
    };
  }

  private getNeighbors(index: number, out: Int32Array): number {
    const col = index % this.cols;
    const row = Math.floor(index / this.cols);
    let count = 0;

    if (col > 0) {
      out[count] = index - 1;
      count += 1;
    }
    if (col < this.cols - 1) {
      out[count] = index + 1;
      count += 1;
    }
    if (row > 0) {
      out[count] = index - this.cols;
      count += 1;
    }
    if (row < this.rows - 1) {
      out[count] = index + this.cols;
      count += 1;
    }

    return count;
  }
}
