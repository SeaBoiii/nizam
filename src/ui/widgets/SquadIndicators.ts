import { Graphics, type Container } from 'pixi.js';
import { estimateFormationRadius } from '../../sim/Formation';
import type { Squad } from '../../sim/Squad';
import { TeamId } from '../../sim/types';
import { clamp } from '../../utils/math';

export class SquadIndicators {
  private readonly graphics: Graphics;

  constructor(layer: Container) {
    this.graphics = new Graphics();
    layer.addChild(this.graphics);
  }

  update(squads: readonly Squad[]): void {
    this.graphics.clear();

    for (let i = 0; i < squads.length; i += 1) {
      const squad = squads[i];
      if (!squad.hasLivingSoldiers()) {
        continue;
      }

      const teamColor = squad.team === TeamId.Blue ? 0x66b8ff : 0xff8f8f;
      const selectedColor = squad.isSelected ? 0xffeb99 : teamColor;
      const radius = estimateFormationRadius(squad.formation, squad.initialSize);
      const baseX = squad.anchor.x;
      const baseY = squad.anchor.y - radius - 12;

      this.graphics.moveTo(baseX, baseY + 8);
      this.graphics.lineTo(baseX, baseY - 12);
      this.graphics.stroke({ color: 0x1f242a, alpha: 0.8, width: 2 });

      this.graphics.moveTo(baseX, baseY - 12);
      this.graphics.lineTo(baseX + 10, baseY - 8);
      this.graphics.lineTo(baseX, baseY - 4);
      this.graphics.closePath();
      this.graphics.fill({ color: selectedColor, alpha: 0.95 });

      const moraleNorm = clamp(squad.morale / 100, 0, 1);
      const barWidth = 24;
      const barHeight = 4;
      const barX = baseX - barWidth * 0.5;
      const barY = baseY - 18;

      this.graphics.rect(barX, barY, barWidth, barHeight);
      this.graphics.fill({ color: 0x1d1d1d, alpha: 0.82 });
      this.graphics.stroke({ color: 0x060606, alpha: 0.8, width: 1 });

      const moraleColor = moraleNorm > 0.5 ? 0x63db75 : moraleNorm > 0.25 ? 0xe4c05d : 0xed6666;
      this.graphics.rect(barX + 0.5, barY + 0.5, (barWidth - 1) * moraleNorm, barHeight - 1);
      this.graphics.fill({ color: moraleColor, alpha: 0.95 });
    }
  }
}