import { describe, expect, it } from 'vitest';
import { buildFlyTimeline, cubicBezier, launchIntervalMs, parseEasing, sampleFly } from '../../app/utils/lucky-fly-path';

const path = { start: { x: 0, y: 0 }, center: { x: 100, y: 100 }, end: { x: 200, y: 0 } };

describe('lucky-fly-path', () => {
  it('keeps the original 0/.15/.5/.85/1 pacing with the hold inserted at center', () => {
    const t = buildFlyTimeline(path, 2000, 800);
    expect(t.totalMs).toBe(2800);
    expect(t.keyframes.map((k) => +k.at.toFixed(3))).toEqual([0, 0.107, 0.357, 0.643, 0.893, 1]);
  });

  it('samples start invisible, center at full size during the hold, end invisible', () => {
    const t = buildFlyTimeline(path, 2000, 800);
    const linear = (x: number): number => x;
    expect(sampleFly(t, 0, linear)).toMatchObject({ x: 0, y: 0, opacity: 0 });
    expect(sampleFly(t, 1400, linear)).toMatchObject({ x: 100, y: 100, scale: 1.3, opacity: 1 });
    expect(sampleFly(t, 5000, linear)).toMatchObject({ x: 200, y: 0, opacity: 0 });
  });

  it('cubic-bezier is monotonic and hits its endpoints', () => {
    const ease = cubicBezier(0.4, 0, 0.2, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    let prev = 0;
    for (let i = 1; i <= 20; i++) {
      const v = ease(i / 20);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(parseEasing('linear')(0.3)).toBe(0.3);
  });

  it('compresses the launch interval so a backlog drains within the stream budget', () => {
    expect(launchIntervalMs(1, 40, 8000)).toBe(40);
    expect(launchIntervalMs(100, 40, 8000)).toBe(40);
    expect(launchIntervalMs(1000, 40, 8000)).toBe(8);
    expect(launchIntervalMs(100000, 40, 8000)).toBeCloseTo(0.08);
  });
});
