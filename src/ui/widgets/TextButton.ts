import { Container, Graphics, Text } from 'pixi.js';

interface TextButtonOptions {
  label: string;
  width?: number;
  height?: number;
  onClick: () => void;
}

let globalClickListener: (() => void) | null = null;

export function setTextButtonClickListener(listener: (() => void) | null): void {
  globalClickListener = listener;
}

export class TextButton extends Container {
  private readonly bg = new Graphics();
  private readonly text: Text;
  private enabled = true;

  private readonly widthPx: number;
  private readonly heightPx: number;

  constructor(options: TextButtonOptions) {
    super();

    this.widthPx = options.width ?? 220;
    this.heightPx = options.height ?? 44;

    this.text = new Text({
      text: options.label,
      style: {
        fill: 0xeaf2ff,
        fontFamily: 'monospace',
        fontSize: 17,
      },
    });
    this.text.anchor.set(0.5, 0.5);
    this.text.position.set(this.widthPx * 0.5, this.heightPx * 0.5);

    this.addChild(this.bg);
    this.addChild(this.text);

    this.eventMode = 'static';
    this.cursor = 'pointer';

    this.on('pointertap', () => {
      if (this.enabled) {
        options.onClick();
        if (globalClickListener !== null) {
          globalClickListener();
        }
      }
    });

    this.on('pointerover', () => {
      if (this.enabled) {
        this.draw(0x2a455f, 0x86bdf7, 1);
      }
    });

    this.on('pointerout', () => {
      this.draw(this.enabled ? 0x1e3247 : 0x202020, this.enabled ? 0x6e9bc9 : 0x4a4a4a, this.enabled ? 1 : 0.55);
    });

    this.draw(0x1e3247, 0x6e9bc9, 1);
  }

  setLabel(label: string): void {
    this.text.text = label;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.cursor = enabled ? 'pointer' : 'default';
    this.eventMode = 'static';
    this.draw(enabled ? 0x1e3247 : 0x202020, enabled ? 0x6e9bc9 : 0x4a4a4a, enabled ? 1 : 0.55);
    this.text.alpha = enabled ? 1 : 0.6;
  }

  private draw(fillColor: number, borderColor: number, alpha: number): void {
    this.bg.clear();
    this.bg.roundRect(0, 0, this.widthPx, this.heightPx, 8);
    this.bg.fill({ color: fillColor, alpha: 0.9 * alpha });
    this.bg.stroke({ color: borderColor, alpha: 0.9 * alpha, width: 1.6 });
  }
}
