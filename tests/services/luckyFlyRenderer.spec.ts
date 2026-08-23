/**
 * LuckyFlyRenderer — every enqueued fly launches (none dropped), launches are
 * staggered, and a large backlog compresses to the stream budget.
 */
import { describe, expect, it, vi } from 'vitest';
import { LuckyFlyRenderer } from '../../app/services/luckyFlyRenderer';

function makeCtx() {
  return {
    canvas: { width: 0, height: 0 },
    globalAlpha: 1,
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

function makeRenderer(ctx = makeCtx()) {
  return new LuckyFlyRenderer({
    ctx,
    loadImage: () => Promise.resolve({} as CanvasImageSource),
    thumbnailSize: 58,
    durationMs: 2000,
    holdMs: 800,
    easing: 'linear',
    staggerMs: 40,
    maxStreamMs: 8000,
    jitterPx: 0,
  });
}

const req = { thumbnailUrl: 'https://cdn.test/g.png', path: { start: { x: 0, y: 0 }, center: { x: 1, y: 1 }, end: { x: 2, y: 2 } } };

describe('LuckyFlyRenderer', () => {
  it('staggers launches at staggerMs and never drops a fly', () => {
    const r = makeRenderer();
    for (let i = 0; i < 10; i++) r.enqueue(req);
    r.tick(1000);
    expect(r.inFlight).toBe(1);
    r.tick(1016);
    expect(r.inFlight).toBe(1);
    r.tick(1040);
    expect(r.inFlight).toBe(2);
    r.tick(1400);
    expect(r.inFlight + r.queued).toBe(10);
  });

  it('compresses a 1,000-leg backlog into the stream budget', () => {
    const r = makeRenderer();
    for (let i = 0; i < 1000; i++) r.enqueue(req);
    let now = 0;
    while (r.queued > 0) {
      now += 16;
      r.tick(now);
    }
    expect(now).toBeLessThanOrEqual(8000 + 16);
  });

  it('draws loaded images and retires flies after their timeline', async () => {
    const ctx = makeCtx();
    const r = makeRenderer(ctx);
    r.resize(400, 800, 2);
    expect(ctx.canvas.width).toBe(800);
    r.enqueue(req);
    await Promise.resolve();
    r.tick(0);
    r.tick(1400);
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(r.tick(3000)).toBe(false);
    expect(r.inFlight).toBe(0);
  });
});
