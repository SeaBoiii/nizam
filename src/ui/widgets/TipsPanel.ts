import { Container, Graphics, Text } from 'pixi.js';

export class TipsPanel {
  readonly root = new Container();

  private readonly panel = new Graphics();
  private readonly titleText = new Text({
    text: '💡 Quick Tips',
    style: {
      fill: 0xf3e2b2,
      fontFamily: 'monospace',
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
  private readonly tipsText = new Text({
    text: '',
    style: {
      fill: 0xdce9fa,
      fontFamily: 'monospace',
      fontSize: 13,
      lineHeight: 20,
      wordWrap: true,
      wordWrapWidth: 280,
    },
  });

  private width = 320;
  private height = 240;
  private currentTipIndex = 0;
  
  private readonly tips = [
    'Press H to hold position\nPress C to charge enemy',
    'Use terrain! Archers on\nhills get range bonus',
    'Flanked units lose morale\nand may rout',
    'Cavalry charges devastate\nexposed infantry',
    'Spearmen counter charging\ncavalry effectively',
    'Use V for volley stance\nUse K to skirmish',
    'Formation 4 (Loose) reduces\nmissile casualties',
    'Press R to Rally and boost\nnearby squad morale',
    'Watch the objective timer!\nCapture zones faster',
    'ESC to pause anytime\nF1 for full controls',
  ];

  constructor() {
    this.root.visible = false;
    this.root.addChild(this.panel);
    this.root.addChild(this.titleText);
    this.root.addChild(this.tipsText);
    
    this.updateTip();
  }

  show(): void {
    this.root.visible = true;
    this.cycleTip();
  }

  hide(): void {
    this.root.visible = false;
  }

  toggle(): void {
    if (this.root.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  isVisible(): boolean {
    return this.root.visible;
  }

  cycleTip(): void {
    this.currentTipIndex = (this.currentTipIndex + 1) % this.tips.length;
    this.updateTip();
  }

  private updateTip(): void {
    this.tipsText.text = this.tips[this.currentTipIndex];
  }

  layout(screenWidth: number, screenHeight: number): void {
    // Position in bottom-right corner
    const x = screenWidth - this.width - 16;
    const y = screenHeight - this.height - 16;

    this.panel.clear();
    this.panel.roundRect(x, y, this.width, this.height, 8);
    this.panel.fill({ color: 0x0a0f16, alpha: 0.85 });
    this.panel.stroke({ color: 0xf3be5a, alpha: 0.7, width: 2 });

    this.titleText.position.set(x + 16, y + 14);
    this.tipsText.position.set(x + 16, y + 50);
  }
}
