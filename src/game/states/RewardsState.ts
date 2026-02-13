import { Container, Graphics, Text } from 'pixi.js';
import type { IGameState } from './IGameState';
import type { StateContext } from './StateContext';
import type { BattleResult } from '../../meta/types';
import { TextButton } from '../../ui/widgets/TextButton';
import { archetypeChoices, archetypeDisplayName, canUpgradeSquad, upgradeSquadTier } from '../../meta/Progression';
import { createSquadMeta } from '../../meta/Army';
import { SeededRng } from '../../utils/rng';

export class RewardsState implements IGameState {
  private readonly root = new Container();
  private readonly bg = new Graphics();
  private readonly title = new Text({
    text: '',
    style: {
      fill: 0xf8e7b6,
      fontFamily: 'monospace',
      fontSize: 42,
      fontWeight: 'bold',
    },
  });
  private readonly summary = new Text({
    text: '',
    style: {
      fill: 0xe0ecff,
      fontFamily: 'monospace',
      fontSize: 18,
    },
  });
  private readonly rewardInfo = new Text({
    text: '',
    style: {
      fill: 0xbfe0ff,
      fontFamily: 'monospace',
      fontSize: 16,
    },
  });

  private readonly upgradeButton: TextButton;
  private readonly recruitButton: TextButton;
  private readonly continueButton: TextButton;

  private choiceTaken = false;

  constructor(private readonly context: StateContext) {
    this.root.addChild(this.bg);

    this.title.anchor.set(0.5, 0.5);
    this.summary.anchor.set(0.5, 0);
    this.rewardInfo.anchor.set(0.5, 0);

    this.upgradeButton = new TextButton({
      label: 'Upgrade Squad',
      onClick: () => this.applyUpgradeChoice(),
      width: 360,
    });

    this.recruitButton = new TextButton({
      label: 'Recruit New Squad',
      onClick: () => this.applyRecruitChoice(),
      width: 360,
    });

    this.continueButton = new TextButton({
      label: 'Continue',
      onClick: () => {
        this.context.transitionTo('OVERWORLD');
      },
      width: 220,
    });

    this.root.addChild(this.title);
    this.root.addChild(this.summary);
    this.root.addChild(this.rewardInfo);
    this.root.addChild(this.upgradeButton);
    this.root.addChild(this.recruitButton);
    this.root.addChild(this.continueButton);
  }

  onEnter(payload?: unknown): void {
    const campaign = this.context.getCampaignData();
    if (campaign === null) {
      this.context.transitionTo('TITLE');
      return;
    }

    const resolvedResult = this.resolveResult(payload);
    if (resolvedResult === null) {
      this.context.transitionTo('OVERWORLD');
      return;
    }

    this.choiceTaken = false;

    const victory = resolvedResult.victory;
    const goldGain = victory ? resolvedResult.scenario.goldReward : Math.round(resolvedResult.scenario.goldReward * 0.45);
    const recruitsGain =
      victory ? resolvedResult.scenario.recruitsReward : Math.max(3, Math.round(resolvedResult.scenario.recruitsReward * 0.5));

    campaign.armyState.gold += goldGain;
    campaign.armyState.recruits += recruitsGain;

    this.title.text = victory ? 'Victory Rewards' : 'Defeat Spoils';
    this.summary.text = [
      `Outcome: ${victory ? 'Victory' : 'Defeat'}`,
      `Player casualties: ${resolvedResult.playerCasualties}`,
      `Enemy casualties: ${resolvedResult.enemyCasualties}`,
    ].join('\n');
    this.rewardInfo.text = `Gold +${goldGain}    Recruits +${recruitsGain}\nChoose one bonus:`;

    this.refreshButtons();
    this.layout();

    this.context.stage.addChild(this.root);
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

  private resolveResult(payload: unknown): BattleResult | null {
    if (payload && typeof payload === 'object' && 'victory' in payload) {
      return payload as BattleResult;
    }

    const stored = this.context.getLastBattleResult();
    if (stored) {
      return stored;
    }

    return null;
  }

  private applyUpgradeChoice(): void {
    if (this.choiceTaken) {
      return;
    }

    const campaign = this.context.getCampaignData();
    if (campaign === null) {
      return;
    }

    let bestIndex = -1;
    let bestTier = Number.POSITIVE_INFINITY;
    for (let i = 0; i < campaign.armyState.squads.length; i += 1) {
      const squad = campaign.armyState.squads[i];
      if (!canUpgradeSquad(squad)) {
        continue;
      }

      if (squad.tier < bestTier) {
        bestTier = squad.tier;
        bestIndex = i;
      }
    }

    if (bestIndex < 0) {
      return;
    }

    upgradeSquadTier(campaign.armyState.squads[bestIndex]);
    this.choiceTaken = true;
    this.rewardInfo.text += `\nUpgraded ${campaign.armyState.squads[bestIndex].name ?? campaign.armyState.squads[bestIndex].id}.`;
    this.refreshButtons();
  }

  private applyRecruitChoice(): void {
    if (this.choiceTaken) {
      return;
    }

    const campaign = this.context.getCampaignData();
    if (campaign === null) {
      return;
    }

    const rngSeed = (campaign.runState.seed ^ (campaign.runState.step * 1103515245)) >>> 0;
    const rng = new SeededRng(rngSeed);
    const archetypeId = rng.pick(archetypeChoices());
    const size = rng.int(18, 22);

    const squad = createSquadMeta(
      campaign.armyState,
      archetypeId,
      size,
      1,
      `${archetypeDisplayName(archetypeId)} Recruits`,
    );
    campaign.armyState.squads.push(squad);

    this.choiceTaken = true;
    this.rewardInfo.text += `\nRecruited ${archetypeDisplayName(archetypeId)} squad (${size}).`;
    this.refreshButtons();
  }

  private refreshButtons(): void {
    const campaign = this.context.getCampaignData();

    const hasUpgradeable =
      campaign !== null && campaign.armyState.squads.some((squad) => canUpgradeSquad(squad));

    this.upgradeButton.setEnabled(!this.choiceTaken && hasUpgradeable);
    this.recruitButton.setEnabled(!this.choiceTaken);
    this.continueButton.setEnabled(this.choiceTaken || !hasUpgradeable);
  }

  private layout(): void {
    const width = this.context.app.screen.width;
    const height = this.context.app.screen.height;

    this.bg.clear();
    this.bg.rect(0, 0, width, height);
    this.bg.fill({ color: 0x101722, alpha: 1 });

    this.title.position.set(width * 0.5, 96);
    this.summary.position.set(width * 0.5, 150);
    this.rewardInfo.position.set(width * 0.5, 270);

    this.upgradeButton.position.set(width * 0.5 - 180, 365);
    this.recruitButton.position.set(width * 0.5 - 180, 423);
    this.continueButton.position.set(width * 0.5 - 110, 500);
  }
}
