export interface GameSettings {
  version: 1;
  contentPackId: string;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  cameraSpeed: number;
  showMinimap: boolean;
  showTrails: boolean;
  reduceScreenShake: boolean;
}

const SETTINGS_KEY = 'nizam_settings_v1';

const DEFAULT_SETTINGS: GameSettings = {
  version: 1,
  contentPackId: 'base',
  masterVolume: 0.85,
  sfxVolume: 0.9,
  musicVolume: 0.6,
  cameraSpeed: 1,
  showMinimap: true,
  showTrails: true,
  reduceScreenShake: false,
};

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function sanitize(value: unknown): GameSettings {
  if (typeof value !== 'object' || value === null) {
    return { ...DEFAULT_SETTINGS };
  }

  const raw = value as Record<string, unknown>;
  return {
    version: 1,
    contentPackId: typeof raw.contentPackId === 'string' && raw.contentPackId.trim().length > 0 ? raw.contentPackId : 'base',
    masterVolume: clamp(raw.masterVolume, 0, 1, DEFAULT_SETTINGS.masterVolume),
    sfxVolume: clamp(raw.sfxVolume, 0, 1, DEFAULT_SETTINGS.sfxVolume),
    musicVolume: clamp(raw.musicVolume, 0, 1, DEFAULT_SETTINGS.musicVolume),
    cameraSpeed: clamp(raw.cameraSpeed, 0.5, 2, DEFAULT_SETTINGS.cameraSpeed),
    showMinimap: typeof raw.showMinimap === 'boolean' ? raw.showMinimap : DEFAULT_SETTINGS.showMinimap,
    showTrails: typeof raw.showTrails === 'boolean' ? raw.showTrails : DEFAULT_SETTINGS.showTrails,
    reduceScreenShake:
      typeof raw.reduceScreenShake === 'boolean' ? raw.reduceScreenShake : DEFAULT_SETTINGS.reduceScreenShake,
  };
}

export function getDefaultSettings(): GameSettings {
  return { ...DEFAULT_SETTINGS };
}

export function loadSettings(): GameSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return getDefaultSettings();
  }

  const raw = window.localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return getDefaultSettings();
  }

  try {
    return sanitize(JSON.parse(raw) as unknown);
  } catch {
    return getDefaultSettings();
  }
}

export function saveSettings(settings: GameSettings): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  const payload = sanitize(settings);
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
}

export function resetSettings(): GameSettings {
  const settings = getDefaultSettings();
  saveSettings(settings);
  return settings;
}
