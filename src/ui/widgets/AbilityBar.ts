import { Container, Graphics, Text } from 'pixi.js';
import { TextButton } from './TextButton';

export interface AbilityBarState {
  abilityName: string;
  cooldownRemaining: number;
  cooldownDuration: number;
  canCast: boolean;
}

interface AbilityBarOptions {
  parent: Container;
  onCast: () => void;
}

export class AbilityBar {
  readonly root = new Container();

  private readonly panel = new Graphics();
  private readonly cooldownFill = new Graphics();
  private readonly title = new Text({
    text: 'Ability',
    style: {
      fill: 0xe8f2ff,
      fontFamily: 'monospace',
      fontSize: 13,
    },
  });
  private readonly keyHint = new Text({
    text: 'Key: R',
    style: {
      fill: 0xa5c8ee,
      fontFamily: 'monospace',
      fontSize: 12,
    },
  });
  private readonly cooldownText = new Text({
    text: '',
    style: {
      fill: 0xf3d89f,
      fontFamily: 'monospace',
      fontSize: 13,
    },
  });
  private readonly castButton: TextButton;

  constructor(options: AbilityBarOptions) {
    this.castButton = new TextButton({
      label: 'Cast Rally',
      width: 168,
      height: 36,
      onClick: options.onCast,
    });

    this.root.addChild(this.panel);
    this.root.addChild(this.cooldownFill);
    this.root.addChild(this.title);
    this.root.addChild(this.keyHint);
    this.root.addChild(this.cooldownText);
    this.root.addChild(this.castButton);
    options.parent.addChild(this.root);
  }

  update(state: AbilityBarState): void {
    const duration = Math.max(0.01, state.cooldownDuration);
    const remaining = Math.max(0, state.cooldownRemaining);
    const ratio = 1 - Math.min(1, remaining / duration);

    this.title.text = `Ability: ${state.abilityName}`;
    this.castButton.setLabel(`Cast ${state.abilityName}`);
    this.castButton.setEnabled(state.canCast);
    this.cooldownText.text = remaining > 0 ? `Cooldown: ${remaining.toFixed(1)}s` : 'Ready';

    this.cooldownFill.clear();
    this.cooldownFill.roundRect(10, 52, 168 * ratio, 10, 5);
    this.cooldownFill.fill({ color: 0x8ec8ff, alpha: 0.92 });
  }

  layout(screenWidth: number, screenHeight: number): void {
    const x = 12;
    const y = Math.max(12, screenHeight - 120);
    this.root.position.set(x, y);

    this.panel.clear();
    this.panel.roundRect(0, 0, 188, 108, 10);
    this.panel.fill({ color: 0x102034, alpha: 0.9 });
    this.panel.stroke({ color: 0x6e9bc9, width: 1.4, alpha: 0.9 });

    this.title.position.set(10, 8);
    this.keyHint.position.set(10, 26);
    this.cooldownText.position.set(10, 66);
    this.castButton.position.set(10, 84 - 20);

    if (screenWidth < 540) {
      this.root.scale.set(0.9);
    } else {
      this.root.scale.set(1);
    }
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
