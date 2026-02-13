import { Application, Text } from 'pixi.js';
import { contentManager } from '../content/ContentManager';
import { createStartingArmy } from '../meta/Army';
import { createScenario } from '../meta/ScenarioFactory';
import { clearSave, hasSave, loadGame, saveGame } from '../meta/Save';
import type { BattleResult, BattleScenario } from '../meta/types';
import { generateMap } from '../overworld/generateMap';
import type { RunState } from '../overworld/types';
import { DebugPanel } from '../ui/widgets/DebugPanel';
import type { IGameState } from './states/IGameState';
import { BattleState } from './states/BattleState';
import { OverworldState } from './states/OverworldState';
import { RewardsState } from './states/RewardsState';
import type { CampaignData, GameStateId, StateContext } from './states/StateContext';
import { TitleState } from './states/TitleState';

export class Game {
  private readonly app: Application;
  private currentState: IGameState | null = null;
  private currentStateId: GameStateId = 'TITLE';

  private campaignData: CampaignData | null = null;
  private pendingScenario: BattleScenario | null = null;
  private lastBattleResult: BattleResult | null = null;
  private readonly debugPanel: DebugPanel;
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
      startNewRun: () => this.startNewRun(),
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
      transitionTo: (stateId, payload) => this.transitionTo(stateId, payload),
    };

    window.addEventListener('beforeunload', this.onBeforeUnload);
    window.addEventListener('keydown', this.onGlobalKeyDown);

    this.contentWarningText.position.set(12, 12);
    this.app.stage.addChild(this.contentWarningText);

    this.debugPanel = new DebugPanel({
      parent: this.app.stage,
      onReloadContent: () => this.reloadContent(),
      onRestartAction: () => this.handleDebugRestartAction(),
    });

    this.transitionTo('TITLE');
    this.app.ticker.add(this.tick);
    this.refreshContentWarning();
  }

  private readonly tick = (): void => {
    if (this.currentState === null) {
      return;
    }

    const frameDt = this.app.ticker.deltaMS / 1000;
    this.currentState.update(frameDt);
    this.updateDebugPanel();
  };

  private transitionTo(stateId: GameStateId, payload?: unknown): void {
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
    }

    this.currentState.onEnter(payload);
    this.app.stage.addChild(this.contentWarningText);
    this.app.stage.addChild(this.debugPanel.root);
  }

  private startNewRun(): void {
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    const mapState = generateMap(seed);

    const runState: RunState = {
      seed,
      currentNodeId: mapState.startNodeId,
      clearedNodeIds: [mapState.startNodeId],
      step: 0,
      difficultyTier: 1,
      restBonusBattles: 0,
    };

    for (let i = 0; i < mapState.nodes.length; i += 1) {
      const node = mapState.nodes[i];
      node.cleared = node.id === mapState.startNodeId;
    }

    this.campaignData = {
      runState,
      armyState: createStartingArmy(),
      mapState,
    };

    this.pendingScenario = null;
    this.lastBattleResult = null;

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
      mapState,
    };

    this.pendingScenario = null;
    this.lastBattleResult = null;

    return true;
  }

  private saveCampaignData(): void {
    if (this.campaignData === null) {
      return;
    }

    saveGame({
      runState: this.campaignData.runState,
      armyState: this.campaignData.armyState,
      mapState: this.campaignData.mapState,
    });
  }

  private clearSaveData(): void {
    clearSave();
  }

  private readonly onBeforeUnload = (): void => {
    this.saveCampaignData();
  };

  private readonly onGlobalKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'F1' || event.code === 'Backquote') {
      event.preventDefault();
      this.debugPanel.toggleVisible();
    }
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
    if (this.currentStateId === 'BATTLE') {
      this.restartCurrentBattle();
      return;
    }

    this.startNewRun();
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
}
