import { Container, Graphics, Text } from 'pixi.js';

export interface HudState {
  fps: number;
  selectedCount: number;
  selectedArchetypes: string;
  formation: string;
  orderMode: string;
}

export class Hud {
  private readonly container: Container;
  private readonly background: Graphics;
  private readonly text: Text;
  
  // Performance: Cache last state to avoid unnecessary text updates
  private lastState: HudState | null = null;

  constructor(uiLayer: Container) {
    this.container = new Container();
    this.background = new Graphics();
    
    this.text = new Text({
      text: '',
      style: {
        fill: 0xe9f2ff,
        fontFamily: 'monospace',
        fontSize: 14,
        fontWeight: '500',
      },
    });

    this.container.addChild(this.background);
    this.container.addChild(this.text);
    this.container.position.set(10, 8);
    uiLayer.addChild(this.container);
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

    const lines = [
      `⚡ FPS: ${state.fps.toFixed(0)}`,
      `🎯 Selected: ${state.selectedCount}`,
      `⚔️  Type: ${state.selectedArchetypes || 'None'}`,
      `🛡️  Formation: ${state.formation}`,
      `📋 Order: ${state.orderMode}`,
    ];
    
    this.text.text = lines.join('\n');
    
    // Draw a semi-transparent background panel
    const padding = 12;
    const textBounds = this.text.getBounds();
    this.background.clear();
    this.background.roundRect(
      -padding, 
      -padding, 
      textBounds.width + padding * 2, 
      textBounds.height + padding * 2, 
      8
    );
    this.background.fill({ color: 0x0a0f16, alpha: 0.75 });
    this.background.stroke({ color: 0x4a7ba7, alpha: 0.6, width: 1.5 });
    
    this.lastState = { ...state };
  }
}
