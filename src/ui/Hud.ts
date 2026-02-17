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
  
  // Performance: Cache last state to avoid unnecessary text updates
  private lastState: HudState | null = null;

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
    // Performance: Only update text when state actually changes
    if (
      this.lastState &&
      this.lastState.fps === state.fps &&
      this.lastState.selectedCount === state.selectedCount &&
      this.lastState.selectedArchetypes === state.selectedArchetypes &&
      this.lastState.formation === state.formation &&
      this.lastState.orderMode === state.orderMode
    ) {
      return;
    }

    this.text.text = [
      `FPS: ${state.fps.toFixed(0)}`,
      `Selected: ${state.selectedCount}`,
      `Archetype: ${state.selectedArchetypes}`,
      `Formation: ${state.formation}`,
      `Order: ${state.orderMode}`,
    ].join('\n');
    
    this.lastState = { ...state };
  }
}
