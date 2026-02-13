import { Container, Text } from 'pixi.js';

export interface HudState {
  fps: number;
  selectedCount: number;
  selectedArchetypes: string;
  formation: string;
  orderMode: string;
}

export class Hud {
  private readonly text: Text;

  constructor(uiLayer: Container) {
    this.text = new Text({
      text: '',
      style: {
        fill: 0xe9f2ff,
        fontFamily: 'monospace',
        fontSize: 14,
      },
    });

    this.text.position.set(10, 8);
    uiLayer.addChild(this.text);
  }

  update(state: HudState): void {
    this.text.text = [
      `FPS: ${state.fps.toFixed(0)}`,
      `Selected: ${state.selectedCount}`,
      `Archetype: ${state.selectedArchetypes}`,
      `Formation: ${state.formation}`,
      `Order: ${state.orderMode}`,
    ].join('\n');
  }
}
