import { Container, Graphics, Text } from 'pixi.js';
import { TeamId } from '../../sim/types';

export class EndScreen {
  private readonly root = new Container();
  private readonly backdrop = new Graphics();
  private readonly title = new Text({
    text: '',
    style: {
      fill: 0xffffff,
      fontFamily: 'monospace',
      fontSize: 52,
      fontWeight: 'bold',
    },
  });
  private readonly subtitle = new Text({
    text: 'Press N to restart',
    style: {
      fill: 0xfff2cc,
      fontFamily: 'monospace',
      fontSize: 22,
    },
  });

  constructor(uiLayer: Container) {
    this.root.visible = false;
    this.root.addChild(this.backdrop);

    this.title.anchor.set(0.5, 0.5);
    this.subtitle.anchor.set(0.5, 0.5);
    this.root.addChild(this.title);
    this.root.addChild(this.subtitle);

    uiLayer.addChild(this.root);
  }

  resize(width: number, height: number): void {
    this.backdrop.clear();
    this.backdrop.rect(0, 0, width, height);
    this.backdrop.fill({ color: 0x000000, alpha: 0.55 });

    this.title.position.set(width * 0.5, height * 0.45);
    this.subtitle.position.set(width * 0.5, height * 0.56);
  }

  show(winner: TeamId): void {
    this.root.visible = true;
    if (winner === TeamId.Blue) {
      this.title.text = 'BLUE WINS';
      this.title.style.fill = 0x9ed2ff;
    } else {
      this.title.text = 'RED WINS';
      this.title.style.fill = 0xffb0b0;
    }
  }

  hide(): void {
    this.root.visible = false;
  }
}