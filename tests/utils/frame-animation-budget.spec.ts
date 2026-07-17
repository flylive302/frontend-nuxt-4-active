import { describe, expect, it } from 'vitest';
import { createFrameAnimationBudget } from '~/utils/frame-animation-budget';

// room-battery-perf/02: pure budget module — cap 15, speakers first, seat-index
// fill, and no-thrash stability under roster churn.

function seats(indices: number[], speakers: number[] = []) {
  const speakerSet = new Set(speakers);
  return indices.map((seatIndex) => ({ seatIndex, isSpeaker: speakerSet.has(seatIndex) }));
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('createFrameAnimationBudget', () => {
  it('selects every eligible seat when under the cap', () => {
    const budget = createFrameAnimationBudget();
    const selected = budget.compute(seats([0, 3, 7]));
    expect([...selected].sort((a, b) => a - b)).toEqual([0, 3, 7]);
  });

  it('selects exactly 15 when more than 15 framed seats are eligible', () => {
    const budget = createFrameAnimationBudget();
    const selected = budget.compute(seats(range(30)));
    expect(selected.size).toBe(15);
  });

  it('always includes active speakers ahead of non-speaking seats', () => {
    const budget = createFrameAnimationBudget();
    // 30 eligible; speakers sit at high indices that plain index-order would drop.
    const selected = budget.compute(seats(range(30), [25, 28, 29]));
    expect(selected.size).toBe(15);
    expect(selected.has(25)).toBe(true);
    expect(selected.has(28)).toBe(true);
    expect(selected.has(29)).toBe(true);
  });

  it('fills non-speaker slots in seat-index order', () => {
    const budget = createFrameAnimationBudget(5);
    const selected = budget.compute(seats([9, 2, 7, 0, 4, 11, 5], [7]));
    // speaker 7 first, then lowest indices: 0, 2, 4, 5.
    expect([...selected].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7]);
  });

  it('caps speakers at the budget too', () => {
    const budget = createFrameAnimationBudget(3);
    const selected = budget.compute(seats(range(10), range(10)));
    expect(selected.size).toBe(3);
  });

  it('stability: an unrelated seat joining does not evict an animating seat', () => {
    const budget = createFrameAnimationBudget(3);
    const first = budget.compute(seats([5, 8, 12]));
    expect([...first].sort((a, b) => a - b)).toEqual([5, 8, 12]);

    // Seat 1 joins with a frame — budget is full; the already-animating seats
    // keep their slots even though 1 < 12 in plain index order.
    const second = budget.compute(seats([1, 5, 8, 12]));
    expect([...second].sort((a, b) => a - b)).toEqual([5, 8, 12]);
  });

  it('stability: an unrelated seat leaving frees a slot without evicting others', () => {
    const budget = createFrameAnimationBudget(3);
    budget.compute(seats([1, 5, 8, 12]));
    // seat 1 was in-budget (first compute picks 1,5,8); it leaves.
    const next = budget.compute(seats([5, 8, 12]));
    expect(next.has(5)).toBe(true);
    expect(next.has(8)).toBe(true);
    expect(next.has(12)).toBe(true);
  });

  it('stability: an unrelated speaker change does not evict an unaffected animating seat', () => {
    const budget = createFrameAnimationBudget(3);
    const first = budget.compute(seats([2, 6, 9, 14]));
    expect([...first].sort((a, b) => a - b)).toEqual([2, 6, 9]);

    // Seat 14 starts speaking: it must be admitted (speakers first), evicting
    // exactly one seat — the others stay put.
    const second = budget.compute(seats([2, 6, 9, 14], [14]));
    expect(second.has(14)).toBe(true);
    expect(second.size).toBe(3);
    const survivors = [...second].filter((i) => i !== 14);
    for (const s of survivors) expect(first.has(s)).toBe(true);

    // Seat 14 stops speaking: retained seats (incl. 14, now previously
    // animating) are stable — no flap back.
    const third = budget.compute(seats([2, 6, 9, 14]));
    expect([...third].sort((a, b) => a - b)).toEqual([...second].sort((a, b) => a - b));
  });

  it('compute is idempotent for an unchanged roster', () => {
    const budget = createFrameAnimationBudget(4);
    const roster = seats(range(10), [7]);
    const a = budget.compute(roster);
    const b = budget.compute(roster);
    expect([...b].sort()).toEqual([...a].sort());
  });

  it('reset() forgets the previous selection', () => {
    const budget = createFrameAnimationBudget(2);
    budget.compute(seats([5, 9]));
    budget.reset();
    const next = budget.compute(seats([1, 5, 9]));
    // With no memory, plain seat-index order wins.
    expect([...next].sort((a, b) => a - b)).toEqual([1, 5]);
  });
});
