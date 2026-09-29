import { describe, expect, it } from 'vitest';

// test-hardening C1 (AC 1): o timeout padrão vale para tests/physics
describe('vitest config', () => {
  it('physics tests run with a 30 s timeout', ({ task }) => {
    expect(task.timeout).toBe(30_000);
  });
});
