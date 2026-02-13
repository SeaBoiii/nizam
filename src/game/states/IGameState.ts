import type { GameSettings } from '../../meta/Settings';

export interface IGameState {
  onEnter(payload?: unknown): void;
  onExit(): void;
  update(dt: number): void;
  setPaused?(paused: boolean): void;
  applySettings?(settings: GameSettings): void;
}
