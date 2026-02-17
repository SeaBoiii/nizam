import { Container, Graphics, Text } from 'pixi.js';
import { MENU_BODY_FONT, MENU_TITLE_FONT, drawMenuCard } from '../theme/MenuTheme';

export class HowToPlayOverlay {
  readonly root = new Container();

  private readonly backdrop = new Graphics();
  private readonly panel = new Graphics();
  private readonly maskGraphics = new Graphics();
  private readonly content = new Container();
  private readonly title = new Text({
    text: 'How to Play',
    style: {
      fill: 0xf3e2b2,
      fontFamily: MENU_TITLE_FONT,
      fontSize: 30,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
  });
  private readonly text = new Text({
    text: '',
    style: {
      fill: 0xdce9fa,
      fontFamily: MENU_BODY_FONT,
      fontSize: 14,
      lineHeight: 22,
    },
  });

  private width = 840;
  private height = 600;
  private scroll = 0;
  private maxScroll = 800;

  constructor() {
    this.root.visible = false;
    this.root.addChild(this.backdrop);
    this.root.addChild(this.panel);
    this.root.addChild(this.title);
    this.root.addChild(this.content);
    this.root.addChild(this.maskGraphics);
    this.content.addChild(this.text);
    this.content.mask = this.maskGraphics;

    this.title.anchor.set(0.5, 0.5);

    this.backdrop.eventMode = 'static';
    this.backdrop.cursor = 'pointer';
    this.backdrop.on('pointerdown', () => {
      this.hide();
    });

    this.text.text = [
      'Overview',
      'Nizam is a tactical battle campaign where your squad control and positioning matter more than raw numbers.',
      '',
      'Campaign Flow',
      '1. Title: Start a run, daily, or challenge.',
      '2. Overworld: Choose connected nodes and shape your route.',
      '3. Battle: Command squads in real-time.',
      '4. Rewards: Gain resources, perks, and upgrades.',
      '',
      'Core Battle Controls',
      'WASD or Arrow Keys: Pan camera',
      'Mouse Wheel: Zoom',
      'Left Click: Select squad',
      'Drag Left Mouse: Multi-select',
      'Right Click: Move',
      'Shift + Right Click: Queue waypoint',
      'Alt + Right Click: Move and set facing',
      '',
      'Orders and Formations',
      '1/2/3/4: Line, Column, Wedge, Loose',
      'H: Hold',
      'C: Charge',
      'V: Volley',
      'K: Skirmish',
      'R: Rally ability',
      'T or Shift+R: Retreat',
      '',
      'Objective Types',
      'Capture: Control the center zone.',
      'Decapitation: Kill enemy commander first.',
      'Last Stand: Survive waves until timer expires.',
      'Caravan Run: Escort caravan to exit.',
      'Siege: Break gate control, then take courtyard.',
      '',
      'Practical Tips',
      '- Protect ranged squads with spears and spacing.',
      '- Use hills for ranged bonus and forests for concealment.',
      '- Watch morale and rally before a chain rout starts.',
      '- Flank with cavalry when the enemy line is fixed.',
      '',
      'Close this guide with ESC or by clicking outside the panel.',
    ].join('\n');
  }

  show(): void {
    this.scroll = 0;
    this.root.visible = true;
  }

  hide(): void {
    this.root.visible = false;
  }

  isVisible(): boolean {
    return this.root.visible;
  }

  scrollBy(deltaY: number): void {
    this.scroll = Math.max(0, Math.min(this.maxScroll, this.scroll + deltaY));
    this.updateContentPosition();
  }

  layout(screenWidth: number, screenHeight: number): void {
    this.width = Math.min(840, Math.max(600, screenWidth * 0.85));
    this.height = Math.min(640, Math.max(400, screenHeight * 0.85));
    const x = screenWidth * 0.5 - this.width * 0.5;
    const y = screenHeight * 0.5 - this.height * 0.5;

    this.backdrop.clear();
    this.backdrop.rect(0, 0, screenWidth, screenHeight);
    this.backdrop.fill({ color: 0x000000, alpha: 0.78 });

    drawMenuCard(this.panel, x, y, this.width, this.height, { radius: 14 });
    this.title.position.set(screenWidth * 0.5, y + 34);

    this.maskGraphics.clear();
    this.maskGraphics.rect(x + 20, y + 64, this.width - 40, this.height - 84);
    this.maskGraphics.fill({ color: 0xffffff, alpha: 1 });

    this.text.position.set(x + 32, y + 68);
    this.updateContentPosition();
  }

  private updateContentPosition(): void {
    this.content.position.set(0, -this.scroll);
  }
}
