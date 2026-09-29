import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173, strictPort: true },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/physics/**/*.test.ts'],
    environment: 'node',
    // folga para máquina ocupada (suítes em paralelo em worktrees); quem precisa de mais declara no teste
    testTimeout: 30_000,
    // `slow`: fica fora do `npm run test:quick`; o `npm test` roda tudo
    tags: [{ name: 'slow', description: 'teste de minutos, fora da suíte rápida' }],
  },
});
