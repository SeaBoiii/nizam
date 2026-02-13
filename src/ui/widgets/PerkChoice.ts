import { Container, Graphics, Text } from 'pixi.js';
import type { PerkContent } from '../../content/ContentTypes';

interface PerkCard {
  root: Container;
  bg: Graphics;
  title: Text;
  desc: Text;
  perkId: string;
}

export class PerkChoice extends Container {
  private readonly panelBg = new Graphics();
  private readonly titleText = new Text({
    text: 'Commander Perk',
    style: {
      fill: 0xf8e3ab,
      fontFamily: 'monospace',
      fontSize: 24,
      fontWeight: 'bold',
    },
  });
  private readonly subtitleText = new Text({
    text: 'Choose one perk',
    style: {
      fill: 0xccdff7,
      fontFamily: 'monospace',
      fontSize: 14,
    },
  });

  private readonly cards: PerkCard[] = [];
  private readonly overlay = new Graphics();

  private onPick: ((perkId: string) => void) | null = null;
  private screenWidth = 0;
  private screenHeight = 0;

  constructor() {
    super();
    this.visible = false;
    this.sortableChildren = false;

    this.addChild(this.overlay);
    this.addChild(this.panelBg);
    this.addChild(this.titleText);
    this.addChild(this.subtitleText);

    this.titleText.anchor.set(0.5, 0.5);
    this.subtitleText.anchor.set(0.5, 0.5);
  }

  show(choices: readonly PerkContent[], onPick: (perkId: string) => void, screenWidth: number, screenHeight: number): void {
    this.onPick = onPick;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.visible = true;

    this.clearCards();
    const cardCount = Math.min(3, choices.length);
    for (let i = 0; i < cardCount; i += 1) {
      this.cards.push(this.createCard(choices[i]));
    }
    this.layout();
  }

  hide(): void {
    this.visible = false;
    this.onPick = null;
    this.clearCards();
  }

  resize(screenWidth: number, screenHeight: number): void {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    if (this.visible) {
      this.layout();
    }
  }

  private createCard(perk: PerkContent): PerkCard {
    const root = new Container();
    const bg = new Graphics();
    const title = new Text({
      text: perk.name,
      style: {
        fill: 0xf4e8c7,
        fontFamily: 'monospace',
        fontSize: 18,
        fontWeight: 'bold',
      },
    });
    const desc = new Text({
      text: perk.desc,
      style: {
        fill: 0xd5e7ff,
        fontFamily: 'monospace',
        fontSize: 13,
        wordWrap: true,
        wordWrapWidth: 220,
      },
    });

    title.anchor.set(0.5, 0);
    desc.anchor.set(0.5, 0);
    root.addChild(bg);
    root.addChild(title);
    root.addChild(desc);
    root.eventMode = 'static';
    root.cursor = 'pointer';

    root.on('pointerover', () => {
      bg.tint = 0xe2f1ff;
    });
    root.on('pointerout', () => {
      bg.tint = 0xffffff;
    });
    root.on('pointertap', () => {
      if (this.onPick !== null) {
        this.onPick(perk.id);
      }
    });

    this.addChild(root);

    const card: PerkCard = {
      root,
      bg,
      title,
      desc,
      perkId: perk.id,
    };
    this.drawCard(card, perk.rarity === 'rare');
    return card;
  }

  private drawCard(card: PerkCard, rare: boolean): void {
    card.bg.clear();
    card.bg.roundRect(0, 0, 260, 180, 10);
    card.bg.fill({ color: rare ? 0x2f2536 : 0x1c2a3a, alpha: 0.97 });
    card.bg.stroke({ color: rare ? 0xc59cff : 0x8db6e0, alpha: 0.95, width: 1.6 });
    card.title.position.set(130, 14);
    card.desc.position.set(130, 54);
  }

  private clearCards(): void {
    for (let i = 0; i < this.cards.length; i += 1) {
      this.cards[i].root.destroy({ children: true });
    }
    this.cards.length = 0;
  }

  private layout(): void {
    const width = this.screenWidth;
    const height = this.screenHeight;
    const panelWidth = 860;
    const panelHeight = 320;
    const panelX = width * 0.5 - panelWidth * 0.5;
    const panelY = height * 0.5 - panelHeight * 0.5;

    this.overlay.clear();
    this.overlay.rect(0, 0, width, height);
    this.overlay.fill({ color: 0x080c12, alpha: 0.65 });

    this.panelBg.clear();
    this.panelBg.roundRect(panelX, panelY, panelWidth, panelHeight, 12);
    this.panelBg.fill({ color: 0x101826, alpha: 0.96 });
    this.panelBg.stroke({ color: 0x85aed9, alpha: 0.94, width: 1.8 });

    this.titleText.position.set(width * 0.5, panelY + 38);
    this.subtitleText.position.set(width * 0.5, panelY + 66);

    const totalWidth = this.cards.length * 260 + Math.max(0, this.cards.length - 1) * 20;
    const startX = width * 0.5 - totalWidth * 0.5;
    const y = panelY + 104;

    for (let i = 0; i < this.cards.length; i += 1) {
      const card = this.cards[i];
      card.root.position.set(startX + i * 280, y);
      card.root.visible = card.perkId.length > 0;
    }
  }
}

