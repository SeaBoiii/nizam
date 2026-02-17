import { Container, Graphics, Text } from 'pixi.js';

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
      fontFamily: 'monospace',
      fontSize: 28,
      fontWeight: 'bold',
    },
  });
  private readonly text = new Text({
    text: '',
    style: {
      fill: 0xdce9fa,
      fontFamily: 'monospace',
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

    // Make backdrop interactive to close on click
    this.backdrop.eventMode = 'static';
    this.backdrop.cursor = 'pointer';
    this.backdrop.on('pointerdown', () => {
      this.hide();
    });

    this.text.text = [
      '═══════════════════════════════════════════════════════════════',
      '                          GAME OVERVIEW',
      '═══════════════════════════════════════════════════════════════',
      '',
      'Nizam is a tactical battle simulator where you command squads of',
      'infantry, archers, cavalry, spearmen, and slingers in real-time',
      'battles. Progress through a roguelite campaign, upgrade your army,',
      'unlock commander perks, and adapt to dynamic objectives.',
      '',
      '═══════════════════════════════════════════════════════════════',
      '                        CAMPAIGN FLOW',
      '═══════════════════════════════════════════════════════════════',
      '',
      '1. TITLE SCREEN - Start a new run or continue saved progress',
      '2. OVERWORLD - Navigate the node map and choose your path',
      '3. BATTLE - Command your army in tactical combat',
      '4. REWARDS - Collect gold, recruits, and draft powerful perks',
      '5. Repeat until victory or defeat!',
      '',
      '═══════════════════════════════════════════════════════════════',
      '                         CAMERA CONTROLS',
      '═══════════════════════════════════════════════════════════════',
      '',
      'WASD or Arrow Keys ........... Pan camera around the battlefield',
      'Mouse Wheel .................. Zoom in/out',
      '',
      '═══════════════════════════════════════════════════════════════',
      '                      SQUAD SELECTION & ORDERS',
      '═══════════════════════════════════════════════════════════════',
      '',
      'Left Click ................... Select single squad',
      'Drag Selection Box ........... Multi-select squads',
      'Right Click .................. Move order',
      'Shift + Right Click .......... Queue waypoint',
      'Alt + Right Click ............ Move and set facing direction',
      '',
      '═══════════════════════════════════════════════════════════════',
      '                         FORMATION HOTKEYS',
      '═══════════════════════════════════════════════════════════════',
      '',
      '1 - LINE FORMATION ........... Balanced offense/defense',
      '2 - COLUMN FORMATION ......... Narrow frontage, deep ranks',
      '3 - WEDGE FORMATION .......... Breakthrough power',
      '4 - LOOSE FORMATION .......... Reduced missile casualties',
      '',
      '═══════════════════════════════════════════════════════════════',
      '                         TACTICAL COMMANDS',
      '═══════════════════════════════════════════════════════════════',
      '',
      'H - HOLD POSITION ............ Squad holds ground',
      'C - CHARGE ................... Attack nearest enemy',
      'V - VOLLEY STANCE ............ Ranged units hold and fire',
      'K - SKIRMISH MODE ............ Kite away while shooting',
      'R - RALLY (Commander) ........ Boost nearby squad morale',
      'T or Shift+R - RETREAT ....... Fall back to map edge',
      '',
      '═══════════════════════════════════════════════════════════════',
      '                        BATTLE OBJECTIVES',
      '═══════════════════════════════════════════════════════════════',
      '',
      'CAPTURE POINT - Control the central zone until bar fills',
      'DECAPITATION - Eliminate enemy commander before losing yours',
      'LAST STAND - Survive waves of reinforcements until timer expires',
      'CARAVAN ESCORT - Protect caravan to exit zone',
      'SIEGE - Capture gate zone, then assault the courtyard',
      '',
      '═══════════════════════════════════════════════════════════════',
      '                          TACTICAL TIPS',
      '═══════════════════════════════════════════════════════════════',
      '',
      '• Use terrain: Archers on hills get range/accuracy bonus',
      '• Watch morale: Flanked or outnumbered units may rout',
      '• Cavalry charges: Devastating against exposed infantry',
      '• Spearmen counter: Effective against charging cavalry',
      '• Formation matters: Loose formation vs archers, line vs melee',
      '• Skirmish with archers: Keep them alive by kiting enemies',
      '• Rally ability: Use when morale is low to prevent rout',
      '',
      '═══════════════════════════════════════════════════════════════',
      '                       UTILITY & DEBUG',
      '═══════════════════════════════════════════════════════════════',
      '',
      'ESC .......................... Pause menu',
      'F1 or ` (backtick) ........... Debug panel',
      '',
      '═══════════════════════════════════════════════════════════════',
      '',
      'Good luck, Commander! Use ESC to pause anytime during battle.',
      'Press ESC or click outside to close this guide.',
      '',
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
    this.backdrop.fill({ color: 0x000000, alpha: 0.8 });

    this.panel.clear();
    this.panel.roundRect(x, y, this.width, this.height, 12);
    this.panel.fill({ color: 0x0e1821, alpha: 0.98 });
    this.panel.stroke({ color: 0x789ec6, alpha: 0.95, width: 2 });

    this.title.position.set(screenWidth * 0.5, y + 32);

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
