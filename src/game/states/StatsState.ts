import { Container, Graphics, Text } from 'pixi.js';
import type { StatsV1 } from '../../meta/Stats';
import { TextButton } from '../../ui/widgets/TextButton';
import type { IGameState } from './IGameState';
import type { GameStateId, StateContext } from './StateContext';

interface StatsStatePayload {
  returnState?: GameStateId;
}

function formatDuration(totalSeconds: number): string {
  const rounded = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function formatWinrate(wins: number, played: number): string {
  if (played <= 0) {
    return '0%';
  }
  return `${((wins / played) * 100).toFixed(1)}%`;
}

function topEntries(record: Record<string, number>, limit: number): Array<{ key: string; value: number }> {
  const entries = Object.entries(record);
  entries.sort((a, b) => b[1] - a[1]);
  const sliced: Array<{ key: string; value: number }> = [];
  for (let i = 0; i < entries.length && i < limit; i += 1) {
    sliced.push({ key: entries[i][0], value: entries[i][1] });
  }
  return sliced;
}

async function copyTextWithFallback(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through
    }
  }

  if (typeof document === 'undefined') {
    return false;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  textArea.style.left = '-1000px';
  textArea.style.top = '-1000px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }

  document.body.removeChild(textArea);
  return copied;
}

export class StatsState implements IGameState {
  private readonly root = new Container();
  private readonly bg = new Graphics();
  private readonly panel = new Graphics();

  private readonly title = new Text({
    text: 'Stats',
    style: {
      fill: 0xf4e2b5,
      fontFamily: 'monospace',
      fontSize: 42,
      fontWeight: 'bold',
    },
  });

  private readonly summary = new Text({
    text: '',
    style: {
      fill: 0xd8e9ff,
      fontFamily: 'monospace',
      fontSize: 15,
      lineHeight: 22,
    },
  });

  private readonly status = new Text({
    text: '',
    style: {
      fill: 0x9dd1ff,
      fontFamily: 'monospace',
      fontSize: 14,
    },
  });

  private readonly copyAllButton: TextButton;
  private readonly copyLastRunButton: TextButton;
  private readonly resetButton: TextButton;
  private readonly backButton: TextButton;

  private returnState: GameStateId = 'TITLE';
  private confirmReset = false;

  constructor(private readonly context: StateContext) {
    this.root.addChild(this.bg);
    this.root.addChild(this.panel);

    this.title.anchor.set(0.5, 0.5);
    this.summary.anchor.set(0.5, 0);
    this.status.anchor.set(0.5, 0.5);

    this.copyAllButton = new TextButton({
      label: 'Copy Stats JSON',
      width: 210,
      onClick: () => this.copyAllStats(),
    });
    this.copyLastRunButton = new TextButton({
      label: 'Copy Last Run JSON',
      width: 210,
      onClick: () => this.copyLastRun(),
    });
    this.resetButton = new TextButton({
      label: 'Reset Stats',
      width: 210,
      onClick: () => this.resetStats(),
    });
    this.backButton = new TextButton({
      label: 'Back',
      width: 210,
      onClick: () => this.goBack(),
    });

    this.root.addChild(this.title);
    this.root.addChild(this.summary);
    this.root.addChild(this.status);
    this.root.addChild(this.copyAllButton);
    this.root.addChild(this.copyLastRunButton);
    this.root.addChild(this.resetButton);
    this.root.addChild(this.backButton);
  }

  onEnter(payload?: unknown): void {
    this.returnState = this.resolveReturnState(payload);
    this.confirmReset = false;
    this.resetButton.setLabel('Reset Stats');
    this.status.text = '';
    this.context.stage.addChild(this.root);
    this.layout();
    this.refreshView();
  }

  onExit(): void {
    this.root.removeFromParent();
  }

  update(): void {
    if (this.root.parent === null) {
      return;
    }
    this.layout();
    this.refreshView();
  }

  private resolveReturnState(payload: unknown): GameStateId {
    if (payload && typeof payload === 'object' && 'returnState' in payload) {
      const value = (payload as StatsStatePayload).returnState;
      if (value === 'OVERWORLD' || value === 'BATTLE' || value === 'TITLE') {
        return value;
      }
    }
    return 'TITLE';
  }

  private refreshView(): void {
    const stats = this.context.getStatsSnapshot();
    this.summary.text = this.buildSummary(stats);
    const hasLastRun = stats.lastRun !== null;
    this.copyLastRunButton.setEnabled(hasLastRun);
  }

  private buildSummary(stats: StatsV1): string {
    const totals = stats.totals;
    const overallWinrate = formatWinrate(totals.battlesWon, totals.battlesPlayed);
    const normal = stats.byDifficulty.NORMAL;
    const hard = stats.byDifficulty.HARD;

    const objectiveEntries = topEntries(stats.objectives.played, 6);
    const objectiveLines: string[] = [];
    for (let i = 0; i < objectiveEntries.length; i += 1) {
      const entry = objectiveEntries[i];
      const wins = stats.objectives.wins[entry.key] ?? 0;
      objectiveLines.push(`${entry.key}: ${entry.value} played, ${wins} won (${formatWinrate(wins, entry.value)})`);
    }
    if (objectiveLines.length === 0) {
      objectiveLines.push('None');
    }

    const topPerks = topEntries(stats.perks.picks, 5);
    const perkLines = topPerks.length > 0 ? topPerks.map((entry) => `${entry.key}: ${entry.value}`) : ['None'];

    const topOrders = topEntries(stats.orders.issued, 5);
    const orderLines = topOrders.length > 0 ? topOrders.map((entry) => `${entry.key}: ${entry.value}`) : ['None'];

    const depthLines: string[] = [];
    for (let i = 0; i < stats.byDepthBucket.length; i += 1) {
      const bucket = stats.byDepthBucket[i];
      depthLines.push(
        `${bucket.depthMin}-${bucket.depthMax}: ${bucket.battlesPlayed}p ${bucket.battlesWon}w  dur ${bucket.avgBattleDurationSec.toFixed(1)}s  cas ${(bucket.avgCasualtiesPct * 100).toFixed(1)}%`,
      );
    }

    return [
      `Runs: started ${totals.runsStarted} | completed ${totals.runsCompleted} | abandoned ${totals.runsAbandoned}`,
      `Battles: played ${totals.battlesPlayed} | won ${totals.battlesWon} | lost ${totals.battlesLost} | winrate ${overallWinrate}`,
      `Play Time: ${formatDuration(totals.totalPlayTimeSec)}`,
      '',
      `Difficulty NORMAL: ${normal.battlesWon}/${normal.battlesPlayed} (${formatWinrate(normal.battlesWon, normal.battlesPlayed)})`,
      `Difficulty HARD:   ${hard.battlesWon}/${hard.battlesPlayed} (${formatWinrate(hard.battlesWon, hard.battlesPlayed)})`,
      '',
      'Objectives:',
      ...objectiveLines,
      '',
      `Perks offered: ${stats.perks.offered}`,
      'Top Perks Picked:',
      ...perkLines,
      '',
      'Top Orders Issued:',
      ...orderLines,
      '',
      'Depth Buckets:',
      ...depthLines,
    ].join('\n');
  }

  private async copyAllStats(): Promise<void> {
    const payload = this.context.getStatsSnapshot();
    const ok = await copyTextWithFallback(JSON.stringify(payload, null, 2));
    this.status.text = ok ? 'Copied full stats JSON.' : 'Copy failed.';
  }

  private async copyLastRun(): Promise<void> {
    const payload = this.context.getStatsSnapshot();
    if (payload.lastRun === null) {
      this.status.text = 'No last run data yet.';
      return;
    }
    const ok = await copyTextWithFallback(JSON.stringify(payload.lastRun, null, 2));
    this.status.text = ok ? 'Copied last run JSON.' : 'Copy failed.';
  }

  private resetStats(): void {
    if (!this.confirmReset) {
      this.confirmReset = true;
      this.resetButton.setLabel('Confirm Reset');
      this.status.text = 'Press Reset Stats again to confirm.';
      return;
    }

    this.context.resetStatsData();
    this.confirmReset = false;
    this.resetButton.setLabel('Reset Stats');
    this.status.text = 'Stats reset.';
    this.refreshView();
  }

  private goBack(): void {
    if (this.returnState === 'BATTLE') {
      const scenario = this.context.getPendingScenario();
      if (scenario !== null) {
        this.context.transitionTo('BATTLE', { scenario });
      } else if (this.context.getCampaignData() !== null) {
        this.context.transitionTo('OVERWORLD');
      } else {
        this.context.transitionTo('TITLE');
      }
      return;
    }

    if (this.returnState === 'OVERWORLD' && this.context.getCampaignData() === null) {
      this.context.transitionTo('TITLE');
      return;
    }

    this.context.transitionTo(this.returnState);
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
    this.summary.position.set(width * 0.5, panelY + 68);
    this.status.position.set(width * 0.5, panelY + panelHeight - 84);

    const buttonY = panelY + panelHeight - 56;
    const left = width * 0.5 - 430;
    this.copyAllButton.position.set(left, buttonY);
    this.copyLastRunButton.position.set(left + 220, buttonY);
    this.resetButton.position.set(left + 440, buttonY);
    this.backButton.position.set(left + 660, buttonY);
  }
}
