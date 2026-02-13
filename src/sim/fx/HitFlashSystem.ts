import { Graphics, type Container } from 'pixi.js';

interface FlashMarker {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  size: number;
  alive: boolean;
}

const MARKER_POOL_SIZE = 512;

export class HitFlashSystem {
  private readonly graphics = new Graphics();
  private readonly markers: FlashMarker[] = [];
  private cursor = 0;

  constructor(layer: Container) {
    layer.addChild(this.graphics);
    for (let i = 0; i < MARKER_POOL_SIZE; i += 1) {
      this.markers.push({
        x: 0,
        y: 0,
        life: 0,
        maxLife: 0.22,
        size: 5,
        alive: false,
      });
    }
  }

  clear(): void {
    for (let i = 0; i < this.markers.length; i += 1) {
      this.markers[i].alive = false;
    }
    this.graphics.clear();
  }

  spawn(x: number, y: number, amount: number): void {
    const marker = this.markers[this.cursor];
    this.cursor = (this.cursor + 1) % this.markers.length;
    marker.x = x;
    marker.y = y;
    marker.maxLife = 0.13 + Math.min(0.22, amount * 0.004);
    marker.life = marker.maxLife;
    marker.size = 2.8 + Math.min(6.5, amount * 0.09);
    marker.alive = true;
  }

  update(dt: number): void {
    for (let i = 0; i < this.markers.length; i += 1) {
      const marker = this.markers[i];
      if (!marker.alive) {
        continue;
      }
      marker.life -= dt;
      if (marker.life <= 0) {
        marker.alive = false;
      }
    }
    this.render();
  }

  private render(): void {
    this.graphics.clear();
    for (let i = 0; i < this.markers.length; i += 1) {
      const marker = this.markers[i];
      if (!marker.alive) {
        continue;
      }

      const alpha = marker.life / Math.max(0.01, marker.maxLife);
      const size = marker.size * (1 - alpha * 0.22);
      this.graphics.circle(marker.x, marker.y, size);
      this.graphics.stroke({ color: 0xfff0c2, alpha: 0.75 * alpha, width: 1.2 });
      this.graphics.moveTo(marker.x - size, marker.y);
      this.graphics.lineTo(marker.x + size, marker.y);
      this.graphics.moveTo(marker.x, marker.y - size);
      this.graphics.lineTo(marker.x, marker.y + size);
      this.graphics.stroke({ color: 0xfff4df, alpha: 0.5 * alpha, width: 1 });
    }
  }
}

