type CueName =
  | 'ui_click'
  | 'horn_charge'
  | 'arrow_shoot'
  | 'hit_impact'
  | 'morale_break'
  | 'victory'
  | 'defeat';

interface ToneStep {
  frequency: number;
  duration: number;
  offset: number;
  gain: number;
  type: OscillatorType;
}

function nowMs(): number {
  if (typeof performance !== 'undefined') {
    return performance.now();
  }
  return Date.now();
}

export class AudioManager {
  private context: AudioContext | null = null;
  private unlocked = false;
  private masterVolume = 0.85;
  private sfxVolume = 0.9;
  private musicVolume = 0.6;
  private readonly throttles = new Map<string, number>();

  unlock(): void {
    if (typeof window === 'undefined') {
      return;
    }
    if (this.context === null) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        return;
      }
      try {
        this.context = new Ctor();
      } catch {
        this.context = null;
        return;
      }
    }

    const context = this.context;
    if (context.state === 'suspended') {
      void context.resume();
    }
    this.unlocked = true;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  setMasterVolume(value: number): void {
    this.masterVolume = Math.max(0, Math.min(1, value));
  }

  setSfxVolume(value: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, value));
  }

  setMusicVolume(value: number): void {
    this.musicVolume = Math.max(0, Math.min(1, value));
  }

  play(name: CueName, volumeMult = 1, throttleMs = 0): void {
    const context = this.context;
    if (context === null || !this.unlocked) {
      return;
    }

    const key = `${name}`;
    if (throttleMs > 0) {
      const t = nowMs();
      const last = this.throttles.get(key) ?? -1e9;
      if (t - last < throttleMs) {
        return;
      }
      this.throttles.set(key, t);
    }

    const baseGain = this.masterVolume * this.sfxVolume * Math.max(0, volumeMult) * (1 + this.musicVolume * 0);
    if (baseGain <= 0.0001) {
      return;
    }

    const tones = this.buildCue(name);
    const startAt = context.currentTime;
    for (let i = 0; i < tones.length; i += 1) {
      const tone = tones[i];
      this.playTone(context, startAt, tone, baseGain);
    }
  }

  private playTone(context: AudioContext, startAt: number, tone: ToneStep, baseGain: number): void {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = tone.type;
    osc.frequency.value = tone.frequency;
    const toneStart = startAt + tone.offset;
    const toneEnd = toneStart + tone.duration;

    const peak = Math.max(0, Math.min(1, baseGain * tone.gain));
    gain.gain.setValueAtTime(0.0001, toneStart);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), toneStart + Math.min(0.01, tone.duration * 0.5));
    gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);

    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(toneStart);
    osc.stop(toneEnd + 0.01);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  private buildCue(name: CueName): ToneStep[] {
    switch (name) {
      case 'ui_click':
        return [{ frequency: 760, duration: 0.045, offset: 0, gain: 0.28, type: 'square' }];
      case 'horn_charge':
        return [
          { frequency: 220, duration: 0.2, offset: 0, gain: 0.35, type: 'sawtooth' },
          { frequency: 280, duration: 0.22, offset: 0.16, gain: 0.3, type: 'sawtooth' },
          { frequency: 330, duration: 0.24, offset: 0.31, gain: 0.28, type: 'sawtooth' },
        ];
      case 'arrow_shoot':
        return [{ frequency: 900, duration: 0.06, offset: 0, gain: 0.2, type: 'triangle' }];
      case 'hit_impact':
        return [
          { frequency: 160, duration: 0.05, offset: 0, gain: 0.22, type: 'square' },
          { frequency: 100, duration: 0.08, offset: 0.02, gain: 0.16, type: 'triangle' },
        ];
      case 'morale_break':
        return [
          { frequency: 260, duration: 0.12, offset: 0, gain: 0.22, type: 'triangle' },
          { frequency: 190, duration: 0.18, offset: 0.09, gain: 0.2, type: 'triangle' },
          { frequency: 140, duration: 0.2, offset: 0.2, gain: 0.2, type: 'sine' },
        ];
      case 'victory':
        return [
          { frequency: 392, duration: 0.14, offset: 0, gain: 0.22, type: 'triangle' },
          { frequency: 494, duration: 0.14, offset: 0.13, gain: 0.22, type: 'triangle' },
          { frequency: 587, duration: 0.2, offset: 0.26, gain: 0.24, type: 'triangle' },
        ];
      case 'defeat':
        return [
          { frequency: 246, duration: 0.14, offset: 0, gain: 0.22, type: 'sawtooth' },
          { frequency: 220, duration: 0.18, offset: 0.12, gain: 0.23, type: 'sawtooth' },
          { frequency: 174, duration: 0.24, offset: 0.25, gain: 0.24, type: 'sawtooth' },
        ];
    }
  }
}

export const audioManager = new AudioManager();
