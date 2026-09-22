import { describe, expect, it } from 'vitest';
import { FRAME_ANIMATION_BUDGET } from '~/constants/room';
import { createFrameAnimationBudget } from '~/utils/frame-animation-budget';

// room-battery-perf/02 + android-client-performance/16: pure budget module —
// cap passed per `compute()` call (device tier × user switch), speakers
// first, seat-index fill, no-thrash stability under roster churn, and a cap
// of 0 (still-only tier/off switch) admitting nobody and clearing memory.

function seats(indices: number[], speakers: number[] = []) {
  const speakerSet = new Set(speakers);
  return indices.map((seatIndex) => ({ seatIndex, isSpeaker: speakerSet.has(seatIndex) }));
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('createFrameAnimationBudget', () => {
  it('selects every eligible seat when under the cap', () => {
    const budget = createFrameAnimationBudget();
    const selected = budget.compute(seats([0, 3, 7]), FRAME_ANIMATION_BUDGET);
    expect([...selected].sort((a, b) => a - b)).toEqual([0, 3, 7]);
  });

  it('selects exactly FRAME_ANIMATION_BUDGET when more framed seats are eligible', () => {
    const budget = createFrameAnimationBudget();
    const selected = budget.compute(seats(range(30)), FRAME_ANIMATION_BUDGET);
    expect(selected.size).toBe(FRAME_ANIMATION_BUDGET);
  });

  it('always includes active speakers ahead of non-speaking seats', () => {
    const budget = createFrameAnimationBudget();
    // 30 eligible; speakers sit at high indices that plain index-order would drop.
    const selected = budget.compute(seats(range(30), [25, 28, 29]), FRAME_ANIMATION_BUDGET);
    expect(selected.size).toBe(FRAME_ANIMATION_BUDGET);
    expect(selected.has(25)).toBe(true);
    expect(selected.has(28)).toBe(true);
    expect(selected.has(29)).toBe(true);
  });

  it('fills non-speaker slots in seat-index order', () => {
    const budget = createFrameAnimationBudget();
    const selected = budget.compute(seats([9, 2, 7, 0, 4, 11, 5], [7]), 5);
    // speaker 7 first, then lowest indices: 0, 2, 4, 5.
    expect([...selected].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7]);
  });

  it('caps speakers at the budget too', () => {
    const budget = createFrameAnimationBudget();
    const selected = budget.compute(seats(range(10), range(10)), 3);
    expect(selected.size).toBe(3);
  });

  it('a cap of 0 admits nobody, even with active speakers', () => {
    const budget = createFrameAnimationBudget();
    const selected = budget.compute(seats(range(10), [1, 2, 3]), 0);
    expect(selected.size).toBe(0);
  });

  it('stability: an unrelated seat joining does not evict an animating seat', () => {
    const budget = createFrameAnimationBudget();
    const first = budget.compute(seats([5, 8, 12]), 3);
    expect([...first].sort((a, b) => a - b)).toEqual([5, 8, 12]);

    // Seat 1 joins with a frame — budget is full; the already-animating seats
    // keep their slots even though 1 < 12 in plain index order.
    const second = budget.compute(seats([1, 5, 8, 12]), 3);
    expect([...second].sort((a, b) => a - b)).toEqual([5, 8, 12]);
  });

  it('stability: an unrelated seat leaving frees a slot without evicting others', () => {
    const budget = createFrameAnimationBudget();
    budget.compute(seats([1, 5, 8, 12]), 3);
    // seat 1 was in-budget (first compute picks 1,5,8); it leaves.
    const next = budget.compute(seats([5, 8, 12]), 3);
    expect(next.has(5)).toBe(true);
    expect(next.has(8)).toBe(true);
    expect(next.has(12)).toBe(true);
  });

  it('stability: an unrelated speaker change does not evict an unaffected animating seat', () => {
    const budget = createFrameAnimationBudget();
    const first = budget.compute(seats([2, 6, 9, 14]), 3);
    expect([...first].sort((a, b) => a - b)).toEqual([2, 6, 9]);

    // Seat 14 starts speaking: it must be admitted (speakers first), evicting
    // exactly one seat — the others stay put.
    const second = budget.compute(seats([2, 6, 9, 14], [14]), 3);
    expect(second.has(14)).toBe(true);
    expect(second.size).toBe(3);
    const survivors = [...second].filter((i) => i !== 14);
    for (const s of survivors) expect(first.has(s)).toBe(true);

    // Seat 14 stops speaking: retained seats (incl. 14, now previously
    // animating) are stable — no flap back.
    const third = budget.compute(seats([2, 6, 9, 14]), 3);
    expect([...third].sort((a, b) => a - b)).toEqual([...second].sort((a, b) => a - b));
  });

  it('compute is idempotent for an unchanged roster', () => {
    const budget = createFrameAnimationBudget();
    const roster = seats(range(10), [7]);
    const a = budget.compute(roster, 4);
    const b = budget.compute(roster, 4);
    expect([...b].sort()).toEqual([...a].sort());
  });

  it('reset() forgets the previous selection', () => {
    const budget = createFrameAnimationBudget();
    budget.compute(seats([5, 9]), 2);
    budget.reset();
    const next = budget.compute(seats([1, 5, 9]), 2);
    // With no memory, plain seat-index order wins.
    expect([...next].sort((a, b) => a - b)).toEqual([1, 5]);
  });

  it('a cap of 0 clears the no-thrash memory: a later compute uses plain seat-index order', () => {
    const budget = createFrameAnimationBudget();
    budget.compute(seats([5, 9]), 3);
    budget.compute(seats([1, 5, 9]), 0);
    // The 0-cap compute must have forgotten {5, 9} — otherwise they would be
    // retained ahead of seat 1 once the cap reopens.
    const next = budget.compute(seats([1, 5, 9]), 3);
    expect([...next].sort((a, b) => a - b)).toEqual([1, 5, 9]);
  });

  it('a cap change from 4 to 2 mid-roster keeps speakers first', () => {
    const budget = createFrameAnimationBudget();
    const first = budget.compute(seats(range(6), [4]), 4);
    expect(first.has(4)).toBe(true);
    expect(first.size).toBe(4);

    const second = budget.compute(seats(range(6), [4]), 2);
    expect(second.size).toBe(2);
    expect(second.has(4)).toBe(true);
  });
});
