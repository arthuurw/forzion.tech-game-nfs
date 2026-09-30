import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    // somam aos padrões (.git, node_modules, test-results): os worktrees de agentes são cópias do repositório,
    // e um arquivo travado na raiz (o `bash.exe.stackdump` do Git Bash) derrubava o servidor com EBUSY no meio do e2e
    watch: { ignored: ['**/.claude/**', '**/*.stackdump', '**/playwright-report/**'] },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/physics/**/*.test.ts'],
    environment: 'node',
    // folga para máquina ocupada (suítes em paralelo em worktrees); quem precisa de mais declara no teste
    testTimeout: 30_000,
    // `slow`: fica fora do `npm run test:quick`; o `npm test` roda tudo
    tags: [{ name: 'slow', description: 'teste de minutos, fora da suíte rápida' }],
  },
});
