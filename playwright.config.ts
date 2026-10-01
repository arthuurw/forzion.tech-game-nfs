import { defineConfig } from '@playwright/test';

// porta configurável para rodar duas suítes em paralelo (worktrees); padrão 5173
const PORT = Number(process.env.E2E_PORT ?? 5173);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  fullyParallel: false,
  // 2 por padrão (e2e-speed door 2); E2E_WORKERS=1 para rodar ao lado de outra suíte
  workers: Number(process.env.E2E_WORKERS ?? 2),
  retries: 0,
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 640, height: 360 },
    launchOptions: {
      args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader'],
    },
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // só reaproveita com E2E_REUSE: sem isso, um servidor de outro checkout na mesma porta faria a suíte testar o código errado
    reuseExistingServer: !!process.env.E2E_REUSE,
    timeout: 120_000,
  },
});
