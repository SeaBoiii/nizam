import { Container, Graphics, Text } from 'pixi.js';
import {
  loadDailyResults,
  resetDailyResults,
  type DailyBestResult,
  type DailyHistoryEntry,
} from '../../meta/DailyResults';
import {
  buildShareResultText,
  createShareCardContainer,
  type ShareCardData,
} from '../../ui/share/ShareCard';
import { exportShareCardPNG } from '../../ui/share/ShareCardExporter';
import { downloadBlob, downloadDataUrl } from '../../ui/share/download';
import { MENU_BODY_FONT, MENU_TITLE_FONT, drawMenuBackdrop, drawMenuCard } from '../../ui/theme/MenuTheme';
import { TextButton } from '../../ui/widgets/TextButton';
import { copyTextWithFallback } from '../../utils/clipboard';
import type { IGameState } from './IGameState';
import type { StateContext } from './StateContext';

const MAX_VISIBLE_HISTORY = 10;

function formatDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
}

function formatPercent(value01: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value01)) * 100)}%`;
}

function isBestEntry(entry: DailyHistoryEntry, best: DailyBestResult | undefined): boolean {
  if (best === undefined) {
    return false;
  }
  return entry.score === best.score && entry.seed === best.seed;
}

export class DailyHistoryState implements IGameState {
  private readonly root = new Container();
  private readonly bg = new Graphics();
  private readonly panel = new Graphics();

  private readonly title = new Text({
    text: 'Daily History',
    style: {
      fill: 0xf3e3b8,
      fontFamily: MENU_TITLE_FONT,
      fontSize: 36,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
  });

  private readonly listHeader = new Text({
    text: 'Recent Results',
    style: {
      fill: 0xc7def8,
      fontFamily: MENU_BODY_FONT,
      fontSize: 16,
      fontWeight: '600',
    },
  });

  private readonly detailsHeader = new Text({
    text: 'Details',
    style: {
      fill: 0xc7def8,
      fontFamily: MENU_BODY_FONT,
      fontSize: 16,
      fontWeight: '600',
    },
  });

  private readonly detailText = new Text({
    text: 'No history entries yet.',
    style: {
      fill: 0xe1edff,
      fontFamily: MENU_BODY_FONT,
      fontSize: 14,
      lineHeight: 21,
      wordWrap: true,
      wordWrapWidth: 580,
    },
  });

  private readonly status = new Text({
    text: '',
    style: {
      fill: 0x9ec8ef,
      fontFamily: MENU_BODY_FONT,
      fontSize: 13,
    },
  });

  private readonly entryButtons: TextButton[] = [];
  private readonly copyButton: TextButton;
  private readonly downloadButton: TextButton;
  private readonly resetButton: TextButton;
  private readonly backButton: TextButton;

  private entries: DailyHistoryEntry[] = [];
  private bestByDate: Record<string, DailyBestResult> = {};
  private selectedIndex = -1;
  private confirmReset = false;

  constructor(private readonly context: StateContext) {
    this.root.addChild(this.bg);
    this.root.addChild(this.panel);

    this.title.anchor.set(0.5, 0.5);
    this.detailText.anchor.set(0, 0);
    this.status.anchor.set(0.5, 0.5);
    this.root.addChild(this.title);
    this.root.addChild(this.listHeader);
    this.root.addChild(this.detailsHeader);
    this.root.addChild(this.detailText);
    this.root.addChild(this.status);

    for (let i = 0; i < MAX_VISIBLE_HISTORY; i += 1) {
      const index = i;
      const button = new TextButton({
        label: '-',
        width: 336,
        height: 36,
        variant: 'secondary',
        onClick: () => this.selectEntry(index),
      });
      this.entryButtons.push(button);
      this.root.addChild(button);
    }

    this.copyButton = new TextButton({
      label: 'Copy Share Text',
      width: 200,
      variant: 'secondary',
      onClick: () => this.copySelectedShareText(),
    });
    this.downloadButton = new TextButton({
      label: 'Download Share Card',
      width: 240,
      variant: 'accent',
      onClick: () => this.downloadSelectedShareCard(),
    });
    this.resetButton = new TextButton({
      label: 'Reset Daily History',
      width: 210,
      variant: 'danger',
      onClick: () => this.resetHistory(),
    });
    this.backButton = new TextButton({
      label: 'Back',
      width: 140,
      variant: 'primary',
      onClick: () => this.context.transitionTo('TITLE'),
    });

    this.root.addChild(this.copyButton);
    this.root.addChild(this.downloadButton);
    this.root.addChild(this.resetButton);
    this.root.addChild(this.backButton);
  }

  onEnter(): void {
    this.context.stage.addChild(this.root);
    this.confirmReset = false;
    this.resetButton.setLabel('Reset Daily History');
    this.status.text = '';
    this.reloadData();
    this.layout();
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

  private reloadData(): void {
    const results = loadDailyResults();
    this.entries = results.history.slice(0, MAX_VISIBLE_HISTORY);
    this.bestByDate = results.bestByDate;
    if (this.entries.length === 0) {
      this.selectedIndex = -1;
    } else if (this.selectedIndex < 0 || this.selectedIndex >= this.entries.length) {
      this.selectedIndex = 0;
    }
    this.refreshListButtons();
    this.refreshDetails();
  }

  private selectEntry(index: number): void {
    if (index < 0 || index >= this.entries.length) {
      return;
    }
    this.selectedIndex = index;
    this.refreshListButtons();
    this.refreshDetails();
  }

  private getSelectedEntry(): DailyHistoryEntry | null {
    if (this.selectedIndex < 0 || this.selectedIndex >= this.entries.length) {
      return null;
    }
    return this.entries[this.selectedIndex];
  }

  private toShareCardData(entry: DailyHistoryEntry): ShareCardData {
    return {
      mode: 'DAILY',
      dateKey: entry.dateKey,
      score: entry.score,
      difficulty: entry.difficulty,
      nodesCleared: entry.nodesCleared,
      wins: entry.wins,
      timeSec: entry.timeSec,
      casualtiesPct: entry.casualtiesPct,
      perks: [...entry.perks],
      seed: entry.seed,
      packName: entry.packName,
      packVersion: entry.packVersion,
      urlPath: import.meta.env.BASE_URL,
    };
  }

  private refreshListButtons(): void {
    for (let i = 0; i < this.entryButtons.length; i += 1) {
      const button = this.entryButtons[i];
      const entry = this.entries[i];
      if (!entry) {
        button.setLabel('-');
        button.setEnabled(false);
        continue;
      }
      const best = this.bestByDate[entry.dateKey];
      const pb = isBestEntry(entry, best) ? ' [PB]' : '';
      button.setLabel(`${entry.dateKey}  ${entry.score}  ${entry.difficulty}${pb}`);
      button.setEnabled(true);
    }
  }

  private refreshDetails(): void {
    const selected = this.getSelectedEntry();
    if (selected === null) {
      this.detailText.text = 'No history entries yet.\nComplete a Daily Challenge run to populate this list.';
      this.copyButton.setEnabled(false);
      this.downloadButton.setEnabled(false);
      return;
    }

    const shareData = this.toShareCardData(selected);
    const shareText = buildShareResultText(shareData);
    const best = this.bestByDate[selected.dateKey];
    const bestLine = best
      ? `Best for ${selected.dateKey}: ${best.score} (${best.difficulty})`
      : `Best for ${selected.dateKey}: -`;

    this.detailText.text = [
      `Date: ${selected.dateKey} (SG)`,
      `Score: ${selected.score} (${selected.difficulty})`,
      `Nodes: ${selected.nodesCleared} | Wins: ${selected.wins}`,
      `Time: ${formatDuration(selected.timeSec)} | Casualties: ${formatPercent(selected.casualtiesPct)}`,
      bestLine,
      `Pack: ${selected.packName} v${selected.packVersion}`,
      `Recorded: ${new Date(selected.ts).toLocaleString()}`,
      '',
      'Share Text:',
      shareText,
    ].join('\n');

    this.copyButton.setEnabled(true);
    this.downloadButton.setEnabled(true);
  }

  private async copySelectedShareText(): Promise<void> {
    const selected = this.getSelectedEntry();
    if (selected === null) {
      this.status.text = 'No entry selected.';
      return;
    }
    const ok = await copyTextWithFallback(buildShareResultText(this.toShareCardData(selected)));
    this.status.text = ok ? 'Copied share text.' : 'Copy failed.';
  }

  private async downloadSelectedShareCard(): Promise<void> {
    const selected = this.getSelectedEntry();
    if (selected === null) {
      this.status.text = 'No entry selected.';
      return;
    }

    const cardData = this.toShareCardData(selected);
    const card = createShareCardContainer(cardData);
    const fileName = `nizam_daily_${selected.dateKey}_${selected.score}.png`;
    try {
      const blob = await exportShareCardPNG(this.context.app.renderer, card);
      let ok = downloadBlob(blob, fileName);
      if (!ok) {
        const fallbackDataUrl = await this.context.app.renderer.extract.base64({
          target: card,
          format: 'png',
        });
        ok = downloadDataUrl(fallbackDataUrl, fileName);
      }
      this.status.text = ok ? `Downloaded ${fileName}.` : 'Download failed.';
    } catch (error) {
      this.status.text = `Download failed: ${String(error)}`;
    } finally {
      card.destroy({ children: true });
    }
  }

  private resetHistory(): void {
    if (!this.confirmReset) {
      this.confirmReset = true;
      this.resetButton.setLabel('Confirm Reset');
      this.status.text = 'Press Reset Daily History again to confirm.';
      return;
    }

    resetDailyResults();
    this.confirmReset = false;
    this.resetButton.setLabel('Reset Daily History');
    this.status.text = 'Daily history reset.';
    this.reloadData();
  }

  private layout(): void {
    const width = this.context.app.screen.width;
    const height = this.context.app.screen.height;
    const panelWidth = Math.min(1120, width - 40);
    const panelHeight = Math.min(700, height - 40);
    const panelX = width * 0.5 - panelWidth * 0.5;
    const panelY = height * 0.5 - panelHeight * 0.5;

    drawMenuBackdrop(this.bg, width, height);
    drawMenuCard(this.panel, panelX, panelY, panelWidth, panelHeight);

    this.title.position.set(width * 0.5, panelY + 34);

    const leftX = panelX + 26;
    const rightX = panelX + 390;
    const topY = panelY + 72;

    this.listHeader.position.set(leftX, topY);
    this.detailsHeader.position.set(rightX, topY);

    for (let i = 0; i < this.entryButtons.length; i += 1) {
      this.entryButtons[i].position.set(leftX, topY + 32 + i * 44);
    }

    this.detailText.style.wordWrapWidth = panelWidth - 430;
    this.detailText.position.set(rightX, topY + 30);

    const buttonY = panelY + panelHeight - 56;
    this.copyButton.position.set(rightX, buttonY);
    this.downloadButton.position.set(rightX + 210, buttonY);
    this.resetButton.position.set(rightX + 460, buttonY);
    this.backButton.position.set(rightX + 680, buttonY);

    this.status.position.set(width * 0.5, panelY + panelHeight - 84);
  }
}
