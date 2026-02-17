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
  private readonly backdrop = new Graphics();
  private readonly heroPanel = new Graphics();
  private readonly actionsPanel = new Graphics();
  private readonly metaPanel = new Graphics();
  private readonly motif = new Graphics();
  private readonly title = new Text({
    text: 'NIZAM',
    style: {
      fill: 0xf7e4b9,
      fontFamily: 'Georgia, Times New Roman, serif',
      fontSize: 84,
      fontWeight: '700',
      letterSpacing: 2.8,
    },
  });
  private readonly subtitle = new Text({
    text: 'TACTICAL CAMPAIGN SANDBOX',
    style: {
      fill: 0xb6d3ea,
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
      fontSize: 19,
      fontWeight: '600',
      letterSpacing: 1.4,
    },
  });
  private readonly description = new Text({
    text: 'Command squads in tactical battles | Build your warband | Survive the campaign map',
    style: {
      fill: 0xd6e6f5,
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
      fontSize: 14,
      wordWrap: true,
      wordWrapWidth: 900,
      align: 'center',
    },
  });
  private readonly actionsHeader = new Text({
    text: 'Campaign',
    style: {
      fill: 0xf4e2b5,
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
  });
  private readonly metaHeader = new Text({
    text: 'Loadout and Tools',
    style: {
      fill: 0xe3f2ff,
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
  });
  private readonly status = new Text({
    text: '',
    style: {
      fill: 0x9fc6ea,
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
      fontSize: 13,
    },
  });
  private readonly difficultyText = new Text({
    text: '',
    style: {
      fill: 0xf0dba9,
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
      fontSize: 14,
      fontWeight: '600',
    },
  });
  private readonly packHeaderText = new Text({
    text: 'Content Pack',
    style: {
      fill: 0xf0dba9,
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
      fontSize: 14,
      fontWeight: '600',
    },
  });
  private readonly packNameText = new Text({
    text: '',
    style: {
      fill: 0xe7f2ff,
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
      fontSize: 16,
      fontWeight: '700',
    },
  });
  private readonly packDescText = new Text({
    text: '',
    style: {
      fill: 0xb8d3f2,
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
      fontSize: 13,
      wordWrap: true,
      wordWrapWidth: 520,
    },
  });
  private readonly packStatusText = new Text({
    text: '',
    style: {
      fill: 0xffc98d,
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
      fontSize: 12,
      wordWrap: true,
      wordWrapWidth: 620,
    },
  });
  private readonly dailyText = new Text({
    text: '',
    style: {
      fill: 0xbde0ff,
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
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
      fontFamily: 'Georgia, Times New Roman, serif',
      fontSize: 24,
      fontWeight: '700',
    },
  });
  private readonly challengeModalHint = new Text({
    text: 'Paste challenge code, validate, then start.',
    style: {
      fill: 0xc5dcf7,
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
      fontSize: 13,
    },
  });
  private readonly challengeModalStatus = new Text({
    text: '',
    style: {
      fill: 0x9dd1ff,
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
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
  private lastLayoutWidth = -1;
  private lastLayoutHeight = -1;

  constructor(private readonly context: StateContext) {
    this.root.addChild(this.bg);
    this.root.addChild(this.backdrop);
    this.root.addChild(this.heroPanel);
    this.root.addChild(this.actionsPanel);
    this.root.addChild(this.metaPanel);
    this.root.addChild(this.motif);

    this.title.anchor.set(0.5, 0.5);
    this.subtitle.anchor.set(0.5, 0.5);
    this.description.anchor.set(0.5, 0.5);
    this.actionsHeader.anchor.set(0, 0.5);
    this.metaHeader.anchor.set(0, 0.5);
    this.status.anchor.set(0.5, 0.5);
    this.packHeaderText.anchor.set(0, 0.5);
    this.packNameText.anchor.set(0, 0.5);
    this.packDescText.anchor.set(0, 0);
    this.packStatusText.anchor.set(0, 0);
    this.dailyText.anchor.set(0, 0);

    this.newRunButton = new TextButton({
      label: 'New Run',
      variant: 'accent',
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
      variant: 'accent',
      onClick: () => {
        if (this.loadingPack || this.loadingDaily) {
          return;
        }
        void this.startDailyChallenge();
      },
    });

    this.continueDailyButton = new TextButton({
      label: 'Continue Daily',
      variant: 'primary',
      onClick: () => {
        if (this.loadingPack || this.loadingDaily) {
          return;
        }
        void this.continueDailyChallenge();
      },
    });

    this.continueChallengeButton = new TextButton({
      label: 'Continue Challenge',
      variant: 'primary',
      onClick: () => {
        if (this.loadingPack || this.loadingDaily || this.loadingChallenge) {
          return;
        }
        void this.continueChallengeRun();
      },
    });

    this.playChallengeButton = new TextButton({
      label: 'Play Challenge Code',
      variant: 'secondary',
      onClick: () => {
        if (this.loadingPack || this.loadingDaily || this.loadingChallenge) {
          return;
        }
        this.openChallengeModal();
      },
    });

    this.continueButton = new TextButton({
      label: 'Continue',
      variant: 'primary',
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
      variant: 'danger',
      onClick: () => {
        this.context.clearSaveData();
        this.status.text = 'Save cleared.';
        this.refreshContinueState();
      },
    });

    this.statsButton = new TextButton({
      label: 'Stats',
      width: 170,
      variant: 'secondary',
      onClick: () => {
        this.context.transitionTo('STATS', { returnState: 'TITLE' });
      },
    });
    this.dailyHistoryButton = new TextButton({
      label: 'Daily History',
      width: 170,
      variant: 'secondary',
      onClick: () => {
        this.context.transitionTo('DAILY_HISTORY');
      },
    });
    this.compareButton = new TextButton({
      label: 'Compare Results',
      width: 170,
      variant: 'secondary',
      onClick: () => {
        this.context.transitionTo('COMPARE', { returnState: 'TITLE' });
      },
    });
    this.leaderboardButton = new TextButton({
      label: 'Leaderboards',
      width: 170,
      variant: 'secondary',
      onClick: () => {
        this.context.transitionTo('LEADERBOARD');
      },
    });

    this.normalButton = new TextButton({
      label: 'Normal',
      width: 130,
      variant: 'secondary',
      onClick: () => {
        this.selectedDifficulty = DifficultyMode.NORMAL;
        this.refreshDifficultyButtons();
      },
    });
    this.hardButton = new TextButton({
      label: 'Hard',
      width: 130,
      variant: 'secondary',
      onClick: () => {
        this.selectedDifficulty = DifficultyMode.HARD;
        this.refreshDifficultyButtons();
      },
    });

    this.packPrevButton = new TextButton({
      label: '<',
      width: 58,
      height: 36,
      variant: 'secondary',
      onClick: () => this.changePackByStep(-1),
    });
    this.packNextButton = new TextButton({
      label: '>',
      width: 58,
      height: 36,
      variant: 'secondary',
      onClick: () => this.changePackByStep(1),
    });

    this.challengeValidateButton = new TextButton({
      label: 'Validate',
      width: 180,
      variant: 'secondary',
      onClick: () => {
        void this.validateChallengeInput();
      },
    });
    this.challengeStartButton = new TextButton({
      label: 'Start Challenge',
      width: 220,
      variant: 'accent',
      onClick: () => {
        void this.startChallengeFromModal();
      },
    });
    this.challengeCloseButton = new TextButton({
      label: 'Close',
      width: 160,
      variant: 'secondary',
      onClick: () => {
        this.closeChallengeModal();
      },
    });

    this.howToPlayButton = new TextButton({
      label: 'How to Play',
      width: 170,
      variant: 'secondary',
      onClick: () => {
        this.howToPlayOverlay.show();
      },
    });

    this.howToPlayOverlay = new HowToPlayOverlay();

    this.root.addChild(this.title);
    this.root.addChild(this.subtitle);
    this.root.addChild(this.description);
    this.root.addChild(this.actionsHeader);
    this.root.addChild(this.metaHeader);
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

    const width = this.context.app.screen.width;
    const height = this.context.app.screen.height;
    if (width !== this.lastLayoutWidth || height !== this.lastLayoutHeight) {
      this.layout();
    }
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
    this.lastLayoutWidth = width;
    this.lastLayoutHeight = height;

    const margin = Math.max(14, Math.min(width, height) * 0.024);
    const frameWidth = Math.max(320, width - margin * 2);
    const frameX = (width - frameWidth) * 0.5;
    const panelGap = Math.max(10, Math.min(20, width * 0.016));
    const narrowLayout = width < 1120;

    const heroHeight = Math.max(150, Math.min(238, height * 0.265));
    const heroX = frameX;
    const heroY = margin;
    const heroW = frameWidth;
    const heroH = heroHeight;

    const lowerTop = heroY + heroH + panelGap;
    const lowerHeight = Math.max(220, height - lowerTop - margin * 1.6);

    let actionsX = frameX;
    let actionsY = lowerTop;
    let actionsW = frameWidth;
    let actionsH = lowerHeight;
    let metaX = frameX;
    let metaY = lowerTop;
    let metaW = frameWidth;
    let metaH = lowerHeight;

    if (narrowLayout) {
      actionsH = Math.max(190, Math.min(420, lowerHeight * 0.54));
      metaY = actionsY + actionsH + panelGap;
      metaH = Math.max(160, height - metaY - margin * 1.6);
    } else {
      actionsW = Math.max(340, Math.min(510, frameWidth * 0.44));
      actionsH = lowerHeight;
      metaX = actionsX + actionsW + panelGap;
      metaW = Math.max(360, frameWidth - actionsW - panelGap);
      metaH = lowerHeight;
    }

    this.drawBackdrop(width, height, heroX, heroY, heroW, heroH, actionsX, actionsY, actionsW, actionsH, metaX, metaY, metaW, metaH);

    this.title.position.set(heroX + heroW * 0.5, heroY + heroH * 0.34);
    this.subtitle.position.set(heroX + heroW * 0.5, heroY + heroH * 0.6);
    this.description.style.wordWrapWidth = Math.max(320, heroW - 84);
    this.description.position.set(heroX + heroW * 0.5, heroY + heroH * 0.84);

    const actionsHeaderY = actionsY + 26;
    this.actionsHeader.position.set(actionsX + 24, actionsHeaderY);
    this.metaHeader.position.set(metaX + 24, metaY + 26);

    const actionButtons = [
      this.newRunButton,
      this.dailyRunButton,
      this.continueDailyButton,
      this.playChallengeButton,
      this.continueChallengeButton,
      this.continueButton,
      this.clearButton,
    ];
    const actionButtonStartY = actionsHeaderY + 22;
    const actionAvailable = Math.max(160, actionsH - 74);
    const naturalStackHeight = actionButtons.length * 44 + (actionButtons.length - 1) * 10;
    const actionScale = Math.max(0.72, Math.min(1, actionAvailable / naturalStackHeight));
    const actionButtonHeight = 44 * actionScale;
    const actionGap = Math.max(4, 8 * actionScale);
    const buttonX = actionsX + (actionsW - 220 * actionScale) * 0.5;
    for (let i = 0; i < actionButtons.length; i += 1) {
      const y = actionButtonStartY + i * (actionButtonHeight + actionGap);
      actionButtons[i].scale.set(actionScale);
      actionButtons[i].position.set(buttonX, y);
    }

    const metaLeft = metaX + 22;
    const metaRight = metaX + metaW - 22;
    const firstRowY = metaY + 54;

    this.difficultyText.position.set(metaLeft, firstRowY);
    this.normalButton.position.set(metaLeft, firstRowY + 18);
    this.hardButton.position.set(metaLeft + 138, firstRowY + 18);
    if (metaW < 560) {
      this.howToPlayButton.position.set(metaLeft, firstRowY + 70);
    } else {
      this.howToPlayButton.position.set(Math.max(metaLeft, metaRight - 170), firstRowY + 18);
    }

    const packTop = firstRowY + (metaW < 560 ? 132 : 80);
    this.packHeaderText.position.set(metaLeft, packTop);
    this.packNameText.position.set(metaLeft + 108, packTop);
    this.packPrevButton.position.set(metaRight - 130, packTop - 17);
    this.packNextButton.position.set(metaRight - 64, packTop - 17);

    this.packDescText.style.wordWrapWidth = Math.max(260, metaW - 44);
    this.packDescText.position.set(metaLeft, packTop + 20);
    this.packStatusText.style.wordWrapWidth = Math.max(260, metaW - 44);
    this.packStatusText.position.set(metaLeft, packTop + 70);
    this.dailyText.style.wordWrapWidth = Math.max(260, metaW - 44);
    this.dailyText.position.set(metaLeft, packTop + 120);

    const utilityTop = metaY + metaH - 108;
    const utilitySingleColumn = metaW < 420;
    if (metaW < 390) {
      this.statsButton.position.set(metaLeft, utilityTop - 86);
      this.dailyHistoryButton.position.set(metaLeft, utilityTop - 34);
      this.compareButton.position.set(metaLeft, utilityTop + 18);
      this.leaderboardButton.position.set(metaLeft, utilityTop + 70);
    } else if (utilitySingleColumn) {
      this.statsButton.position.set(metaLeft, utilityTop - 36);
      this.dailyHistoryButton.position.set(metaLeft, utilityTop + 16);
      this.compareButton.position.set(metaLeft + 178, utilityTop - 36);
      this.leaderboardButton.position.set(metaLeft + 178, utilityTop + 16);
    } else {
      this.statsButton.position.set(metaLeft, utilityTop);
      this.dailyHistoryButton.position.set(metaLeft + 182, utilityTop);
      this.compareButton.position.set(metaLeft, utilityTop + 52);
      this.leaderboardButton.position.set(metaLeft + 182, utilityTop + 52);
    }

    this.status.position.set(width * 0.5, height - margin * 0.62);

    this.layoutChallengeModal(width, height);
    this.howToPlayOverlay.layout(width, height);
  }

  private drawBackdrop(
    width: number,
    height: number,
    heroX: number,
    heroY: number,
    heroW: number,
    heroH: number,
    actionsX: number,
    actionsY: number,
    actionsW: number,
    actionsH: number,
    metaX: number,
    metaY: number,
    metaW: number,
    metaH: number,
  ): void {
    this.bg.clear();
    this.bg.rect(0, 0, width, height);
    this.bg.fill({ color: 0x0a1219, alpha: 1 });

    this.backdrop.clear();
    this.backdrop.roundRect(10, 10, width - 20, height - 20, 18);
    this.backdrop.stroke({ color: 0x6d94ba, alpha: 0.2, width: 1.2 });

    this.backdrop.circle(width * 0.15, height * 0.14, Math.max(180, width * 0.15));
    this.backdrop.fill({ color: 0x1d3951, alpha: 0.22 });
    this.backdrop.circle(width * 0.88, height * 0.2, Math.max(170, width * 0.12));
    this.backdrop.fill({ color: 0x4e3320, alpha: 0.18 });

    for (let i = 0; i < 9; i += 1) {
      const y = height * (0.08 + i * 0.098);
      this.backdrop.moveTo(0, y);
      this.backdrop.lineTo(width, y - 42);
    }
    this.backdrop.stroke({ color: 0x8cb5da, alpha: 0.07, width: 1 });

    this.heroPanel.clear();
    this.heroPanel.roundRect(heroX, heroY, heroW, heroH, 16);
    this.heroPanel.fill({ color: 0x112132, alpha: 0.95 });
    this.heroPanel.stroke({ color: 0x7ea9cf, alpha: 0.68, width: 1.6 });
    this.heroPanel.roundRect(heroX + 2, heroY + 2, heroW - 4, Math.max(16, heroH * 0.32), 12);
    this.heroPanel.fill({ color: 0xffffff, alpha: 0.035 });

    this.actionsPanel.clear();
    this.actionsPanel.roundRect(actionsX, actionsY, actionsW, actionsH, 14);
    this.actionsPanel.fill({ color: 0x12202d, alpha: 0.95 });
    this.actionsPanel.stroke({ color: 0x7d9ab2, alpha: 0.58, width: 1.35 });

    this.metaPanel.clear();
    this.metaPanel.roundRect(metaX, metaY, metaW, metaH, 14);
    this.metaPanel.fill({ color: 0x111f2d, alpha: 0.95 });
    this.metaPanel.stroke({ color: 0x8cb4d8, alpha: 0.64, width: 1.35 });

    this.motif.clear();
    const motifY = heroY + heroH * 0.5;
    const leftX = heroX + 44;
    const rightX = heroX + heroW - 44;
    this.motif.moveTo(leftX, motifY - 22);
    this.motif.lineTo(leftX + 14, motifY + 18);
    this.motif.lineTo(leftX + 36, motifY + 10);
    this.motif.lineTo(leftX + 24, motifY - 28);
    this.motif.closePath();
    this.motif.fill({ color: 0x9fcdf5, alpha: 0.52 });

    this.motif.moveTo(rightX, motifY - 20);
    this.motif.lineTo(rightX - 22, motifY - 6);
    this.motif.lineTo(rightX - 22, motifY + 6);
    this.motif.lineTo(rightX, motifY + 20);
    this.motif.stroke({ color: 0xf5ca93, alpha: 0.56, width: 2.1 });

    this.motif.roundRect(heroX + heroW * 0.5 - 130, heroY + heroH - 28, 260, 8, 4);
    this.motif.fill({ color: 0x2c465a, alpha: 0.7 });
    this.motif.roundRect(heroX + heroW * 0.5 - 70, heroY + heroH - 28, 140, 8, 4);
    this.motif.fill({ color: 0xcda160, alpha: 0.82 });
  }

  private refreshDifficultyButtons(): void {
    this.difficultyText.text = `Difficulty: ${this.selectedDifficulty}`;
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
      area.style.fontFamily = 'Consolas, Menlo, monospace';
      area.style.fontSize = '12px';
      area.style.background = '#0f1a24';
      area.style.color = '#d4e7ff';
      area.style.border = '1px solid #7fa7cb';
      area.style.borderRadius = '10px';
      area.style.padding = '10px';
      area.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)';
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
    this.challengeModalBackdrop.fill({ color: 0x03070b, alpha: 0.78 });

    this.challengeModalPanel.clear();
    this.challengeModalPanel.roundRect(modalX, modalY, modalWidth, modalHeight, 14);
    this.challengeModalPanel.fill({ color: 0x101c2a, alpha: 0.98 });
    this.challengeModalPanel.stroke({ color: 0x83adcf, alpha: 0.9, width: 1.7 });
    this.challengeModalPanel.roundRect(modalX + 2, modalY + 2, modalWidth - 4, 68, 12);
    this.challengeModalPanel.fill({ color: 0xffffff, alpha: 0.035 });

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

