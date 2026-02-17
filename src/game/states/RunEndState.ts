import { Container, Graphics, Text } from 'pixi.js';
import { contentManager } from '../../content/ContentManager';
import { getBestForDate, recordDailyResult } from '../../meta/DailyResults';
import { DifficultyMode } from '../../meta/Difficulty';
import {
  buildShareResultText,
  createShareCardContainer,
  type ShareCardData,
} from '../../ui/share/ShareCard';
import { exportShareCardPNG } from '../../ui/share/ShareCardExporter';
import { downloadBlob, downloadDataUrl } from '../../ui/share/download';
import { TextButton } from '../../ui/widgets/TextButton';
import { copyTextWithFallback } from '../../utils/clipboard';
import type { IGameState } from './IGameState';
import type { StateContext } from './StateContext';

function formatDurationShort(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
}

function formatPercent(value01: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value01)) * 100)}%`;
}

function modeLabel(mode: string): string {
  return mode === 'DAILY' ? 'Daily' : 'Normal';
}

export class RunEndState implements IGameState {
  private readonly root = new Container();
  private readonly bg = new Graphics();
  private readonly panel = new Graphics();
  private readonly title = new Text({
    text: 'Run Summary',
    style: {
      fill: 0xf4e2b5,
      fontFamily: 'monospace',
      fontSize: 42,
      fontWeight: 'bold',
    },
  });
  private readonly body = new Text({
    text: '',
    style: {
      fill: 0xd8e9ff,
      fontFamily: 'monospace',
      fontSize: 15,
      lineHeight: 22,
      wordWrap: true,
      wordWrapWidth: 900,
    },
  });
  private readonly status = new Text({
    text: '',
    style: {
      fill: 0x9dd1ff,
      fontFamily: 'monospace',
      fontSize: 13,
    },
  });

  private readonly copyButton: TextButton;
  private readonly downloadCardButton: TextButton;
  private readonly newDailyButton: TextButton;
  private readonly backButton: TextButton;

  private shareText = '';
  private shareCardData: ShareCardData | null = null;
  private isDailyRun = false;
  private ended = false;

  constructor(private readonly context: StateContext) {
    this.root.addChild(this.bg);
    this.root.addChild(this.panel);
    this.title.anchor.set(0.5, 0.5);
    this.body.anchor.set(0.5, 0);
    this.status.anchor.set(0.5, 0.5);

    this.copyButton = new TextButton({
      label: 'Copy Result Text',
      width: 220,
      onClick: () => this.copyResult(),
    });
    this.downloadCardButton = new TextButton({
      label: 'Download Share Card (PNG)',
      width: 260,
      onClick: () => this.downloadCard(),
    });
    this.newDailyButton = new TextButton({
      label: 'New Daily Run',
      width: 220,
      onClick: () => this.startNewDaily(),
    });
    this.backButton = new TextButton({
      label: 'Back To Title',
      width: 220,
      onClick: () => this.backToTitle(),
    });

    this.root.addChild(this.title);
    this.root.addChild(this.body);
    this.root.addChild(this.status);
    this.root.addChild(this.copyButton);
    this.root.addChild(this.downloadCardButton);
    this.root.addChild(this.newDailyButton);
    this.root.addChild(this.backButton);
  }

  onEnter(): void {
    const campaign = this.context.getCampaignData();
    if (campaign === null) {
      this.context.transitionTo('TITLE');
      return;
    }

    this.context.stage.addChild(this.root);
    this.ended = false;
    this.status.text = '';
    this.isDailyRun = campaign.runState.mode === 'DAILY';
    this.newDailyButton.visible = this.isDailyRun;
    this.downloadCardButton.visible = this.isDailyRun;

    const stats = this.context.getStatsSnapshot();
    const contentStatus = this.context.getContentStatus();
    const runState = campaign.runState;

    const lastRun = stats.lastRun;
    const battleSummaries = lastRun?.battleSummaries ?? [];
    let battlesWon = 0;
    let totalDuration = 0;
    let casualtiesAcc = 0;
    for (let i = 0; i < battleSummaries.length; i += 1) {
      if (battleSummaries[i].won) {
        battlesWon += 1;
      }
      totalDuration += battleSummaries[i].durationSec;
      casualtiesAcc += battleSummaries[i].playerCasualtiesPct;
    }
    const avgCasualties = battleSummaries.length > 0 ? casualtiesAcc / battleSummaries.length : 0;
    const breakdown = runState.scoreBreakdown;
    const finalScore = runState.finalScore ?? 0;

    const perkNames: string[] = [];
    for (let i = 0; i < campaign.perkState.pickedPerkIds.length; i += 1) {
      const perkId = campaign.perkState.pickedPerkIds[i];
      const perk = contentManager.getPerk(perkId);
      perkNames.push(perk ? perk.name : perkId);
    }
    const perkList = perkNames.length > 0 ? perkNames.join(', ') : 'None';
    const difficultyLabel = runState.difficultyMode === DifficultyMode.HARD ? 'HARD' : 'NORMAL';
    const dateLine = runState.mode === 'DAILY' && runState.dateKey !== null ? `Date: ${runState.dateKey} (SG)` : 'Date: -';

    this.shareCardData = {
      mode: runState.mode,
      dateKey: runState.dateKey,
      score: finalScore,
      difficulty: runState.difficultyMode,
      nodesCleared: runState.clearedNodeIds.length,
      wins: battlesWon,
      timeSec: totalDuration,
      casualtiesPct: avgCasualties,
      perks: perkNames,
      seed: runState.seed,
      packName: contentStatus.loadedPackName,
      packVersion: contentStatus.contentVersion,
      urlPath: import.meta.env.BASE_URL,
    };

    this.shareText = buildShareResultText(this.shareCardData);

    let dailyBestLine = '';
    if (this.isDailyRun && runState.dateKey !== null) {
      recordDailyResult({
        dateKey: runState.dateKey,
        score: finalScore,
        difficulty: runState.difficultyMode,
        nodesCleared: runState.clearedNodeIds.length,
        wins: battlesWon,
        timeSec: totalDuration,
        casualtiesPct: avgCasualties,
        perks: perkNames,
        seed: runState.seed,
        packName: contentStatus.loadedPackName,
        packVersion: contentStatus.contentVersion,
        ts: Date.now(),
      });
      const best = getBestForDate(runState.dateKey);
      if (best !== null) {
        dailyBestLine = `Daily Best: ${best.score} (${best.difficulty})`;
      }
    }

    const bodyLines = [
      `Mode: ${modeLabel(runState.mode)}`,
      dateLine,
      `Seed: ${runState.seed}`,
      `Difficulty: ${difficultyLabel}`,
      `Pack: ${contentStatus.loadedPackName} (${contentStatus.contentVersion})`,
      `Nodes Cleared: ${runState.clearedNodeIds.length}`,
      `Score: ${finalScore}`,
      breakdown
        ? `Breakdown: base ${breakdown.baseScore} - time ${breakdown.timePenalty} - casualties ${breakdown.casualtyPenalty} x${breakdown.difficultyMult.toFixed(2)}`
        : 'Breakdown: unavailable',
      `Battles Won: ${battlesWon}`,
      `Battle Time: ${formatDurationShort(totalDuration)}`,
      `Avg Casualties: ${formatPercent(avgCasualties)}`,
      `Perks: ${perkList}`,
    ];
    if (dailyBestLine.length > 0) {
      bodyLines.push(dailyBestLine);
    }
    this.body.text = bodyLines.join('\n');

    this.context.recordDiagnosticEvent('RUN_END_VIEWED', {
      mode: runState.mode,
      dateKey: runState.dateKey ?? '',
      score: finalScore,
    });

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

  private async copyResult(): Promise<void> {
    const ok = await copyTextWithFallback(this.shareText);
    this.status.text = ok ? 'Copied result text.' : 'Copy failed.';
  }

  private async downloadCard(): Promise<void> {
    const data = this.shareCardData;
    if (data === null || data.mode !== 'DAILY' || data.dateKey === null) {
      this.status.text = 'Share card is available for daily runs only.';
      return;
    }

    const card = createShareCardContainer(data);
    const fileName = `nizam_daily_${data.dateKey}_${Math.max(0, Math.floor(data.score))}.png`;
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

  private async startNewDaily(): Promise<void> {
    if (this.ended) {
      return;
    }
    this.ended = true;
    this.context.endCurrentRunSession();
    const started = await this.context.startDailyRun(DifficultyMode.NORMAL);
    if (!started) {
      this.ended = false;
      this.status.text = 'Failed to start daily run.';
      return;
    }
    this.context.transitionTo('OVERWORLD');
  }

  private backToTitle(): void {
    if (this.ended) {
      return;
    }
    this.ended = true;
    this.context.endCurrentRunSession();
    this.context.transitionTo('TITLE');
  }

  private layout(): void {
    const width = this.context.app.screen.width;
    const height = this.context.app.screen.height;
    const panelWidth = Math.min(980, width - 40);
    const panelHeight = Math.min(650, height - 40);
    const panelX = width * 0.5 - panelWidth * 0.5;
    const panelY = height * 0.5 - panelHeight * 0.5;

    this.bg.clear();
    this.bg.rect(0, 0, width, height);
    this.bg.fill({ color: 0x0f1720, alpha: 1 });

    this.panel.clear();
    this.panel.roundRect(panelX, panelY, panelWidth, panelHeight, 12);
    this.panel.fill({ color: 0x121c2a, alpha: 0.96 });
    this.panel.stroke({ color: 0x6e9bc9, alpha: 0.9, width: 1.6 });

    this.title.position.set(width * 0.5, panelY + 34);
    this.body.style.wordWrapWidth = panelWidth - 70;
    this.body.position.set(width * 0.5, panelY + 78);
    this.status.position.set(width * 0.5, panelY + panelHeight - 84);

    const buttonY = panelY + panelHeight - 56;
    if (this.isDailyRun) {
      this.copyButton.position.set(width * 0.5 - 450, buttonY);
      this.downloadCardButton.position.set(width * 0.5 - 220, buttonY);
      this.newDailyButton.position.set(width * 0.5 + 50, buttonY);
      this.backButton.position.set(width * 0.5 + 280, buttonY);
    } else {
      this.copyButton.position.set(width * 0.5 - 230, buttonY);
      this.backButton.position.set(width * 0.5 + 10, buttonY);
    }
  }
}
