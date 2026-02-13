export class Vec2 {
  x: number;
  y: number;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(v: Vec2): this {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  add(v: Vec2): this {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  sub(v: Vec2): this {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  scale(s: number): this {
    this.x *= s;
    this.y *= s;
    return this;
  }

  addScaled(v: Vec2, scale: number): this {
    this.x += v.x * scale;
    this.y += v.y * scale;
    return this;
  }

  lenSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  len(): number {
    return Math.hypot(this.x, this.y);
  }

  normalize(): this {
    const length = this.len();
    if (length > 0.000001) {
      this.x /= length;
      this.y /= length;
    }
    return this;
  }

  limit(max: number): this {
    const maxSq = max * max;
    const lengthSq = this.lenSq();
    if (lengthSq > maxSq && lengthSq > 0) {
      const scale = max / Math.sqrt(lengthSq);
      this.x *= scale;
      this.y *= scale;
    }
    return this;
  }

  distanceSqTo(v: Vec2): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return dx * dx + dy * dy;
  }

  distanceTo(v: Vec2): number {
    return Math.sqrt(this.distanceSqTo(v));
  }
}