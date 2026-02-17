import { Container, Graphics, Text } from 'pixi.js';
import { contentManager } from '../../content/ContentManager';
import { encodeChallenge, type ChallengePayloadV1 } from '../../meta/ChallengeCode';
import { getBestForDate, recordDailyResult } from '../../meta/DailyResults';
import { DifficultyMode } from '../../meta/Difficulty';
import { decodeResult, encodeResult, type ResultPayloadV1 } from '../../meta/ResultCode';
import {
  buildShareResultText,
  createShareCardContainer,
  type ShareCardData,
} from '../../ui/share/ShareCard';
import { exportShareCardPNG } from '../../ui/share/ShareCardExporter';
import { downloadBlob, downloadDataUrl } from '../../ui/share/download';
import {
  MENU_BODY_FONT,
  MENU_MONO_FONT,
  MENU_TITLE_FONT,
  drawMenuBackdrop,
  drawMenuCard,
  styleCodeTextArea,
} from '../../ui/theme/MenuTheme';
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
  if (mode === 'DAILY') {
    return 'Daily';
  }
  if (mode === 'CHALLENGE') {
    return 'Challenge';
  }
  return 'Normal';
}

export class RunEndState implements IGameState {
  private readonly root = new Container();
  private readonly bg = new Graphics();
  private readonly panel = new Graphics();
  private readonly title = new Text({
    text: 'Run Summary',
    style: {
      fill: 0xf4e2b5,
      fontFamily: MENU_TITLE_FONT,
      fontSize: 40,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
  });
  private readonly body = new Text({
    text: '',
    style: {
      fill: 0xd8e9ff,
      fontFamily: MENU_BODY_FONT,
      fontSize: 14,
      lineHeight: 22,
      wordWrap: true,
      wordWrapWidth: 900,
    },
  });
  private readonly status = new Text({
    text: '',
    style: {
      fill: 0x9dd1ff,
      fontFamily: MENU_BODY_FONT,
      fontSize: 13,
    },
  });

  private readonly copyButton: TextButton;
  private readonly copyResultCodeButton: TextButton;
  private readonly compareResultButton: TextButton;
  private readonly createChallengeButton: TextButton;
  private readonly downloadCardButton: TextButton;
  private readonly newDailyButton: TextButton;
  private readonly backButton: TextButton;
  private readonly challengeModal = new Container();
  private readonly challengeModalBackdrop = new Graphics();
  private readonly challengeModalPanel = new Graphics();
  private readonly challengeModalTitle = new Text({
    text: 'Challenge Code',
    style: {
      fill: 0xf4e2b5,
      fontFamily: MENU_TITLE_FONT,
      fontSize: 24,
      fontWeight: '700',
    },
  });
  private readonly challengeModalHint = new Text({
    text: 'Share this code to recreate this run setup.',
    style: {
      fill: 0xc3daf6,
      fontFamily: MENU_BODY_FONT,
      fontSize: 14,
    },
  });
  private readonly challengeModalStatus = new Text({
    text: '',
    style: {
      fill: 0xa7cdf4,
      fontFamily: MENU_BODY_FONT,
      fontSize: 13,
    },
  });
  private readonly challengeCopyCodeButton: TextButton;
  private readonly challengeCopyShareButton: TextButton;
  private readonly challengeCloseButton: TextButton;

  private shareText = '';
  private resultCode = '';
  private resultPayload: ResultPayloadV1 | null = null;
  private challengeCode = '';
  private challengeModalOpen = false;
  private challengeCodeTextArea: HTMLTextAreaElement | null = null;
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
      variant: 'secondary',
      onClick: () => this.copyResult(),
    });
    this.copyResultCodeButton = new TextButton({
      label: 'Copy Result Code',
      width: 220,
      variant: 'secondary',
      onClick: () => this.copyResultCode(),
    });
    this.compareResultButton = new TextButton({
      label: 'Compare Result Code',
      width: 220,
      variant: 'secondary',
      onClick: () => this.openCompare(),
    });
    this.createChallengeButton = new TextButton({
      label: 'Create Challenge Code',
      width: 240,
      variant: 'accent',
      onClick: () => this.openChallengeModal(),
    });
    this.downloadCardButton = new TextButton({
      label: 'Download Share Card (PNG)',
      width: 260,
      variant: 'accent',
      onClick: () => this.downloadCard(),
    });
    this.newDailyButton = new TextButton({
      label: 'New Daily Run',
      width: 220,
      variant: 'accent',
      onClick: () => this.startNewDaily(),
    });
    this.backButton = new TextButton({
      label: 'Back To Title',
      width: 220,
      variant: 'primary',
      onClick: () => this.backToTitle(),
    });
    this.challengeCopyCodeButton = new TextButton({
      label: 'Copy Code',
      width: 190,
      variant: 'secondary',
      onClick: () => this.copyChallengeCode(),
    });
    this.challengeCopyShareButton = new TextButton({
      label: 'Copy Share Text',
      width: 210,
      variant: 'secondary',
      onClick: () => this.copyChallengeShareText(),
    });
    this.challengeCloseButton = new TextButton({
      label: 'Close',
      width: 160,
      variant: 'primary',
      onClick: () => this.closeChallengeModal(),
    });

    this.root.addChild(this.title);
    this.root.addChild(this.body);
    this.root.addChild(this.status);
    this.root.addChild(this.copyButton);
    this.root.addChild(this.copyResultCodeButton);
    this.root.addChild(this.compareResultButton);
    this.root.addChild(this.createChallengeButton);
    this.root.addChild(this.downloadCardButton);
    this.root.addChild(this.newDailyButton);
    this.root.addChild(this.backButton);

    this.challengeModal.visible = false;
    this.challengeModalTitle.anchor.set(0.5, 0.5);
    this.challengeModalHint.anchor.set(0.5, 0.5);
    this.challengeModalStatus.anchor.set(0.5, 0.5);
    this.challengeModal.addChild(this.challengeModalBackdrop);
    this.challengeModal.addChild(this.challengeModalPanel);
    this.challengeModal.addChild(this.challengeModalTitle);
    this.challengeModal.addChild(this.challengeModalHint);
    this.challengeModal.addChild(this.challengeModalStatus);
    this.challengeModal.addChild(this.challengeCopyCodeButton);
    this.challengeModal.addChild(this.challengeCopyShareButton);
    this.challengeModal.addChild(this.challengeCloseButton);
    this.root.addChild(this.challengeModal);
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
    this.challengeModalStatus.text = '';
    this.closeChallengeModal();
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

    const shareCardData: ShareCardData = {
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
    this.shareCardData = shareCardData;

    this.shareText = buildShareResultText(shareCardData);
    this.resultCode = '';
    this.resultPayload = null;

    let bestSquadArchetypeId: string | undefined;
    let bestSquadSize = -1;
    for (let i = 0; i < campaign.armyState.squads.length; i += 1) {
      const squad = campaign.armyState.squads[i];
      if (squad.size > bestSquadSize) {
        bestSquadSize = squad.size;
        bestSquadArchetypeId = squad.archetypeId;
      }
    }

    const encodedResult = encodeResult({
      v: 1,
      kind: 'RESULT',
      mode: runState.mode,
      dateKey: runState.mode === 'DAILY' && runState.dateKey ? runState.dateKey : undefined,
      seed: runState.seed >>> 0,
      difficulty: runState.difficultyMode,
      pack: {
        id: contentStatus.loadedPackId,
        version: contentStatus.contentVersion,
        name: contentStatus.loadedPackName,
      },
      score: finalScore,
      nodesCleared: runState.clearedNodeIds.length,
      wins: battlesWon,
      timeSec: totalDuration,
      casualtiesPct: avgCasualties,
      perks: [...campaign.perkState.pickedPerkIds],
      bestSquadArchetypeId,
    });
    this.resultCode = encodedResult;
    const decodedResult = decodeResult(encodedResult);
    if (decodedResult.ok && decodedResult.payload) {
      this.resultPayload = decodedResult.payload;
    }

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
    if (runState.mode === 'CHALLENGE' && runState.challengePayload !== null) {
      bodyLines.push(
        `Challenge: pack ${runState.challengePayload.packId} (${runState.challengePayload.packVersion})`,
      );
      bodyLines.push(
        `Rules: objectiveNoRepeat=${runState.challengePayload.objectiveNoRepeat ? 'on' : 'off'}, mapNoRepeat=${runState.challengePayload.mapNoRepeat ? 'on' : 'off'}`,
      );
    }
    if (dailyBestLine.length > 0) {
      bodyLines.push(dailyBestLine);
    }
    this.body.text = bodyLines.join('\n');

    const challengePayload: ChallengePayloadV1 = {
      v: 1,
      mode: 'CHALLENGE',
      seed: runState.seed >>> 0,
      difficulty: runState.difficultyMode,
      dateKey: runState.mode === 'DAILY' && runState.dateKey ? runState.dateKey : undefined,
      pack: {
        id: contentStatus.loadedPackId,
        name: contentStatus.loadedPackName,
        version: contentStatus.contentVersion,
      },
      rules: {
        objectiveNoRepeat: runState.objectiveNoRepeat,
        mapNoRepeat: runState.mapNoRepeat,
      },
    };
    this.challengeCode = encodeChallenge(challengePayload);
    this.createChallengeButton.setEnabled(this.challengeCode.length > 0);
    this.copyResultCodeButton.setEnabled(this.resultCode.length > 0);
    this.compareResultButton.setEnabled(this.resultPayload !== null);

    this.context.recordDiagnosticEvent('RUN_END_VIEWED', {
      mode: runState.mode,
      dateKey: runState.dateKey ?? '',
      score: finalScore,
    });

    this.layout();
  }

  onExit(): void {
    this.closeChallengeModal();
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

  private async copyResultCode(): Promise<void> {
    if (this.resultCode.length === 0) {
      this.status.text = 'Result code unavailable.';
      return;
    }
    const ok = await copyTextWithFallback(this.resultCode);
    this.status.text = ok ? 'Copied result code.' : 'Copy failed.';
  }

  private openCompare(): void {
    if (this.resultPayload === null) {
      this.status.text = 'Result payload unavailable.';
      return;
    }
    this.context.transitionTo('COMPARE', {
      yourResult: this.resultPayload,
      returnState: 'RUN_END',
    });
  }

  private openChallengeModal(): void {
    if (this.challengeCode.length === 0) {
      this.status.text = 'Failed to generate challenge code.';
      return;
    }
    this.challengeModalOpen = true;
    this.challengeModal.visible = true;
    this.challengeModalStatus.text = '';
    this.ensureChallengeCodeTextArea();
    this.layout();
  }

  private closeChallengeModal(): void {
    this.challengeModalOpen = false;
    this.challengeModal.visible = false;
    this.destroyChallengeCodeTextArea();
  }

  private ensureChallengeCodeTextArea(): void {
    if (typeof document === 'undefined') {
      return;
    }
    if (this.challengeCodeTextArea === null) {
      const textArea = document.createElement('textarea');
      textArea.readOnly = true;
      textArea.value = this.challengeCode;
      textArea.style.position = 'fixed';
      textArea.style.zIndex = '30';
      styleCodeTextArea(textArea);
      textArea.style.fontFamily = MENU_MONO_FONT;
      document.body.appendChild(textArea);
      this.challengeCodeTextArea = textArea;
    }
    if (this.challengeCodeTextArea !== null) {
      this.challengeCodeTextArea.value = this.challengeCode;
    }
    this.layoutChallengeCodeTextArea();
  }

  private destroyChallengeCodeTextArea(): void {
    if (this.challengeCodeTextArea === null) {
      return;
    }
    if (typeof document !== 'undefined') {
      document.body.removeChild(this.challengeCodeTextArea);
    }
    this.challengeCodeTextArea = null;
  }

  private layoutChallengeCodeTextArea(): void {
    if (!this.challengeModalOpen || this.challengeCodeTextArea === null) {
      return;
    }
    const canvasRect = this.context.app.canvas.getBoundingClientRect();
    const width = this.context.app.screen.width;
    const height = this.context.app.screen.height;
    const panelWidth = Math.min(860, width - 60);
    const panelHeight = Math.min(420, height - 80);
    const panelX = width * 0.5 - panelWidth * 0.5;
    const panelY = height * 0.5 - panelHeight * 0.5;
    const textLeft = canvasRect.left + panelX + 24;
    const textTop = canvasRect.top + panelY + 98;
    const textWidth = panelWidth - 48;
    const textHeight = panelHeight - 192;
    this.challengeCodeTextArea.style.left = `${Math.round(textLeft)}px`;
    this.challengeCodeTextArea.style.top = `${Math.round(textTop)}px`;
    this.challengeCodeTextArea.style.width = `${Math.round(textWidth)}px`;
    this.challengeCodeTextArea.style.height = `${Math.round(textHeight)}px`;
  }

  private async copyChallengeCode(): Promise<void> {
    const code = this.challengeCodeTextArea ? this.challengeCodeTextArea.value : this.challengeCode;
    const ok = await copyTextWithFallback(code);
    this.challengeModalStatus.text = ok ? 'Copied challenge code.' : 'Copy failed.';
  }

  private async copyChallengeShareText(): Promise<void> {
    const ok = await copyTextWithFallback(this.shareText);
    this.challengeModalStatus.text = ok ? 'Copied share text.' : 'Copy failed.';
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

    drawMenuBackdrop(this.bg, width, height);
    drawMenuCard(this.panel, panelX, panelY, panelWidth, panelHeight);

    this.title.position.set(width * 0.5, panelY + 34);
    this.body.style.wordWrapWidth = panelWidth - 70;
    this.body.position.set(width * 0.5, panelY + 78);
    this.status.position.set(width * 0.5, panelY + panelHeight - 84);

    const buttonRowA = panelY + panelHeight - 148;
    const buttonRowB = panelY + panelHeight - 100;
    const buttonRowC = panelY + panelHeight - 52;
    if (this.isDailyRun) {
      this.copyButton.position.set(width * 0.5 - 370, buttonRowA);
      this.copyResultCodeButton.position.set(width * 0.5 - 130, buttonRowA);
      this.compareResultButton.position.set(width * 0.5 + 110, buttonRowA);
      this.createChallengeButton.position.set(width * 0.5 - 130, buttonRowB);
      this.downloadCardButton.position.set(width * 0.5 + 130, buttonRowB);
      this.newDailyButton.position.set(width * 0.5 - 130, buttonRowC);
      this.backButton.position.set(width * 0.5 + 130, buttonRowC);
    } else {
      this.copyButton.position.set(width * 0.5 - 370, buttonRowB);
      this.copyResultCodeButton.position.set(width * 0.5 - 130, buttonRowB);
      this.compareResultButton.position.set(width * 0.5 + 110, buttonRowB);
      this.createChallengeButton.position.set(width * 0.5 - 130, buttonRowC);
      this.backButton.position.set(width * 0.5 + 130, buttonRowC);
    }

    if (this.challengeModalOpen) {
      const modalWidth = Math.min(860, width - 60);
      const modalHeight = Math.min(420, height - 80);
      const modalX = width * 0.5 - modalWidth * 0.5;
      const modalY = height * 0.5 - modalHeight * 0.5;

      this.challengeModalBackdrop.clear();
      this.challengeModalBackdrop.rect(0, 0, width, height);
      this.challengeModalBackdrop.fill({ color: 0x04090e, alpha: 0.76 });
      drawMenuCard(this.challengeModalPanel, modalX, modalY, modalWidth, modalHeight, {
        radius: 14,
      });

      this.challengeModalTitle.position.set(width * 0.5, modalY + 34);
      this.challengeModalHint.position.set(width * 0.5, modalY + 62);
      this.challengeModalStatus.position.set(width * 0.5, modalY + modalHeight - 88);
      this.challengeCopyCodeButton.position.set(width * 0.5 - 300, modalY + modalHeight - 62);
      this.challengeCopyShareButton.position.set(width * 0.5 - 96, modalY + modalHeight - 62);
      this.challengeCloseButton.position.set(width * 0.5 + 128, modalY + modalHeight - 62);
      this.layoutChallengeCodeTextArea();
    }
  }
}
