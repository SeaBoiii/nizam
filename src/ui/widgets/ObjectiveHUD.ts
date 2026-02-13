import { Container, Text } from 'pixi.js';

export interface ObjectiveHUDState {
  blueProgress: number;
  redProgress: number;
  blueInside: number;
  redInside: number;
  contested: boolean;
}

export class ObjectiveHUD {
  private readonly text: Text;

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
    uiLayer.addChild(this.text);
  }

  update(state: ObjectiveHUDState): void {
    const contestedText = state.contested ? 'CONTESTED' : 'Stable';
    this.text.text = [
      'Objective: Capture Point',
      `Blue: ${state.blueProgress.toFixed(1)}% (${state.blueInside})`,
      `Red:  ${state.redProgress.toFixed(1)}% (${state.redInside})`,
      `Status: ${contestedText}`,
    ].join('\n');
  }
}