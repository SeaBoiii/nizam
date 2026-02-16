import { Container, Graphics, Text } from 'pixi.js';
import { copyTextWithFallback } from '../../utils/clipboard';
import { TextButton } from './TextButton';

export interface ErrorOverlayContextSummary {
  seed: number | null;
  nodeId: string;
  mapId: string;
  objectiveType: string;
  difficulty: string;
  perksCount: number;
  state: string;
}

export interface ErrorOverlayPayload {
  message: string;
  stack: string;
  canContinue: boolean;
  context: ErrorOverlayContextSummary;
  bugReportJson: string;
  onReload: () => void;
  onContinue: () => void;
}

export class ErrorOverlay {
  readonly root = new Container();

  private readonly dim = new Graphics();
  private readonly panel = new Graphics();

  private readonly title = new Text({
    text: 'Something went wrong',
    style: {
      fill: 0xffdfba,
      fontFamily: 'monospace',
      fontSize: 30,
      fontWeight: 'bold',
    },
  });
  private readonly message = new Text({
    text: '',
    style: {
      fill: 0xffe9d1,
      fontFamily: 'monospace',
      fontSize: 16,
      wordWrap: true,
      wordWrapWidth: 920,
      lineHeight: 22,
    },
  });
  private readonly contextText = new Text({
    text: '',
    style: {
      fill: 0xd7e7ff,
      fontFamily: 'monospace',
      fontSize: 13,
      lineHeight: 20,
      wordWrap: true,
      wordWrapWidth: 920,
    },
  });
  private readonly stackText = new Text({
    text: '',
    style: {
      fill: 0xf0cfcf,
      fontFamily: 'monospace',
      fontSize: 11,
      lineHeight: 16,
      wordWrap: true,
      wordWrapWidth: 920,
    },
  });
  private readonly status = new Text({
    text: '',
    style: {
      fill: 0xaed7ff,
      fontFamily: 'monospace',
      fontSize: 12,
    },
  });

  private readonly copyBugButton: TextButton;
  private readonly copyStackButton: TextButton;
  private readonly reloadButton: TextButton;
  private readonly continueButton: TextButton;
  private readonly toggleStackButton: TextButton;

  private stackCollapsed = true;
  private stackVisible = false;
  private stackTextFull = '';
  private bugReportJson = '';
  private onReloadAction: (() => void) | null = null;
  private onContinueAction: (() => void) | null = null;

  constructor(parent: Container) {
    this.root.visible = false;
    this.root.eventMode = 'static';
    this.root.cursor = 'default';

    this.copyBugButton = new TextButton({
      label: 'Copy Bug Report JSON',
      width: 220,
      height: 36,
      onClick: () => this.copyBugReport(),
    });
    this.copyStackButton = new TextButton({
      label: 'Copy Stack Trace',
      width: 190,
      height: 36,
      onClick: () => this.copyStackTrace(),
    });
    this.reloadButton = new TextButton({
      label: 'Reload',
      width: 130,
      height: 36,
      onClick: () => {
        if (this.onReloadAction) {
          this.onReloadAction();
        }
      },
    });
    this.continueButton = new TextButton({
      label: 'Continue',
      width: 130,
      height: 36,
      onClick: () => {
        if (this.onContinueAction) {
          this.onContinueAction();
        }
      },
    });
    this.toggleStackButton = new TextButton({
      label: 'Show Stack',
      width: 140,
      height: 32,
      onClick: () => this.toggleStack(),
    });

    this.root.addChild(this.dim);
    this.root.addChild(this.panel);
    this.root.addChild(this.title);
    this.root.addChild(this.message);
    this.root.addChild(this.contextText);
    this.root.addChild(this.toggleStackButton);
    this.root.addChild(this.stackText);
    this.root.addChild(this.status);
    this.root.addChild(this.copyBugButton);
    this.root.addChild(this.copyStackButton);
    this.root.addChild(this.reloadButton);
    this.root.addChild(this.continueButton);

    parent.addChild(this.root);
  }

  show(payload: ErrorOverlayPayload): void {
    this.stackCollapsed = true;
    this.stackVisible = true;
    this.message.text = payload.message;
    this.stackTextFull = payload.stack;
    this.bugReportJson = payload.bugReportJson;
    this.onReloadAction = payload.onReload;
    this.onContinueAction = payload.onContinue;
    this.continueButton.setEnabled(payload.canContinue);
    this.status.text = '';

    this.contextText.text = [
      `State: ${payload.context.state}`,
      `Seed: ${payload.context.seed === null ? '-' : payload.context.seed}`,
      `Node: ${payload.context.nodeId}`,
      `Map: ${payload.context.mapId}`,
      `Objective: ${payload.context.objectiveType}`,
      `Difficulty: ${payload.context.difficulty}`,
      `Perks: ${payload.context.perksCount}`,
    ].join('\n');

    this.root.visible = true;
    this.updateStackText();
  }

  hide(): void {
    this.root.visible = false;
    this.stackVisible = false;
    this.status.text = '';
  }

  isVisible(): boolean {
    return this.root.visible;
  }

  layout(screenWidth: number, screenHeight: number): void {
    if (!this.root.visible) {
      return;
    }

    this.dim.clear();
    this.dim.rect(0, 0, screenWidth, screenHeight);
    this.dim.fill({ color: 0x000000, alpha: 0.7 });

    const panelWidth = Math.min(980, screenWidth - 30);
    const panelHeight = Math.min(700, screenHeight - 30);
    const panelX = (screenWidth - panelWidth) * 0.5;
    const panelY = (screenHeight - panelHeight) * 0.5;

    this.panel.clear();
    this.panel.roundRect(panelX, panelY, panelWidth, panelHeight, 12);
    this.panel.fill({ color: 0x151d28, alpha: 0.98 });
    this.panel.stroke({ color: 0x8ba6c4, alpha: 0.95, width: 1.8 });

    this.title.position.set(panelX + 18, panelY + 14);
    this.message.style.wordWrapWidth = panelWidth - 36;
    this.message.position.set(panelX + 18, panelY + 64);
    this.contextText.style.wordWrapWidth = panelWidth - 36;
    this.contextText.position.set(panelX + 18, panelY + 116);

    this.toggleStackButton.position.set(panelX + 18, panelY + 270);
    this.stackText.style.wordWrapWidth = panelWidth - 36;
    this.stackText.position.set(panelX + 18, panelY + 312);
    this.stackText.visible = this.stackVisible && !this.stackCollapsed;
    this.status.position.set(panelX + 18, panelY + panelHeight - 104);

    const buttonsY = panelY + panelHeight - 50;
    this.copyBugButton.position.set(panelX + 18, buttonsY);
    this.copyStackButton.position.set(panelX + 248, buttonsY);
    this.reloadButton.position.set(panelX + panelWidth - 286, buttonsY);
    this.continueButton.position.set(panelX + panelWidth - 146, buttonsY);
  }

  private toggleStack(): void {
    this.stackCollapsed = !this.stackCollapsed;
    this.updateStackText();
  }

  private updateStackText(): void {
    this.toggleStackButton.setLabel(this.stackCollapsed ? 'Show Stack' : 'Hide Stack');
    if (this.stackCollapsed || this.stackTextFull.trim().length === 0) {
      this.stackText.text = '';
    } else {
      this.stackText.text = this.stackTextFull;
    }
  }

  private async copyBugReport(): Promise<void> {
    const ok = await copyTextWithFallback(this.bugReportJson);
    this.status.text = ok ? 'Copied bug report JSON.' : 'Copy failed.';
  }

  private async copyStackTrace(): Promise<void> {
    const stack = this.stackTextFull.trim().length > 0 ? this.stackTextFull : this.message.text;
    const ok = await copyTextWithFallback(stack);
    this.status.text = ok ? 'Copied stack trace.' : 'Copy failed.';
  }
}

