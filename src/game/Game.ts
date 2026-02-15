import { Application, Text } from 'pixi.js';
import { audioManager } from '../audio/AudioManager';
import { contentManager } from '../content/ContentManager';
import { createStartingArmy } from '../meta/Army';
import { DifficultyMode } from '../meta/Difficulty';
import { createPerkState } from '../meta/Perks';
import { loadSettings, saveSettings, type GameSettings } from '../meta/Settings';
import { StatsCollector } from '../meta/StatsCollector';
import { createScenario } from '../meta/ScenarioFactory';
import { clearSave, hasSave, loadGame, saveGame } from '../meta/Save';
import type { BattleResult, BattleScenario } from '../meta/types';
import { generateMap } from '../overworld/generateMap';
import type { RunState } from '../overworld/types';
import type { GameEvents } from '../sim/events/GameEvents';
import { DebugPanel } from '../ui/widgets/DebugPanel';
import { PauseMenu } from '../ui/widgets/PauseMenu';
import { setTextButtonClickListener } from '../ui/widgets/TextButton';
import type { IGameState } from './states/IGameState';
import { BattleState } from './states/BattleState';
import { OverworldState } from './states/OverworldState';
import { RewardsState } from './states/RewardsState';
import { StatsState } from './states/StatsState';
import type { CampaignData, GameStateId, StateContext } from './states/StateContext';
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
  private readonly contentWarningText = new Text({
    text: '',
    style: {
      fill: 0xffca92,
      fontFamily: 'monospace',
      fontSize: 12,
    },
  });

  private readonly stateContext: StateContext;

  constructor(app: Application) {
    this.app = app;

    this.stateContext = {
      app: this.app,
      stage: this.app.stage,
      getCampaignData: () => this.campaignData,
      setCampaignData: (data) => {
        this.campaignData = data;
      },
      startNewRun: (mode) => this.startNewRun(mode),
      hasSaveData: () => hasSave(),
      loadSaveData: () => this.loadSaveData(),
      saveCampaignData: () => this.saveCampaignData(),
      clearSaveData: () => this.clearSaveData(),
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
      markPerkOffered: (choiceCount) => this.statsCollector.recordPerkOffered(choiceCount),
      markPerkPicked: (perkId) =>
        this.statsCollector.recordPerkPicked(perkId, this.campaignData ? this.campaignData.perkState : null),
      markRunCompleted: (outcome) => this.markRunCompleted(outcome),
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
    if (this.currentState === null) {
      return;
    }

    const frameDt = this.app.ticker.deltaMS / 1000;
    this.currentState.update(this.paused ? 0 : frameDt);
    this.statsCollector.update(
      frameDt,
      this.campaignData !== null &&
        !this.paused &&
        this.currentStateId !== 'TITLE' &&
        this.currentStateId !== 'STATS',
    );
    this.updateDebugPanel();
    this.pauseMenu.layout(this.app.screen.width, this.app.screen.height);
  };

  private transitionTo(stateId: GameStateId, payload?: unknown): void {
    if (stateId === 'TITLE' && this.currentStateId !== 'TITLE' && this.campaignData !== null) {
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
      case 'STATS':
        this.currentState = new StatsState(this.stateContext);
        break;
    }

    this.currentState.onEnter(payload);
    if (this.currentState.applySettings) {
      this.currentState.applySettings(this.settings);
    }
    this.app.stage.addChild(this.contentWarningText);
    this.app.stage.addChild(this.debugPanel.root);
    this.app.stage.addChild(this.pauseMenu.root);
  }

  private startNewRun(mode: DifficultyMode = DifficultyMode.NORMAL): void {
    if (this.campaignData !== null) {
      this.statsCollector.onRunAbandoned(this.campaignData.runState, this.campaignData.perkState);
    }

    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    const mapState = generateMap(seed);

    const runState: RunState = {
      seed,
      currentNodeId: mapState.startNodeId,
      clearedNodeIds: [mapState.startNodeId],
      step: 0,
      difficultyTier: 1,
      difficultyMode: mode,
      restBonusBattles: 0,
      battleNodesCleared: 0,
      lastRewardedNodeId: '',
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
    this.statsCollector.onRunStarted(runState, this.campaignData.perkState);

    this.saveCampaignData();
  }

  private loadSaveData(): boolean {
    const loaded = loadGame();
    if (loaded === null) {
      return false;
    }

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
    this.statsCollector.onRunLoaded(runState, loaded.perkState);

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
    });
    this.statsCollector.saveNow();
  }

  private clearSaveData(): void {
    clearSave();
  }

  private readonly onBeforeUnload = (): void => {
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
        restartButtonLabel: this.currentStateId === 'BATTLE' ? 'Restart Current Battle' : 'Restart Run',
      },
      this.app.screen.width,
      this.app.screen.height,
    );
  }

  private async reloadContent(): Promise<void> {
    await contentManager.loadAll({ forceReload: true });
    this.refreshContentWarning();
  }

  private refreshContentWarning(): void {
    const status = contentManager.getStatus();
    const showWarning = import.meta.env.DEV && status.fallbackUsed;
    this.contentWarningText.visible = showWarning;
    this.contentWarningText.text = showWarning ? 'Content load fallback' : '';
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
    return this.statsCollector.bindGameEvents(events);
  }

  private markBattleStarted(scenario: BattleScenario): void {
    if (this.campaignData === null) {
      return;
    }
    this.statsCollector.onBattleStarted(
      scenario,
      this.campaignData.runState,
      this.campaignData.perkState,
      this.campaignData.armyState.squads,
    );
  }

  private markBattleEnded(result: BattleResult): void {
    this.statsCollector.onBattleEnded(
      result,
      this.campaignData ? this.campaignData.runState : null,
      this.campaignData ? this.campaignData.perkState : null,
    );
    if (this.campaignData !== null && result.scenario.nodeType === 'BOSS') {
      this.statsCollector.onRunCompleted(
        this.campaignData.runState,
        this.campaignData.perkState,
        result.victory ? 'WIN' : 'LOSS',
      );
    }
  }

  private markBattleAborted(): void {
    this.statsCollector.onBattleAborted(
      this.campaignData ? this.campaignData.runState : null,
      this.campaignData ? this.campaignData.perkState : null,
    );
  }

  private markRunCompleted(outcome: 'WIN' | 'LOSS'): void {
    if (this.campaignData === null) {
      return;
    }
    this.statsCollector.onRunCompleted(this.campaignData.runState, this.campaignData.perkState, outcome);
  }
}
