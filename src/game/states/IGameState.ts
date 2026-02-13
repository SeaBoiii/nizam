export interface IGameState {
  onEnter(payload?: unknown): void;
  onExit(): void;
  update(dt: number): void;
}