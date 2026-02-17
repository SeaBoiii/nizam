import { Container, Graphics, Text } from 'pixi.js';
import { contentManager } from '../../content/ContentManager';
import type { ContentLoadStatus, ContentPackManifestEntry } from '../../content/ContentTypes';
import {
  decodeChallenge,
  validatePayloadAgainstContent,
  type ChallengePayloadV1,
  type ChallengeCompatibilityResult,
} from '../../meta/ChallengeCode';
import { getDailySeed } from '../../meta/DailyChallenge';
import { getBestForDate } from '../../meta/DailyResults';
import { DifficultyMode } from '../../meta/Difficulty';
import { HowToPlayOverlay } from '../../ui/widgets/HowToPlayOverlay';
import { TextButton } from '../../ui/widgets/TextButton';
import type { IGameState } from './IGameState';
import type { StateContext } from './StateContext';

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
  private readonly description = new Text({
    text: 'Command squads in tactical battles • Upgrade your army • Conquer the campaign',
    style: {
      fill: 0xa5c2de,
      fontFamily: 'monospace',
      fontSize: 14,
      wordWrap: true,
      wordWrapWidth: 600,
      align: 'center',
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
  private readonly difficultyText = new Text({
    text: '',
    style: {
      fill: 0xf1d79d,
      fontFamily: 'monospace',
      fontSize: 16,
    },
  });
  private readonly packHeaderText = new Text({
    text: 'Content Pack',
    style: {
      fill: 0xf1d79d,
      fontFamily: 'monospace',
      fontSize: 16,
    },
  });
  private readonly packNameText = new Text({
    text: '',
    style: {
      fill: 0xe7f2ff,
      fontFamily: 'monospace',
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
  private readonly packDescText = new Text({
    text: '',
    style: {
      fill: 0xb8d3f2,
      fontFamily: 'monospace',
      fontSize: 13,
      wordWrap: true,
      wordWrapWidth: 520,
    },
  });
  private readonly packStatusText = new Text({
    text: '',
    style: {
      fill: 0xffc98d,
      fontFamily: 'monospace',
      fontSize: 12,
      wordWrap: true,
      wordWrapWidth: 620,
    },
  });
  private readonly dailyText = new Text({
    text: '',
    style: {
      fill: 0xbde0ff,
      fontFamily: 'monospace',
      fontSize: 12,
      wordWrap: true,
      wordWrapWidth: 620,
    },
  });

  private readonly newRunButton: TextButton;
  private readonly dailyRunButton: TextButton;
  private readonly continueDailyButton: TextButton;
  private readonly continueChallengeButton: TextButton;
  private readonly playChallengeButton: TextButton;
  private readonly continueButton: TextButton;
  private readonly clearButton: TextButton;
  private readonly statsButton: TextButton;
  private readonly dailyHistoryButton: TextButton;
  private readonly compareButton: TextButton;
  private readonly leaderboardButton: TextButton;
  private readonly normalButton: TextButton;
  private readonly hardButton: TextButton;
  private readonly packPrevButton: TextButton;
  private readonly packNextButton: TextButton;
  private readonly challengeModal = new Container();
  private readonly challengeModalBackdrop = new Graphics();
  private readonly challengeModalPanel = new Graphics();
  private readonly challengeModalTitle = new Text({
    text: 'Play Challenge Code',
    style: {
      fill: 0xf4e2b5,
      fontFamily: 'monospace',
      fontSize: 24,
      fontWeight: 'bold',
    },
  });
  private readonly challengeModalHint = new Text({
    text: 'Paste challenge code, validate, then start.',
    style: {
      fill: 0xc5dcf7,
      fontFamily: 'monospace',
      fontSize: 13,
    },
  });
  private readonly challengeModalStatus = new Text({
    text: '',
    style: {
      fill: 0x9dd1ff,
      fontFamily: 'monospace',
      fontSize: 13,
      wordWrap: true,
      wordWrapWidth: 640,
    },
  });
  private readonly challengeValidateButton: TextButton;
  private readonly challengeStartButton: TextButton;
  private readonly challengeCloseButton: TextButton;
  private readonly howToPlayButton: TextButton;
  private readonly howToPlayOverlay: HowToPlayOverlay;

  private selectedDifficulty = DifficultyMode.NORMAL;
  private availablePacks: ContentPackManifestEntry[] = [];
  private selectedPackIndex = 0;
  private loadingPack = false;
  private loadingDaily = false;
  private loadingChallenge = false;
  private mounted = false;
  private challengeModalOpen = false;
  private challengeInputArea: HTMLTextAreaElement | null = null;
  private challengePayload: ChallengePayloadV1 | null = null;
  private challengeCompatibility: ChallengeCompatibilityResult | null = null;
  private challengeVersionMismatchConfirmed = false;

  constructor(private readonly context: StateContext) {
    this.root.addChild(this.bg);

    this.title.anchor.set(0.5, 0.5);
    this.subtitle.anchor.set(0.5, 0.5);
    this.description.anchor.set(0.5, 0.5);
    this.status.anchor.set(0.5, 0.5);
    this.packHeaderText.anchor.set(0.5, 0.5);
    this.packNameText.anchor.set(0.5, 0.5);
    this.packDescText.anchor.set(0.5, 0.5);
    this.packStatusText.anchor.set(0.5, 0.5);

    this.newRunButton = new TextButton({
      label: 'New Run',
      onClick: () => {
        if (this.loadingPack || this.loadingDaily) {
          return;
        }
        this.context.startNewRun(this.selectedDifficulty);
        this.context.transitionTo('OVERWORLD');
      },
    });

    this.dailyRunButton = new TextButton({
      label: 'Daily Challenge',
      onClick: () => {
        if (this.loadingPack || this.loadingDaily) {
          return;
        }
        void this.startDailyChallenge();
      },
    });

    this.continueDailyButton = new TextButton({
      label: 'Continue Daily',
      onClick: () => {
        if (this.loadingPack || this.loadingDaily) {
          return;
        }
        void this.continueDailyChallenge();
      },
    });

    this.continueChallengeButton = new TextButton({
      label: 'Continue Challenge',
      onClick: () => {
        if (this.loadingPack || this.loadingDaily || this.loadingChallenge) {
          return;
        }
        void this.continueChallengeRun();
      },
    });

    this.playChallengeButton = new TextButton({
      label: 'Play Challenge Code',
      onClick: () => {
        if (this.loadingPack || this.loadingDaily || this.loadingChallenge) {
          return;
        }
        this.openChallengeModal();
      },
    });

    this.continueButton = new TextButton({
      label: 'Continue',
      onClick: () => {
        if (this.loadingPack || this.loadingDaily) {
          return;
        }
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

    this.statsButton = new TextButton({
      label: 'Stats',
      width: 170,
      onClick: () => {
        this.context.transitionTo('STATS', { returnState: 'TITLE' });
      },
    });
    this.dailyHistoryButton = new TextButton({
      label: 'Daily History',
      width: 170,
      onClick: () => {
        this.context.transitionTo('DAILY_HISTORY');
      },
    });
    this.compareButton = new TextButton({
      label: 'Compare Results',
      width: 170,
      onClick: () => {
        this.context.transitionTo('COMPARE', { returnState: 'TITLE' });
      },
    });
    this.leaderboardButton = new TextButton({
      label: 'Leaderboards',
      width: 170,
      onClick: () => {
        this.context.transitionTo('LEADERBOARD');
      },
    });

    this.normalButton = new TextButton({
      label: 'Normal',
      width: 130,
      onClick: () => {
        this.selectedDifficulty = DifficultyMode.NORMAL;
        this.refreshDifficultyButtons();
      },
    });
    this.hardButton = new TextButton({
      label: 'Hard',
      width: 130,
      onClick: () => {
        this.selectedDifficulty = DifficultyMode.HARD;
        this.refreshDifficultyButtons();
      },
    });

    this.packPrevButton = new TextButton({
      label: '<',
      width: 58,
      height: 36,
      onClick: () => this.changePackByStep(-1),
    });
    this.packNextButton = new TextButton({
      label: '>',
      width: 58,
      height: 36,
      onClick: () => this.changePackByStep(1),
    });

    this.challengeValidateButton = new TextButton({
      label: 'Validate',
      width: 180,
      onClick: () => {
        void this.validateChallengeInput();
      },
    });
    this.challengeStartButton = new TextButton({
      label: 'Start Challenge',
      width: 220,
      onClick: () => {
        void this.startChallengeFromModal();
      },
    });
    this.challengeCloseButton = new TextButton({
      label: 'Close',
      width: 160,
      onClick: () => {
        this.closeChallengeModal();
      },
    });

    this.howToPlayButton = new TextButton({
      label: 'How to Play',
      width: 170,
      onClick: () => {
        this.howToPlayOverlay.show();
      },
    });

    this.howToPlayOverlay = new HowToPlayOverlay();

    this.root.addChild(this.title);
    this.root.addChild(this.subtitle);
    this.root.addChild(this.description);
    this.root.addChild(this.status);
    this.root.addChild(this.difficultyText);
    this.root.addChild(this.packHeaderText);
    this.root.addChild(this.packNameText);
    this.root.addChild(this.packDescText);
    this.root.addChild(this.packStatusText);
    this.root.addChild(this.dailyText);
    this.root.addChild(this.newRunButton);
    this.root.addChild(this.dailyRunButton);
    this.root.addChild(this.continueDailyButton);
    this.root.addChild(this.continueChallengeButton);
    this.root.addChild(this.playChallengeButton);
    this.root.addChild(this.continueButton);
    this.root.addChild(this.clearButton);
    this.root.addChild(this.statsButton);
    this.root.addChild(this.dailyHistoryButton);
    this.root.addChild(this.compareButton);
    this.root.addChild(this.leaderboardButton);
    this.root.addChild(this.normalButton);
    this.root.addChild(this.hardButton);
    this.root.addChild(this.packPrevButton);
    this.root.addChild(this.packNextButton);
    this.root.addChild(this.howToPlayButton);

    this.challengeModal.visible = false;
    this.challengeModalTitle.anchor.set(0.5, 0.5);
    this.challengeModalHint.anchor.set(0.5, 0.5);
    this.challengeModalStatus.anchor.set(0, 0);
    this.challengeModal.addChild(this.challengeModalBackdrop);
    this.challengeModal.addChild(this.challengeModalPanel);
    this.challengeModal.addChild(this.challengeModalTitle);
    this.challengeModal.addChild(this.challengeModalHint);
    this.challengeModal.addChild(this.challengeModalStatus);
    this.challengeModal.addChild(this.challengeValidateButton);
    this.challengeModal.addChild(this.challengeStartButton);
    this.challengeModal.addChild(this.challengeCloseButton);
    this.root.addChild(this.challengeModal);
    this.root.addChild(this.howToPlayOverlay.root);
  }

  onEnter(): void {
    this.mounted = true;
    this.context.stage.addChild(this.root);
    this.closeChallengeModal();
    this.layout();
    this.refreshDifficultyButtons();
    this.status.text = '';

    this.availablePacks = this.context.getAvailableContentPacks();
    if (this.availablePacks.length === 0) {
      this.availablePacks = [{ id: 'base', name: 'Base', desc: 'Default balance and content.' }];
    }

    const preferredPack = this.context.getSettings().contentPackId;
    const foundIndex = this.availablePacks.findIndex((pack) => pack.id === preferredPack);
    this.selectedPackIndex = foundIndex >= 0 ? foundIndex : 0;

    this.refreshContinueState();
    this.refreshPackUI(this.context.getContentStatus());
    this.refreshDailyUI();
  }

  onExit(): void {
    this.mounted = false;
    this.closeChallengeModal();
    this.root.removeFromParent();
  }

  update(): void {
    if (this.root.parent === null) {
      return;
    }

    this.layout();
  }

  private refreshContinueState(): void {
    const locked = this.loadingPack || this.loadingDaily || this.loadingChallenge;
    this.continueButton.setEnabled(this.context.hasSaveData() && !locked);
    this.continueChallengeButton.setEnabled(this.context.hasChallengeSaveData() && !locked);
    this.newRunButton.setEnabled(!locked);
    this.dailyRunButton.setEnabled(!locked);
    this.playChallengeButton.setEnabled(!locked);
    this.dailyHistoryButton.setEnabled(!locked);
    this.statsButton.setEnabled(!locked);
    this.compareButton.setEnabled(!locked);
    this.leaderboardButton.setEnabled(!locked);
    this.continueDailyButton.setEnabled(false);
  }

  private layout(): void {
    const width = this.context.app.screen.width;
    const height = this.context.app.screen.height;

    this.bg.clear();
    this.bg.rect(0, 0, width, height);
    this.bg.fill({ color: 0x0f1720, alpha: 1 });

    this.title.position.set(width * 0.5, height * 0.15);
    this.subtitle.position.set(width * 0.5, height * 0.21);
    this.description.position.set(width * 0.5, height * 0.26);

    this.packHeaderText.position.set(width * 0.5, height * 0.315);
    this.packNameText.position.set(width * 0.5, height * 0.36);
    this.packDescText.position.set(width * 0.5, height * 0.402);
    this.packStatusText.position.set(width * 0.5, height * 0.445);
    this.dailyText.position.set(width * 0.5, height * 0.49);

    this.packPrevButton.position.set(width * 0.5 - 190, height * 0.342);
    this.packNextButton.position.set(width * 0.5 + 132, height * 0.342);

    this.newRunButton.position.set(width * 0.5 - 110, height * 0.54);
    this.dailyRunButton.position.set(width * 0.5 - 110, height * 0.615);
    this.continueDailyButton.position.set(width * 0.5 - 110, height * 0.69);
    this.playChallengeButton.position.set(width * 0.5 - 110, height * 0.765);
    this.continueChallengeButton.position.set(width * 0.5 - 110, height * 0.84);
    this.continueButton.position.set(width * 0.5 - 110, height * 0.895);
    this.clearButton.position.set(width * 0.5 - 110, height * 0.945);
    this.howToPlayButton.position.set(width * 0.5 + 200, height * 0.54);
    this.statsButton.position.set(width * 0.5 - 370, height * 0.995);
    this.dailyHistoryButton.position.set(width * 0.5 - 190, height * 0.995);
    this.compareButton.position.set(width * 0.5 - 10, height * 0.995);
    this.leaderboardButton.position.set(width * 0.5 + 170, height * 0.995);

    this.difficultyText.position.set(width * 0.5 - 130, height * 0.93);
    this.normalButton.position.set(width * 0.5 - 134, height * 0.96);
    this.hardButton.position.set(width * 0.5 + 4, height * 0.96);
    this.status.position.set(width * 0.5, height * 0.99);

    this.layoutChallengeModal(width, height);
    this.howToPlayOverlay.layout(width, height);
  }

  private refreshDifficultyButtons(): void {
    this.difficultyText.text = `Difficulty: ${this.selectedDifficulty}`;
    if (this.selectedDifficulty === DifficultyMode.NORMAL) {
      this.normalButton.setLabel('[Normal]');
      this.hardButton.setLabel('Hard');
    } else {
      this.normalButton.setLabel('Normal');
      this.hardButton.setLabel('[Hard]');
    }
  }

  private getSelectedPack(): ContentPackManifestEntry {
    if (this.availablePacks.length === 0) {
      return { id: 'base', name: 'Base', desc: 'Default balance and content.' };
    }
    return this.availablePacks[this.selectedPackIndex];
  }

  private refreshPackUI(status: ContentLoadStatus): void {
    const selectedPack = this.getSelectedPack();
    this.packNameText.text = `${selectedPack.name} (${selectedPack.id})`;
    this.packDescText.text = selectedPack.desc;

    if (this.loadingPack) {
      this.packStatusText.text = 'Loading pack...';
    } else if (status.fallbackUsed) {
      const reason = status.errors.length > 0 ? status.errors[0] : 'Validation failed.';
      this.packStatusText.text = `Fallback active: ${status.selectedPackId} -> ${status.loadedPackId}\n${reason}`;
    } else {
      this.packStatusText.text = `Status: OK (${status.loadedPackName})`;
    }

    const canShift = this.availablePacks.length > 1 && !this.loadingPack;
    this.packPrevButton.setEnabled(canShift);
    this.packNextButton.setEnabled(canShift);
    this.refreshDailyUI();
  }

  private changePackByStep(step: number): void {
    if (this.loadingPack || this.availablePacks.length <= 1) {
      return;
    }
    const nextIndex = (this.selectedPackIndex + step + this.availablePacks.length) % this.availablePacks.length;
    this.applySelectedPack(nextIndex);
  }

  private refreshDailyUI(): void {
    const today = getDailySeed();
    const selectedPack = this.getSelectedPack();
    const dailySave = this.context.getDailySaveInfo();
    const bestToday = getBestForDate(today.dateKey);
    const locked = this.loadingPack || this.loadingDaily || this.loadingChallenge;

    if (locked) {
      this.dailyText.text = 'Daily: preparing...';
      this.continueDailyButton.setEnabled(false);
      this.continueDailyButton.setLabel('Continue Daily');
      this.continueChallengeButton.setEnabled(false);
      this.continueChallengeButton.setLabel('Continue Challenge');
      return;
    }

    const lines: string[] = [];
    lines.push(`Daily Seed (${today.dateKey} SG): ${today.seed}`);
    lines.push(`Best Local Daily: ${bestToday ? bestToday.score : '-'}`);
    if (selectedPack.id !== 'base') {
      lines.push('Daily Challenge uses Base pack for fairness.');
    }

    if (dailySave === null) {
      this.continueDailyButton.setEnabled(false);
      this.continueDailyButton.setLabel('Continue Daily');
      lines.push("No saved daily run.");
    } else if (dailySave.isToday && dailySave.inProgress) {
      this.continueDailyButton.setEnabled(true);
      this.continueDailyButton.setLabel('Continue Daily (Today)');
      lines.push('Saved daily run is available for today.');
    } else if (dailySave.isToday) {
      this.continueDailyButton.setEnabled(false);
      this.continueDailyButton.setLabel('Daily Completed (Today)');
      lines.push('Today\'s daily run is already finished. Start a new daily on the next SG day.');
    } else {
      this.continueDailyButton.setEnabled(false);
      this.continueDailyButton.setLabel(`Saved Daily: ${dailySave.dateKey ?? 'Unknown'}`);
      lines.push(`Saved daily run is from ${dailySave.dateKey ?? 'Unknown'} (SG).`);
    }

    if (this.context.hasChallengeSaveData()) {
      this.continueChallengeButton.setEnabled(true);
      this.continueChallengeButton.setLabel('Continue Challenge');
    } else {
      this.continueChallengeButton.setEnabled(false);
      this.continueChallengeButton.setLabel('Continue Challenge');
    }

    this.dailyText.text = lines.join('\n');
  }

  private async startDailyChallenge(): Promise<void> {
    this.loadingDaily = true;
    this.status.text = '';
    this.refreshContinueState();
    this.refreshDailyUI();

    try {
      const started = await this.context.startDailyRun(this.selectedDifficulty);
      if (!this.mounted) {
        return;
      }
      if (!started) {
        this.status.text = 'Failed to start daily challenge.';
        return;
      }
      this.context.transitionTo('OVERWORLD');
    } catch (error) {
      if (!this.mounted) {
        return;
      }
      this.status.text = `Daily start failed: ${String(error)}`;
    } finally {
      this.loadingDaily = false;
      if (this.mounted) {
        this.refreshContinueState();
        this.refreshDailyUI();
      }
    }
  }

  private async continueDailyChallenge(): Promise<void> {
    this.loadingDaily = true;
    this.status.text = '';
    this.refreshContinueState();
    this.refreshDailyUI();

    try {
      const loaded = await this.context.loadDailySaveData();
      if (!this.mounted) {
        return;
      }
      if (!loaded) {
        const info = this.context.getDailySaveInfo();
        if (info !== null && !info.isToday) {
          this.status.text = `Saved daily is from ${info.dateKey ?? 'Unknown'} (SG). Start today's daily instead.`;
        } else if (info !== null && !info.inProgress) {
          this.status.text = "Today's daily run is already complete.";
        } else {
          this.status.text = 'No valid daily save for today.';
        }
        return;
      }
      this.context.transitionTo('OVERWORLD');
    } catch (error) {
      if (!this.mounted) {
        return;
      }
      this.status.text = `Continue daily failed: ${String(error)}`;
    } finally {
      this.loadingDaily = false;
      if (this.mounted) {
        this.refreshContinueState();
        this.refreshDailyUI();
      }
    }
  }

  private async continueChallengeRun(): Promise<void> {
    this.loadingChallenge = true;
    this.status.text = '';
    this.refreshContinueState();
    this.refreshDailyUI();

    try {
      const loaded = await this.context.loadChallengeSaveData();
      if (!this.mounted) {
        return;
      }
      if (!loaded) {
        this.status.text = 'No valid challenge save found.';
        return;
      }
      this.context.transitionTo('OVERWORLD');
    } catch (error) {
      if (!this.mounted) {
        return;
      }
      this.status.text = `Continue challenge failed: ${String(error)}`;
    } finally {
      this.loadingChallenge = false;
      if (this.mounted) {
        this.refreshContinueState();
        this.refreshDailyUI();
      }
    }
  }

  private openChallengeModal(): void {
    this.challengeModalOpen = true;
    this.challengeModal.visible = true;
    this.challengePayload = null;
    this.challengeCompatibility = null;
    this.challengeVersionMismatchConfirmed = false;
    this.challengeModalStatus.text = '';
    this.challengeStartButton.setLabel('Start Challenge');
    this.challengeStartButton.setEnabled(false);
    this.ensureChallengeInputArea();
    this.layout();
  }

  private closeChallengeModal(): void {
    this.challengeModalOpen = false;
    this.challengeModal.visible = false;
    this.challengePayload = null;
    this.challengeCompatibility = null;
    this.challengeVersionMismatchConfirmed = false;
    this.destroyChallengeInputArea();
  }

  private ensureChallengeInputArea(): void {
    if (typeof document === 'undefined') {
      return;
    }
    if (this.challengeInputArea === null) {
      const area = document.createElement('textarea');
      area.placeholder = 'Paste challenge code here...';
      area.style.position = 'fixed';
      area.style.zIndex = '30';
      area.style.fontFamily = 'monospace';
      area.style.fontSize = '12px';
      area.style.background = '#0f1720';
      area.style.color = '#d4e7ff';
      area.style.border = '1px solid #6e9bc9';
      area.style.borderRadius = '8px';
      area.style.padding = '8px';
      area.style.resize = 'none';
      area.addEventListener('input', () => {
        this.challengePayload = null;
        this.challengeCompatibility = null;
        this.challengeVersionMismatchConfirmed = false;
        this.challengeStartButton.setLabel('Start Challenge');
        this.challengeStartButton.setEnabled(false);
      });
      document.body.appendChild(area);
      this.challengeInputArea = area;
    }
    this.layoutChallengeInputArea();
  }

  private destroyChallengeInputArea(): void {
    if (this.challengeInputArea === null) {
      return;
    }
    if (typeof document !== 'undefined') {
      document.body.removeChild(this.challengeInputArea);
    }
    this.challengeInputArea = null;
  }

  private layoutChallengeInputArea(): void {
    if (!this.challengeModalOpen || this.challengeInputArea === null) {
      return;
    }
    const width = this.context.app.screen.width;
    const height = this.context.app.screen.height;
    const modalWidth = Math.min(760, width - 60);
    const modalHeight = Math.min(450, height - 80);
    const modalX = width * 0.5 - modalWidth * 0.5;
    const modalY = height * 0.5 - modalHeight * 0.5;
    const canvasRect = this.context.app.canvas.getBoundingClientRect();

    this.challengeInputArea.style.left = `${Math.round(canvasRect.left + modalX + 24)}px`;
    this.challengeInputArea.style.top = `${Math.round(canvasRect.top + modalY + 88)}px`;
    this.challengeInputArea.style.width = `${Math.round(modalWidth - 48)}px`;
    this.challengeInputArea.style.height = `${Math.round(modalHeight - 218)}px`;
  }

  private async validateChallengeInput(): Promise<void> {
    const input = this.challengeInputArea ? this.challengeInputArea.value.trim() : '';
    this.challengeVersionMismatchConfirmed = false;
    if (input.length === 0) {
      this.challengePayload = null;
      this.challengeCompatibility = null;
      this.challengeModalStatus.text = 'Enter a challenge code first.';
      this.challengeStartButton.setEnabled(false);
      this.challengeStartButton.setLabel('Start Challenge');
      return;
    }

    const decoded = decodeChallenge(input);
    if (!decoded.ok || !decoded.payload) {
      this.challengePayload = null;
      this.challengeCompatibility = null;
      this.challengeModalStatus.text = decoded.error ?? 'Invalid challenge code.';
      this.challengeStartButton.setEnabled(false);
      this.challengeStartButton.setLabel('Start Challenge');
      return;
    }

    this.challengePayload = decoded.payload;
    this.challengeCompatibility = validatePayloadAgainstContent(
      decoded.payload,
      contentManager,
      this.availablePacks,
    );

    const compatibility = this.challengeCompatibility;
    this.challengeModalStatus.text = compatibility.message;
    if (compatibility.status === 'OK') {
      this.challengeStartButton.setLabel('Start Challenge');
      this.challengeStartButton.setEnabled(true);
      return;
    }
    if (compatibility.status === 'PACK_MISMATCH') {
      this.challengeStartButton.setLabel(`Switch to ${decoded.payload.pack.id} & Start`);
      this.challengeStartButton.setEnabled(true);
      return;
    }
    if (compatibility.status === 'VERSION_MISMATCH') {
      this.challengeStartButton.setLabel('Start With Version Warning');
      this.challengeStartButton.setEnabled(true);
      return;
    }
    this.challengeStartButton.setLabel('Start Challenge');
    this.challengeStartButton.setEnabled(false);
  }

  private async startChallengeFromModal(): Promise<void> {
    if (this.challengePayload === null || this.challengeCompatibility === null) {
      await this.validateChallengeInput();
      if (this.challengePayload === null || this.challengeCompatibility === null) {
        return;
      }
    }

    if (
      this.challengeCompatibility.status === 'PACK_NOT_FOUND' ||
      this.challengeCompatibility.status === 'INVALID_SIGNATURE'
    ) {
      this.challengeModalStatus.text = this.challengeCompatibility.message;
      return;
    }

    if (
      this.challengeCompatibility.status === 'VERSION_MISMATCH' &&
      !this.challengeVersionMismatchConfirmed
    ) {
      this.challengeVersionMismatchConfirmed = true;
      this.challengeModalStatus.text = `${this.challengeCompatibility.message}\nPress Start again to continue anyway.`;
      return;
    }

    const rawCode = this.challengeInputArea ? this.challengeInputArea.value.trim() : '';
    this.loadingChallenge = true;
    this.refreshContinueState();
    this.refreshDailyUI();
    this.challengeStartButton.setEnabled(false);

    try {
      const started = await this.context.startChallengeRun(this.challengePayload, rawCode);
      if (!this.mounted) {
        return;
      }
      if (!started) {
        this.challengeModalStatus.text = 'Failed to start challenge run.';
        this.challengeStartButton.setEnabled(true);
        return;
      }
      this.closeChallengeModal();
      this.context.transitionTo('OVERWORLD');
    } catch (error) {
      if (!this.mounted) {
        return;
      }
      this.challengeModalStatus.text = `Challenge start failed: ${String(error)}`;
      this.challengeStartButton.setEnabled(true);
    } finally {
      this.loadingChallenge = false;
      if (this.mounted) {
        this.refreshContinueState();
        this.refreshDailyUI();
      }
    }
  }

  private layoutChallengeModal(width: number, height: number): void {
    if (!this.challengeModalOpen) {
      return;
    }
    const modalWidth = Math.min(760, width - 60);
    const modalHeight = Math.min(450, height - 80);
    const modalX = width * 0.5 - modalWidth * 0.5;
    const modalY = height * 0.5 - modalHeight * 0.5;

    this.challengeModalBackdrop.clear();
    this.challengeModalBackdrop.rect(0, 0, width, height);
    this.challengeModalBackdrop.fill({ color: 0x000000, alpha: 0.7 });

    this.challengeModalPanel.clear();
    this.challengeModalPanel.roundRect(modalX, modalY, modalWidth, modalHeight, 12);
    this.challengeModalPanel.fill({ color: 0x111c29, alpha: 0.98 });
    this.challengeModalPanel.stroke({ color: 0x6e9bc9, alpha: 0.92, width: 1.6 });

    this.challengeModalTitle.position.set(width * 0.5, modalY + 34);
    this.challengeModalHint.position.set(width * 0.5, modalY + 58);
    this.challengeModalStatus.style.wordWrapWidth = modalWidth - 44;
    this.challengeModalStatus.position.set(modalX + 22, modalY + modalHeight - 130);

    this.challengeValidateButton.position.set(width * 0.5 - 292, modalY + modalHeight - 62);
    this.challengeStartButton.position.set(width * 0.5 - 96, modalY + modalHeight - 62);
    this.challengeCloseButton.position.set(width * 0.5 + 144, modalY + modalHeight - 62);

    this.layoutChallengeInputArea();
  }

  private async applySelectedPack(nextIndex: number): Promise<void> {
    this.selectedPackIndex = nextIndex;
    const selected = this.getSelectedPack();
    this.loadingPack = true;
    this.status.text = '';
    this.refreshContinueState();
    this.refreshPackUI(this.context.getContentStatus());

    try {
      const status = await this.context.setContentPack(selected.id);
      if (!this.mounted) {
        return;
      }
      if (status.fallbackUsed) {
        this.status.text = `Pack warning: using ${status.loadedPackId}.`;
      } else {
        this.status.text = `Loaded ${selected.name}.`;
      }
      this.refreshPackUI(status);
    } catch (error) {
      if (!this.mounted) {
        return;
      }
      this.status.text = `Pack load failed: ${String(error)}`;
      this.refreshPackUI(this.context.getContentStatus());
    } finally {
      this.loadingPack = false;
      if (this.mounted) {
        this.refreshContinueState();
        this.refreshPackUI(this.context.getContentStatus());
      }
    }
  }
}
