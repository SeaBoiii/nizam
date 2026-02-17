import { Container, Graphics, Text } from 'pixi.js';
import { contentManager } from '../../content/ContentManager';
import { DifficultyMode } from '../../meta/Difficulty';
import type { RunState } from '../../overworld/types';
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
  private readonly newDailyButton: TextButton;
  private readonly backButton: TextButton;

  private shareText = '';
  private isDailyRun = false;
  private ended = false;

  constructor(private readonly context: StateContext) {
    this.root.addChild(this.bg);
    this.root.addChild(this.panel);
    this.title.anchor.set(0.5, 0.5);
    this.body.anchor.set(0.5, 0);
    this.status.anchor.set(0.5, 0.5);

    this.copyButton = new TextButton({
      label: 'Copy Result',
      width: 220,
      onClick: () => this.copyResult(),
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
    const difficultyLabel = runState.difficultyMode === DifficultyMode.HARD ? 'Hard' : 'Normal';
    const dateLine = runState.mode === 'DAILY' && runState.dateKey !== null ? `Date: ${runState.dateKey} (SG)` : 'Date: -';

    this.body.text = [
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
    ].join('\n');

    this.shareText = this.buildShareText({
      runState,
      finalScore,
      difficultyLabel,
      nodesCleared: runState.clearedNodeIds.length,
      battlesWon,
      totalDurationSec: totalDuration,
      avgCasualties,
      perkList,
      contentVersion: contentStatus.contentVersion,
      packName: contentStatus.loadedPackName,
    });

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

  private buildShareText(input: {
    runState: RunState;
    finalScore: number;
    difficultyLabel: string;
    nodesCleared: number;
    battlesWon: number;
    totalDurationSec: number;
    avgCasualties: number;
    perkList: string;
    contentVersion: string;
    packName: string;
  }): string {
    const header =
      input.runState.mode === 'DAILY' && input.runState.dateKey !== null
        ? `NIZAM Daily Challenge - ${input.runState.dateKey} (SG)`
        : 'NIZAM Run Result';

    return [
      header,
      `Score: ${input.finalScore} (${input.difficultyLabel})`,
      `Nodes: ${input.nodesCleared} | Wins: ${input.battlesWon} | Casualties: ${formatPercent(input.avgCasualties)} | Time: ${formatDurationShort(input.totalDurationSec)}`,
      `Perks: ${input.perkList}`,
      `Seed: ${input.runState.seed} | Pack: ${input.packName} v${input.contentVersion}`,
    ].join('\n');
  }

  private async copyResult(): Promise<void> {
    const ok = await copyTextWithFallback(this.shareText);
    this.status.text = ok ? 'Copied result text.' : 'Copy failed.';
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
    this.copyButton.position.set(width * 0.5 - 340, buttonY);
    this.newDailyButton.position.set(width * 0.5 - 110, buttonY);
    this.backButton.position.set(width * 0.5 + 120, buttonY);
  }
}
