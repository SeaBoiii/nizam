import { Container, Graphics, Text } from 'pixi.js';
import type { IGameState } from './IGameState';
import type { StateContext } from './StateContext';
import { TextButton } from '../../ui/widgets/TextButton';

export class TitleState implements IGameState {
  private readonly root = new Container();
  private readonly bg = new Graphics();
  private readonly title = new Text({
    text: 'NIZAM',
    style: {
      fill: 0xf3e2b2,
      fontFamily: 'monospace',
      fontSize: 86,
      fontWeight: 'bold',
    },
  });
  private readonly subtitle = new Text({
    text: 'Bannerlord-lite Campaign',
    style: {
      fill: 0xcad8ec,
      fontFamily: 'monospace',
      fontSize: 20,
    },
  });
  private readonly status = new Text({
    text: '',
    style: {
      fill: 0x9fc2e9,
      fontFamily: 'monospace',
      fontSize: 14,
    },
  });

  private readonly newRunButton: TextButton;
  private readonly continueButton: TextButton;
  private readonly clearButton: TextButton;

  constructor(private readonly context: StateContext) {
    this.root.addChild(this.bg);

    this.title.anchor.set(0.5, 0.5);
    this.subtitle.anchor.set(0.5, 0.5);
    this.status.anchor.set(0.5, 0.5);

    this.newRunButton = new TextButton({
      label: 'New Run',
      onClick: () => {
        this.context.startNewRun();
        this.context.transitionTo('OVERWORLD');
      },
    });

    this.continueButton = new TextButton({
      label: 'Continue',
      onClick: () => {
        if (this.context.loadSaveData()) {
          this.context.transitionTo('OVERWORLD');
        } else {
          this.status.text = 'No valid save found.';
          this.refreshContinueState();
        }
      },
    });

    this.clearButton = new TextButton({
      label: 'Reset Save',
      onClick: () => {
        this.context.clearSaveData();
        this.status.text = 'Save cleared.';
        this.refreshContinueState();
      },
    });

    this.root.addChild(this.title);
    this.root.addChild(this.subtitle);
    this.root.addChild(this.status);
    this.root.addChild(this.newRunButton);
    this.root.addChild(this.continueButton);
    this.root.addChild(this.clearButton);
  }

  onEnter(): void {
    this.context.stage.addChild(this.root);
    this.layout();
    this.refreshContinueState();
    this.status.text = '';
  }

  onExit(): void {
    this.root.removeFromParent();
  }

  update(): void {
    if (this.root.parent === null) {
      return;
    }

    this.layout();
  }

  private refreshContinueState(): void {
    this.continueButton.setEnabled(this.context.hasSaveData());
  }

  private layout(): void {
    const width = this.context.app.screen.width;
    const height = this.context.app.screen.height;

    this.bg.clear();
    this.bg.rect(0, 0, width, height);
    this.bg.fill({ color: 0x0f1720, alpha: 1 });

    this.title.position.set(width * 0.5, height * 0.24);
    this.subtitle.position.set(width * 0.5, height * 0.33);
    this.status.position.set(width * 0.5, height * 0.77);

    this.newRunButton.position.set(width * 0.5 - 110, height * 0.45);
    this.continueButton.position.set(width * 0.5 - 110, height * 0.53);
    this.clearButton.position.set(width * 0.5 - 110, height * 0.61);
  }
}