import { Application } from 'pixi.js';
import { createStartingArmy } from '../meta/Army';
import { clearSave, hasSave, loadGame, saveGame } from '../meta/Save';
import type { BattleResult, BattleScenario } from '../meta/types';
import { generateMap } from '../overworld/generateMap';
import type { RunState } from '../overworld/types';
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

    this.transitionTo('TITLE');
    this.app.ticker.add(this.tick);
  }

  private readonly tick = (): void => {
    if (this.currentState === null) {
      return;
    }

    const frameDt = this.app.ticker.deltaMS / 1000;
    this.currentState.update(frameDt);
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

    for (let i = 0; i < mapState.nodes.length; i += 1) {
      const node = mapState.nodes[i];
      node.cleared = runState.clearedNodeIds.includes(node.id);
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
}