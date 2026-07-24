import { describe, it, expect } from 'vitest';
import { evaluateTransportRebuild } from '~/utils/transport-rebuild-budget';

const COOLDOWN = 120_000;
const MAX = 1;

describe('evaluateTransportRebuild — transport-exhaustion loop guard', () => {
  it('allows the first auto-rebuild from a cold budget', () => {
    const d = evaluateTransportRebuild({ attempt: 0, lastAt: 0 }, 1_000_000, COOLDOWN, MAX);
    expect(d.autoRebuild).toBe(true);
    expect(d.next.attempt).toBe(1);
  });

  it('refuses a second auto-rebuild when the transport re-fails inside the window', () => {
    // First exhaustion handled at t=1_000_000 → budget {attempt:1, lastAt:1_050_000}.
    const t0 = 1_050_000;
    // Fresh transport re-fails 40s later (a full engine cycle < window).
    const d = evaluateTransportRebuild({ attempt: 1, lastAt: t0 }, t0 + 40_000, COOLDOWN, MAX);
    expect(d.autoRebuild).toBe(false); // → manual "Reconnect" affordance, no loop
    expect(d.next.attempt).toBe(1);
  });

  it('grants a fresh auto-rebuild once audio stayed healthy for a full window', () => {
    const t0 = 1_050_000;
    const d = evaluateTransportRebuild({ attempt: 1, lastAt: t0 }, t0 + COOLDOWN + 1, COOLDOWN, MAX);
    expect(d.autoRebuild).toBe(true);
    expect(d.next.attempt).toBe(1); // reset to 0, then incremented for this rebuild
  });

  it('is exactly boundary-safe: at the window edge the budget is not yet reset', () => {
    const t0 = 1_050_000;
    const d = evaluateTransportRebuild({ attempt: 1, lastAt: t0 }, t0 + COOLDOWN, COOLDOWN, MAX);
    expect(d.autoRebuild).toBe(false); // strictly greater-than resets; == does not
  });
});
