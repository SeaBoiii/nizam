import type { Soldier } from './Soldier';

export class SpatialHash {
  private readonly buckets = new Map<number, Soldier[]>();

  constructor(private readonly cellSize: number) {}

  clear(): void {
    for (const bucket of this.buckets.values()) {
      bucket.length = 0;
    }
  }

  insert(soldier: Soldier): void {
    const ix = Math.floor(soldier.position.x / this.cellSize);
    const iy = Math.floor(soldier.position.y / this.cellSize);
    const bucketKey = this.key(ix, iy);

    let bucket = this.buckets.get(bucketKey);
    if (bucket === undefined) {
      bucket = [];
      this.buckets.set(bucketKey, bucket);
    }

    bucket.push(soldier);
  }

  queryNearby(x: number, y: number, out: Soldier[]): Soldier[] {
    return this.queryRadius(x, y, this.cellSize * 1.01, out);
  }

  queryRadius(x: number, y: number, radius: number, out: Soldier[]): Soldier[] {
    out.length = 0;
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minY = Math.floor((y - radius) / this.cellSize);
    const maxY = Math.floor((y + radius) / this.cellSize);

    for (let iy = minY; iy <= maxY; iy += 1) {
      for (let ix = minX; ix <= maxX; ix += 1) {
        const bucket = this.buckets.get(this.key(ix, iy));
        if (bucket === undefined || bucket.length === 0) {
          continue;
        }

        for (let i = 0; i < bucket.length; i += 1) {
          out.push(bucket[i]);
        }
      }
    }

    return out;
  }

  private key(ix: number, iy: number): number {
    return (ix << 16) ^ (iy & 0xffff);
  }
}
