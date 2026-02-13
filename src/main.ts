import { Application } from 'pixi.js';
import { Game } from './game/Game';
import './styles.css';

async function bootstrap(): Promise<void> {
  const app = new Application();
  await app.init({
    resizeTo: window,
    antialias: true,
    background: 0x0f1720,
  });

  const mount = document.getElementById('app');
  if (!mount) {
    throw new Error('Missing #app element');
  }

  mount.appendChild(app.canvas);
  new Game(app);
}

bootstrap().catch((error) => {
  console.error('Failed to start game:', error);
});