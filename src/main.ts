import './style.css';
import { exposeDebug } from './core/exposeDebug';
import { Game } from './core/Game';
import { hasWebGL2, loadAssets } from './core/Loader';
import { parseQuality, qualityPreset } from './core/quality';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const hudRoot = document.querySelector<HTMLElement>('#hud')!;
const loading = document.querySelector<HTMLElement>('#loading')!;
const loadingText = document.querySelector<HTMLElement>('#loading-text')!;
const errorBox = document.querySelector<HTMLElement>('#error')!;

function showError(message: string): void {
  loading.style.display = 'none';
  hudRoot.style.display = 'none';
  errorBox.textContent = message;
  errorBox.style.display = 'flex';
}

async function boot(): Promise<void> {
  if (!hasWebGL2()) {
    showError('Seu navegador não suporta WebGL2');
    return;
  }

  let game: Game;
  try {
    const assets = await loadAssets((msg) => {
      loadingText.textContent = msg;
    });
    const quality = qualityPreset(parseQuality(window.location.search));
    game = new Game(canvas, hudRoot, assets, quality, () => {
      loading.style.display = 'none';
      hudRoot.style.display = 'block';
    });
  } catch (error) {
    console.error(error);
    showError(`Falha ao iniciar o jogo: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  exposeDebug(import.meta.env, game.debugHandle(), window as unknown as Record<string, unknown>);
  game.start();
}

void boot();
