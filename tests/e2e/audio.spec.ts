import { expect, test } from '@playwright/test';
import { advanceSim, gotoGame } from './helpers';

async function startAudio(page: Parameters<typeof gotoGame>[0]): Promise<void> {
  // qualquer tecla inicia o áudio; Shift não é mapeada, então não move o carro
  await page.keyboard.press('ShiftLeft');
  await page.waitForFunction(() => (window as any).__game.audio.state === 'running');
}

test.describe('audio', () => {
  test.beforeEach(async ({ page }) => {
    await gotoGame(page);
  });

  // free-roam-city C35 (AC 27)
  test('first keypress starts audio', async ({ page }) => {
    expect(await page.evaluate(() => (window as any).__game.audio.state)).toBe('idle');
    await page.keyboard.press('KeyW');
    await page.waitForFunction(() => (window as any).__game.audio.state === 'running');
    const gains = await page.evaluate(() => (window as any).__game.audio.gains);
    expect(gains.engineTarget).toBeGreaterThan(0);
    expect(gains.ambient).toBeGreaterThan(0);
  });

  // engine-sound C5 (supersede free-roam-city C37)
  test('gains are 0.12 ambient and 0.06 idle engine', async ({ page }) => {
    await startAudio(page);
    const gains = await page.evaluate(() => (window as any).__game.audio.gains);
    expect(gains.ambient).toBeCloseTo(0.12, 6);
    expect(gains.engineTarget).toBeCloseTo(0.06, 6);
    expect(gains.master).toBeCloseTo(1, 6);
    await advanceSim(page, 1);
    const settled = await page.evaluate(() => (window as any).__game.audio.gains);
    expect(Math.abs(settled.engine - 0.06)).toBeLessThan(0.01);
  });

  // engine-sound C6
  test('throttle raises engine gain', async ({ page }) => {
    await startAudio(page);
    await page.keyboard.down('KeyW');
    await advanceSim(page, 0.2);
    expect((await page.evaluate(() => (window as any).__game.audio.gains)).engineTarget).toBeCloseTo(0.15, 6);
    await page.keyboard.up('KeyW');
    await advanceSim(page, 0.2);
    expect((await page.evaluate(() => (window as any).__game.audio.gains)).engineTarget).toBeCloseTo(0.06, 6);
  });

  // engine-sound C4 (supersede free-roam-city C46) - grafo por conexões registradas
  test('synthesized audio graph', async ({ page }) => {
    await startAudio(page);
    const graph = await page.evaluate(() => (window as any).__game.audio.graph);
    expect(graph.sources).toEqual([
      'OscillatorNode(sawtooth)',
      'OscillatorNode(square,detune=8)',
      'OscillatorNode(sine,sub)',
      'AudioBufferSourceNode(loop)',
    ]);
    // cada aresta é "from -> to"; a ordem é a ordem em que connect() foi chamado
    expect(graph.edges).toEqual([
      'GainNode(master) -> DynamicsCompressorNode',
      'DynamicsCompressorNode -> AudioDestinationNode',
      'OscillatorNode(sawtooth) -> BiquadFilterNode(lowpass)',
      'OscillatorNode(square,detune=8) -> BiquadFilterNode(lowpass)',
      'OscillatorNode(sine,sub) -> BiquadFilterNode(lowpass)',
      'BiquadFilterNode(lowpass) -> GainNode(tremolo)',
      'GainNode(tremolo) -> GainNode(engine)',
      'GainNode(engine) -> GainNode(master)',
      'OscillatorNode(lfo) -> GainNode(tremoloDepth)',
      'GainNode(tremoloDepth) -> AudioParam(tremolo.gain)',
      'AudioBufferSourceNode(loop) -> BiquadFilterNode(bandpass)',
      'BiquadFilterNode(bandpass) -> GainNode(ambient)',
      'GainNode(ambient) -> GainNode(master)',
    ]);
    expect(await page.locator('audio').count()).toBe(0);
  });

  // engine-sound C7
  test('master compressor', async ({ page }) => {
    await startAudio(page);
    const c = await page.evaluate(() => (window as any).__game.audio.compressor);
    expect(c.threshold).toBeCloseTo(-18, 6);
    expect(c.ratio).toBeCloseTo(4, 6);
    expect(c.knee).toBeCloseTo(12, 6);
  });

  // engine-sound C8
  test('lowpass cutoff follows rpm', async ({ page }) => {
    await startAudio(page);
    await page.keyboard.down('KeyW');
    await advanceSim(page, 2);
    const sample = await page.evaluate(() => {
      const g = (window as any).__game;
      return { cutoff: g.audio.cutoffTarget as number, rpm: g.car.rpm as number };
    });
    await page.keyboard.up('KeyW');
    const expected = 250 + ((sample.rpm - 1000) / 6000) * (1400 - 250);
    expect(sample.cutoff).toBeGreaterThan(300);
    expect(Math.abs(sample.cutoff - expected)).toBeLessThan(60);
  });

  // engine-sound C9 (regressão de free-roam-city C38, AC 30)
  test('M toggles master gain', async ({ page }) => {
    await startAudio(page);
    await page.keyboard.press('KeyM');
    expect((await page.evaluate(() => (window as any).__game.audio.gains)).master).toBeCloseTo(0, 6);
    await page.keyboard.press('KeyM');
    expect((await page.evaluate(() => (window as any).__game.audio.gains)).master).toBeCloseTo(1, 6);
  });
});
