import { describe, expect, it } from 'vitest';
import { planReactionPlayback } from '../../app/utils/planReactionPlayback';

describe('planReactionPlayback', () => {
  it('loops a 1s animation 3x (≥3s total, ends on loop boundary)', () => {
    expect(planReactionPlayback(1000)).toEqual({ loops: 3 });
  });

  it('loops a 1.4s animation 3x (≥3s total)', () => {
    expect(planReactionPlayback(1400)).toEqual({ loops: 3 });
  });

  it('loops a 2.9s animation 2x', () => {
    expect(planReactionPlayback(2900)).toEqual({ loops: 2 });
  });

  it('plays a 3s animation exactly once', () => {
    expect(planReactionPlayback(3000)).toEqual({ loops: 1 });
  });

  it('plays a 10s animation exactly once', () => {
    expect(planReactionPlayback(10000)).toEqual({ loops: 1 });
  });

  it('falls back to 1 loop for zero duration', () => {
    expect(planReactionPlayback(0)).toEqual({ loops: 1 });
  });

  it('falls back to 1 loop for NaN duration', () => {
    expect(planReactionPlayback(NaN)).toEqual({ loops: 1 });
  });

  it('falls back to 1 loop for negative duration', () => {
    expect(planReactionPlayback(-500)).toEqual({ loops: 1 });
  });
});
