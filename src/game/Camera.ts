import { Container } from 'pixi.js';
import type { WorldBounds } from '../sim/types';
import { clamp } from '../utils/math';
import { Vec2 } from '../utils/vec2';

export class Camera {
  readonly position = new Vec2();
  zoom = 1;

  readonly minZoom = 0.45;
  readonly maxZoom = 2.2;

  private viewportWidth = 1;
  private viewportHeight = 1;
  private readonly tempBefore = new Vec2();
  private readonly tempAfter = new Vec2();

  constructor(private readonly world: WorldBounds) {}

  setViewport(width: number, height: number): void {
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);
    this.clampToBounds();
  }

  pan(worldDx: number, worldDy: number): void {
    this.position.x += worldDx;
    this.position.y += worldDy;
    this.clampToBounds();
  }

  zoomAt(screenX: number, screenY: number, zoomFactor: number): void {
    this.screenToWorld(screenX, screenY, this.tempBefore);
    this.zoom = clamp(this.zoom * zoomFactor, this.minZoom, this.maxZoom);
    this.screenToWorld(screenX, screenY, this.tempAfter);

    this.position.x += this.tempBefore.x - this.tempAfter.x;
    this.position.y += this.tempBefore.y - this.tempAfter.y;
    this.clampToBounds();
  }

  clampToBounds(): void {
    const halfWorldWidth = this.viewportWidth * 0.5 / this.zoom;
    const halfWorldHeight = this.viewportHeight * 0.5 / this.zoom;

    const minX = halfWorldWidth;
    const maxX = this.world.width - halfWorldWidth;
    const minY = halfWorldHeight;
    const maxY = this.world.height - halfWorldHeight;

    if (minX > maxX) {
      this.position.x = this.world.width * 0.5;
    } else {
      this.position.x = clamp(this.position.x, minX, maxX);
    }

    if (minY > maxY) {
      this.position.y = this.world.height * 0.5;
    } else {
      this.position.y = clamp(this.position.y, minY, maxY);
    }
  }

  applyTo(container: Container): void {
    container.scale.set(this.zoom, this.zoom);
    container.position.set(
      this.viewportWidth * 0.5 - this.position.x * this.zoom,
      this.viewportHeight * 0.5 - this.position.y * this.zoom,
    );
  }

  screenToWorld(screenX: number, screenY: number, out: Vec2): Vec2 {
    out.x = (screenX - this.viewportWidth * 0.5) / this.zoom + this.position.x;
    out.y = (screenY - this.viewportHeight * 0.5) / this.zoom + this.position.y;
    return out;
  }
}