import { Container, Graphics, Text } from 'pixi.js';

interface RoutBurst {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  radius: number;
  teamColor: number;
  alive: boolean;
}

const ROUT_BURST_POOL_SIZE = 80;

export class RoutBurstSystem {
  private readonly graphics = new Graphics();
  private readonly labelLayer = new Container();
  private readonly bursts: RoutBurst[] = [];
  private readonly labels: Text[] = [];
  private cursor = 0;

  constructor(layer: Container) {
    layer.addChild(this.graphics);
    layer.addChild(this.labelLayer);

    for (let i = 0; i < ROUT_BURST_POOL_SIZE; i += 1) {
      this.bursts.push({
        x: 0,
        y: 0,
        life: 0,
        maxLife: 1.5,
        radius: 12,
        teamColor: 0xffaaaa,
        alive: false,
      });
      const label = new Text({
        text: 'ROUT',
        style: {
          fill: 0xffe3a9,
          fontFamily: 'monospace',
          fontSize: 12,
          fontWeight: 'bold',
        },
      });
      label.anchor.set(0.5, 1);
      label.visible = false;
      this.labels.push(label);
      this.labelLayer.addChild(label);
    }
  }

  clear(): void {
    for (let i = 0; i < this.bursts.length; i += 1) {
      this.bursts[i].alive = false;
      this.labels[i].visible = false;
    }
    this.graphics.clear();
  }

  spawn(x: number, y: number, teamColor: number, intensity = 1): void {
    const index = this.cursor;
    this.cursor = (this.cursor + 1) % this.bursts.length;
    const burst = this.bursts[index];
    burst.x = x;
    burst.y = y;
    burst.teamColor = teamColor;
    burst.maxLife = 1.5;
    burst.life = burst.maxLife;
    burst.radius = 20 * Math.max(0.3, intensity);
    burst.alive = true;

    const label = this.labels[index];
    label.visible = true;
    label.position.set(x, y - 18);
    label.alpha = 1;
  }

  update(dt: number): void {
    for (let i = 0; i < this.bursts.length; i += 1) {
      const burst = this.bursts[i];
      if (!burst.alive) {
        continue;
      }
      burst.life -= dt;
      if (burst.life <= 0) {
        burst.alive = false;
        this.labels[i].visible = false;
        continue;
      }

      const alpha = burst.life / burst.maxLife;
      this.labels[i].visible = true;
      this.labels[i].alpha = Math.min(1, alpha * 1.2);
      this.labels[i].position.set(burst.x, burst.y - 16 - (1 - alpha) * 16);
    }
    this.render();
  }

  private render(): void {
    this.graphics.clear();
    for (let i = 0; i < this.bursts.length; i += 1) {
      const burst = this.bursts[i];
      if (!burst.alive) {
        continue;
      }

      const alpha = burst.life / burst.maxLife;
      const r = burst.radius + (1 - alpha) * 52;
      this.graphics.circle(burst.x, burst.y, r);
      this.graphics.stroke({ color: burst.teamColor, alpha: 0.56 * alpha, width: 1.5 });
    }
  }
}
