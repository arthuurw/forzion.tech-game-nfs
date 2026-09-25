import { expect, test } from '@playwright/test';
import { gotoGame } from './helpers';

test.describe('audio', () => {
  test.beforeEach(async ({ page }) => {
    await gotoGame(page);
  });

  // C35 (AC 27)
  test('first keypress starts audio', async ({ page }) => {
    expect(await page.evaluate(() => (window as any).__game.audio.state)).toBe('idle');
    await page.keyboard.press('KeyW');
    await page.waitForFunction(() => (window as any).__game.audio.state === 'running');
    const gains = await page.evaluate(() => (window as any).__game.audio.gains);
    expect(gains.engine).toBeGreaterThan(0);
    expect(gains.ambient).toBeGreaterThan(0);
  });

  // C37 (AC 29)
  test('gains are 0.3 ambient 0.5 engine', async ({ page }) => {
    await page.keyboard.press('KeyW');
    await page.waitForFunction(() => (window as any).__game.audio.state === 'running');
    const gains = await page.evaluate(() => (window as any).__game.audio.gains);
    expect(gains.ambient).toBeCloseTo(0.3, 6);
    expect(gains.engine).toBeCloseTo(0.5, 6);
    expect(gains.master).toBeCloseTo(1, 6);
  });

  // C46 (door 8) - grafo sintetizado, sem arquivos de som
  test('synthesized audio graph', async ({ page }) => {
    await page.keyboard.press('KeyW');
    await page.waitForFunction(() => (window as any).__game.audio.state === 'running');
    const graph = await page.evaluate(() => (window as any).__game.audio.graph);
    expect(graph.engine).toEqual(['OscillatorNode(sawtooth)', 'BiquadFilterNode(lowpass)', 'GainNode']);
    expect(graph.ambient).toEqual(['AudioBufferSourceNode(loop)', 'BiquadFilterNode(lowpass)', 'GainNode']);
    expect(graph.masterConnected).toBe(true);
    expect(await page.locator('audio').count()).toBe(0);
  });

  // C38 (AC 30)
  test('M toggles master gain', async ({ page }) => {
    await page.keyboard.press('KeyW');
    await page.waitForFunction(() => (window as any).__game.audio.state === 'running');
    await page.keyboard.press('KeyM');
    expect((await page.evaluate(() => (window as any).__game.audio.gains)).master).toBeCloseTo(0, 6);
    await page.keyboard.press('KeyM');
    expect((await page.evaluate(() => (window as any).__game.audio.gains)).master).toBeCloseTo(1, 6);
  });
});
