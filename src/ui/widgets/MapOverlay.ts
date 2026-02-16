import { Graphics, type Container } from 'pixi.js';
import { BattleMapState } from '../../sim/map/MapState';

export class MapOverlay {
  readonly graphics: Graphics;
  private lastMapId = '';
  private lastVisualRevision = -1;

  constructor(layer: Container) {
    this.graphics = new Graphics();
    layer.addChild(this.graphics);
  }

  draw(mapState: BattleMapState): void {
    if (this.lastMapId === mapState.id && this.lastVisualRevision === mapState.getVisualRevision()) {
      return;
    }
    this.lastMapId = mapState.id;
    this.lastVisualRevision = mapState.getVisualRevision();

    this.graphics.clear();

    const forests = mapState.getForestRects();
    for (let i = 0; i < forests.length; i += 1) {
      const rect = forests[i];
      this.graphics.rect(rect.x, rect.y, rect.w, rect.h);
      this.graphics.fill({ color: 0x3f6b3f, alpha: 0.2 });
      this.graphics.stroke({ color: 0x9dcd9d, alpha: 0.36, width: 1 });

      const step = 18;
      for (let x = rect.x - rect.h; x < rect.x + rect.w; x += step) {
        this.graphics.moveTo(x, rect.y);
        this.graphics.lineTo(x + rect.h, rect.y + rect.h);
      }
      this.graphics.stroke({ color: 0x95c995, alpha: 0.2, width: 0.8 });
    }

    const hills = mapState.getHillRects();
    for (let i = 0; i < hills.length; i += 1) {
      const rect = hills[i];
      this.graphics.roundRect(rect.x, rect.y, rect.w, rect.h, 8);
      this.graphics.fill({ color: 0xc6a86f, alpha: 0.12 });
      this.graphics.stroke({ color: 0xe7c98e, alpha: 0.55, width: 1.4 });
    }

    const obstacles = mapState.getObstacleRects();
    for (let i = 0; i < obstacles.length; i += 1) {
      const rect = obstacles[i];
      this.graphics.rect(rect.x, rect.y, rect.w, rect.h);
      this.graphics.fill({ color: 0x1c2d3f, alpha: 0.82 });
      this.graphics.stroke({ color: 0x466a91, alpha: 0.75, width: 1 });
    }

    const gates = mapState.getGateStates();
    for (let i = 0; i < gates.length; i += 1) {
      const gate = gates[i];
      const rect = gate.rect;
      this.graphics.roundRect(rect.x, rect.y, rect.w, rect.h, 4);
      if (gate.isOpen) {
        this.graphics.fill({ color: 0x5f9679, alpha: 0.22 });
        this.graphics.stroke({ color: 0x8fd4b1, alpha: 0.95, width: 2.4 });
      } else {
        this.graphics.fill({ color: 0x2e3c4a, alpha: 0.9 });
        this.graphics.stroke({ color: 0x87a9c4, alpha: 0.95, width: 2.4 });
      }
    }
  }
}
