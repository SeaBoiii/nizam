import { Container, Graphics, Text } from 'pixi.js';
import { MENU_BODY_FONT, drawMenuCard } from '../theme/MenuTheme';

const MAX_SCROLL = 520;

export class ControlsOverlay {
  readonly root = new Container();

  private readonly panel = new Graphics();
  private readonly maskGraphics = new Graphics();
  private readonly content = new Container();
  private readonly text = new Text({
    text: '',
    style: {
      fill: 0xdce9fa,
      fontFamily: MENU_BODY_FONT,
      fontSize: 14,
      lineHeight: 21,
    },
  });

  private width = 640;
  private height = 460;
  private scroll = 0;

  constructor() {
    this.root.visible = false;
    this.root.addChild(this.panel);
    this.root.addChild(this.content);
    this.root.addChild(this.maskGraphics);
    this.content.addChild(this.text);
    this.content.mask = this.maskGraphics;

    this.text.text = [
      'Quick Controls',
      '',
      'Camera',
      'WASD or Arrow Keys: Pan',
      'Mouse Wheel: Zoom',
      '',
      'Selection and Movement',
      'Left Click: Select squad',
      'Drag Left Mouse: Box select',
      'Right Click: Move order',
      'Shift + Right Click: Queue waypoint',
      'Alt + Right Click: Move and set facing',
      '',
      'Formations',
      '1: Line',
      '2: Column',
      '3: Wedge',
      '4: Loose',
      '',
      'Tactical Orders',
      'H: Hold position',
      'C: Charge',
      'V: Volley stance',
      'K: Skirmish mode',
      'R: Rally ability',
      'T or Shift+R: Retreat',
      '',
      'Utility',
      'ESC: Pause menu',
      'F1 or `: Debug panel',
      '',
      'Tip: Use terrain and morale to your advantage.',
    ].join('\n');
  }

  show(): void {
    this.root.visible = true;
  }

  hide(): void {
    this.root.visible = false;
  }

  isVisible(): boolean {
    return this.root.visible;
  }

  scrollBy(deltaY: number): void {
    this.scroll = Math.max(0, Math.min(MAX_SCROLL, this.scroll + deltaY));
    this.content.position.y = this.topY() - this.scroll;
  }

  layout(screenWidth: number, screenHeight: number): void {
    this.width = Math.min(760, Math.max(400, screenWidth * 0.72));
    this.height = Math.min(520, Math.max(320, screenHeight * 0.74));
    const x = screenWidth * 0.5 - this.width * 0.5;
    const y = screenHeight * 0.5 - this.height * 0.5;

    drawMenuCard(this.panel, x, y, this.width, this.height, { radius: 12 });

    this.maskGraphics.clear();
    this.maskGraphics.rect(x + 16, y + 18, this.width - 32, this.height - 36);
    this.maskGraphics.fill({ color: 0xffffff, alpha: 1 });

    this.text.position.set(x + 24, y + 22);
    this.content.position.set(0, -this.scroll);
  }

  private topY(): number {
    return 0;
  }
}
