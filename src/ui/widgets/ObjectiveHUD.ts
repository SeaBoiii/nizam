import { Container, Graphics, Text } from 'pixi.js';
import type { ObjectiveHUDState } from '../../sim/objectives/IObjective';

export class ObjectiveHUD {
  private readonly text: Text;
  private readonly bars = new Graphics();

  constructor(uiLayer: Container) {
    this.text = new Text({
      text: '',
      style: {
        fill: 0xf6eecf,
        fontFamily: 'monospace',
        fontSize: 14,
      },
    });

    this.text.position.set(10, 96);
    this.bars.position.set(10, 172);
    uiLayer.addChild(this.text);
    uiLayer.addChild(this.bars);
  }

  update(state: ObjectiveHUDState): void {
    const lines = [`Objective: ${state.title}`];
    for (let i = 0; i < state.lines.length && i < 3; i += 1) {
      lines.push(state.lines[i]);
    }

    this.text.text = lines.join('\n');
    this.drawBars(state);
  }

  private drawBars(state: ObjectiveHUDState): void {
    this.bars.clear();

    if (state.progressBlue !== undefined && state.progressRed !== undefined) {
      this.drawBar(0, 0, 170, 8, state.progressBlue / 100, 0x5faeff, 0x101315);
      this.drawBar(0, 12, 170, 8, state.progressRed / 100, 0xff7777, 0x101315);
    }

    if (state.timer !== undefined) {
      this.drawBar(0, 28, 170, 8, state.timer, 0xf2d48f, 0x101315);
    }

    if (state.secondary !== undefined) {
      this.drawBar(0, 40, 170, 8, state.secondary, 0x8edb8e, 0x101315);
    }
  }

  private drawBar(
    x: number,
    y: number,
    width: number,
    height: number,
    normalized: number,
    fillColor: number,
    bgColor: number,
  ): void {
    const value = Math.max(0, Math.min(1, normalized));
    this.bars.rect(x, y, width, height);
    this.bars.fill({ color: bgColor, alpha: 0.9 });
    this.bars.stroke({ color: 0x08090a, alpha: 0.9, width: 1 });

    this.bars.rect(x + 0.5, y + 0.5, (width - 1) * value, height - 1);
    this.bars.fill({ color: fillColor, alpha: 0.92 });
  }
}
