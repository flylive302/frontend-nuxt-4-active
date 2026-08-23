import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFrameCoalescer, createTrailingThrottle } from '../../app/utils/frame-batcher';

describe('createFrameCoalescer', () => {
  it('runs flush once per frame no matter how many schedules', () => {
    const flush = vi.fn();
    const callbacks: Array<() => void> = [];
    const c = createFrameCoalescer(flush, (cb) => {
      callbacks.push(cb);
      return () => callbacks.splice(callbacks.indexOf(cb), 1);
    });
    for (let i = 0; i < 300; i++) c.schedule();
    expect(callbacks).toHaveLength(1);
    expect(c.pending).toBe(true);
    callbacks[0]!();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(c.pending).toBe(false);
  });

  it('flushNow runs immediately and cancels the frame; cancel drops it', () => {
    const flush = vi.fn();
    const cancel = vi.fn();
    const c = createFrameCoalescer(flush, () => cancel);
    c.schedule();
    c.flushNow();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    c.schedule();
    c.cancel();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(c.pending).toBe(false);
  });

  it('falls back to a microtask without requestAnimationFrame', async () => {
    const flush = vi.fn();
    const c = createFrameCoalescer(flush);
    c.schedule();
    expect(flush).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(flush).toHaveBeenCalledTimes(1);
  });
});

describe('createTrailingThrottle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires immediately, then once per window with the latest value', () => {
    const fn = vi.fn();
    const t = createTrailingThrottle<number>(fn, 500);
    t(1);
    expect(fn).toHaveBeenLastCalledWith(1);
    for (let i = 2; i <= 300; i++) t(i);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(300);
  });
});
