import { Container, Graphics, Text } from 'pixi.js';
import { getSingaporeDateKey } from '../../meta/DailyChallenge';
import { DifficultyMode } from '../../meta/Difficulty';
import {
  getAllKeys,
  getEntries,
  removeEntry,
  resetAll,
  type LocalLeaderboardEntry,
} from '../../meta/LocalLeaderboard';
import { encodeResult, type ResultPayloadV1 } from '../../meta/ResultCode';
import { MENU_BODY_FONT, MENU_TITLE_FONT, drawMenuBackdrop, drawMenuCard } from '../../ui/theme/MenuTheme';
import { TextButton } from '../../ui/widgets/TextButton';
import { copyTextWithFallback } from '../../utils/clipboard';
import type { IGameState } from './IGameState';
import type { StateContext } from './StateContext';

const MAX_VISIBLE_ENTRIES = 10;

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

function stripSig(payload: ResultPayloadV1): Omit<ResultPayloadV1, 'sig'> {
  const {
    v,
    kind,
    mode,
    dateKey,
    seed,
    difficulty,
    pack,
    score,
    nodesCleared,
    wins,
    timeSec,
    casualtiesPct,
    perks,
    bestSquadArchetypeId,
  } = payload;
  return {
    v,
    kind,
    mode,
    dateKey,
    seed,
    difficulty,
    pack: {
      id: pack.id,
      version: pack.version,
      name: pack.name,
    },
    score,
    nodesCleared,
    wins,
    timeSec,
    casualtiesPct,
    perks: [...perks],
    bestSquadArchetypeId,
  };
}

export class LeaderboardState implements IGameState {
  private readonly root = new Container();
  private readonly bg = new Graphics();
  private readonly panel = new Graphics();

  private readonly title = new Text({
    text: 'Leaderboards (Local)',
    style: {
      fill: 0xf3e3b8,
      fontFamily: MENU_TITLE_FONT,
      fontSize: 36,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
  });
  private readonly keyLabel = new Text({
    text: '',
    style: {
      fill: 0xc7def8,
      fontFamily: MENU_BODY_FONT,
      fontSize: 14,
      wordWrap: true,
      wordWrapWidth: 1080,
    },
  });
  private readonly detailText = new Text({
    text: '',
    style: {
      fill: 0xe1edff,
      fontFamily: MENU_BODY_FONT,
      fontSize: 14,
      lineHeight: 21,
      wordWrap: true,
      wordWrapWidth: 620,
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
  private readonly prevKeyButton: TextButton;
  private readonly nextKeyButton: TextButton;
  private readonly todayDailyButton: TextButton;
  private readonly challengeKeyButton: TextButton;
  private readonly normalButton: TextButton;
  private readonly hardButton: TextButton;
  private readonly copyCodeButton: TextButton;
  private readonly removeButton: TextButton;
  private readonly resetButton: TextButton;
  private readonly backButton: TextButton;

  private selectedDifficulty: DifficultyMode = DifficultyMode.NORMAL;
  private availableKeys: string[] = [];
  private selectedKey = '';
  private entries: LocalLeaderboardEntry[] = [];
  private selectedIndex = -1;
  private confirmReset = false;
  private confirmRemove = false;

  constructor(private readonly context: StateContext) {
    this.root.addChild(this.bg);
    this.root.addChild(this.panel);

    this.title.anchor.set(0.5, 0.5);
    this.keyLabel.anchor.set(0.5, 0.5);
    this.status.anchor.set(0.5, 0.5);
    this.detailText.anchor.set(0, 0);

    this.prevKeyButton = new TextButton({
      label: '<',
      width: 58,
      height: 36,
      variant: 'secondary',
      onClick: () => this.cycleKey(-1),
    });
    this.nextKeyButton = new TextButton({
      label: '>',
      width: 58,
      height: 36,
      variant: 'secondary',
      onClick: () => this.cycleKey(1),
    });
    this.todayDailyButton = new TextButton({
      label: 'Today Daily',
      width: 170,
      variant: 'accent',
      onClick: () => this.selectTodayDailyKey(),
    });
    this.challengeKeyButton = new TextButton({
      label: 'Challenge Seed...',
      width: 190,
      variant: 'secondary',
      onClick: () => this.selectChallengeSeedKey(),
    });
    this.normalButton = new TextButton({
      label: 'Normal',
      width: 120,
      variant: 'secondary',
      onClick: () => this.setDifficulty(DifficultyMode.NORMAL),
    });
    this.hardButton = new TextButton({
      label: 'Hard',
      width: 120,
      variant: 'secondary',
      onClick: () => this.setDifficulty(DifficultyMode.HARD),
    });
    this.copyCodeButton = new TextButton({
      label: 'Copy Result Code',
      width: 200,
      variant: 'secondary',
      onClick: () => {
        void this.copySelectedCode();
      },
    });
    this.removeButton = new TextButton({
      label: 'Remove',
      width: 160,
      variant: 'danger',
      onClick: () => this.removeSelected(),
    });
    this.resetButton = new TextButton({
      label: 'Reset All',
      width: 170,
      variant: 'danger',
      onClick: () => this.resetLeaderboards(),
    });
    this.backButton = new TextButton({
      label: 'Back',
      width: 140,
      variant: 'primary',
      onClick: () => this.context.transitionTo('TITLE'),
    });

    this.root.addChild(this.title);
    this.root.addChild(this.keyLabel);
    this.root.addChild(this.detailText);
    this.root.addChild(this.status);
    this.root.addChild(this.prevKeyButton);
    this.root.addChild(this.nextKeyButton);
    this.root.addChild(this.todayDailyButton);
    this.root.addChild(this.challengeKeyButton);
    this.root.addChild(this.normalButton);
    this.root.addChild(this.hardButton);
    this.root.addChild(this.copyCodeButton);
    this.root.addChild(this.removeButton);
    this.root.addChild(this.resetButton);
    this.root.addChild(this.backButton);

    for (let i = 0; i < MAX_VISIBLE_ENTRIES; i += 1) {
      const index = i;
      const button = new TextButton({
        label: '-',
        width: 390,
        height: 36,
        variant: 'secondary',
        onClick: () => this.selectEntry(index),
      });
      this.entryButtons.push(button);
      this.root.addChild(button);
    }
  }

  onEnter(): void {
    this.context.stage.addChild(this.root);
    this.status.text = '';
    this.confirmReset = false;
    this.confirmRemove = false;
    this.resetButton.setLabel('Reset All');
    this.removeButton.setLabel('Remove');
    this.reloadKeys(this.buildTodayDailyKey());
    this.refreshDifficultyButtons();
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

  private buildTodayDailyKey(): string {
    const content = this.context.getContentStatus();
    const dateKey = getSingaporeDateKey();
    return `daily|${dateKey}|${content.loadedPackId}|${content.contentVersion}|${this.selectedDifficulty}`;
  }

  private buildChallengeKey(seed: number): string {
    const content = this.context.getContentStatus();
    return `challenge|${seed >>> 0}|${content.loadedPackId}|${content.contentVersion}|${this.selectedDifficulty}`;
  }

  private setDifficulty(value: DifficultyMode): void {
    this.selectedDifficulty = value;
    this.refreshDifficultyButtons();
  }

  private refreshDifficultyButtons(): void {
    if (this.selectedDifficulty === DifficultyMode.NORMAL) {
      this.normalButton.setLabel('Normal');
      this.normalButton.setVariant('accent');
      this.hardButton.setVariant('secondary');
      this.hardButton.setLabel('Hard');
    } else {
      this.normalButton.setLabel('Normal');
      this.normalButton.setVariant('secondary');
      this.hardButton.setVariant('accent');
      this.hardButton.setLabel('Hard');
    }
  }

  private reloadKeys(preferredKey: string): void {
    const keys = getAllKeys();
    keys.sort();
    this.availableKeys = keys;

    if (preferredKey.length > 0) {
      this.selectedKey = preferredKey;
    } else if (this.availableKeys.length > 0) {
      this.selectedKey = this.availableKeys[0];
    } else {
      this.selectedKey = this.buildTodayDailyKey();
    }

    this.reloadEntries();
  }

  private reloadEntries(): void {
    this.entries = getEntries(this.selectedKey);
    if (this.entries.length === 0) {
      this.selectedIndex = -1;
    } else if (this.selectedIndex < 0 || this.selectedIndex >= this.entries.length) {
      this.selectedIndex = 0;
    }
    this.refreshListButtons();
    this.refreshDetails();
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
      const name = entry.name ? entry.name : entry.verified ? 'Anonymous' : 'Anonymous*';
      button.setLabel(`${i + 1}. ${name}  ${entry.result.score}  ${formatDuration(entry.result.timeSec)}`);
      button.setEnabled(true);
    }
  }

  private refreshDetails(): void {
    const selected = this.getSelectedEntry();
    const keyCount = this.availableKeys.length;
    this.keyLabel.text = `Key: ${this.selectedKey}   |   Stored Keys: ${keyCount}`;

    this.prevKeyButton.setEnabled(keyCount > 1);
    this.nextKeyButton.setEnabled(keyCount > 1);
    this.copyCodeButton.setEnabled(selected !== null);
    this.removeButton.setEnabled(selected !== null);

    if (selected === null) {
      this.detailText.text = 'No entries for this key.\nUse Today Daily or Challenge Seed to select a bucket.';
      return;
    }

    const payload = selected.result;
    this.detailText.text = [
      `Score: ${payload.score}`,
      `Mode: ${payload.mode}${payload.dateKey ? ` (${payload.dateKey})` : ''}`,
      `Difficulty: ${payload.difficulty}`,
      `Nodes: ${payload.nodesCleared} | Wins: ${payload.wins}`,
      `Time: ${formatDuration(payload.timeSec)} | Casualties: ${formatPercent(payload.casualtiesPct)}`,
      `Seed: ${payload.seed}`,
      `Pack: ${payload.pack.id} v${payload.pack.version}`,
      `Perks: ${payload.perks.length > 0 ? payload.perks.join(', ') : 'None'}`,
      `Signature: ${selected.verified ? 'Verified' : 'Unverified'}`,
      `Recorded: ${new Date(selected.ts).toLocaleString()}`,
      '',
      selected.name ? `Name: ${selected.name}` : 'Name: -',
    ].join('\n');
  }

  private getSelectedEntry(): LocalLeaderboardEntry | null {
    if (this.selectedIndex < 0 || this.selectedIndex >= this.entries.length) {
      return null;
    }
    return this.entries[this.selectedIndex];
  }

  private selectEntry(index: number): void {
    if (index < 0 || index >= this.entries.length) {
      return;
    }
    this.selectedIndex = index;
    this.confirmRemove = false;
    this.removeButton.setLabel('Remove');
    this.refreshDetails();
  }

  private cycleKey(step: number): void {
    if (this.availableKeys.length <= 1) {
      return;
    }
    const currentIndex = this.availableKeys.indexOf(this.selectedKey);
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (baseIndex + step + this.availableKeys.length) % this.availableKeys.length;
    this.selectedKey = this.availableKeys[nextIndex];
    this.selectedIndex = -1;
    this.confirmRemove = false;
    this.removeButton.setLabel('Remove');
    this.reloadEntries();
  }

  private selectTodayDailyKey(): void {
    this.confirmRemove = false;
    this.removeButton.setLabel('Remove');
    this.reloadKeys(this.buildTodayDailyKey());
  }

  private selectChallengeSeedKey(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const raw = window.prompt('Enter challenge seed:', '');
    if (raw === null) {
      return;
    }
    const seed = Math.max(0, Math.floor(Number(raw.trim())));
    if (!Number.isFinite(seed)) {
      this.status.text = 'Invalid seed.';
      return;
    }
    this.confirmRemove = false;
    this.removeButton.setLabel('Remove');
    this.reloadKeys(this.buildChallengeKey(seed));
  }

  private async copySelectedCode(): Promise<void> {
    const selected = this.getSelectedEntry();
    if (selected === null) {
      this.status.text = 'No entry selected.';
      return;
    }
    const code = encodeResult(stripSig(selected.result));
    const ok = await copyTextWithFallback(code);
    this.status.text = ok ? 'Copied result code.' : 'Copy failed.';
  }

  private removeSelected(): void {
    const selected = this.getSelectedEntry();
    if (selected === null) {
      this.status.text = 'No entry selected.';
      return;
    }
    if (!this.confirmRemove) {
      this.confirmRemove = true;
      this.removeButton.setLabel('Confirm Remove');
      this.status.text = 'Press Remove again to confirm.';
      return;
    }

    removeEntry(this.selectedKey, this.selectedIndex);
    this.confirmRemove = false;
    this.removeButton.setLabel('Remove');
    this.status.text = 'Entry removed.';
    this.reloadKeys(this.selectedKey);
  }

  private resetLeaderboards(): void {
    if (!this.confirmReset) {
      this.confirmReset = true;
      this.resetButton.setLabel('Confirm Reset');
      this.status.text = 'Press Reset All again to confirm.';
      return;
    }
    resetAll();
    this.confirmReset = false;
    this.resetButton.setLabel('Reset All');
    this.status.text = 'All local leaderboards reset.';
    this.reloadKeys(this.buildTodayDailyKey());
  }

  private layout(): void {
    const width = this.context.app.screen.width;
    const height = this.context.app.screen.height;
    const panelWidth = Math.min(1140, width - 40);
    const panelHeight = Math.min(700, height - 40);
    const panelX = width * 0.5 - panelWidth * 0.5;
    const panelY = height * 0.5 - panelHeight * 0.5;

    drawMenuBackdrop(this.bg, width, height);
    drawMenuCard(this.panel, panelX, panelY, panelWidth, panelHeight);

    this.title.position.set(width * 0.5, panelY + 34);
    this.keyLabel.style.wordWrapWidth = panelWidth - 56;
    this.keyLabel.position.set(width * 0.5, panelY + 72);
    this.status.position.set(width * 0.5, panelY + panelHeight - 84);

    const controlsY = panelY + 98;
    this.todayDailyButton.position.set(panelX + 22, controlsY);
    this.challengeKeyButton.position.set(panelX + 202, controlsY);
    this.normalButton.position.set(panelX + 402, controlsY);
    this.hardButton.position.set(panelX + 530, controlsY);
    this.prevKeyButton.position.set(panelX + panelWidth - 156, controlsY + 4);
    this.nextKeyButton.position.set(panelX + panelWidth - 90, controlsY + 4);

    const listTop = panelY + 156;
    for (let i = 0; i < this.entryButtons.length; i += 1) {
      this.entryButtons[i].position.set(panelX + 22, listTop + i * 44);
    }

    this.detailText.style.wordWrapWidth = panelWidth - 470;
    this.detailText.position.set(panelX + 430, listTop);

    const buttonY = panelY + panelHeight - 56;
    const actionWidth = 200 + 160 + 170 + 140 + 24;
    const actionStartX = Math.max(panelX + 20, panelX + panelWidth - actionWidth - 20);
    this.copyCodeButton.position.set(actionStartX, buttonY);
    this.removeButton.position.set(actionStartX + 206, buttonY);
    this.resetButton.position.set(actionStartX + 372, buttonY);
    this.backButton.position.set(actionStartX + 548, buttonY);
  }
}
