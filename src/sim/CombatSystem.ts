import type { Soldier } from './Soldier';
import { SpatialHash } from './SpatialHash';
import type { Squad } from './Squad';

const MELEE_RANGE = 13;
const MELEE_RANGE_SQ = MELEE_RANGE * MELEE_RANGE;
const DAMAGE_PER_SECOND = 16;
const MAX_ATTACKERS_PER_FRAME = 3;

export class CombatSystem {
  private readonly grid = new SpatialHash(28);
  private readonly aliveBuffer: Soldier[] = [];

  update(dt: number, squads: readonly Squad[]): void {
    this.aliveBuffer.length = 0;

    for (let squadIndex = 0; squadIndex < squads.length; squadIndex += 1) {
      const squad = squads[squadIndex];
      const soldiers = squad.soldiers;
      for (let i = 0; i < soldiers.length; i += 1) {
        const soldier = soldiers[i];
        if (soldier.alive) {
          this.aliveBuffer.push(soldier);
        }
      }
    }

    this.grid.clear();
    for (let i = 0; i < this.aliveBuffer.length; i += 1) {
      this.grid.insert(this.aliveBuffer[i]);
    }

    for (let i = 0; i < this.aliveBuffer.length; i += 1) {
      const soldier = this.aliveBuffer[i];
      if (!soldier.alive) {
        continue;
      }

      let attackers = 0;
      this.grid.forEachNearby(soldier.position.x, soldier.position.y, (other) => {
        if (!other.alive || other === soldier || other.team === soldier.team) {
          return;
        }

        const dx = other.position.x - soldier.position.x;
        const dy = other.position.y - soldier.position.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > MELEE_RANGE_SQ) {
          return;
        }

        attackers += 1;
      });

      if (attackers > 0) {
        const appliedAttackers = Math.min(attackers, MAX_ATTACKERS_PER_FRAME);
        soldier.applyDamage(appliedAttackers * DAMAGE_PER_SECOND * dt);
      }
    }
  }
}