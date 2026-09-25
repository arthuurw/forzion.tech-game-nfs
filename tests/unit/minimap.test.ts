import { describe, expect, it } from 'vitest';
import { MINIMAP_SIZE_PX, MINIMAP_WINDOW_M, worldToMinimap } from '../../src/hud/minimapMath';

describe('minimap math', () => {
  // C30 (AC 23)
  it('320 m window into 160 px', () => {
    expect(MINIMAP_SIZE_PX).toBe(160);
    expect(MINIMAP_WINDOW_M).toBe(320);
    const car = { x: 10, z: -40 };
    expect(worldToMinimap(10, -40, car)).toEqual({ x: 80, y: 80 });
    expect(worldToMinimap(170, -40, car)).toEqual({ x: 160, y: 80 });
    expect(worldToMinimap(10, -200, car)).toEqual({ x: 80, y: 0 });
  });
});
