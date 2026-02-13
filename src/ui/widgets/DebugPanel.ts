import { Container, Graphics, Text } from 'pixi.js';
import { TextButton } from './TextButton';

export interface DebugPanelState {
  currentStateLabel: string;
  runSeed: number | null;
  contentStatus: string;
  contentVersion: string;
  fallbackUsed: boolean;
  restartButtonLabel: string;
}

interface DebugPanelOptions {
  parent: Container;
  onReloadContent: () => Promise<void> | void;
  onRestartAction: () => void;
}

export class DebugPanel {
  readonly root = new Container();

  private readonly bg = new Graphics();
  private readonly title = new Text({
    text: 'Debug Panel',
    style: {
      fill: 0xf0f4ff,
      fontFamily: 'monospace',
      fontSize: 14,
      fontWeight: 'bold',
    },
  });
  private readonly body = new Text({
    text: '',
    style: {
      fill: 0xd7e6ff,
      fontFamily: 'monospace',
      fontSize: 12,
    },
  });
  private readonly status = new Text({
    text: '',
    style: {
      fill: 0xffce9a,
      fontFamily: 'monospace',
      fontSize: 11,
    },
  });

  private readonly reloadButton: TextButton;
  private readonly restartButton: TextButton;
  private readonly onReloadContent: () => Promise<void> | void;
  private readonly onRestartAction: () => void;

  private visible = false;
  private loading = false;

  constructor(options: DebugPanelOptions) {
    this.onReloadContent = options.onReloadContent;
    this.onRestartAction = options.onRestartAction;

    this.root.visible = false;
    this.root.addChild(this.bg);
    this.root.addChild(this.title);
    this.root.addChild(this.body);
    this.root.addChild(this.status);

    this.reloadButton = new TextButton({
      label: 'Reload Content',
      width: 160,
      height: 34,
      onClick: () => this.reloadContent(),
    });
    this.restartButton = new TextButton({
      label: 'Restart',
      width: 190,
      height: 34,
      onClick: () => this.onRestartAction(),
    });

    this.root.addChild(this.reloadButton);
    this.root.addChild(this.restartButton);
    options.parent.addChild(this.root);

    this.layout(0, 0);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.visible = visible;
  }

  toggleVisible(): void {
    this.setVisible(!this.visible);
  }

  isVisible(): boolean {
    return this.visible;
  }

  update(state: DebugPanelState, screenWidth: number, _screenHeight: number): void {
    this.body.text = [
      `State: ${state.currentStateLabel}`,
      `Run Seed: ${state.runSeed === null ? '-' : state.runSeed}`,
      `Content: ${state.contentStatus}`,
      `Version: ${state.contentVersion}`,
      `Fallback: ${state.fallbackUsed ? 'YES' : 'NO'}`,
    ].join('\n');

    this.restartButton.setLabel(state.restartButtonLabel);
    this.status.text = this.loading ? 'Reloading content...' : '';

    this.layout(screenWidth, 0);
  }

  setMessage(message: string): void {
    this.status.text = message;
  }

  private layout(screenWidth: number, _screenHeight: number): void {
    const width = 280;
    const height = 184;
    this.root.position.set(Math.max(12, screenWidth - width - 12), 12);

    this.bg.clear();
    this.bg.roundRect(0, 0, width, height, 10);
    this.bg.fill({ color: 0x0f1a25, alpha: 0.96 });
    this.bg.stroke({ color: 0x7aa3cc, alpha: 0.9, width: 1.4 });

    this.title.position.set(10, 8);
    this.body.position.set(10, 32);
    this.status.position.set(10, 132);

    this.reloadButton.position.set(10, 148);
    this.restartButton.position.set(80, 148);
  }

  private async reloadContent(): Promise<void> {
    if (this.loading) {
      return;
    }
    this.loading = true;
    this.reloadButton.setEnabled(false);
    this.status.text = 'Reloading content...';

    try {
      await this.onReloadContent();
      this.status.text = 'Content reloaded. Restart battle for stat changes.';
    } catch (error) {
      this.status.text = `Reload failed: ${String(error)}`;
    }

    this.loading = false;
    this.reloadButton.setEnabled(true);
  }
}
