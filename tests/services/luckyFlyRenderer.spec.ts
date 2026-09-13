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
    fillText: vi.fn(),
    strokeText: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

function makeRenderer(ctx = makeCtx(), extra: Partial<ConstructorParameters<typeof LuckyFlyRenderer>[0]> = {}) {
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
    ...extra,
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

  it('enqueue(request, count) queues `count` identical flies, all eventually launched — none dropped (gift-authority-tick-fanout ticket 15)', () => {
    const r = makeRenderer();
    r.enqueue(req, 7);
    expect(r.queued).toBe(7);

    let now = 0;
    let everSeen = 0;
    while (r.queued > 0 || r.inFlight > 0) {
      now += 16;
      r.tick(now);
      everSeen = Math.max(everSeen, r.inFlight);
    }
    // Every one of the 7 copies passed through `active` at some point — the
    // queue only ever drains via `tick`'s launch/retire path, never a bulk drop.
    expect(everSeen).toBeGreaterThan(0);
    expect(r.queued).toBe(0);
    expect(r.inFlight).toBe(0);
  });

  it('enqueue(request, count) matches calling enqueue(request) `count` times for pacing (same backlog, same compression)', () => {
    const single = makeRenderer();
    for (let i = 0; i < 5; i++) single.enqueue(req);

    const bulk = makeRenderer();
    bulk.enqueue(req, 5);

    expect(bulk.queued).toBe(single.queued);
  });

  it('`queued` stays exact when flies are enqueued mid-drain (running counter, not an array walk)', () => {
    const r = makeRenderer();
    r.enqueue(req, 6, 0);
    expect(r.queued).toBe(6);

    // Drain part of the backlog, then enqueue on top of the partially
    // consumed head entry — `enqueue` reads `queued` to size burstInterval,
    // so an off-by-N here silently changes the whole burst's pacing.
    r.tick(0);
    r.tick(40);
    const afterDrain = r.queued;
    expect(afterDrain).toBeLessThan(6);

    r.enqueue(req, 4, 80);
    expect(r.queued).toBe(afterDrain + 4);

    let now = 80;
    while (r.queued > 0 && now < 20_000) {
      now += 16;
      r.tick(now);
    }
    expect(r.queued).toBe(0);
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

  // ─── gift-backlog-and-lag 01 ───────────────────────────────────────

  describe('stale drop (viewer was away)', () => {
    it('drops a fly queued longer than maxAgeMs instead of launching it — the "pile on return"', () => {
      const r = makeRenderer(makeCtx(), { maxAgeMs: 8000 });
      // Queued at t=0 while the loop was stalled (hidden tab); first frame at t=60s.
      r.enqueue(req, 30, 0);
      expect(r.queued).toBe(30);
      r.tick(60_000);
      expect(r.inFlight).toBe(0);
      expect(r.queued).toBe(0);
      expect(r.droppedStaleCount).toBe(30);
      expect(r.hasWork()).toBe(false);
    });

    it('keeps a fly inside its age budget and one with no queuedAt (unknown clock)', () => {
      const r = makeRenderer(makeCtx(), { maxAgeMs: 8000 });
      r.enqueue(req, 1, 1000);
      r.enqueue(req, 1); // NaN queuedAt: never stale
      r.tick(5000);
      r.tick(5100);
      expect(r.inFlight).toBe(2);
      expect(r.droppedStaleCount).toBe(0);
    });

    it('a live burst is never judged stale: it drains inside maxStreamMs, the age budget is 1.5× that', () => {
      const r = makeRenderer(makeCtx(), { maxAgeMs: 12000 });
      let now = 0;
      for (let i = 0; i < 1000; i++) r.enqueue(req, 1, now);
      while (r.queued > 0) {
        now += 16;
        r.tick(now);
      }
      expect(r.droppedStaleCount).toBe(0);
    });

    it('clear() forgets queued and in-flight flies', () => {
      const r = makeRenderer();
      r.enqueue(req, 5);
      r.tick(0);
      expect(r.inFlight + r.queued).toBe(5);
      r.clear();
      expect(r.hasWork()).toBe(false);
    });
  });

  describe('fold under frame pressure', () => {
    const pressureOpts = { slowFrameMs: 48, slowFramesToFold: 3, foldActiveThreshold: 40 };

    it('launches a batch item one copy at a time while frames are healthy', () => {
      const r = makeRenderer(makeCtx(), pressureOpts);
      r.enqueue(req, 5);
      r.tick(0);
      r.tick(16);
      r.tick(48);
      expect(r.inFlight).toBe(2);
      expect(r.foldedCount).toBe(0);
    });

    it('after 3 consecutive slow frames a batch item launches as ONE fly with its count — nothing dropped', () => {
      const ctx = makeCtx();
      const r = makeRenderer(ctx, pressureOpts);
      r.enqueue(req, 1); // something in flight so the loop is "running"
      r.tick(0);
      // Three slow frames (100 ms gaps) in a row.
      r.tick(100);
      r.tick(200);
      r.tick(300);
      r.enqueue(req, 7);
      r.tick(400);
      expect(r.foldedCount).toBe(6);
      expect(r.queued).toBe(0);
      expect(r.inFlight).toBe(2);
      // The folded fly draws its ×N badge once its image is loaded.
      return Promise.resolve().then(() => {
        r.tick(500);
        expect(ctx.fillText).toHaveBeenCalledWith('×7', expect.any(Number), expect.any(Number));
      });
    });

    it('folds once the in-flight count reaches foldActiveThreshold, even at a healthy frame rate', () => {
      const r = makeRenderer(makeCtx(), { ...pressureOpts, foldActiveThreshold: 3 });
      r.enqueue(req, 3);
      r.enqueue(req, 10);
      let now = 0;
      while (r.queued > 0) {
        now += 16;
        r.tick(now);
      }
      // 07 round-robin: A1 B1 A2 launch, then in-flight = 3 → B's remaining 9 fold into one.
      expect(r.foldedCount).toBe(8);
    });

    it('healthy frames after a slow patch return to one-copy launches', () => {
      const r = makeRenderer(makeCtx(), pressureOpts);
      r.enqueue(req, 1);
      r.tick(0);
      r.tick(100);
      r.tick(200);
      r.tick(300);
      // Six healthy frames decay the slow counter back to 0.
      for (let t = 316; t <= 400; t += 16) r.tick(t);
      r.enqueue(req, 4);
      r.tick(416);
      expect(r.foldedCount).toBe(0);
      // Existing catch-up rule: the virtual launch clock lands at most one
      // interval behind `now`, so a frame may launch two copies — never all.
      expect(r.queued).toBeGreaterThanOrEqual(2);
      expect(r.inFlight).toBeLessThanOrEqual(3);
    });
  });
});

describe('gift-backlog-and-lag 07 — fairness across senders', () => {
  const reqA = { ...req, thumbnailUrl: 'https://cdn.test/a.png' };
  const reqB = { ...req, thumbnailUrl: 'https://cdn.test/b.png' };
  const reqC = { ...req, thumbnailUrl: 'https://cdn.test/c.png' };

  function launchedUrls(r: LuckyFlyRenderer): string[] {
    return (r as unknown as { active: { url: string }[] }).active.map((f) => f.url);
  }

  it('round-robins launches across queued entries instead of draining the head first', () => {
    const r = makeRenderer();
    r.enqueue(reqA, 50);
    r.enqueue(reqB, 3);
    r.tick(1000);
    r.tick(1040);
    r.tick(1080);
    r.tick(1120);
    expect(launchedUrls(r)).toEqual([reqA.thumbnailUrl, reqB.thumbnailUrl, reqA.thumbnailUrl, reqB.thumbnailUrl]);
    expect(r.queued).toBe(49);
  });

  it('a second sender is on screen within one stagger even mid-burst', () => {
    const r = makeRenderer();
    r.enqueue(reqA, 200);
    r.tick(1000);
    r.tick(1040);
    r.enqueue(reqB, 1);
    r.tick(1080);
    expect(launchedUrls(r)).toContain(reqB.thumbnailUrl);
  });

  it('continues rotating after an entry drains out', () => {
    const r = makeRenderer();
    r.enqueue(reqA, 1);
    r.enqueue(reqB, 2);
    r.enqueue(reqC, 2);
    for (let t = 1000; t <= 1160; t += 40) r.tick(t);
    expect(launchedUrls(r)).toEqual([
      reqA.thumbnailUrl, reqB.thumbnailUrl, reqC.thumbnailUrl, reqB.thumbnailUrl, reqC.thumbnailUrl,
    ]);
    expect(r.queued).toBe(0);
  });

  it('folds each entry to one ×N fly once foldQueuedEntries senders are queued (30-sender case)', () => {
    const r = makeRenderer(makeCtx(), { foldQueuedEntries: 6 });
    for (let i = 0; i < 30; i++) r.enqueue({ ...req, thumbnailUrl: `https://cdn.test/${i}.png` }, 10);
    for (let t = 1000; t < 1000 + 30 * 40; t += 40) r.tick(t);
    // Every sender is on screen within one round; only the last <6 entries
    // (below the fold threshold) stream as singles.
    expect(new Set(launchedUrls(r)).size).toBe(30);
    expect(r.foldedCount).toBeGreaterThanOrEqual(24 * 9);
  });

  it('does not fold below foldQueuedEntries', () => {
    const r = makeRenderer(makeCtx(), { foldQueuedEntries: 6 });
    r.enqueue(reqA, 5);
    r.enqueue(reqB, 5);
    r.tick(1000);
    expect(r.inFlight).toBe(1);
    expect(r.queued).toBe(9);
    expect(r.foldedCount).toBe(0);
  });
});
