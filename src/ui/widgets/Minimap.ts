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
  
  // Performance: Cache last map state to avoid redrawing static terrain every frame
  private lastMapStateHash = '';
  private mapStateDirty = true;
  private readonly terrainGraphics = new Graphics();

  constructor(uiLayer: Container, private readonly world: WorldBounds) {
    this.root.addChild(this.terrainGraphics);
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

    // Performance: Only redraw terrain when map state changes (gates opening, etc.)
    const currentMapHash = this.computeMapStateHash(mapState);
    if (this.mapStateDirty || currentMapHash !== this.lastMapStateHash) {
      this.lastMapStateHash = currentMapHash;
      this.mapStateDirty = false;
      this.redrawTerrain(scaleX, scaleY, mapState);
    }

    // Clear only dynamic elements (units, squads)
    this.graphics.clear();

    // Draw objective markers
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

  private computeMapStateHash(mapState: BattleMapState): string {
    // Create a simple hash based on gate states (main dynamic terrain element)
    const gates = mapState.getGateStates();
    return gates.map((g) => `${g.id}:${g.isOpen ? '1' : '0'}`).join('|');
  }

  private redrawTerrain(scaleX: number, scaleY: number, mapState: BattleMapState): void {
    this.terrainGraphics.clear();
    
    // Draw background
    this.terrainGraphics.roundRect(0, 0, this.width, this.height, 8);
    this.terrainGraphics.fill({ color: 0x0b1219, alpha: 0.72 });
    this.terrainGraphics.stroke({ color: 0x7aa5d6, alpha: 0.7, width: 1.4 });

    const forests = mapState.getForestRects();
    for (let i = 0; i < forests.length; i += 1) {
      const rect = forests[i];
      this.terrainGraphics.rect(rect.x * scaleX, rect.y * scaleY, rect.w * scaleX, rect.h * scaleY);
      this.terrainGraphics.fill({ color: 0x476f47, alpha: 0.2 });
    }

    const hills = mapState.getHillRects();
    for (let i = 0; i < hills.length; i += 1) {
      const rect = hills[i];
      this.terrainGraphics.rect(rect.x * scaleX, rect.y * scaleY, rect.w * scaleX, rect.h * scaleY);
      this.terrainGraphics.stroke({ color: 0xd8bc82, alpha: 0.35, width: 1 });
    }

    const obstacles = mapState.getObstacleRects();
    for (let i = 0; i < obstacles.length; i += 1) {
      const rect = obstacles[i];
      this.terrainGraphics.rect(rect.x * scaleX, rect.y * scaleY, rect.w * scaleX, rect.h * scaleY);
      this.terrainGraphics.fill({ color: 0x2b3e51, alpha: 0.85 });
    }

    const gates = mapState.getGateStates();
    for (let i = 0; i < gates.length; i += 1) {
      const gate = gates[i];
      const rect = gate.rect;
      this.terrainGraphics.rect(rect.x * scaleX, rect.y * scaleY, rect.w * scaleX, rect.h * scaleY);
      if (gate.isOpen) {
        this.terrainGraphics.fill({ color: 0x7bc39d, alpha: 0.4 });
      } else {
        this.terrainGraphics.fill({ color: 0x95a9bf, alpha: 0.9 });
      }
      this.terrainGraphics.stroke({ color: 0x0f141a, alpha: 0.85, width: 0.8 });
    }
  }
}
