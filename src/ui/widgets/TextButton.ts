import { Container, Graphics, Text } from 'pixi.js';

export type TextButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger';

interface TextButtonOptions {
  label: string;
  width?: number;
  height?: number;
  variant?: TextButtonVariant;
  onClick: () => void;
}

interface ButtonPalette {
  fill: number;
  border: number;
  text: number;
  hoverFill: number;
  hoverBorder: number;
  disabledFill: number;
  disabledBorder: number;
}

const BUTTON_PALETTES: Record<TextButtonVariant, ButtonPalette> = {
  primary: {
    fill: 0x213c56,
    border: 0x8fc2f3,
    text: 0xf4fbff,
    hoverFill: 0x2b4d6a,
    hoverBorder: 0xb4d8ff,
    disabledFill: 0x1f2b35,
    disabledBorder: 0x41515f,
  },
  secondary: {
    fill: 0x273640,
    border: 0x84b4c2,
    text: 0xe7f2ff,
    hoverFill: 0x314753,
    hoverBorder: 0xa2cfde,
    disabledFill: 0x1f2b35,
    disabledBorder: 0x41515f,
  },
  accent: {
    fill: 0x5a3c1d,
    border: 0xf4cb85,
    text: 0xfff4dd,
    hoverFill: 0x6c4a23,
    hoverBorder: 0xffde9d,
    disabledFill: 0x2f2a24,
    disabledBorder: 0x5b5246,
  },
  danger: {
    fill: 0x4d2626,
    border: 0xf0a1a1,
    text: 0xffecec,
    hoverFill: 0x663131,
    hoverBorder: 0xffc0c0,
    disabledFill: 0x2f2424,
    disabledBorder: 0x5e4e4e,
  },
};

let globalClickListener: (() => void) | null = null;

export function setTextButtonClickListener(listener: (() => void) | null): void {
  globalClickListener = listener;
}

export class TextButton extends Container {
  private readonly shadow = new Graphics();
  private readonly bg = new Graphics();
  private readonly sheen = new Graphics();
  private readonly text: Text;
  private enabled = true;
  private hovered = false;
  private pressed = false;
  private variant: TextButtonVariant;

  private readonly widthPx: number;
  private readonly heightPx: number;

  constructor(options: TextButtonOptions) {
    super();

    this.widthPx = options.width ?? 220;
    this.heightPx = options.height ?? 44;
    this.variant = options.variant ?? 'primary';

    this.text = new Text({
      text: options.label,
      style: {
        fill: 0xf4fbff,
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.45,
      },
    });
    this.text.anchor.set(0.5, 0.5);
    this.text.position.set(this.widthPx * 0.5, this.heightPx * 0.5);

    this.addChild(this.shadow);
    this.addChild(this.bg);
    this.addChild(this.sheen);
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
      this.hovered = true;
      this.drawCurrent();
    });

    this.on('pointerout', () => {
      this.hovered = false;
      this.pressed = false;
      this.drawCurrent();
    });

    this.on('pointerdown', () => {
      if (!this.enabled) {
        return;
      }
      this.pressed = true;
      this.drawCurrent();
    });

    this.on('pointerup', () => {
      if (!this.enabled) {
        return;
      }
      this.pressed = false;
      this.drawCurrent();
    });

    this.on('pointerupoutside', () => {
      if (!this.enabled) {
        return;
      }
      this.pressed = false;
      this.drawCurrent();
    });

    this.drawCurrent();
  }

  setLabel(label: string): void {
    this.text.text = label;
  }

  setVariant(variant: TextButtonVariant): void {
    this.variant = variant;
    this.drawCurrent();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.hovered = false;
    this.pressed = false;
    this.cursor = enabled ? 'pointer' : 'default';
    this.eventMode = 'static';
    this.text.alpha = enabled ? 1 : 0.68;
    this.drawCurrent();
  }

  private drawCurrent(): void {
    const palette = BUTTON_PALETTES[this.variant];
    const fillColor = !this.enabled
      ? palette.disabledFill
      : this.hovered
        ? palette.hoverFill
        : palette.fill;
    const borderColor = !this.enabled
      ? palette.disabledBorder
      : this.hovered
        ? palette.hoverBorder
        : palette.border;
    const alpha = this.enabled ? 1 : 0.7;
    const pressOffset = this.pressed ? 1.5 : 0;
    const corner = Math.max(7, Math.min(this.heightPx * 0.24, 14));

    this.shadow.clear();
    this.shadow.roundRect(0, 3, this.widthPx, this.heightPx, corner);
    this.shadow.fill({ color: 0x000000, alpha: 0.3 * alpha });

    this.bg.clear();
    this.bg.roundRect(0, pressOffset, this.widthPx, this.heightPx, corner);
    this.bg.fill({ color: fillColor, alpha: 0.9 * alpha });
    this.bg.stroke({ color: borderColor, alpha: 0.96 * alpha, width: 1.8 });

    this.sheen.clear();
    this.sheen.roundRect(2, 2 + pressOffset, this.widthPx - 4, Math.max(10, this.heightPx * 0.26), Math.max(4, corner - 2));
    this.sheen.fill({ color: 0xffffff, alpha: this.enabled ? 0.08 : 0.04 });

    this.text.style.fill = palette.text;
    this.text.position.set(this.widthPx * 0.5, this.heightPx * 0.5 + pressOffset);
  }
}
