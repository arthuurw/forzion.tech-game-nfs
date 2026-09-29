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
  test('first keypress starts audio', { tag: '@smoke' }, async ({ page }) => {
    expect(await page.evaluate(() => (window as any).__game.audio.state)).toBe('idle');
    await page.keyboard.press('KeyW');
    await page.waitForFunction(() => (window as any).__game.audio.state === 'running');
    const gains = await page.evaluate(() => (window as any).__game.audio.gains);
    expect(gains.engineTarget).toBeGreaterThan(0);
    expect(gains.ambient).toBeGreaterThan(0);
  });

  // engine-sound C5 (supersede free-roam-city C37)
  test('gains are 0.05 ambient and 0.048 idle engine', async ({ page }) => {
    await startAudio(page);
    const gains = await page.evaluate(() => (window as any).__game.audio.gains);
    expect(gains.ambient).toBeCloseTo(0.05, 6);
    expect(gains.engineTarget).toBeCloseTo(0.048, 6);
    expect(gains.master).toBeCloseTo(1, 6);
    await advanceSim(page, 1);
    const settled = await page.evaluate(() => (window as any).__game.audio.gains);
    expect(Math.abs(settled.engine - 0.048)).toBeLessThan(0.01);
  });

  // engine-sound C6 - alvo e valor REAL do AudioParam
  test('throttle raises engine gain', async ({ page }) => {
    await startAudio(page);
    await page.keyboard.down('KeyW');
    await advanceSim(page, 1);
    const up = await page.evaluate(() => {
      const a = (window as any).__game.audio;
      return { target: a.gains.engineTarget as number, real: a.params.engineGain as number };
    });
    expect(up.target).toBeCloseTo(0.12, 6);
    expect(up.real).toBeGreaterThan(0.1);
    await page.keyboard.up('KeyW');
    await advanceSim(page, 1);
    const down = await page.evaluate(() => {
      const a = (window as any).__game.audio;
      return { target: a.gains.engineTarget as number, real: a.params.engineGain as number };
    });
    expect(down.target).toBeCloseTo(0.048, 6);
    expect(down.real).toBeLessThan(0.06);
  });

  // engine-sound C4 (supersede free-roam-city C46) - grafo descrito pelas propriedades reais dos nós
  test('synthesized audio graph', { tag: '@smoke' }, async ({ page }) => {
    await startAudio(page);
    const graph = await page.evaluate(() => (window as any).__game.audio.graph);
    // fontes: oscilador de explosões (onda custom a 33.33 Hz = 1000 rpm / 30), sub uma oitava abaixo, ruído marrom em loop
    expect(graph.sources).toEqual([
      'OscillatorNode(custom,33.33Hz,engine)',
      'OscillatorNode(sine,16.67Hz,sub)',
      'AudioBufferSourceNode(loop=true,ambient)',
    ]);
    // cada aresta é "from -> to" na ordem em que connect() foi chamado; valores lidos dos nós reais
    expect(graph.edges).toEqual([
      'GainNode(1.000,master) -> DynamicsCompressorNode(-18dB,4:1,master)',
      'DynamicsCompressorNode(-18dB,4:1,master) -> AudioDestinationNode',
      'OscillatorNode(custom,33.33Hz,engine) -> BiquadFilterNode(lowpass,250Hz,engine)',
      'OscillatorNode(sine,16.67Hz,sub) -> BiquadFilterNode(lowpass,250Hz,engine)',
      'BiquadFilterNode(lowpass,250Hz,engine) -> GainNode(1.000,tremolo)',
      'GainNode(1.000,tremolo) -> GainNode(0.048,engine)',
      'GainNode(0.048,engine) -> GainNode(1.000,master)',
      'OscillatorNode(sine,6.00Hz,lfo) -> GainNode(0.250,tremoloDepth)',
      'GainNode(0.250,tremoloDepth) -> AudioParam(tremolo.gain)',
      'AudioBufferSourceNode(loop=true,ambient) -> BiquadFilterNode(lowpass,180Hz,ambient)',
      'BiquadFilterNode(lowpass,180Hz,ambient) -> GainNode(0.050,ambient)',
      'GainNode(0.050,ambient) -> GainNode(1.000,master)',
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
      return { cutoff: g.audio.cutoffTarget as number, rpm: g.car.rpm as number, firingHz: g.audio.firingHz as number, params: g.audio.params };
    });
    await page.keyboard.up('KeyW');
    const expected = 250 + ((sample.rpm - 1000) / 6000) * (1400 - 250);
    expect(sample.cutoff).toBeGreaterThan(300);
    expect(Math.abs(sample.cutoff - expected)).toBeLessThan(60);
    // valor REAL do filtro: atrasa o alvo pela rampa, tau 0.15 s x taxa do cutoff (até ~770 Hz/s) = ~115 Hz -> 150 Hz
    expect(sample.params.lowpassHz).toBeGreaterThan(300);
    expect(Math.abs(sample.params.lowpassHz - expected)).toBeLessThan(150);
    // C15: sub segue metade do oscilador principal; tremolo some acima de 2500 rpm
    expect(sample.rpm).toBeGreaterThan(3000);
    expect(Math.abs(sample.params.subHz - sample.params.engineHz / 2)).toBeLessThan(3);
    expect(sample.params.tremoloDepth).toBeLessThan(0.05);
    // C13: o oscilador principal segue rpm / 30 (valor real do AudioParam; rampa de 50 ms + até 5 passos
    // de física entre a escrita do alvo e a leitura em headless ≈ 600 rpm = 20 Hz)
    expect(Math.abs(sample.firingHz - sample.rpm / 30)).toBeLessThan(20);
  });

  // engine-sound C15 - tremolo real em marcha lenta
  test('idle tremolo depth is applied', async ({ page }) => {
    await startAudio(page);
    await advanceSim(page, 0.5);
    const p = await page.evaluate(() => (window as any).__game.audio.params);
    expect(Math.abs(p.tremoloDepth - 0.25)).toBeLessThan(0.005);
    expect(Math.abs(p.subHz - p.engineHz / 2)).toBeLessThan(0.5);
  });

  // engine-sound C9 (regressão de free-roam-city C38, AC 30)
  test('M toggles master gain', async ({ page }) => {
    await startAudio(page);
    await page.keyboard.press('KeyM');
    expect((await page.evaluate(() => (window as any).__game.audio.gains)).master).toBeCloseTo(0, 6);
    await page.keyboard.press('KeyM');
    expect((await page.evaluate(() => (window as any).__game.audio.gains)).master).toBeCloseTo(1, 6);
  });

  // play-fixes C4 (AC 3)
  test('hidden tab suspends the audio', async ({ page }) => {
    await startAudio(page);
    const setVisibility = (v: string) =>
      page.evaluate((v) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
        document.dispatchEvent(new Event('visibilitychange'));
      }, v);
    await setVisibility('hidden');
    await page.waitForFunction(() => (window as any).__game.audio.contextState === 'suspended', null, { timeout: 5_000 });
    await setVisibility('visible');
    await page.waitForFunction(() => (window as any).__game.audio.contextState === 'running', null, { timeout: 5_000 });
  });

  // play-fixes C5 (AC 4)
  test('key or pointer resumes a suspended context', async ({ page }) => {
    await startAudio(page);
    const suspend = async () => {
      await page.evaluate(() => (window as any).__game.audio.suspend());
      await page.waitForFunction(() => (window as any).__game.audio.contextState === 'suspended', null, { timeout: 5_000 });
    };
    await suspend();
    await page.keyboard.press('ShiftLeft');
    await page.waitForFunction(() => (window as any).__game.audio.contextState === 'running', null, { timeout: 5_000 });
    await suspend();
    await page.locator('#game').dispatchEvent('pointerdown');
    await page.waitForFunction(() => (window as any).__game.audio.contextState === 'running', null, { timeout: 5_000 });
  });

  // play-fixes C7 (AC 4): `idle` sem contexto; depois, o `ctx.state` real
  test('audio state mirrors the context', async ({ page }) => {
    const read = () => page.evaluate(() => ({ state: (window as any).__game.audio.state, ctx: (window as any).__game.audio.contextState }));
    expect(await read()).toEqual({ state: 'idle', ctx: 'none' });
    await startAudio(page);
    expect(await read()).toEqual({ state: 'running', ctx: 'running' });
    await page.evaluate(() => (window as any).__game.audio.suspend());
    await page.waitForFunction(() => (window as any).__game.audio.contextState === 'suspended', null, { timeout: 5_000 });
    expect(await read()).toEqual({ state: 'suspended', ctx: 'suspended' });
  });
});

test.describe('audio unavailable', () => {
  // play-fixes C8 (AC 5)
  test('game runs silent when audio fails', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).AudioContext = function () {
        throw new Error('sem Web Audio');
      };
    });
    const warns: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'warning') warns.push(m.text());
    });
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await gotoGame(page);
    await page.keyboard.down('KeyW');
    await advanceSim(page, 1);
    const kmh = await page.evaluate(() => (window as any).__game.car.speedKmh as number);
    await page.keyboard.up('KeyW');
    expect(kmh).toBeGreaterThan(5);
    expect(warns.some((w) => w.startsWith('Áudio indisponível'))).toBe(true);
    expect(pageErrors).toEqual([]);
    expect(await page.evaluate(() => (window as any).__game.audio.state)).toBe('idle');
  });
});
