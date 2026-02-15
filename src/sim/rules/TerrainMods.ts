import type { Vec2 } from '../../utils/vec2';
import { BattleMapState } from '../map/MapState';

export class TerrainMods {
  constructor(private readonly mapState: BattleMapState) {}

  getMoveSpeedMult(position: Vec2): number {
    const flags = this.mapState.getTerrainFlags(position.x, position.y);
    if (flags.inForest) {
      return this.mapState.terrainRules.forest.moveSpeedMult;
    }
    return 1;
  }

  getRangedAccuracyAdd(shooterPos: Vec2, _targetPos: Vec2): number {
    let add = 0;
    if (this.mapState.isInForest(shooterPos.x, shooterPos.y)) {
      add += this.mapState.terrainRules.forest.rangedAccuracyAdd;
    }
    if (this.mapState.isOnHill(shooterPos.x, shooterPos.y)) {
      add += this.mapState.terrainRules.hill.rangedAccuracyAdd;
    }
    return add;
  }

  getRangedRangeMult(shooterPos: Vec2): number {
    if (this.mapState.isOnHill(shooterPos.x, shooterPos.y)) {
      return this.mapState.terrainRules.hill.rangedRangeMult;
    }
    return 1;
  }

  getProjectileSpeedMult(shooterPos: Vec2): number {
    if (this.mapState.isInForest(shooterPos.x, shooterPos.y)) {
      return this.mapState.terrainRules.forest.projectileSpeedMult;
    }
    return 1;
  }
}

