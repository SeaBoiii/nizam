import { Container, Graphics, Text } from 'pixi.js';

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
      fontFamily: 'monospace',
      fontSize: 14,
      lineHeight: 20,
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
      '═══════════════════════════════════════════════════════',
      '                      QUICK CONTROLS',
      '═══════════════════════════════════════════════════════',
      '',
      '🎮 CAMERA CONTROLS',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'WASD / Arrow Keys .............. Pan camera',
      'Mouse Wheel .................... Zoom in/out',
      '',
      '⚔️  SQUAD SELECTION & MOVEMENT',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'Left Click ..................... Select squad',
      'Drag Left Mouse ................ Box select multiple',
      'Right Click .................... Move order',
      'Shift + Right Click ............ Queue waypoint',
      'Alt + Right Click .............. Move + set facing',
      '',
      '🛡️  FORMATION HOTKEYS',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '1 - Line ....................... Balanced (default)',
      '2 - Column ..................... Narrow & deep',
      '3 - Wedge ...................... Breakthrough',
      '4 - Loose ...................... vs Missiles',
      '',
      '⚡ TACTICAL COMMANDS',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'H - Hold Position .............. Stop & defend',
      'C - Charge ..................... Attack nearest',
      'V - Volley Stance .............. Ranged: hold & fire',
      'K - Skirmish Mode .............. Ranged: kite & shoot',
      'R - Rally (Commander) .......... Boost morale',
      'T or Shift+R - Retreat ......... Fall back',
      '',
      '🎯 UTILITY',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'ESC ............................ Pause / Resume',
      'F1 or ` (backtick) ............. Debug panel',
      '',
      '💡 TIP: Use F1 during battle to access full guide!',
      '',
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

    this.panel.clear();
    this.panel.roundRect(x, y, this.width, this.height, 10);
    this.panel.fill({ color: 0x131d2b, alpha: 0.97 });
    this.panel.stroke({ color: 0x789ec6, alpha: 0.92, width: 1.6 });

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

