import { Container, Graphics } from 'pixi.js';
import { Vec2 } from '../utils/vec2';

export class SelectionBox {
  readonly start = new Vec2();
  readonly end = new Vec2();

  private readonly graphics: Graphics;
  private active = false;

  constructor(uiLayer: Container) {
    this.graphics = new Graphics();
    this.graphics.visible = false;
    uiLayer.addChild(this.graphics);
  }

  begin(x: number, y: number): void {
    this.active = true;
    this.start.set(x, y);
    this.end.set(x, y);
    this.graphics.visible = true;
    this.draw();
  }

  update(x: number, y: number): void {
    if (!this.active) {
      return;
    }

    this.end.set(x, y);
    this.draw();
  }

  hide(): void {
    this.active = false;
    this.graphics.visible = false;
    this.graphics.clear();
  }

  isActive(): boolean {
    return this.active;
  }

  private draw(): void {
    const left = Math.min(this.start.x, this.end.x);
    const top = Math.min(this.start.y, this.end.y);
    const width = Math.abs(this.end.x - this.start.x);
    const height = Math.abs(this.end.y - this.start.y);

    this.graphics.clear();
    this.graphics.rect(left, top, width, height);
    this.graphics.fill({ color: 0x7fb5ff, alpha: 0.18 });
    this.graphics.stroke({ color: 0x9fd2ff, alpha: 0.85, width: 1.5 });
  }
}