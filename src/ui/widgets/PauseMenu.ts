import { Container, Graphics, Text } from 'pixi.js';
import type { GameSettings } from '../../meta/Settings';
import { getDefaultSettings } from '../../meta/Settings';
import { clamp } from '../../utils/math';
import { ControlsOverlay } from './ControlsOverlay';
import { TextButton } from './TextButton';

type PauseView = 'main' | 'settings' | 'controls' | 'confirm_quit';

interface PauseMenuOptions {
  parent: Container;
  getSettings: () => GameSettings;
  onSettingsChanged: (settings: GameSettings) => void;
  onResume: () => void;
  onQuitToTitle: () => void;
  onShowStats: () => void;
}

function boolLabel(value: boolean): string {
  return value ? 'ON' : 'OFF';
}

export class PauseMenu {
  readonly root = new Container();

  private readonly dim = new Graphics();
  private readonly panel = new Graphics();
  private readonly title = new Text({
    text: 'Paused',
    style: {
      fill: 0xf3e6bf,
      fontFamily: 'monospace',
      fontSize: 40,
      fontWeight: 'bold',
    },
  });
  private readonly body = new Text({
    text: '',
    style: {
      fill: 0xd7e8ff,
      fontFamily: 'monospace',
      fontSize: 14,
      lineHeight: 22,
    },
  });
  private readonly controlsOverlay = new ControlsOverlay();

  private readonly resumeButton: TextButton;
  private readonly settingsButton: TextButton;
  private readonly controlsButton: TextButton;
  private readonly statsButton: TextButton;
  private readonly quitButton: TextButton;

  private readonly backButton: TextButton;
  private readonly resetSettingsButton: TextButton;

  private readonly masterMinus: TextButton;
  private readonly masterPlus: TextButton;
  private readonly sfxMinus: TextButton;
  private readonly sfxPlus: TextButton;
  private readonly musicMinus: TextButton;
  private readonly musicPlus: TextButton;
  private readonly cameraMinus: TextButton;
  private readonly cameraPlus: TextButton;

  private readonly minimapToggle: TextButton;
  private readonly trailsToggle: TextButton;
  private readonly shakeToggle: TextButton;

  private readonly confirmNoButton: TextButton;
  private readonly confirmYesButton: TextButton;

  private readonly getSettings: () => GameSettings;
  private readonly onSettingsChanged: (settings: GameSettings) => void;
  private readonly onResume: () => void;
  private readonly onQuitToTitle: () => void;
  private readonly onShowStats: () => void;

  private view: PauseView = 'main';
  private screenWidth = 1280;
  private screenHeight = 720;

  constructor(options: PauseMenuOptions) {
    this.getSettings = options.getSettings;
    this.onSettingsChanged = options.onSettingsChanged;
    this.onResume = options.onResume;
    this.onQuitToTitle = options.onQuitToTitle;
    this.onShowStats = options.onShowStats;

    this.root.visible = false;
    this.root.eventMode = 'static';

    this.title.anchor.set(0.5, 0.5);
    this.body.anchor.set(0.5, 0);

    this.resumeButton = new TextButton({ label: 'Resume', width: 260, onClick: () => this.resume() });
    this.settingsButton = new TextButton({ label: 'Settings', width: 260, onClick: () => this.showView('settings') });
    this.controlsButton = new TextButton({ label: 'Controls', width: 260, onClick: () => this.showView('controls') });
    this.statsButton = new TextButton({ label: 'Stats', width: 260, onClick: () => this.showStats() });
    this.quitButton = new TextButton({ label: 'Quit To Title', width: 260, onClick: () => this.showView('confirm_quit') });

    this.backButton = new TextButton({ label: 'Back', width: 180, onClick: () => this.showView('main') });
    this.resetSettingsButton = new TextButton({
      label: 'Reset Defaults',
      width: 180,
      onClick: () => {
        const current = this.getSettings();
        this.onSettingsChanged({
          ...getDefaultSettings(),
          contentPackId: current.contentPackId,
        });
        this.refreshSettingsText();
      },
    });

    this.masterMinus = new TextButton({ label: '-', width: 44, onClick: () => this.adjustNumber('masterVolume', -0.05, 0, 1) });
    this.masterPlus = new TextButton({ label: '+', width: 44, onClick: () => this.adjustNumber('masterVolume', 0.05, 0, 1) });
    this.sfxMinus = new TextButton({ label: '-', width: 44, onClick: () => this.adjustNumber('sfxVolume', -0.05, 0, 1) });
    this.sfxPlus = new TextButton({ label: '+', width: 44, onClick: () => this.adjustNumber('sfxVolume', 0.05, 0, 1) });
    this.musicMinus = new TextButton({ label: '-', width: 44, onClick: () => this.adjustNumber('musicVolume', -0.05, 0, 1) });
    this.musicPlus = new TextButton({ label: '+', width: 44, onClick: () => this.adjustNumber('musicVolume', 0.05, 0, 1) });
    this.cameraMinus = new TextButton({ label: '-', width: 44, onClick: () => this.adjustNumber('cameraSpeed', -0.1, 0.5, 2) });
    this.cameraPlus = new TextButton({ label: '+', width: 44, onClick: () => this.adjustNumber('cameraSpeed', 0.1, 0.5, 2) });

    this.minimapToggle = new TextButton({ label: '', width: 180, onClick: () => this.toggleBool('showMinimap') });
    this.trailsToggle = new TextButton({ label: '', width: 180, onClick: () => this.toggleBool('showTrails') });
    this.shakeToggle = new TextButton({ label: '', width: 180, onClick: () => this.toggleBool('reduceScreenShake') });

    this.confirmNoButton = new TextButton({ label: 'Cancel', width: 140, onClick: () => this.showView('main') });
    this.confirmYesButton = new TextButton({
      label: 'Quit',
      width: 140,
      onClick: () => {
        this.setVisible(false);
        this.onQuitToTitle();
      },
    });

    this.root.addChild(this.dim);
    this.root.addChild(this.panel);
    this.root.addChild(this.title);
    this.root.addChild(this.body);
    this.root.addChild(this.controlsOverlay.root);

    this.root.addChild(this.resumeButton);
    this.root.addChild(this.settingsButton);
    this.root.addChild(this.controlsButton);
    this.root.addChild(this.statsButton);
    this.root.addChild(this.quitButton);
    this.root.addChild(this.backButton);
    this.root.addChild(this.resetSettingsButton);
    this.root.addChild(this.masterMinus);
    this.root.addChild(this.masterPlus);
    this.root.addChild(this.sfxMinus);
    this.root.addChild(this.sfxPlus);
    this.root.addChild(this.musicMinus);
    this.root.addChild(this.musicPlus);
    this.root.addChild(this.cameraMinus);
    this.root.addChild(this.cameraPlus);
    this.root.addChild(this.minimapToggle);
    this.root.addChild(this.trailsToggle);
    this.root.addChild(this.shakeToggle);
    this.root.addChild(this.confirmNoButton);
    this.root.addChild(this.confirmYesButton);

    options.parent.addChild(this.root);
    this.showView('main');
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
    if (visible) {
      this.showView('main');
    }
  }

  isVisible(): boolean {
    return this.root.visible;
  }

  toggle(): void {
    if (this.root.visible) {
      this.resume();
    } else {
      this.setVisible(true);
    }
  }

  onWheel(deltaY: number): void {
    if (!this.root.visible || this.view !== 'controls') {
      return;
    }
    this.controlsOverlay.scrollBy(deltaY * 0.3);
  }

  layout(screenWidth: number, screenHeight: number): void {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;

    this.dim.clear();
    this.dim.rect(0, 0, screenWidth, screenHeight);
    this.dim.fill({ color: 0x070b11, alpha: 0.6 });

    const panelW = 620;
    const panelH = 440;
    const x = screenWidth * 0.5 - panelW * 0.5;
    const y = screenHeight * 0.5 - panelH * 0.5;

    this.panel.clear();
    this.panel.roundRect(x, y, panelW, panelH, 12);
    this.panel.fill({ color: 0x121b28, alpha: 0.96 });
    this.panel.stroke({ color: 0x739dc9, alpha: 0.92, width: 1.6 });

    this.title.position.set(screenWidth * 0.5, y + 44);
    this.body.position.set(screenWidth * 0.5, y + 84);

    this.controlsOverlay.layout(screenWidth, screenHeight);

    this.layoutButtons(x, y, panelW);
  }

  private resume(): void {
    this.root.visible = false;
    this.onResume();
  }

  private showView(view: PauseView): void {
    this.view = view;
    this.controlsOverlay.hide();

    const inMain = view === 'main';
    const inSettings = view === 'settings';
    const inControls = view === 'controls';
    const inConfirm = view === 'confirm_quit';

    this.resumeButton.visible = inMain;
    this.settingsButton.visible = inMain;
    this.controlsButton.visible = inMain;
    this.statsButton.visible = inMain;
    this.quitButton.visible = inMain;

    this.backButton.visible = inSettings || inControls;
    this.resetSettingsButton.visible = inSettings;
    this.masterMinus.visible = inSettings;
    this.masterPlus.visible = inSettings;
    this.sfxMinus.visible = inSettings;
    this.sfxPlus.visible = inSettings;
    this.musicMinus.visible = inSettings;
    this.musicPlus.visible = inSettings;
    this.cameraMinus.visible = inSettings;
    this.cameraPlus.visible = inSettings;
    this.minimapToggle.visible = inSettings;
    this.trailsToggle.visible = inSettings;
    this.shakeToggle.visible = inSettings;

    this.confirmNoButton.visible = inConfirm;
    this.confirmYesButton.visible = inConfirm;

    if (inMain) {
      this.title.text = 'Paused';
      this.body.text = '';
    } else if (inSettings) {
      this.title.text = 'Settings';
      this.refreshSettingsText();
    } else if (inControls) {
      this.title.text = 'Controls';
      this.body.text = 'Mouse wheel scrolls this panel.';
      this.controlsOverlay.show();
    } else {
      this.title.text = 'Quit To Title?';
      this.body.text = 'Current battle progress will be lost.';
    }

    this.layout(this.screenWidth, this.screenHeight);
  }

  private layoutButtons(panelX: number, panelY: number, panelW: number): void {
    const centerX = panelX + panelW * 0.5;

    this.resumeButton.position.set(centerX - 130, panelY + 120);
    this.settingsButton.position.set(centerX - 130, panelY + 176);
    this.controlsButton.position.set(centerX - 130, panelY + 232);
    this.statsButton.position.set(centerX - 130, panelY + 288);
    this.quitButton.position.set(centerX - 130, panelY + 344);

    this.backButton.position.set(panelX + 30, panelY + 382);
    this.resetSettingsButton.position.set(panelX + panelW - 210, panelY + 382);

    const rowX = panelX + panelW - 110;
    this.masterMinus.position.set(rowX - 66, panelY + 122);
    this.masterPlus.position.set(rowX, panelY + 122);
    this.sfxMinus.position.set(rowX - 66, panelY + 167);
    this.sfxPlus.position.set(rowX, panelY + 167);
    this.musicMinus.position.set(rowX - 66, panelY + 212);
    this.musicPlus.position.set(rowX, panelY + 212);
    this.cameraMinus.position.set(rowX - 66, panelY + 257);
    this.cameraPlus.position.set(rowX, panelY + 257);

    this.minimapToggle.position.set(panelX + panelW - 220, panelY + 305);
    this.trailsToggle.position.set(panelX + panelW - 220, panelY + 343);
    this.shakeToggle.position.set(panelX + panelW - 220, panelY + 381);

    this.confirmNoButton.position.set(centerX - 150, panelY + 300);
    this.confirmYesButton.position.set(centerX + 10, panelY + 300);
  }

  private adjustNumber(
    key: 'masterVolume' | 'sfxVolume' | 'musicVolume' | 'cameraSpeed',
    delta: number,
    min: number,
    max: number,
  ): void {
    const settings = this.getSettings();
    const next = {
      ...settings,
      [key]: clamp((settings[key] as number) + delta, min, max),
    };
    this.onSettingsChanged(next);
    this.refreshSettingsText();
  }

  private toggleBool(key: 'showMinimap' | 'showTrails' | 'reduceScreenShake'): void {
    const settings = this.getSettings();
    const next = {
      ...settings,
      [key]: !settings[key],
    };
    this.onSettingsChanged(next);
    this.refreshSettingsText();
  }

  private refreshSettingsText(): void {
    const settings = this.getSettings();
    this.body.text = [
      `Master Volume: ${settings.masterVolume.toFixed(2)}`,
      `SFX Volume: ${settings.sfxVolume.toFixed(2)}`,
      `Music Volume: ${settings.musicVolume.toFixed(2)}`,
      `Camera Speed: ${settings.cameraSpeed.toFixed(2)}`,
      '',
      `Minimap: ${boolLabel(settings.showMinimap)}`,
      `Trails: ${boolLabel(settings.showTrails)}`,
      `Reduce Shake: ${boolLabel(settings.reduceScreenShake)}`,
    ].join('\n');

    this.minimapToggle.setLabel(`Minimap ${boolLabel(settings.showMinimap)}`);
    this.trailsToggle.setLabel(`Trails ${boolLabel(settings.showTrails)}`);
    this.shakeToggle.setLabel(`Reduce Shake ${boolLabel(settings.reduceScreenShake)}`);
  }

  private showStats(): void {
    this.root.visible = false;
    this.onShowStats();
  }
}
