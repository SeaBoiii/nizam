import { Container, Graphics, Text } from 'pixi.js';
import type { Squad } from '../../sim/Squad';
import type { Soldier } from '../../sim/Soldier';
import { BattleMapState } from '../../sim/map/MapState';
import type { WorldBounds } from '../../sim/types';
import { TeamId } from '../../sim/types';
import { MINIMAP_HEIGHT, MINIMAP_MARGIN, MINIMAP_WIDTH } from '../../sim/rules/Constants';
import type { ObjectiveMinimapMarker } from '../../sim/objectives/IObjective';

export class Minimap {
  private readonly root = new Container();
  private readonly graphics = new Graphics();
  private readonly title = new Text({
    text: 'Minimap',
    style: {
      fill: 0xd7e6ff,
      fontFamily: 'monospace',
      fontSize: 11,
    },
  });

  private width = MINIMAP_WIDTH;
  private height = MINIMAP_HEIGHT;

  constructor(uiLayer: Container, private readonly world: WorldBounds) {
    this.root.addChild(this.graphics);
    this.title.position.set(6, 4);
    this.root.addChild(this.title);
    uiLayer.addChild(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  resize(screenWidth: number, screenHeight: number): void {
    this.root.position.set(screenWidth - this.width - MINIMAP_MARGIN, screenHeight - this.height - MINIMAP_MARGIN);
  }

  update(
    squads: readonly Squad[],
    units: readonly Soldier[],
    objectiveMarkers: readonly ObjectiveMinimapMarker[],
    mapState: BattleMapState,
  ): void {
    const scaleX = this.width / this.world.width;
    const scaleY = this.height / this.world.height;

    this.graphics.clear();
    this.graphics.roundRect(0, 0, this.width, this.height, 8);
    this.graphics.fill({ color: 0x0b1219, alpha: 0.72 });
    this.graphics.stroke({ color: 0x7aa5d6, alpha: 0.7, width: 1.4 });

    const forests = mapState.getForestRects();
    for (let i = 0; i < forests.length; i += 1) {
      const rect = forests[i];
      this.graphics.rect(rect.x * scaleX, rect.y * scaleY, rect.w * scaleX, rect.h * scaleY);
      this.graphics.fill({ color: 0x476f47, alpha: 0.2 });
    }

    const hills = mapState.getHillRects();
    for (let i = 0; i < hills.length; i += 1) {
      const rect = hills[i];
      this.graphics.rect(rect.x * scaleX, rect.y * scaleY, rect.w * scaleX, rect.h * scaleY);
      this.graphics.stroke({ color: 0xd8bc82, alpha: 0.35, width: 1 });
    }

    const obstacles = mapState.getObstacleRects();
    for (let i = 0; i < obstacles.length; i += 1) {
      const rect = obstacles[i];
      this.graphics.rect(rect.x * scaleX, rect.y * scaleY, rect.w * scaleX, rect.h * scaleY);
      this.graphics.fill({ color: 0x2b3e51, alpha: 0.85 });
    }

    for (let markerIndex = 0; markerIndex < objectiveMarkers.length; markerIndex += 1) {
      const marker = objectiveMarkers[markerIndex];
      const markerX = marker.x * scaleX;
      const markerY = marker.y * scaleY;
      this.graphics.circle(markerX, markerY, Math.max(2, marker.radius * scaleX));
      this.graphics.stroke({ color: marker.color, alpha: 0.68, width: 1 });
    }

    for (let i = 0; i < units.length; i += 1) {
      const unit = units[i];
      if (!unit.alive) {
        continue;
      }

      const color = unit.team === TeamId.Blue ? 0x66b7ff : 0xff8d8d;
      const x = unit.position.x * scaleX;
      const y = unit.position.y * scaleY;
      this.graphics.circle(x, y, 1.15);
      this.graphics.fill({ color, alpha: 0.85 });
    }

    for (let i = 0; i < squads.length; i += 1) {
      const squad = squads[i];
      if (!squad.hasLivingSoldiers()) {
        continue;
      }

      const color = squad.team === TeamId.Blue ? 0x9dd4ff : 0xffbbbb;
      const x = squad.anchor.x * scaleX;
      const y = squad.anchor.y * scaleY;
      this.graphics.rect(x - 1.8, y - 1.8, 3.6, 3.6);
      this.graphics.fill({ color, alpha: 0.95 });
    }
  }
}
