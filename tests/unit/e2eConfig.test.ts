import { execSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';

// e2e-speed C10 (AC 10, door 2): quantos workers o Playwright usa vem de E2E_WORKERS, padrão 2
describe('playwright config', () => {
  const saved = process.env.E2E_WORKERS;
  afterEach(() => {
    if (saved === undefined) delete process.env.E2E_WORKERS;
    else process.env.E2E_WORKERS = saved;
    vi.resetModules();
  });

  async function workers(value: string | undefined): Promise<unknown> {
    if (value === undefined) delete process.env.E2E_WORKERS;
    else process.env.E2E_WORKERS = value;
    vi.resetModules();
    return (await import('../../playwright.config')).default.workers;
  }

  function list(value: string | undefined): string {
    const env = { ...process.env };
    if (value === undefined) delete env.E2E_WORKERS;
    else env.E2E_WORKERS = value;
    return execSync('npx playwright test --list', { env, encoding: 'utf8' });
  }

  it('workers come from E2E_WORKERS with default 2', { timeout: 120_000 }, async () => {
    expect(await workers(undefined)).toBe(2);
    expect(await workers('1')).toBe(1);
    const one = list('1');
    expect(one).toMatch(/Total: \d+ tests? in \d+ files?/);
    expect(list(undefined)).toBe(one);
  });
});
