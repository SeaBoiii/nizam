import { Application, Text } from 'pixi.js';
import { audioManager } from '../audio/AudioManager';
import { contentManager } from '../content/ContentManager';
import type { ContentLoadStatus } from '../content/ContentTypes';
import { createStartingArmy } from '../meta/Army';
import { buildBugReport } from '../meta/BugReport';
import type { ChallengePayloadV1 } from '../meta/ChallengeCode';
import { getDailySeed, getSingaporeDateKey } from '../meta/DailyChallenge';
import { DifficultyMode } from '../meta/Difficulty';
import { createPerkState } from '../meta/Perks';
import { computeRunScore } from '../meta/Scoring';
import { loadSettings, saveSettings, type GameSettings } from '../meta/Settings';
import { StatsCollector } from '../meta/StatsCollector';
import { createScenario } from '../meta/ScenarioFactory';
import { clearSave, hasSave, loadGame, saveGame, type SaveGameData, type SaveSlot } from '../meta/Save';
import type { BattleResult, BattleScenario } from '../meta/types';
import { generateMap } from '../overworld/generateMap';
import type { RunState } from '../overworld/types';
import { EventRecorder } from '../sim/events/EventRecorder';
import type { GameEvents } from '../sim/events/GameEvents';
import { DebugPanel } from '../ui/widgets/DebugPanel';
import { ErrorOverlay } from '../ui/widgets/ErrorOverlay';
import { PauseMenu } from '../ui/widgets/PauseMenu';
import { setTextButtonClickListener } from '../ui/widgets/TextButton';
import { ErrorBoundary, type CapturedErrorInfo } from './ErrorBoundary';
import type { IGameState } from './states/IGameState';
import { BattleState } from './states/BattleState';
import { DailyHistoryState } from './states/DailyHistoryState';
import { OverworldState } from './states/OverworldState';
import { RunEndState } from './states/RunEndState';
import { RewardsState } from './states/RewardsState';
import { StatsState } from './states/StatsState';
import type { CampaignData, DailySaveInfo, GameStateId, StateContext } from './states/StateContext';
import { TitleState } from './states/TitleState';

export class Game {
  private readonly app: Application;
  private currentState: IGameState | null = null;
  private currentStateId: GameStateId = 'TITLE';

  private campaignData: CampaignData | null = null;
  private pendingScenario: BattleScenario | null = null;
  private lastBattleResult: BattleResult | null = null;
  private settings: GameSettings = loadSettings();
  private paused = false;
  private readonly statsCollector = new StatsCollector();

  private readonly debugPanel: DebugPanel;
  private readonly pauseMenu: PauseMenu;
  private readonly errorOverlay: ErrorOverlay;
  private readonly errorBoundary: ErrorBoundary;
  private readonly eventRecorder = new EventRecorder(200);
  private readonly contentWarningText = new Text({
    text: '',
    style: {
      fill: 0xffca92,
      fontFamily: 'monospace',
      fontSize: 12,
    },
  });

  private readonly stateContext: StateContext;
  private crashed = false;
  private crashGuard = false;
  private lastObjectiveStage: string | undefined;

  constructor(app: Application) {
    this.app = app;

    this.stateContext = {
      app: this.app,
      stage: this.app.stage,
      getSettings: () => ({ ...this.settings }),
      setContentPack: (packId) => this.setContentPack(packId),
      getContentStatus: () => contentManager.getStatus(),
      getAvailableContentPacks: () => contentManager.getAvailablePacks(),
      getCampaignData: () => this.campaignData,
      setCampaignData: (data) => {
        this.campaignData = data;
      },
      startNewRun: (mode) => this.startNewRun(mode),
      startDailyRun: (mode) => this.startDailyRun(mode),
      startChallengeRun: (payload, rawCode) => this.startChallengeRun(payload, rawCode),
      hasSaveData: () => hasSave('normal'),
      hasChallengeSaveData: () => hasSave('challenge'),
      loadSaveData: () => this.loadSaveData(),
      getDailySaveInfo: () => this.getDailySaveInfo(),
      loadDailySaveData: () => this.loadDailySaveData(),
      loadChallengeSaveData: () => this.loadChallengeSaveData(),
      saveCampaignData: () => this.saveCampaignData(),
      clearSaveData: () => this.clearSaveData(),
      clearDailySaveData: () => this.clearDailySaveData(),
      clearChallengeSaveData: () => this.clearChallengeSaveData(),
      clearActiveRunSave: () => this.clearActiveRunSave(),
      getActiveSaveSlot: () => this.getActiveSaveSlot(),
      endCurrentRunSession: () => this.endCurrentRunSession(),
      setPendingScenario: (scenario) => {
        this.pendingScenario = scenario;
      },
      getPendingScenario: () => this.pendingScenario,
      setLastBattleResult: (result) => {
        this.lastBattleResult = result;
      },
      getLastBattleResult: () => this.lastBattleResult,
      bindBattleTelemetry: (events) => this.bindBattleTelemetry(events),
      markBattleStarted: (scenario) => this.markBattleStarted(scenario),
      markBattleEnded: (result) => this.markBattleEnded(result),
      markBattleAborted: () => this.markBattleAborted(),
      markPerkOffered: (choiceCount) => this.markPerkOffered(choiceCount),
      markPerkPicked: (perkId) => this.markPerkPicked(perkId),
      markRunCompleted: (outcome) => this.markRunCompleted(outcome),
      recordDiagnosticEvent: (eventType, payload) => this.recordDiagnosticEvent(eventType, payload),
      getStatsSnapshot: () => this.statsCollector.getSnapshot(),
      resetStatsData: () => this.statsCollector.reset(),
      transitionTo: (stateId, payload) => this.transitionTo(stateId, payload),
    };

    window.addEventListener('beforeunload', this.onBeforeUnload);
    window.addEventListener('keydown', this.onGlobalKeyDown);
    window.addEventListener('pointerdown', this.onGlobalPointerDown);
    window.addEventListener('wheel', this.onGlobalWheel, { passive: true });

    this.contentWarningText.position.set(12, 12);
    this.app.stage.addChild(this.contentWarningText);

    this.debugPanel = new DebugPanel({
      parent: this.app.stage,
      onReloadContent: () => this.reloadContent(),
      onRestartAction: () => this.handleDebugRestartAction(),
      onForceCrash: import.meta.env.DEV
        ? () => {
            throw new Error('Forced crash from DebugPanel');
          }
        : undefined,
    });
    this.pauseMenu = new PauseMenu({
      parent: this.app.stage,
      getSettings: () => this.settings,
      onSettingsChanged: (settings) => this.applySettings(settings, true),
      onResume: () => this.setPaused(false),
      onQuitToTitle: () => {
        this.setPaused(false);
        this.transitionTo('TITLE');
      },
      onShowStats: () => {
        const returnState = this.currentStateId === 'BATTLE' ? 'BATTLE' : 'OVERWORLD';
        this.setPaused(false);
        this.transitionTo('STATS', { returnState });
      },
    });
    this.errorOverlay = new ErrorOverlay(this.app.stage);
    this.errorBoundary = new ErrorBoundary({
      onError: (error) => this.handleGlobalError(error),
    });
    this.errorBoundary.install();

    setTextButtonClickListener(() => {
      audioManager.unlock();
      audioManager.play('ui_click', 1, 35);
    });

    this.applySettings(this.settings, false);
    this.transitionTo('TITLE');
    this.app.ticker.add(this.tick);
    this.refreshContentWarning();
  }

  private readonly tick = (): void => {
    if (this.crashed) {
      this.errorOverlay.layout(this.app.screen.width, this.app.screen.height);
      return;
    }
    if (this.currentState === null) {
      this.errorOverlay.layout(this.app.screen.width, this.app.screen.height);
      return;
    }

    const frameDt = this.app.ticker.deltaMS / 1000;
    this.currentState.update(this.paused ? 0 : frameDt);
    this.statsCollector.update(
      frameDt,
      this.campaignData !== null &&
        !this.paused &&
        this.currentStateId !== 'TITLE' &&
        this.currentStateId !== 'STATS' &&
        this.currentStateId !== 'DAILY_HISTORY',
    );
    this.updateDebugPanel();
    this.pauseMenu.layout(this.app.screen.width, this.app.screen.height);
    this.errorOverlay.layout(this.app.screen.width, this.app.screen.height);
  };

  private transitionTo(stateId: GameStateId, payload?: unknown): void {
    if (
      stateId === 'TITLE' &&
      this.currentStateId !== 'TITLE' &&
      this.campaignData !== null &&
      this.campaignData.runState.finalScore === null
    ) {
      this.statsCollector.onRunAbandoned(this.campaignData.runState, this.campaignData.perkState);
    }
    this.setPaused(false);

    if (this.currentState !== null) {
      if (this.currentStateId === 'OVERWORLD' || this.currentStateId === 'REWARDS') {
        this.saveCampaignData();
      }
      this.currentState.onExit();
      this.currentState = null;
    }

    this.currentStateId = stateId;
    this.eventRecorder.record('STATE_TRANSITION', {
      to: stateId,
    });

    switch (stateId) {
      case 'TITLE':
        this.currentState = new TitleState(this.stateContext);
        break;
      case 'OVERWORLD':
        this.currentState = new OverworldState(this.stateContext);
        break;
      case 'BATTLE':
        this.currentState = new BattleState(this.stateContext);
        break;
      case 'REWARDS':
        this.currentState = new RewardsState(this.stateContext);
        break;
      case 'RUN_END':
        this.currentState = new RunEndState(this.stateContext);
        break;
      case 'STATS':
        this.currentState = new StatsState(this.stateContext);
        break;
      case 'DAILY_HISTORY':
        this.currentState = new DailyHistoryState(this.stateContext);
        break;
    }

    this.currentState.onEnter(payload);
    if (this.currentState.applySettings) {
      this.currentState.applySettings(this.settings);
    }
    this.app.stage.addChild(this.contentWarningText);
    this.app.stage.addChild(this.debugPanel.root);
    this.app.stage.addChild(this.pauseMenu.root);
    this.app.stage.addChild(this.errorOverlay.root);
  }

  private startNewRun(mode: DifficultyMode = DifficultyMode.NORMAL): void {
    if (this.campaignData !== null && this.campaignData.runState.finalScore === null) {
      this.statsCollector.onRunAbandoned(this.campaignData.runState, this.campaignData.perkState);
    }

    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    const mapState = generateMap(seed);

    const runState: RunState = {
      seed,
      mode: 'NORMAL',
      dateKey: null,
      packIdLocked: null,
      currentNodeId: mapState.startNodeId,
      clearedNodeIds: [mapState.startNodeId],
      step: 0,
      difficultyTier: 1,
      difficultyMode: mode,
      restBonusBattles: 0,
      battleNodesCleared: 0,
      lastRewardedNodeId: '',
      consecutiveLosses: 0,
      lastObjectiveType: null,
      lastMapId: null,
      finalScore: null,
      scoreBreakdown: null,
      objectiveNoRepeat: true,
      mapNoRepeat: true,
      challengeCode: null,
      challengePayload: null,
    };

    for (let i = 0; i < mapState.nodes.length; i += 1) {
      const node = mapState.nodes[i];
      node.cleared = node.id === mapState.startNodeId;
    }

    this.campaignData = {
      runState,
      armyState: createStartingArmy(),
      perkState: createPerkState(),
      mapState,
    };

    this.pendingScenario = null;
    this.lastBattleResult = null;
    this.lastObjectiveStage = undefined;
    this.eventRecorder.clear();
    this.statsCollector.onRunStarted(runState, this.campaignData.perkState);
    this.eventRecorder.record('RUN_STARTED', {
      seed,
      difficulty: mode,
      startNodeId: mapState.startNodeId,
    });

    this.saveCampaignData();
  }

  private async startDailyRun(mode: DifficultyMode = DifficultyMode.NORMAL): Promise<boolean> {
    const daily = getDailySeed();
    const status = await this.setContentPack('base', true);
    if (!status.loaded || status.loadedPackId === 'embedded') {
      return false;
    }

    if (this.campaignData !== null && this.campaignData.runState.finalScore === null) {
      this.statsCollector.onRunAbandoned(this.campaignData.runState, this.campaignData.perkState);
    }

    const seed = daily.seed >>> 0;
    const mapState = generateMap(seed);
    const runState: RunState = {
      seed,
      mode: 'DAILY',
      dateKey: daily.dateKey,
      packIdLocked: 'base',
      currentNodeId: mapState.startNodeId,
      clearedNodeIds: [mapState.startNodeId],
      step: 0,
      difficultyTier: 1,
      difficultyMode: mode,
      restBonusBattles: 0,
      battleNodesCleared: 0,
      lastRewardedNodeId: '',
      consecutiveLosses: 0,
      lastObjectiveType: null,
      lastMapId: null,
      finalScore: null,
      scoreBreakdown: null,
      objectiveNoRepeat: true,
      mapNoRepeat: true,
      challengeCode: null,
      challengePayload: null,
    };

    for (let i = 0; i < mapState.nodes.length; i += 1) {
      const node = mapState.nodes[i];
      node.cleared = node.id === mapState.startNodeId;
    }

    this.campaignData = {
      runState,
      armyState: createStartingArmy(),
      perkState: createPerkState(),
      mapState,
    };

    this.pendingScenario = null;
    this.lastBattleResult = null;
    this.lastObjectiveStage = undefined;
    this.eventRecorder.clear();
    this.statsCollector.onRunStarted(runState, this.campaignData.perkState);
    this.eventRecorder.record('RUN_STARTED', {
      seed,
      difficulty: mode,
      startNodeId: mapState.startNodeId,
      mode: 'DAILY',
      dateKey: daily.dateKey,
    });

    this.saveCampaignData();
    return true;
  }

  private loadSaveData(): boolean {
    const loaded = loadGame('normal');
    if (loaded === null) {
      return false;
    }

    return this.applyLoadedSave(loaded);
  }

  private async loadDailySaveData(): Promise<boolean> {
    const loaded = loadGame('daily');
    if (loaded === null) {
      return false;
    }

    if (loaded.runState.mode !== 'DAILY') {
      return false;
    }

    const dailyInfo = this.getDailySaveInfo();
    if (dailyInfo === null || !dailyInfo.isToday || !dailyInfo.inProgress) {
      return false;
    }

    const status = await this.setContentPack('base', true);
    if (!status.loaded || status.loadedPackId === 'embedded') {
      return false;
    }

    return this.applyLoadedSave(loaded);
  }

  private async startChallengeRun(payload: ChallengePayloadV1, rawCode: string): Promise<boolean> {
    if (this.campaignData !== null && this.campaignData.runState.finalScore === null) {
      this.statsCollector.onRunAbandoned(this.campaignData.runState, this.campaignData.perkState);
    }

    const status = await this.setContentPack(payload.pack.id, true);
    if (!status.loaded || status.loadedPackId !== payload.pack.id || status.loadedPackId === 'embedded') {
      return false;
    }

    const seed = payload.seed >>> 0;
    const difficultyMode = payload.difficulty === DifficultyMode.HARD ? DifficultyMode.HARD : DifficultyMode.NORMAL;
    const mapState = generateMap(seed);
    const objectiveNoRepeat = payload.rules?.objectiveNoRepeat ?? true;
    const mapNoRepeat = payload.rules?.mapNoRepeat ?? true;

    const runState: RunState = {
      seed,
      mode: 'CHALLENGE',
      dateKey: payload.dateKey ?? null,
      packIdLocked: payload.pack.id,
      currentNodeId: mapState.startNodeId,
      clearedNodeIds: [mapState.startNodeId],
      step: 0,
      difficultyTier: 1,
      difficultyMode,
      restBonusBattles: 0,
      battleNodesCleared: 0,
      lastRewardedNodeId: '',
      consecutiveLosses: 0,
      lastObjectiveType: null,
      lastMapId: null,
      finalScore: null,
      scoreBreakdown: null,
      objectiveNoRepeat,
      mapNoRepeat,
      challengeCode: rawCode.trim(),
      challengePayload: {
        seed,
        difficulty: difficultyMode,
        packId: payload.pack.id,
        packVersion: payload.pack.version,
        dateKey: payload.dateKey ?? null,
        objectiveNoRepeat,
        mapNoRepeat,
      },
    };

    for (let i = 0; i < mapState.nodes.length; i += 1) {
      const node = mapState.nodes[i];
      node.cleared = node.id === mapState.startNodeId;
    }

    this.campaignData = {
      runState,
      armyState: createStartingArmy(),
      perkState: createPerkState(),
      mapState,
    };

    this.pendingScenario = null;
    this.lastBattleResult = null;
    this.lastObjectiveStage = undefined;
    this.eventRecorder.clear();
    this.statsCollector.onRunStarted(runState, this.campaignData.perkState);
    this.eventRecorder.record('RUN_STARTED', {
      seed,
      difficulty: difficultyMode,
      startNodeId: mapState.startNodeId,
      mode: 'CHALLENGE',
      packId: payload.pack.id,
      packVersion: payload.pack.version,
    });

    this.saveCampaignData();
    return true;
  }

  private async loadChallengeSaveData(): Promise<boolean> {
    const loaded = loadGame('challenge');
    if (loaded === null || loaded.runState.mode !== 'CHALLENGE') {
      return false;
    }

    const desiredPackId = loaded.runState.packIdLocked ?? loaded.runState.challengePayload?.packId ?? 'base';
    const status = await this.setContentPack(desiredPackId, true);
    if (!status.loaded || status.loadedPackId === 'embedded') {
      return false;
    }

    return this.applyLoadedSave(loaded);
  }

  private getDailySaveInfo(): DailySaveInfo | null {
    const loaded = loadGame('daily');
    if (loaded === null || loaded.runState.mode !== 'DAILY') {
      return null;
    }
    const todayDateKey = getSingaporeDateKey();
    const inProgress = loaded.runState.finalScore === null;
    return {
      dateKey: loaded.runState.dateKey,
      isToday: loaded.runState.dateKey === todayDateKey,
      inProgress,
      difficulty: loaded.runState.difficultyMode,
      seed: loaded.runState.seed,
    };
  }

  private applyLoadedSave(loaded: SaveGameData): boolean {
    const runState: RunState = loaded.runState;
    const mapState = loaded.mapState;
    let hasCurrentNode = false;

    for (let i = 0; i < mapState.nodes.length; i += 1) {
      const node = mapState.nodes[i];
      node.cleared = runState.clearedNodeIds.includes(node.id);
      if (node.id === runState.currentNodeId) {
        hasCurrentNode = true;
      }
    }

    if (!hasCurrentNode) {
      runState.currentNodeId = mapState.startNodeId;
      if (!runState.clearedNodeIds.includes(mapState.startNodeId)) {
        runState.clearedNodeIds.push(mapState.startNodeId);
      }
    }

    this.campaignData = {
      runState,
      armyState: loaded.armyState,
      perkState: loaded.perkState,
      mapState,
    };

    this.pendingScenario = null;
    this.lastBattleResult = null;
    this.lastObjectiveStage = undefined;
    this.eventRecorder.clear();
    this.statsCollector.onRunLoaded(runState, loaded.perkState);
    this.eventRecorder.record('RUN_LOADED', {
      seed: runState.seed,
      difficulty: runState.difficultyMode,
      currentNodeId: runState.currentNodeId,
      mode: runState.mode,
      dateKey: runState.dateKey ?? '',
    });

    return true;
  }

  private saveCampaignData(): void {
    if (this.campaignData === null) {
      return;
    }

    this.statsCollector.syncRunSnapshot(this.campaignData.runState, this.campaignData.perkState);
    saveGame({
      runState: this.campaignData.runState,
      armyState: this.campaignData.armyState,
      perkState: this.campaignData.perkState,
      mapState: this.campaignData.mapState,
    }, this.getActiveSaveSlot() ?? 'normal');
    this.statsCollector.saveNow();
  }

  private clearSaveData(): void {
    clearSave('normal');
  }

  private clearDailySaveData(): void {
    clearSave('daily');
  }

  private clearChallengeSaveData(): void {
    clearSave('challenge');
  }

  private clearActiveRunSave(): void {
    const slot = this.getActiveSaveSlot();
    if (slot !== null) {
      clearSave(slot);
    }
  }

  private getActiveSaveSlot(): SaveSlot | null {
    if (this.campaignData === null) {
      return null;
    }
    if (this.campaignData.runState.mode === 'DAILY') {
      return 'daily';
    }
    if (this.campaignData.runState.mode === 'CHALLENGE') {
      return 'challenge';
    }
    return 'normal';
  }

  private endCurrentRunSession(): void {
    this.clearActiveRunSave();
    this.campaignData = null;
    this.pendingScenario = null;
    this.lastBattleResult = null;
    this.lastObjectiveStage = undefined;
  }

  private readonly onBeforeUnload = (): void => {
    this.errorBoundary.uninstall();
    this.saveCampaignData();
    saveSettings(this.settings);
    this.statsCollector.saveNow();
  };

  private readonly onGlobalKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'F1' || event.code === 'Backquote') {
      event.preventDefault();
      this.debugPanel.toggleVisible();
      return;
    }

    if (event.code === 'Escape' && (this.currentStateId === 'BATTLE' || this.currentStateId === 'OVERWORLD')) {
      event.preventDefault();
      this.setPaused(!this.paused);
    }
  };

  private readonly onGlobalPointerDown = (): void => {
    audioManager.unlock();
  };

  private readonly onGlobalWheel = (event: WheelEvent): void => {
    if (!this.paused) {
      return;
    }
    this.pauseMenu.onWheel(event.deltaY);
  };

  private updateDebugPanel(): void {
    const campaign = this.campaignData;
    const status = contentManager.getStatus();
    this.debugPanel.update(
      {
        currentStateLabel: this.currentStateId,
        runSeed: campaign ? campaign.runState.seed : null,
        contentStatus: status.fallbackUsed ? 'Fallback' : 'OK',
        contentVersion: status.contentVersion,
        fallbackUsed: status.fallbackUsed,
        selectedPackId: status.selectedPackId,
        loadedPackId: status.loadedPackId,
        contentErrors: status.errors,
        restartButtonLabel: this.currentStateId === 'BATTLE' ? 'Restart Current Battle' : 'Restart Run',
      },
      this.app.screen.width,
      this.app.screen.height,
    );
  }

  private async reloadContent(): Promise<void> {
    await contentManager.loadAllForPack(this.settings.contentPackId, { forceReload: true });
    this.refreshContentWarning();
  }

  private async setContentPack(packId: string, persistToSettings = true): Promise<ContentLoadStatus> {
    if (this.currentStateId !== 'TITLE' && this.currentStateId !== 'RUN_END') {
      console.warn('[Game] Ignored content pack change outside Title state.');
      return contentManager.getStatus();
    }

    const normalizedPackId = packId.trim().length > 0 ? packId.trim() : 'base';
    if (persistToSettings && this.settings.contentPackId !== normalizedPackId) {
      this.settings = {
        ...this.settings,
        contentPackId: normalizedPackId,
      };
      saveSettings(this.settings);
    }

    await contentManager.loadAllForPack(normalizedPackId, { forceReload: true });
    this.refreshContentWarning();
    return contentManager.getStatus();
  }

  private refreshContentWarning(): void {
    const status = contentManager.getStatus();
    const showWarning = status.fallbackUsed;
    let warningText = '';
    if (showWarning) {
      if (status.loadedPackId !== status.selectedPackId) {
        warningText = `Content fallback: ${status.selectedPackId} -> ${status.loadedPackId}`;
      } else {
        warningText = 'Content load fallback';
      }
    }
    this.contentWarningText.visible = showWarning;
    this.contentWarningText.text = warningText;
  }

  private handleDebugRestartAction(): void {
    this.setPaused(false);
    if (this.currentStateId === 'BATTLE') {
      this.restartCurrentBattle();
      return;
    }

    const mode = this.campaignData?.runState.difficultyMode ?? DifficultyMode.NORMAL;
    this.startNewRun(mode);
    this.transitionTo('OVERWORLD');
  }

  private restartCurrentBattle(): void {
    if (this.campaignData === null) {
      this.startNewRun();
      this.transitionTo('OVERWORLD');
      return;
    }

    const currentScenario = this.pendingScenario;
    if (currentScenario !== null) {
      const rebuilt = createScenario(
        currentScenario.nodeId,
        currentScenario.nodeType,
        this.campaignData.runState,
        this.campaignData.armyState,
      );
      this.pendingScenario = rebuilt;
      this.transitionTo('BATTLE', { scenario: rebuilt });
      return;
    }

    const runState = this.campaignData.runState;
    const currentNode = this.campaignData.mapState.nodes.find((node) => node.id === runState.currentNodeId);
    if (!currentNode || (currentNode.type !== 'BATTLE' && currentNode.type !== 'ELITE' && currentNode.type !== 'BOSS')) {
      this.startNewRun();
      this.transitionTo('OVERWORLD');
      return;
    }

    const rebuilt = createScenario(
      currentNode.id,
      currentNode.type,
      this.campaignData.runState,
      this.campaignData.armyState,
    );
    this.pendingScenario = rebuilt;
    this.transitionTo('BATTLE', { scenario: rebuilt });
  }

  private applySettings(settings: GameSettings, persist: boolean): void {
    this.settings = settings;
    audioManager.setMasterVolume(settings.masterVolume);
    audioManager.setSfxVolume(settings.sfxVolume);
    audioManager.setMusicVolume(settings.musicVolume);

    if (this.currentState && this.currentState.applySettings) {
      this.currentState.applySettings(settings);
    }
    if (persist) {
      saveSettings(this.settings);
    }
  }

  private setPaused(paused: boolean): void {
    if (this.crashed) {
      this.paused = true;
      this.pauseMenu.setVisible(false);
      return;
    }
    if (this.currentStateId !== 'BATTLE' && this.currentStateId !== 'OVERWORLD') {
      this.paused = false;
      this.pauseMenu.setVisible(false);
      return;
    }
    this.paused = paused;
    this.pauseMenu.setVisible(paused);
    if (this.currentState && this.currentState.setPaused) {
      this.currentState.setPaused(paused);
    }
  }

  private bindBattleTelemetry(events: GameEvents): () => void {
    events.setRecorder(this.eventRecorder);
    const unbindStats = this.statsCollector.bindGameEvents(events);
    const unbindObjectiveStage = events.onObjectiveStage((event) => {
      this.lastObjectiveStage = event.stage;
    });
    return () => {
      unbindStats();
      unbindObjectiveStage();
      events.setRecorder(null);
    };
  }

  private markBattleStarted(scenario: BattleScenario): void {
    if (this.campaignData === null) {
      return;
    }
    this.lastObjectiveStage = undefined;
    this.statsCollector.onBattleStarted(
      scenario,
      this.campaignData.runState,
      this.campaignData.perkState,
      this.campaignData.armyState.squads,
    );
    this.eventRecorder.record('BATTLE_STARTED', {
      nodeId: scenario.nodeId,
      nodeType: scenario.nodeType,
      mapId: scenario.mapId,
      objectiveType: scenario.objectiveType,
      difficulty: scenario.difficultyMode,
    });
  }

  private markBattleEnded(result: BattleResult): void {
    this.statsCollector.onBattleEnded(
      result,
      this.campaignData ? this.campaignData.runState : null,
      this.campaignData ? this.campaignData.perkState : null,
    );
    this.eventRecorder.record('BATTLE_RESULT', {
      nodeId: result.scenario.nodeId,
      mapId: result.scenario.mapId,
      objectiveType: result.scenario.objectiveType,
      victory: result.victory,
      playerRemaining: result.playerRemaining,
      enemyRemaining: result.enemyRemaining,
    });
  }

  private markBattleAborted(): void {
    this.statsCollector.onBattleAborted(
      this.campaignData ? this.campaignData.runState : null,
      this.campaignData ? this.campaignData.perkState : null,
    );
    this.eventRecorder.record('BATTLE_ABORTED', {
      state: this.currentStateId,
    });
  }

  private markRunCompleted(outcome: 'WIN' | 'LOSS'): void {
    if (this.campaignData === null) {
      return;
    }
    const runState = this.campaignData.runState;
    const score = this.computeCurrentRunScore(outcome === 'WIN');
    runState.finalScore = score.finalScore;
    runState.scoreBreakdown = score;

    this.statsCollector.onRunCompleted(this.campaignData.runState, this.campaignData.perkState, outcome);
    this.eventRecorder.record('RUN_COMPLETED', {
      outcome,
      seed: runState.seed,
      step: runState.step,
      mode: runState.mode,
      dateKey: runState.dateKey ?? '',
      score: score.finalScore,
    });
  }

  private computeCurrentRunScore(bossCleared: boolean): import('../overworld/types').RunScoreBreakdown {
    if (this.campaignData === null) {
      return computeRunScore({
        nodesCleared: 0,
        battlesWon: 0,
        totalBattleDurationSec: 0,
        avgCasualtiesPct: 0,
        difficulty: DifficultyMode.NORMAL,
        bossCleared,
      });
    }

    const runState = this.campaignData.runState;
    const snapshot = this.statsCollector.getSnapshot();
    const lastRun = snapshot.lastRun;
    const summaries = lastRun ? lastRun.battleSummaries : [];

    let battlesWon = 0;
    let totalDurationSec = 0;
    let casualtiesAcc = 0;
    for (let i = 0; i < summaries.length; i += 1) {
      if (summaries[i].won) {
        battlesWon += 1;
      }
      totalDurationSec += summaries[i].durationSec;
      casualtiesAcc += summaries[i].playerCasualtiesPct;
    }
    const avgCasualtiesPct = summaries.length > 0 ? casualtiesAcc / summaries.length : 0;

    return computeRunScore({
      nodesCleared: runState.clearedNodeIds.length,
      battlesWon,
      totalBattleDurationSec: totalDurationSec,
      avgCasualtiesPct,
      difficulty: runState.difficultyMode,
      bossCleared,
    });
  }

  private markPerkOffered(choiceCount: number): void {
    this.statsCollector.recordPerkOffered(choiceCount);
    this.eventRecorder.record('PERK_OFFERED', {
      choices: choiceCount,
      state: this.currentStateId,
    });
  }

  private markPerkPicked(perkId: string): void {
    this.statsCollector.recordPerkPicked(perkId, this.campaignData ? this.campaignData.perkState : null);
    this.eventRecorder.record('PERK_PICKED', {
      perkId,
      totalPerks: this.campaignData ? this.campaignData.perkState.pickedPerkIds.length : 0,
    });
  }

  private recordDiagnosticEvent(eventType: string, payload?: Record<string, unknown>): void {
    this.eventRecorder.record(eventType, payload ?? {});
  }

  private handleGlobalError(error: CapturedErrorInfo): void {
    if (this.crashGuard) {
      return;
    }
    this.crashGuard = true;

    this.eventRecorder.record('ERROR_CAPTURED', {
      source: error.source,
      type: error.type,
      message: error.message,
    });

    this.crashed = true;
    this.paused = true;
    if (this.currentState && this.currentState.setPaused) {
      this.currentState.setPaused(true);
    }
    this.pauseMenu.setVisible(false);

    const campaign = this.campaignData;
    const run = campaign?.runState;
    const perks = campaign?.perkState.pickedPerkIds ?? [];
    const scenario = this.pendingScenario;
    const contentStatus = contentManager.getStatus();
    const bugReport = buildBugReport({
      error,
      context: {
        state: this.currentStateId,
        run: {
          seed: run ? run.seed : null,
          difficulty: run ? run.difficultyMode : 'NONE',
          currentNodeId: run ? run.currentNodeId : '-',
          nodesCleared: run ? run.clearedNodeIds.length : 0,
          perksPicked: [...perks],
        },
        battle:
          scenario !== null
            ? {
                mapId: scenario.mapId,
                objectiveType: scenario.objectiveType,
                stage: this.lastObjectiveStage,
              }
            : undefined,
        contentStatus,
        settings: this.settings,
      },
      recentEvents: this.eventRecorder.getRecentEvents(),
      scenario,
      lastBattleResult: this.lastBattleResult,
    });

    const message =
      error.message && error.message.trim().length > 0 ? error.message : 'Unknown runtime error';
    const stack = error.stack && error.stack.trim().length > 0 ? error.stack : '';
    this.errorOverlay.show({
      message: `${message}\n(${error.type} from ${error.source})`,
      stack,
      canContinue: error.canContinue,
      context: {
        state: this.currentStateId,
        seed: run ? run.seed : null,
        nodeId: run ? run.currentNodeId : '-',
        mapId: scenario ? scenario.mapId : '-',
        objectiveType: scenario ? scenario.objectiveType : '-',
        difficulty: run ? run.difficultyMode : '-',
        perksCount: perks.length,
      },
      bugReportJson: JSON.stringify(bugReport, null, 2),
      onReload: () => {
        location.reload();
      },
      onContinue: () => {
        if (!error.canContinue) {
          return;
        }
        this.crashed = false;
        this.paused = false;
        this.errorOverlay.hide();
        this.crashGuard = false;
      },
    });
    this.errorOverlay.layout(this.app.screen.width, this.app.screen.height);

    if (!error.canContinue) {
      this.crashGuard = true;
      return;
    }
    this.crashGuard = false;
  }
}
