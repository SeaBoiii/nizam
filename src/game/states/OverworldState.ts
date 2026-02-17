import { Container, Graphics, Text } from 'pixi.js';
import type { GameSettings } from '../../meta/Settings';
import type { IGameState } from './IGameState';
import type { StateContext } from './StateContext';
import type { MapState, Node, NodeType } from '../../overworld/types';
import { createScenario, objectivePreviewLabel } from '../../meta/ScenarioFactory';
import { TextButton } from '../../ui/widgets/TextButton';
import { archetypeChoices, archetypeDisplayName } from '../../meta/Progression';
import { createSquadMeta } from '../../meta/Army';
import { contentManager } from '../../content/ContentManager';
import { SeededRng } from '../../utils/rng';

const MAP_OFFSET_X = 120;
const MAP_OFFSET_Y = 120;
const MAP_WIDTH = 980;
const MAP_HEIGHT = 560;
const NODE_RADIUS = 16;

function nodeTypeColor(type: NodeType): number {
  switch (type) {
    case 'BATTLE':
      return 0xe6b35f;
    case 'SHOP':
      return 0x78d39d;
    case 'RECRUIT':
      return 0x7fc0ff;
    case 'REST':
      return 0xb794f6;
    case 'ELITE':
      return 0xff8a66;
    case 'BOSS':
      return 0xff5d5d;
  }
}

function isBattleNode(type: NodeType): boolean {
  return type === 'BATTLE' || type === 'ELITE' || type === 'BOSS';
}

function nodeRewardHint(type: NodeType): string {
  const rewards = contentManager.getNodeTuning().rewardsByNodeType[type];
  const rewardText = `Gold ${rewards.gold.min}-${rewards.gold.max}, Recruits ${rewards.recruits.min}-${rewards.recruits.max}`;
  switch (type) {
    case 'BATTLE':
      return `Skirmish rewards: ${rewardText}`;
    case 'ELITE':
      return `Elite rewards: ${rewardText}`;
    case 'BOSS':
      return `Boss rewards: ${rewardText}`;
    case 'SHOP':
      return 'Spend gold on army improvements';
    case 'RECRUIT':
      return 'Gain recruits and optional new squad';
    case 'REST':
      return 'Recover supplies and rest bonus';
  }
}

export class OverworldState implements IGameState {
  private readonly root = new Container();
  private readonly bg = new Graphics();
  private readonly mapGraphics = new Graphics();
  private readonly panel = new Container();

  private readonly titleText = new Text({
    text: 'Overworld',
    style: {
      fill: 0xf4e0b4,
      fontFamily: 'monospace',
      fontSize: 26,
      fontWeight: 'bold',
    },
  });
  private readonly topBarText = new Text({
    text: '',
    style: {
      fill: 0xd4e7ff,
      fontFamily: 'monospace',
      fontSize: 15,
    },
  });
  private readonly tooltipText = new Text({
    text: '',
    style: {
      fill: 0xf0e0bf,
      fontFamily: 'monospace',
      fontSize: 14,
    },
  });

  private readonly panelBg = new Graphics();
  private readonly panelTitle = new Text({
    text: '',
    style: {
      fill: 0xf8e8c0,
      fontFamily: 'monospace',
      fontSize: 22,
      fontWeight: 'bold',
    },
  });
  private readonly panelBody = new Text({
    text: '',
    style: {
      fill: 0xd6e7ff,
      fontFamily: 'monospace',
      fontSize: 16,
    },
  });

  private readonly backButton: TextButton;
  private readonly panelButtons: TextButton[] = [];

  private hoveredNodeId: string | null = null;
  private paused = false;

  constructor(private readonly context: StateContext) {
    this.root.addChild(this.bg);
    this.root.addChild(this.mapGraphics);

    this.root.addChild(this.titleText);
    this.root.addChild(this.topBarText);
    this.root.addChild(this.tooltipText);

    this.panel.addChild(this.panelBg);
    this.panelTitle.anchor.set(0.5, 0.5);
    this.panelBody.anchor.set(0.5, 0);
    this.panel.addChild(this.panelTitle);
    this.panel.addChild(this.panelBody);
    this.panel.visible = false;
    this.root.addChild(this.panel);

    this.backButton = new TextButton({
      label: 'Back To Title',
      width: 170,
      height: 36,
      onClick: () => {
        this.context.transitionTo('TITLE');
      },
    });
    this.root.addChild(this.backButton);
  }

  onEnter(): void {
    const campaign = this.context.getCampaignData();
    if (campaign === null) {
      this.context.transitionTo('TITLE');
      return;
    }

    this.context.stage.addChild(this.root);
    this.bindInput();
    this.closeNodePanel();
    this.layout();
    this.refreshText(campaign.mapState);
  }

  onExit(): void {
    this.unbindInput();
    this.root.removeFromParent();
    this.closeNodePanel();
    this.hoveredNodeId = null;
  }

  update(): void {
    const campaign = this.context.getCampaignData();
    if (campaign === null) {
      return;
    }

    this.layout();
    this.refreshText(campaign.mapState);
    this.drawMap(campaign.mapState);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  applySettings(_settings: GameSettings): void {}

  private bindInput(): void {
    const canvas = this.context.app.canvas;
    window.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('resize', this.onResize);
  }

  private unbindInput(): void {
    const canvas = this.context.app.canvas;
    window.removeEventListener('mousemove', this.onMouseMove);
    canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('resize', this.onResize);
  }

  private readonly onResize = (): void => {
    this.layout();
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (this.paused) {
      return;
    }
    const campaign = this.context.getCampaignData();
    if (campaign === null) {
      return;
    }

    const point = this.toCanvasPoint(event.clientX, event.clientY);
    const hovered = this.findNodeAt(campaign.mapState, point.x, point.y);
    this.hoveredNodeId = hovered ? hovered.id : null;
  };

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (this.paused) {
      return;
    }
    if (event.button !== 0 || this.panel.visible) {
      return;
    }

    const campaign = this.context.getCampaignData();
    if (campaign === null) {
      return;
    }

    const point = this.toCanvasPoint(event.clientX, event.clientY);
    const clicked = this.findNodeAt(campaign.mapState, point.x, point.y);
    if (clicked === null || !this.isSelectable(campaign.mapState, clicked.id)) {
      return;
    }

    this.advanceToNode(clicked);
  };

  private advanceToNode(node: Node): void {
    const campaign = this.context.getCampaignData();
    if (campaign === null) {
      return;
    }

    const runState = campaign.runState;
    const armyState = campaign.armyState;
    if (!node.cleared) {
      node.cleared = true;
      runState.step += 1;
      runState.difficultyTier = 1 + Math.floor(runState.step / 3);
      if (!runState.clearedNodeIds.includes(node.id)) {
        runState.clearedNodeIds.push(node.id);
      }
    }
    this.context.recordDiagnosticEvent('NODE_ENTERED', {
      nodeId: node.id,
      nodeType: node.type,
      step: runState.step,
      difficulty: runState.difficultyMode,
    });

    if (isBattleNode(node.type)) {
      const scenario = createScenario(node.id, node.type, runState, armyState);
      runState.currentNodeId = node.id;
      runState.lastObjectiveType = scenario.objectiveType;
      runState.lastMapId = scenario.mapId;
      if (runState.restBonusBattles > 0) {
        runState.restBonusBattles = Math.max(0, runState.restBonusBattles - 1);
      }
      this.context.setPendingScenario(scenario);
      this.context.transitionTo('BATTLE', { scenario });
      return;
    }

    runState.currentNodeId = node.id;

    switch (node.type) {
      case 'SHOP':
        this.openShopPanel();
        break;
      case 'RECRUIT':
        this.openRecruitPanel();
        break;
      case 'REST':
        this.openRestPanel();
        break;
      default:
        this.openSimplePanel(node.type, 'Nothing happened at this node.', 'Continue');
        break;
    }
  }

  private openShopPanel(): void {
    const campaign = this.context.getCampaignData();
    if (campaign === null) {
      return;
    }
    const tuning = contentManager.getNodeTuning();
    const shop = tuning.shop;

    this.preparePanel('Shop', 'Spend gold to improve your warband.');

    const buySizeButton = this.addPanelButton(
      `Buy +${shop.sizeUpgradeAmount} squad size (${shop.sizeUpgradeCost}g)`,
      () => {
        if (campaign.armyState.gold < shop.sizeUpgradeCost) {
          this.panelBody.text = 'Not enough gold for squad expansion.';
          return;
        }

        let targetIndex = 0;
        for (let i = 1; i < campaign.armyState.squads.length; i += 1) {
          if (campaign.armyState.squads[i].size < campaign.armyState.squads[targetIndex].size) {
            targetIndex = i;
          }
        }

        campaign.armyState.gold -= shop.sizeUpgradeCost;
        campaign.armyState.squads[targetIndex].size += shop.sizeUpgradeAmount;
        this.panelBody.text = 'Purchased squad expansion.';
        this.refreshText(campaign.mapState);
      },
    );
    buySizeButton.setEnabled(campaign.armyState.gold >= shop.sizeUpgradeCost);

    const buySuppliesButton = this.addPanelButton(`Buy supplies +${shop.suppliesAmount} (${shop.suppliesCost}g)`, () => {
      if (campaign.armyState.gold < shop.suppliesCost) {
        this.panelBody.text = 'Not enough gold for supplies.';
        return;
      }

      campaign.armyState.gold -= shop.suppliesCost;
      campaign.armyState.supplies += shop.suppliesAmount;
      this.panelBody.text = 'Purchased supplies.';
      this.refreshText(campaign.mapState);
    });
    buySuppliesButton.setEnabled(campaign.armyState.gold >= shop.suppliesCost);

    this.addPanelButton('Leave Shop', () => this.closeNodePanel());
  }

  private openRecruitPanel(): void {
    const campaign = this.context.getCampaignData();
    if (campaign === null) {
      return;
    }
    const recruitTuning = contentManager.getNodeTuning().recruit;

    const recruitsGain =
      recruitTuning.baseRecruits +
      Math.min(recruitTuning.recruitsBonusCap, campaign.runState.difficultyTier * recruitTuning.recruitsPerDifficulty);
    campaign.armyState.recruits += recruitsGain;

    this.preparePanel('Recruit Camp', `Recruits gained: +${recruitsGain}`);

    const discountButton = this.addPanelButton(`Hire new squad (${recruitTuning.discountHireCost}g)`, () => {
      if (campaign.armyState.gold < recruitTuning.discountHireCost) {
        this.panelBody.text = `Recruits gained: +${recruitsGain}\nNeed more gold.`;
        return;
      }

      const rng = new SeededRng((campaign.runState.seed ^ campaign.runState.step * 73856093) >>> 0);
      const archetypeId = rng.pick(archetypeChoices());
      const size = rng.int(recruitTuning.discountSizeMin, recruitTuning.discountSizeMax);

      campaign.armyState.gold -= recruitTuning.discountHireCost;
      campaign.armyState.squads.push(
        createSquadMeta(campaign.armyState, archetypeId, size, 1, `${archetypeDisplayName(archetypeId)} Scouts`),
      );

      this.panelBody.text = `Recruits gained: +${recruitsGain}\nHired ${archetypeDisplayName(archetypeId)} (${size}).`;
      this.refreshText(campaign.mapState);
      discountButton.setEnabled(false);
    });
    discountButton.setEnabled(campaign.armyState.gold >= recruitTuning.discountHireCost);

    this.addPanelButton('Continue', () => this.closeNodePanel());
    this.refreshText(campaign.mapState);
  }

  private openRestPanel(): void {
    const campaign = this.context.getCampaignData();
    if (campaign === null) {
      return;
    }
    const restTuning = contentManager.getNodeTuning().rest;

    campaign.armyState.supplies += restTuning.suppliesGain;
    campaign.runState.restBonusBattles = restTuning.restBonusBattles;

    this.preparePanel('Rest Stop', `Supplies +${restTuning.suppliesGain}\nNext battle: +8% unit HP bonus.`);
    this.addPanelButton('Continue', () => this.closeNodePanel());
    this.refreshText(campaign.mapState);
  }

  private openSimplePanel(title: string, body: string, buttonLabel: string): void {
    this.preparePanel(title, body);
    this.addPanelButton(buttonLabel, () => this.closeNodePanel());
  }

  private preparePanel(title: string, body: string): void {
    this.closeNodePanelButtons();

    this.panel.visible = true;
    this.panelTitle.text = title;
    this.panelBody.text = body;

    this.layoutPanel();
  }

  private addPanelButton(label: string, onClick: () => void): TextButton {
    const button = new TextButton({
      label,
      width: 320,
      onClick,
    });
    this.panelButtons.push(button);
    this.panel.addChild(button);
    this.layoutPanel();
    return button;
  }

  private closeNodePanel(): void {
    this.panel.visible = false;
    this.closeNodePanelButtons();
  }

  private closeNodePanelButtons(): void {
    for (let i = 0; i < this.panelButtons.length; i += 1) {
      this.panelButtons[i].destroy({ children: true });
    }
    this.panelButtons.length = 0;
  }

  private refreshText(mapState: MapState): void {
    const campaign = this.context.getCampaignData();
    if (campaign === null) {
      return;
    }

    const current = this.getNodeById(mapState, campaign.runState.currentNodeId);
    const currentType = current ? current.type : 'UNKNOWN';

    this.topBarText.text = [
      `Gold: ${campaign.armyState.gold}`,
      `Supplies: ${campaign.armyState.supplies}`,
      `Recruits: ${campaign.armyState.recruits}`,
      `Current Node: ${currentType}`,
      `Mode: ${campaign.runState.difficultyMode}`,
      `Pack: ${contentManager.getStatus().loadedPackName}`,
      `Tier: ${campaign.runState.difficultyTier}`,
    ].join('    ');

    if (this.hoveredNodeId) {
      const node = this.getNodeById(mapState, this.hoveredNodeId);
      if (node) {
        if (isBattleNode(node.type)) {
          const objectiveLabel = objectivePreviewLabel(node.id, node.type, campaign.runState);
          const preview = createScenario(node.id, node.type, campaign.runState, campaign.armyState);
          const map = contentManager.getMap(preview.mapId);
          const mapLabel = map ? map.name : preview.mapId;
          this.tooltipText.text = `${node.type} (${objectiveLabel}) [${mapLabel}] - ${nodeRewardHint(node.type)}`;
        } else {
          this.tooltipText.text = `${node.type} - ${nodeRewardHint(node.type)}`;
        }
      } else {
        this.tooltipText.text = '';
      }
    } else {
      this.tooltipText.text = '';
    }
  }

  private drawMap(mapState: MapState): void {
    this.mapGraphics.clear();

    this.mapGraphics.roundRect(MAP_OFFSET_X - 26, MAP_OFFSET_Y - 26, MAP_WIDTH + 52, MAP_HEIGHT + 52, 12);
    this.mapGraphics.fill({ color: 0x101826, alpha: 0.92 });
    this.mapGraphics.stroke({ color: 0x567aa0, alpha: 0.8, width: 1.5 });

    for (let i = 0; i < mapState.nodes.length; i += 1) {
      const node = mapState.nodes[i];
      const fromX = MAP_OFFSET_X + node.x;
      const fromY = MAP_OFFSET_Y + node.y;

      for (let edgeIndex = 0; edgeIndex < node.edges.length; edgeIndex += 1) {
        const target = this.getNodeById(mapState, node.edges[edgeIndex]);
        if (!target) {
          continue;
        }

        const toX = MAP_OFFSET_X + target.x;
        const toY = MAP_OFFSET_Y + target.y;

        this.mapGraphics.moveTo(fromX, fromY);
        this.mapGraphics.lineTo(toX, toY);
        this.mapGraphics.stroke({ color: 0x607d9b, alpha: 0.44, width: 1.2 });
      }
    }

    for (let i = 0; i < mapState.nodes.length; i += 1) {
      const node = mapState.nodes[i];
      const x = MAP_OFFSET_X + node.x;
      const y = MAP_OFFSET_Y + node.y;

      const selectable = this.isSelectable(mapState, node.id);
      const isCurrent = this.context.getCampaignData()?.runState.currentNodeId === node.id;
      const isHovered = this.hoveredNodeId === node.id;

      const baseColor = nodeTypeColor(node.type);
      const alpha = node.cleared ? 0.28 : 0.9;

      this.mapGraphics.circle(x, y, NODE_RADIUS);
      this.mapGraphics.fill({ color: baseColor, alpha });

      this.mapGraphics.circle(x, y, NODE_RADIUS);
      this.mapGraphics.stroke({ color: 0x17202a, alpha: 0.9, width: 2 });

      if (selectable) {
        this.mapGraphics.circle(x, y, NODE_RADIUS + 4);
        this.mapGraphics.stroke({ color: 0xffe59c, alpha: 0.95, width: 1.6 });
      }

      if (isCurrent) {
        this.mapGraphics.circle(x, y, NODE_RADIUS + 7);
        this.mapGraphics.stroke({ color: 0xdaf0ff, alpha: 0.95, width: 2.2 });
      }

      if (isHovered) {
        this.mapGraphics.circle(x, y, NODE_RADIUS + 9);
        this.mapGraphics.stroke({ color: 0xffffff, alpha: 0.7, width: 1.3 });
      }
    }
  }

  private getNodeById(mapState: MapState, id: string): Node | null {
    for (let i = 0; i < mapState.nodes.length; i += 1) {
      if (mapState.nodes[i].id === id) {
        return mapState.nodes[i];
      }
    }
    return null;
  }

  private findNodeAt(mapState: MapState, x: number, y: number): Node | null {
    let nearest: Node | null = null;
    let nearestSq = (NODE_RADIUS + 8) * (NODE_RADIUS + 8);

    for (let i = 0; i < mapState.nodes.length; i += 1) {
      const node = mapState.nodes[i];
      const dx = x - (MAP_OFFSET_X + node.x);
      const dy = y - (MAP_OFFSET_Y + node.y);
      const distSq = dx * dx + dy * dy;

      if (distSq <= nearestSq) {
        nearestSq = distSq;
        nearest = node;
      }
    }

    return nearest;
  }

  private isSelectable(mapState: MapState, nodeId: string): boolean {
    const campaign = this.context.getCampaignData();
    if (campaign === null) {
      return false;
    }

    const current = this.getNodeById(mapState, campaign.runState.currentNodeId);
    if (!current) {
      return false;
    }

    for (let i = 0; i < current.edges.length; i += 1) {
      if (current.edges[i] !== nodeId) {
        continue;
      }

      const node = this.getNodeById(mapState, nodeId);
      return node !== null && !node.cleared;
    }

    return false;
  }

  private layout(): void {
    const width = this.context.app.screen.width;
    const height = this.context.app.screen.height;

    this.bg.clear();
    this.bg.rect(0, 0, width, height);
    this.bg.fill({ color: 0x0f1720, alpha: 1 });

    this.titleText.position.set(16, 18);
    this.topBarText.position.set(16, 56);
    this.tooltipText.position.set(16, height - 34);

    this.backButton.position.set(width - 188, 18);

    this.layoutPanel();
  }

  private layoutPanel(): void {
    if (!this.panel.visible) {
      return;
    }

    const width = this.context.app.screen.width;
    const height = this.context.app.screen.height;

    const panelWidth = 460;
    const panelHeight = 270;
    const panelX = width * 0.5 - panelWidth * 0.5;
    const panelY = height * 0.5 - panelHeight * 0.5;

    this.panel.position.set(panelX, panelY);

    this.panelBg.clear();
    this.panelBg.roundRect(0, 0, panelWidth, panelHeight, 10);
    this.panelBg.fill({ color: 0x111b28, alpha: 0.96 });
    this.panelBg.stroke({ color: 0x6e9bc9, alpha: 0.95, width: 1.6 });

    this.panelTitle.position.set(panelWidth * 0.5, 34);
    this.panelBody.position.set(panelWidth * 0.5, 64);

    for (let i = 0; i < this.panelButtons.length; i += 1) {
      this.panelButtons[i].position.set(panelWidth * 0.5 - 160, 128 + i * 54);
    }
  }

  private toCanvasPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.context.app.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }
}
