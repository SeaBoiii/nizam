import { Container, Graphics, Text } from 'pixi.js';
import { addEntry, leaderboardKeyForResult } from '../../meta/LocalLeaderboard';
import { decodeResult, formatResultSummaryText, type ResultPayloadV1 } from '../../meta/ResultCode';
import { MENU_BODY_FONT, MENU_TITLE_FONT, drawMenuBackdrop, drawMenuCard, styleCodeTextArea } from '../../ui/theme/MenuTheme';
import { TextButton } from '../../ui/widgets/TextButton';
import { copyTextWithFallback } from '../../utils/clipboard';
import type { IGameState } from './IGameState';
import type { GameStateId, StateContext } from './StateContext';

interface CompareStatePayload {
  yourResult?: ResultPayloadV1;
  returnState?: GameStateId;
  prefillCode?: string;
}

interface ComparisonStatus {
  message: string;
  compatible: boolean;
  canSave: boolean;
}

function formatDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m${rem.toString().padStart(2, '0')}s`;
}

function formatPercent(value: number): string {
  const clamped = Math.max(0, Math.min(1, value));
  return `${Math.round(clamped * 100)}%`;
}

function resolveReturnState(value: unknown): GameStateId {
  if (value === 'RUN_END' || value === 'TITLE') {
    return value;
  }
  return 'TITLE';
}

function buildResultLines(label: string, payload: ResultPayloadV1 | null, verified: boolean): string {
  if (!payload) {
    return `${label}\nNo result loaded.`;
  }

  const lines = [
    label,
    `Mode: ${payload.mode}${payload.dateKey ? ` (${payload.dateKey})` : ''}`,
    `Score: ${payload.score}`,
    `Difficulty: ${payload.difficulty}`,
    `Nodes: ${payload.nodesCleared} | Wins: ${payload.wins}`,
    `Time: ${formatDuration(payload.timeSec)} | Casualties: ${formatPercent(payload.casualtiesPct)}`,
    `Seed: ${payload.seed}`,
    `Pack: ${payload.pack.id} v${payload.pack.version}`,
    `Perks: ${payload.perks.length > 0 ? payload.perks.join(', ') : 'None'}`,
    `Signature: ${verified ? 'Verified' : 'Unverified'}`,
  ];
  return lines.join('\n');
}

function isDailyMismatch(a: ResultPayloadV1, b: ResultPayloadV1): boolean {
  if (a.mode !== 'DAILY' || b.mode !== 'DAILY') {
    return false;
  }
  return (a.dateKey ?? '') !== (b.dateKey ?? '');
}

function isSameIdentity(a: ResultPayloadV1, b: ResultPayloadV1): boolean {
  if (a.seed !== b.seed) {
    return false;
  }
  if (a.difficulty !== b.difficulty) {
    return false;
  }
  if (a.pack.id !== b.pack.id || a.pack.version !== b.pack.version) {
    return false;
  }
  if (a.mode === 'DAILY' || b.mode === 'DAILY') {
    if (a.mode !== b.mode) {
      return false;
    }
    if ((a.dateKey ?? '') !== (b.dateKey ?? '')) {
      return false;
    }
  }
  return true;
}

export class CompareState implements IGameState {
  private readonly root = new Container();
  private readonly bg = new Graphics();
  private readonly panel = new Graphics();
  private readonly title = new Text({
    text: 'Compare Results',
    style: {
      fill: 0xf3e3b8,
      fontFamily: MENU_TITLE_FONT,
      fontSize: 36,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
  });
  private readonly compatibilityText = new Text({
    text: '',
    style: {
      fill: 0xa8d3ff,
      fontFamily: MENU_BODY_FONT,
      fontSize: 13,
      wordWrap: true,
      wordWrapWidth: 1020,
    },
  });
  private readonly statusText = new Text({
    text: '',
    style: {
      fill: 0xb9d8f7,
      fontFamily: MENU_BODY_FONT,
      fontSize: 13,
      wordWrap: true,
      wordWrapWidth: 1020,
    },
  });
  private readonly yoursText = new Text({
    text: '',
    style: {
      fill: 0xe0ecff,
      fontFamily: MENU_BODY_FONT,
      fontSize: 14,
      lineHeight: 21,
      wordWrap: true,
      wordWrapWidth: 480,
    },
  });
  private readonly theirsText = new Text({
    text: '',
    style: {
      fill: 0xe0ecff,
      fontFamily: MENU_BODY_FONT,
      fontSize: 14,
      lineHeight: 21,
      wordWrap: true,
      wordWrapWidth: 480,
    },
  });

  private readonly validateButton: TextButton;
  private readonly copySummaryButton: TextButton;
  private readonly saveButton: TextButton;
  private readonly backButton: TextButton;

  private inputArea: HTMLTextAreaElement | null = null;
  private yourResult: ResultPayloadV1 | null = null;
  private theirResult: ResultPayloadV1 | null = null;
  private theirVerified = true;
  private returnState: GameStateId = 'TITLE';

  constructor(private readonly context: StateContext) {
    this.root.addChild(this.bg);
    this.root.addChild(this.panel);

    this.title.anchor.set(0.5, 0.5);
    this.compatibilityText.anchor.set(0.5, 0.5);
    this.statusText.anchor.set(0.5, 0.5);
    this.yoursText.anchor.set(0, 0);
    this.theirsText.anchor.set(0, 0);

    this.validateButton = new TextButton({
      label: 'Validate Code',
      width: 190,
      variant: 'accent',
      onClick: () => {
        void this.validateInput();
      },
    });
    this.copySummaryButton = new TextButton({
      label: 'Copy Theirs Summary',
      width: 230,
      variant: 'secondary',
      onClick: () => {
        void this.copyTheirsSummary();
      },
    });
    this.saveButton = new TextButton({
      label: 'Save To Leaderboard',
      width: 230,
      variant: 'secondary',
      onClick: () => this.saveToLeaderboard(),
    });
    this.backButton = new TextButton({
      label: 'Back',
      width: 150,
      variant: 'primary',
      onClick: () => this.goBack(),
    });

    this.root.addChild(this.title);
    this.root.addChild(this.compatibilityText);
    this.root.addChild(this.statusText);
    this.root.addChild(this.yoursText);
    this.root.addChild(this.theirsText);
    this.root.addChild(this.validateButton);
    this.root.addChild(this.copySummaryButton);
    this.root.addChild(this.saveButton);
    this.root.addChild(this.backButton);
  }

  onEnter(payload?: unknown): void {
    this.context.stage.addChild(this.root);

    this.statusText.text = '';
    this.theirResult = null;
    this.theirVerified = true;

    if (payload && typeof payload === 'object') {
      const typed = payload as CompareStatePayload;
      this.yourResult = typed.yourResult ?? null;
      this.returnState = resolveReturnState(typed.returnState);
    } else {
      this.yourResult = null;
      this.returnState = 'TITLE';
    }

    this.ensureInputArea();
    if (payload && typeof payload === 'object') {
      const typed = payload as CompareStatePayload;
      if (this.inputArea && typeof typed.prefillCode === 'string' && typed.prefillCode.trim().length > 0) {
        this.inputArea.value = typed.prefillCode.trim();
      }
    }

    this.refreshView();
    this.layout();
  }

  onExit(): void {
    this.destroyInputArea();
    this.root.removeFromParent();
  }

  update(): void {
    if (this.root.parent === null) {
      return;
    }
    this.layout();
  }

  private refreshView(): void {
    this.yoursText.text = buildResultLines('Yours', this.yourResult, true);
    this.theirsText.text = buildResultLines('Theirs', this.theirResult, this.theirVerified);

    const status = this.computeComparisonStatus();
    this.compatibilityText.text = status.message;
    this.copySummaryButton.setEnabled(this.theirResult !== null);
    this.saveButton.setEnabled(status.canSave);
  }

  private computeComparisonStatus(): ComparisonStatus {
    if (this.theirResult === null) {
      return {
        message: 'Paste a Result Code and click Validate.',
        compatible: false,
        canSave: false,
      };
    }

    const key = leaderboardKeyForResult(this.theirResult);
    if (this.yourResult === null) {
      const message = key
        ? 'No local baseline loaded. Save is allowed by result identity.'
        : 'Normal-mode result: no leaderboard bucket (daily/challenge only).';
      return {
        message: this.theirVerified ? message : `${message} Signature is unverified.`,
        compatible: key !== null,
        canSave: key !== null,
      };
    }

    if (this.yourResult.seed !== this.theirResult.seed) {
      return {
        message: `Different seed: yours ${this.yourResult.seed} vs theirs ${this.theirResult.seed}.`,
        compatible: false,
        canSave: false,
      };
    }
    if (this.yourResult.difficulty !== this.theirResult.difficulty) {
      return {
        message: `Different difficulty: yours ${this.yourResult.difficulty} vs theirs ${this.theirResult.difficulty}.`,
        compatible: false,
        canSave: false,
      };
    }
    if (
      this.yourResult.pack.id !== this.theirResult.pack.id ||
      this.yourResult.pack.version !== this.theirResult.pack.version
    ) {
      return {
        message: `Different pack/version: yours ${this.yourResult.pack.id}@${this.yourResult.pack.version} vs theirs ${this.theirResult.pack.id}@${this.theirResult.pack.version}.`,
        compatible: false,
        canSave: false,
      };
    }
    if (isDailyMismatch(this.yourResult, this.theirResult)) {
      return {
        message: `Different daily date: yours ${this.yourResult.dateKey ?? '-'} vs theirs ${this.theirResult.dateKey ?? '-'}.`,
        compatible: false,
        canSave: false,
      };
    }
    if (!isSameIdentity(this.yourResult, this.theirResult)) {
      return {
        message: 'Different run identity (mode/date mismatch).',
        compatible: false,
        canSave: false,
      };
    }

    const suffix = this.theirVerified ? '' : ' Signature is unverified.';
    return {
      message: `Same challenge identity (seed + difficulty + pack/version match).${suffix}`,
      compatible: true,
      canSave: key !== null,
    };
  }

  private ensureInputArea(): void {
    if (typeof document === 'undefined') {
      return;
    }
    if (this.inputArea === null) {
      const area = document.createElement('textarea');
      area.placeholder = 'Paste Result Code here...';
      area.style.position = 'fixed';
      area.style.zIndex = '30';
      styleCodeTextArea(area);
      area.addEventListener('input', () => {
        this.theirResult = null;
        this.theirVerified = true;
        this.statusText.text = '';
        this.refreshView();
      });
      document.body.appendChild(area);
      this.inputArea = area;
    }
    this.layoutInputArea();
  }

  private destroyInputArea(): void {
    if (this.inputArea === null) {
      return;
    }
    if (typeof document !== 'undefined') {
      document.body.removeChild(this.inputArea);
    }
    this.inputArea = null;
  }

  private layoutInputArea(): void {
    if (!this.inputArea) {
      return;
    }
    const width = this.context.app.screen.width;
    const height = this.context.app.screen.height;
    const panelWidth = Math.min(1120, width - 40);
    const panelHeight = Math.min(700, height - 40);
    const panelX = width * 0.5 - panelWidth * 0.5;
    const panelY = height * 0.5 - panelHeight * 0.5;
    const canvasRect = this.context.app.canvas.getBoundingClientRect();

    this.inputArea.style.left = `${Math.round(canvasRect.left + panelX + panelWidth * 0.5 + 26)}px`;
    this.inputArea.style.top = `${Math.round(canvasRect.top + panelY + 70)}px`;
    this.inputArea.style.width = `${Math.round(panelWidth * 0.5 - 56)}px`;
    this.inputArea.style.height = `${Math.round(panelHeight * 0.26)}px`;
  }

  private async validateInput(): Promise<void> {
    const raw = this.inputArea ? this.inputArea.value.trim() : '';
    if (raw.length === 0) {
      this.theirResult = null;
      this.theirVerified = true;
      this.statusText.text = 'Paste a Result Code first.';
      this.refreshView();
      return;
    }

    const decoded = decodeResult(raw);
    if (!decoded.ok || !decoded.payload) {
      this.theirResult = null;
      this.theirVerified = true;
      this.statusText.text = decoded.error ?? 'Invalid result code.';
      this.refreshView();
      return;
    }

    this.theirResult = decoded.payload;
    this.theirVerified = decoded.verified !== false;
    this.statusText.text = decoded.verified === false ? decoded.error ?? 'Loaded (unverified).' : 'Result code loaded.';
    this.context.recordDiagnosticEvent('RESULT_CODE_VALIDATED', {
      ok: true,
      verified: this.theirVerified,
      mode: decoded.payload.mode,
      seed: decoded.payload.seed,
    });
    this.refreshView();
  }

  private async copyTheirsSummary(): Promise<void> {
    if (this.theirResult === null) {
      this.statusText.text = 'No decoded result to copy.';
      return;
    }
    const ok = await copyTextWithFallback(formatResultSummaryText(this.theirResult));
    this.statusText.text = ok ? 'Copied result summary.' : 'Copy failed.';
  }

  private saveToLeaderboard(): void {
    if (this.theirResult === null) {
      this.statusText.text = 'No decoded result to save.';
      return;
    }
    const status = this.computeComparisonStatus();
    if (!status.canSave) {
      this.statusText.text = 'Result is not compatible for leaderboard save.';
      return;
    }
    const key = leaderboardKeyForResult(this.theirResult);
    if (key === null) {
      this.statusText.text = 'Normal-mode result has no leaderboard bucket.';
      return;
    }

    const rawName = typeof window !== 'undefined' ? window.prompt('Optional name label:', '') : '';
    const name = typeof rawName === 'string' && rawName.trim().length > 0 ? rawName.trim() : undefined;

    addEntry(key, {
      name,
      ts: Date.now(),
      result: this.theirResult,
      verified: this.theirVerified,
    });
    this.statusText.text = `Saved to local leaderboard (${key}).`;
    this.context.recordDiagnosticEvent('RESULT_SAVED_TO_LEADERBOARD', {
      key,
      verified: this.theirVerified,
    });
  }

  private goBack(): void {
    if (this.returnState === 'RUN_END' && this.context.getCampaignData() === null) {
      this.context.transitionTo('TITLE');
      return;
    }
    this.context.transitionTo(this.returnState);
  }

  private layout(): void {
    const width = this.context.app.screen.width;
    const height = this.context.app.screen.height;
    const panelWidth = Math.min(1120, width - 40);
    const panelHeight = Math.min(700, height - 40);
    const panelX = width * 0.5 - panelWidth * 0.5;
    const panelY = height * 0.5 - panelHeight * 0.5;
    const halfWidth = panelWidth * 0.5;

    drawMenuBackdrop(this.bg, width, height);
    drawMenuCard(this.panel, panelX, panelY, panelWidth, panelHeight);
    this.panel.moveTo(panelX + halfWidth, panelY + 62);
    this.panel.lineTo(panelX + halfWidth, panelY + panelHeight - 120);
    this.panel.stroke({ color: 0x6d93b8, alpha: 0.35, width: 1.1 });

    this.title.position.set(width * 0.5, panelY + 34);
    this.compatibilityText.style.wordWrapWidth = panelWidth - 56;
    this.compatibilityText.position.set(width * 0.5, panelY + panelHeight - 108);
    this.statusText.style.wordWrapWidth = panelWidth - 56;
    this.statusText.position.set(width * 0.5, panelY + panelHeight - 80);

    this.yoursText.style.wordWrapWidth = halfWidth - 40;
    this.theirsText.style.wordWrapWidth = halfWidth - 40;
    this.yoursText.position.set(panelX + 24, panelY + 70);
    this.theirsText.position.set(panelX + halfWidth + 20, panelY + panelHeight * 0.38);

    const buttonY = panelY + panelHeight - 54;
    const actionWidth = 190 + 230 + 230 + 24;
    const actionStartX = Math.max(panelX + 20, panelX + panelWidth - actionWidth - 20);
    this.validateButton.position.set(actionStartX, buttonY);
    this.copySummaryButton.position.set(actionStartX + 202, buttonY);
    this.saveButton.position.set(actionStartX + 444, buttonY);
    this.backButton.position.set(panelX + panelWidth - 166, panelY + 18);

    this.layoutInputArea();
  }
}
