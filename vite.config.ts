import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173, strictPort: true },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/physics/**/*.test.ts'],
    environment: 'node',
  },
});
