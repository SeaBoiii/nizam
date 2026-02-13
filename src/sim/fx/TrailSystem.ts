import { Graphics, type Container } from 'pixi.js';
import type { Soldier } from '../Soldier';
import { TeamId } from '../types';

interface TrailSegment {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  alive: boolean;
}

const TRAIL_SEGMENT_POOL_SIZE = 1200;
const TRAIL_SPEED_THRESHOLD = 72;
const TRAIL_EMIT_INTERVAL = 0.05;

export class TrailSystem {
  private readonly graphics = new Graphics();
  private readonly segments: TrailSegment[] = [];
  private cursor = 0;
  private enabled = true;

  constructor(layer: Container) {
    layer.addChild(this.graphics);
    for (let i = 0; i < TRAIL_SEGMENT_POOL_SIZE; i += 1) {
      this.segments.push({
        x: 0,
        y: 0,
        life: 0,
        maxLife: 0.6,
        size: 2,
        color: 0xffffff,
        alive: false,
      });
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.graphics.visible = enabled;
  }

  clear(): void {
    for (let i = 0; i < this.segments.length; i += 1) {
      this.segments[i].alive = false;
    }
    this.graphics.clear();
  }

  update(dt: number, units: readonly Soldier[]): void {
    for (let i = 0; i < this.segments.length; i += 1) {
      const segment = this.segments[i];
      if (!segment.alive) {
        continue;
      }
      segment.life -= dt;
      if (segment.life <= 0) {
        segment.alive = false;
      }
    }

    if (this.enabled) {
      const speedThresholdSq = TRAIL_SPEED_THRESHOLD * TRAIL_SPEED_THRESHOLD;
      for (let i = 0; i < units.length; i += 1) {
        const unit = units[i];
        if (!unit.alive) {
          continue;
        }
        unit.trailCooldown = Math.max(0, unit.trailCooldown - dt);
        if (unit.velocity.lenSq() < speedThresholdSq || unit.trailCooldown > 0) {
          continue;
        }

        const speed = unit.velocity.len();
        this.spawn(
          unit.position.x,
          unit.position.y,
          unit.team === TeamId.Blue ? 0x8ac9ff : 0xff9c9c,
          0.45 + Math.min(0.4, speed / 220),
          unit.tags.has('cavalry') ? 2.9 : 2.1,
        );
        unit.trailCooldown = TRAIL_EMIT_INTERVAL;
      }
    }

    this.render();
  }

  private spawn(x: number, y: number, color: number, maxLife: number, size: number): void {
    const segment = this.segments[this.cursor];
    this.cursor = (this.cursor + 1) % this.segments.length;
    segment.x = x;
    segment.y = y;
    segment.color = color;
    segment.maxLife = maxLife;
    segment.life = maxLife;
    segment.size = size;
    segment.alive = true;
  }

  private render(): void {
    this.graphics.clear();
    if (!this.enabled) {
      return;
    }
    for (let i = 0; i < this.segments.length; i += 1) {
      const segment = this.segments[i];
      if (!segment.alive) {
        continue;
      }
      const alpha = Math.max(0, segment.life / Math.max(0.01, segment.maxLife));
      this.graphics.circle(segment.x, segment.y, segment.size);
      this.graphics.fill({ color: segment.color, alpha: 0.22 * alpha });
    }
  }
}

