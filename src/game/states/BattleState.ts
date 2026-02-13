import { Container } from 'pixi.js';
import { BattleScene } from '../BattleScene';
import { getCombinedPerkMods } from '../../meta/Perks';
import { getDefaultSettings, type GameSettings } from '../../meta/Settings';
import type { IGameState } from './IGameState';
import type { StateContext } from './StateContext';
import type { BattleScenario } from '../../meta/types';

export class BattleState implements IGameState {
  private readonly root = new Container();
  private battleScene: BattleScene | null = null;
  private currentSettings: GameSettings = getDefaultSettings();

  constructor(private readonly context: StateContext) {}

  onEnter(payload?: unknown): void {
    const campaign = this.context.getCampaignData();
    if (campaign === null) {
      this.context.transitionTo('TITLE');
      return;
    }

    const scenario = this.resolveScenario(payload);
    if (scenario === null) {
      this.context.transitionTo('OVERWORLD');
      return;
    }
    this.context.setPendingScenario(scenario);

    this.context.stage.addChild(this.root);

    this.battleScene = new BattleScene({
      app: this.context.app,
      parent: this.root,
      scenario,
      armyState: campaign.armyState,
      playerPerkMods: getCombinedPerkMods(campaign.perkState.pickedPerkIds),
      settings: this.currentSettings,
      onFinished: (result) => {
        this.context.setLastBattleResult(result);
        this.context.transitionTo('REWARDS', result);
      },
    });
  }

  onExit(): void {
    if (this.battleScene !== null) {
      this.battleScene.destroy();
      this.battleScene = null;
    }

    this.root.removeFromParent();
    this.root.removeChildren();
  }

  update(dt: number): void {
    if (this.battleScene !== null) {
      this.battleScene.update(dt);
    }
  }

  setPaused(paused: boolean): void {
    if (this.battleScene !== null) {
      this.battleScene.setPaused(paused);
    }
  }

  applySettings(settings: GameSettings): void {
    this.currentSettings = settings;
    if (this.battleScene !== null) {
      this.battleScene.applySettings(settings);
    }
  }

  private resolveScenario(payload: unknown): BattleScenario | null {
    if (payload && typeof payload === 'object' && 'scenario' in payload) {
      const candidate = (payload as { scenario?: BattleScenario }).scenario;
      if (candidate) {
        return candidate;
      }
    }

    const pending = this.context.getPendingScenario();
    if (pending !== null) {
      return pending;
    }

    return null;
  }
}
