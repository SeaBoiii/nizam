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

  forEachNearby(x: number, y: number, callback: (soldier: Soldier) => void): void {
    const centerX = Math.floor(x / this.cellSize);
    const centerY = Math.floor(y / this.cellSize);

    for (let iy = centerY - 1; iy <= centerY + 1; iy += 1) {
      for (let ix = centerX - 1; ix <= centerX + 1; ix += 1) {
        const bucket = this.buckets.get(this.key(ix, iy));
        if (bucket === undefined || bucket.length === 0) {
          continue;
        }

        for (let i = 0; i < bucket.length; i += 1) {
          callback(bucket[i]);
        }
      }
    }
  }

  private key(ix: number, iy: number): number {
    return (ix << 16) ^ (iy & 0xffff);
  }
}