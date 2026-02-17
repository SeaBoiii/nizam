import { Container, Graphics, Text } from 'pixi.js';
import type { ContentLoadStatus, ContentPackManifestEntry } from '../../content/ContentTypes';
import { DifficultyMode } from '../../meta/Difficulty';
import { TextButton } from '../../ui/widgets/TextButton';
import type { IGameState } from './IGameState';
import type { StateContext } from './StateContext';

export class TitleState implements IGameState {
  private readonly root = new Container();
  private readonly bg = new Graphics();
  private readonly title = new Text({
    text: 'NIZAM',
    style: {
      fill: 0xf3e2b2,
      fontFamily: 'monospace',
      fontSize: 86,
      fontWeight: 'bold',
    },
  });
  private readonly subtitle = new Text({
    text: 'Bannerlord-lite Campaign',
    style: {
      fill: 0xcad8ec,
      fontFamily: 'monospace',
      fontSize: 20,
    },
  });
  private readonly status = new Text({
    text: '',
    style: {
      fill: 0x9fc2e9,
      fontFamily: 'monospace',
      fontSize: 14,
    },
  });
  private readonly difficultyText = new Text({
    text: '',
    style: {
      fill: 0xf1d79d,
      fontFamily: 'monospace',
      fontSize: 16,
    },
  });
  private readonly packHeaderText = new Text({
    text: 'Content Pack',
    style: {
      fill: 0xf1d79d,
      fontFamily: 'monospace',
      fontSize: 16,
    },
  });
  private readonly packNameText = new Text({
    text: '',
    style: {
      fill: 0xe7f2ff,
      fontFamily: 'monospace',
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
  private readonly packDescText = new Text({
    text: '',
    style: {
      fill: 0xb8d3f2,
      fontFamily: 'monospace',
      fontSize: 13,
      wordWrap: true,
      wordWrapWidth: 520,
    },
  });
  private readonly packStatusText = new Text({
    text: '',
    style: {
      fill: 0xffc98d,
      fontFamily: 'monospace',
      fontSize: 12,
      wordWrap: true,
      wordWrapWidth: 620,
    },
  });

  private readonly newRunButton: TextButton;
  private readonly continueButton: TextButton;
  private readonly clearButton: TextButton;
  private readonly statsButton: TextButton;
  private readonly normalButton: TextButton;
  private readonly hardButton: TextButton;
  private readonly packPrevButton: TextButton;
  private readonly packNextButton: TextButton;

  private selectedDifficulty = DifficultyMode.NORMAL;
  private availablePacks: ContentPackManifestEntry[] = [];
  private selectedPackIndex = 0;
  private loadingPack = false;
  private mounted = false;

  constructor(private readonly context: StateContext) {
    this.root.addChild(this.bg);

    this.title.anchor.set(0.5, 0.5);
    this.subtitle.anchor.set(0.5, 0.5);
    this.status.anchor.set(0.5, 0.5);
    this.packHeaderText.anchor.set(0.5, 0.5);
    this.packNameText.anchor.set(0.5, 0.5);
    this.packDescText.anchor.set(0.5, 0.5);
    this.packStatusText.anchor.set(0.5, 0.5);

    this.newRunButton = new TextButton({
      label: 'New Run',
      onClick: () => {
        if (this.loadingPack) {
          return;
        }
        this.context.startNewRun(this.selectedDifficulty);
        this.context.transitionTo('OVERWORLD');
      },
    });

    this.continueButton = new TextButton({
      label: 'Continue',
      onClick: () => {
        if (this.loadingPack) {
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
      onClick: () => {
        this.context.clearSaveData();
        this.status.text = 'Save cleared.';
        this.refreshContinueState();
      },
    });

    this.statsButton = new TextButton({
      label: 'Stats',
      onClick: () => {
        this.context.transitionTo('STATS', { returnState: 'TITLE' });
      },
    });

    this.normalButton = new TextButton({
      label: 'Normal',
      width: 130,
      onClick: () => {
        this.selectedDifficulty = DifficultyMode.NORMAL;
        this.refreshDifficultyButtons();
      },
    });
    this.hardButton = new TextButton({
      label: 'Hard',
      width: 130,
      onClick: () => {
        this.selectedDifficulty = DifficultyMode.HARD;
        this.refreshDifficultyButtons();
      },
    });

    this.packPrevButton = new TextButton({
      label: '<',
      width: 58,
      height: 36,
      onClick: () => this.changePackByStep(-1),
    });
    this.packNextButton = new TextButton({
      label: '>',
      width: 58,
      height: 36,
      onClick: () => this.changePackByStep(1),
    });

    this.root.addChild(this.title);
    this.root.addChild(this.subtitle);
    this.root.addChild(this.status);
    this.root.addChild(this.difficultyText);
    this.root.addChild(this.packHeaderText);
    this.root.addChild(this.packNameText);
    this.root.addChild(this.packDescText);
    this.root.addChild(this.packStatusText);
    this.root.addChild(this.newRunButton);
    this.root.addChild(this.continueButton);
    this.root.addChild(this.clearButton);
    this.root.addChild(this.statsButton);
    this.root.addChild(this.normalButton);
    this.root.addChild(this.hardButton);
    this.root.addChild(this.packPrevButton);
    this.root.addChild(this.packNextButton);
  }

  onEnter(): void {
    this.mounted = true;
    this.context.stage.addChild(this.root);
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
  }

  onExit(): void {
    this.mounted = false;
    this.root.removeFromParent();
  }

  update(): void {
    if (this.root.parent === null) {
      return;
    }

    this.layout();
  }

  private refreshContinueState(): void {
    this.continueButton.setEnabled(this.context.hasSaveData() && !this.loadingPack);
    this.newRunButton.setEnabled(!this.loadingPack);
  }

  private layout(): void {
    const width = this.context.app.screen.width;
    const height = this.context.app.screen.height;

    this.bg.clear();
    this.bg.rect(0, 0, width, height);
    this.bg.fill({ color: 0x0f1720, alpha: 1 });

    this.title.position.set(width * 0.5, height * 0.2);
    this.subtitle.position.set(width * 0.5, height * 0.285);

    this.packHeaderText.position.set(width * 0.5, height * 0.375);
    this.packNameText.position.set(width * 0.5, height * 0.425);
    this.packDescText.position.set(width * 0.5, height * 0.468);
    this.packStatusText.position.set(width * 0.5, height * 0.52);

    this.packPrevButton.position.set(width * 0.5 - 190, height * 0.407);
    this.packNextButton.position.set(width * 0.5 + 132, height * 0.407);

    this.newRunButton.position.set(width * 0.5 - 110, height * 0.575);
    this.continueButton.position.set(width * 0.5 - 110, height * 0.655);
    this.clearButton.position.set(width * 0.5 - 110, height * 0.735);
    this.statsButton.position.set(width * 0.5 - 110, height * 0.815);

    this.difficultyText.position.set(width * 0.5 - 130, height * 0.89);
    this.normalButton.position.set(width * 0.5 - 134, height * 0.925);
    this.hardButton.position.set(width * 0.5 + 4, height * 0.925);
    this.status.position.set(width * 0.5, height * 0.975);
  }

  private refreshDifficultyButtons(): void {
    this.difficultyText.text = `Difficulty: ${this.selectedDifficulty}`;
    if (this.selectedDifficulty === DifficultyMode.NORMAL) {
      this.normalButton.setLabel('[Normal]');
      this.hardButton.setLabel('Hard');
    } else {
      this.normalButton.setLabel('Normal');
      this.hardButton.setLabel('[Hard]');
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
  }

  private changePackByStep(step: number): void {
    if (this.loadingPack || this.availablePacks.length <= 1) {
      return;
    }
    const nextIndex = (this.selectedPackIndex + step + this.availablePacks.length) % this.availablePacks.length;
    this.applySelectedPack(nextIndex);
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
