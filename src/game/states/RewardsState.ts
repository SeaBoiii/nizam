import { Container, Graphics, Text } from 'pixi.js';
import { contentManager } from '../../content/ContentManager';
import type { IGameState } from './IGameState';
import type { CampaignData, StateContext } from './StateContext';
import { getScaling } from '../../meta/Difficulty';
import { getCombinedPerkMods, getDeterministicPerkChoices, shouldOfferPerk } from '../../meta/Perks';
import type { BattleResult } from '../../meta/types';
import { TextButton } from '../../ui/widgets/TextButton';
import {
  archetypeChoices,
  archetypeDisplayName,
  canUpgradeSquad,
  upgradeCostForSquad,
  upgradeSquadTier,
} from '../../meta/Progression';
import { createSquadMeta } from '../../meta/Army';
import { SeededRng } from '../../utils/rng';
import { PerkChoice } from '../../ui/widgets/PerkChoice';
import { objectiveDisplayName } from '../../sim/objectives/ObjectiveTypes';
import { MENU_BODY_FONT, MENU_TITLE_FONT, drawMenuBackdrop, drawMenuCard } from '../../ui/theme/MenuTheme';

export class RewardsState implements IGameState {
  private readonly root = new Container();
  private readonly bg = new Graphics();
  private readonly panel = new Graphics();
  private readonly title = new Text({
    text: '',
    style: {
      fill: 0xf8e7b6,
      fontFamily: MENU_TITLE_FONT,
      fontSize: 40,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
  });
  private readonly summary = new Text({
    text: '',
    style: {
      fill: 0xe0ecff,
      fontFamily: MENU_BODY_FONT,
      fontSize: 16,
      lineHeight: 24,
    },
  });
  private readonly rewardInfo = new Text({
    text: '',
    style: {
      fill: 0xbfe0ff,
      fontFamily: MENU_BODY_FONT,
      fontSize: 15,
      lineHeight: 22,
    },
  });

  private readonly upgradeButton: TextButton;
  private readonly recruitButton: TextButton;
  private readonly continueButton: TextButton;
  private readonly perkChoice = new PerkChoice();

  private choiceTaken = false;
  private perkChoicePending = false;
  private allowBonusChoices = true;
  private returnToTitleOnContinue = false;
  private goToRunEndOnContinue = false;

  constructor(private readonly context: StateContext) {
    this.root.addChild(this.bg);
    this.root.addChild(this.panel);

    this.title.anchor.set(0.5, 0.5);
    this.summary.anchor.set(0.5, 0);
    this.rewardInfo.anchor.set(0.5, 0);

    this.upgradeButton = new TextButton({
      label: 'Upgrade Squad',
      variant: 'accent',
      onClick: () => this.applyUpgradeChoice(),
      width: 360,
    });

    this.recruitButton = new TextButton({
      label: 'Recruit New Squad',
      variant: 'secondary',
      onClick: () => this.applyRecruitChoice(),
      width: 360,
    });

    this.continueButton = new TextButton({
      label: 'Continue',
      variant: 'primary',
      onClick: () => {
        if (this.goToRunEndOnContinue) {
          this.context.transitionTo('RUN_END');
          return;
        }
        if (this.returnToTitleOnContinue) {
          this.context.clearSaveData();
          this.context.setCampaignData(null);
          this.context.transitionTo('TITLE');
          return;
        }
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
    this.root.addChild(this.perkChoice);
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
    this.perkChoicePending = false;
    this.allowBonusChoices = true;
    this.returnToTitleOnContinue = false;
    this.goToRunEndOnContinue = false;
    this.perkChoice.hide();

    const victory = resolvedResult.victory;
    const bossBattle = resolvedResult.scenario.nodeType === 'BOSS';
    const bossLoss = !victory && bossBattle;
    this.allowBonusChoices = victory && !bossBattle;
    this.goToRunEndOnContinue = bossBattle;
    this.returnToTitleOnContinue = false;
    this.continueButton.setLabel(bossBattle ? 'View Run Summary' : bossLoss ? 'Back To Title' : 'Continue');

    const alreadyRewarded = campaign.runState.lastRewardedNodeId === resolvedResult.scenario.nodeId;
    const scaling = getScaling(campaign.runState.step, campaign.runState.difficultyMode);
    const perkMods = getCombinedPerkMods(campaign.perkState.pickedPerkIds);
    const lossProtection = contentManager.getNodeTuning().lossProtection;

    let goldGain = 0;
    let recruitsGain = 0;
    let suppliesGain = 0;
    let fieldMedicBonus = 0;
    let consolationMultiplier = 1;

    if (!alreadyRewarded) {
      campaign.runState.battleNodesCleared += 1;
      campaign.runState.lastRewardedNodeId = resolvedResult.scenario.nodeId;
      const scaledGold = Math.round(resolvedResult.scenario.goldReward * scaling.rewardGoldMult);
      const scaledRecruits = Math.round(resolvedResult.scenario.recruitsReward * (0.95 + (scaling.rewardGoldMult - 1) * 0.8));

      fieldMedicBonus = Math.max(
        0,
        Math.round(resolvedResult.playerCasualties * perkMods.fieldMedicRecruitsPerCasualty),
      );

      if (victory) {
        campaign.runState.consecutiveLosses = 0;
        goldGain = scaledGold;
        recruitsGain = scaledRecruits;
      } else {
        campaign.runState.consecutiveLosses += 1;
        if (!bossLoss && lossProtection.enabled) {
          const cappedLosses = Math.min(
            campaign.runState.consecutiveLosses,
            Math.max(0, Math.floor(lossProtection.maxConsecutiveLossBoost)),
          );
          consolationMultiplier = 1 + 0.2 * cappedLosses;
          goldGain = Math.floor(
            scaledGold * Math.max(0, lossProtection.goldPctOfNormalReward) * consolationMultiplier,
          );
          recruitsGain = Math.floor(
            scaledRecruits * Math.max(0, lossProtection.recruitsPctOfNormalReward) * consolationMultiplier,
          );
          suppliesGain = Math.max(0, Math.floor(lossProtection.suppliesFlat));
        }
      }

      campaign.armyState.gold += goldGain;
      campaign.armyState.supplies += suppliesGain;
      campaign.armyState.recruits += recruitsGain + fieldMedicBonus;
    }

    if (resolvedResult.scenario.nodeType === 'BOSS') {
      this.context.markRunCompleted(victory ? 'WIN' : 'LOSS');
    }

    this.title.text = victory
      ? bossBattle
        ? 'Victory - Run Complete'
        : 'Victory Rewards'
      : bossLoss
        ? 'Defeat - Run Ends'
        : 'Defeat - You regroup and recover';

    const summaryLines = [
      `Outcome: ${victory ? 'Victory' : bossLoss ? 'Defeat (Boss)' : 'Defeat'}`,
      `Objective: ${objectiveDisplayName(resolvedResult.scenario.objectiveType)}`,
      `Player casualties: ${resolvedResult.playerCasualties}`,
      `Enemy casualties: ${resolvedResult.enemyCasualties}`,
      `Mode: ${campaign.runState.difficultyMode}`,
    ];
    if (!victory && !bossLoss && lossProtection.enabled) {
      summaryLines.push(`Consolation bonus x${consolationMultiplier.toFixed(1)}`);
    }
    this.summary.text = summaryLines.join('\n');

    if (alreadyRewarded) {
      this.rewardInfo.text = this.allowBonusChoices
        ? 'Rewards already claimed for this node.\nChoose one bonus:'
        : bossBattle
          ? `Boss ${victory ? 'victory' : 'defeat'} recorded.\nView run summary to finish.`
          : 'Rewards already claimed for this node.';
    } else if (victory && !bossBattle) {
      this.rewardInfo.text = `Gold +${goldGain}    Recruits +${recruitsGain}${
        fieldMedicBonus > 0 ? ` (+${fieldMedicBonus} Field Medic)` : ''
      }\nChoose one bonus:`;
    } else if (victory && bossBattle) {
      this.rewardInfo.text = `Gold +${goldGain}    Recruits +${recruitsGain}${
        fieldMedicBonus > 0 ? ` (+${fieldMedicBonus} Field Medic)` : ''
      }\nFinal score is ready. View run summary.`;
    } else if (bossLoss) {
      this.rewardInfo.text = 'The boss battle was lost. This run has ended.\nNo consolation rewards granted.';
    } else {
      this.rewardInfo.text = `Consolation: Gold +${goldGain}    Recruits +${recruitsGain}    Supplies +${suppliesGain}${
        fieldMedicBonus > 0 ? `\nField Medic recovered +${fieldMedicBonus} recruits.` : ''
      }\nConsolation Bonus x${consolationMultiplier.toFixed(1)}`;
    }

    if (!alreadyRewarded && this.allowBonusChoices) {
      this.maybeOfferPerk(campaign);
    }

    this.refreshButtons();
    this.layout();

    this.context.stage.addChild(this.root);
  }

  onExit(): void {
    this.perkChoice.hide();
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
    if (!this.allowBonusChoices || this.choiceTaken || this.perkChoicePending) {
      return;
    }

    const campaign = this.context.getCampaignData();
    if (campaign === null) {
      return;
    }

    let bestIndex = -1;
    let bestTier = Number.POSITIVE_INFINITY;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let i = 0; i < campaign.armyState.squads.length; i += 1) {
      const squad = campaign.armyState.squads[i];
      if (!canUpgradeSquad(squad)) {
        continue;
      }
      const cost = upgradeCostForSquad(squad);
      if (campaign.armyState.gold < cost) {
        continue;
      }

      if (squad.tier < bestTier || (squad.tier === bestTier && cost < bestCost)) {
        bestTier = squad.tier;
        bestCost = cost;
        bestIndex = i;
      }
    }

    if (bestIndex < 0) {
      return;
    }

    const upgradeCost = upgradeCostForSquad(campaign.armyState.squads[bestIndex]);
    campaign.armyState.gold = Math.max(0, campaign.armyState.gold - upgradeCost);
    upgradeSquadTier(campaign.armyState.squads[bestIndex]);
    this.choiceTaken = true;
    this.rewardInfo.text += `\nUpgraded ${campaign.armyState.squads[bestIndex].name ?? campaign.armyState.squads[bestIndex].id}${upgradeCost > 0 ? ` (-${upgradeCost}g)` : ''}.`;
    this.refreshButtons();
  }

  private applyRecruitChoice(): void {
    if (!this.allowBonusChoices || this.choiceTaken || this.perkChoicePending) {
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

    let hasUpgradeable = false;
    let lowestCost = Number.POSITIVE_INFINITY;
    if (campaign !== null) {
      for (let i = 0; i < campaign.armyState.squads.length; i += 1) {
        const squad = campaign.armyState.squads[i];
        if (!canUpgradeSquad(squad)) {
          continue;
        }
        const cost = upgradeCostForSquad(squad);
        lowestCost = Math.min(lowestCost, cost);
        if (campaign.armyState.gold >= cost) {
          hasUpgradeable = true;
        }
      }
    }

    if (Number.isFinite(lowestCost)) {
      this.upgradeButton.setLabel(lowestCost > 0 ? `Upgrade Squad (${lowestCost}g+)` : 'Upgrade Squad');
    } else {
      this.upgradeButton.setLabel('Upgrade Squad');
    }

    const canUseChoices = !this.perkChoicePending && this.allowBonusChoices;
    this.upgradeButton.setEnabled(canUseChoices && !this.choiceTaken && hasUpgradeable);
    this.recruitButton.setEnabled(canUseChoices && !this.choiceTaken);
    this.continueButton.setEnabled(canUseChoices ? this.choiceTaken || !hasUpgradeable : !this.perkChoicePending);
  }

  private layout(): void {
    const width = this.context.app.screen.width;
    const height = this.context.app.screen.height;
    const panelWidth = Math.min(920, width - 40);
    const panelHeight = Math.min(610, height - 40);
    const panelX = width * 0.5 - panelWidth * 0.5;
    const panelY = height * 0.5 - panelHeight * 0.5;

    drawMenuBackdrop(this.bg, width, height);
    drawMenuCard(this.panel, panelX, panelY, panelWidth, panelHeight);

    this.summary.style.wordWrap = true;
    this.summary.style.wordWrapWidth = panelWidth - 84;
    this.rewardInfo.style.wordWrap = true;
    this.rewardInfo.style.wordWrapWidth = panelWidth - 84;

    this.title.position.set(width * 0.5, panelY + 52);
    this.summary.position.set(width * 0.5, panelY + 94);
    this.rewardInfo.position.set(width * 0.5, panelY + 214);

    this.upgradeButton.position.set(width * 0.5 - 180, panelY + panelHeight - 186);
    this.recruitButton.position.set(width * 0.5 - 180, panelY + panelHeight - 130);
    this.continueButton.position.set(width * 0.5 - 110, panelY + panelHeight - 62);
    this.perkChoice.resize(width, height);
  }

  private maybeOfferPerk(campaign: CampaignData): void {
    const rewardRules = contentManager.getPerkRewardRules();
    if (!shouldOfferPerk(campaign.runState, rewardRules, campaign.perkState)) {
      return;
    }

    const choices = getDeterministicPerkChoices(
      campaign.runState,
      campaign.perkState,
      rewardRules.choices,
      contentManager.getPerkPool(),
    );
    if (choices.length === 0) {
      campaign.perkState.lastOfferedAtBattleCount = campaign.runState.battleNodesCleared;
      return;
    }

    this.context.markPerkOffered(choices.length);
    this.perkChoicePending = true;
    this.perkChoice.show(choices, (perkId) => this.applyPerkChoice(perkId), this.context.app.screen.width, this.context.app.screen.height);
  }

  private applyPerkChoice(perkId: string): void {
    const campaign = this.context.getCampaignData();
    if (campaign === null || !this.perkChoicePending) {
      return;
    }

    if (!campaign.perkState.pickedPerkIds.includes(perkId)) {
      campaign.perkState.pickedPerkIds.push(perkId);
    }
    this.context.markPerkPicked(perkId);
    campaign.perkState.lastOfferedAtBattleCount = campaign.runState.battleNodesCleared;
    const perk = contentManager.getPerk(perkId);
    this.rewardInfo.text += `\nPerk selected: ${perk ? perk.name : perkId}.`;

    this.perkChoicePending = false;
    this.perkChoice.hide();
    this.refreshButtons();
  }
}
