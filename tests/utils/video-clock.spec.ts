import { describe, expect, it } from 'vitest';
import {
  ROOM_VIDEO_CLOCK_SAMPLE_COUNT,
  ROOM_VIDEO_DRIFT_THRESHOLD_SEC,
} from '~/constants/room';
import type { RoomVideoSnapshot } from '~/types/room/video';
import { estimateOffset, expectedPosition, shouldCorrect } from '~/utils/video-clock';

const SERVER_TS = 1_700_000_000_000;

function makeSnapshot(overrides: Partial<RoomVideoSnapshot> = {}): RoomVideoSnapshot {
  return {
    controllerUserId: 7,
    source: { kind: 'youtube', videoId: 'dQw4w9WgXcQ' },
    paused: false,
    positionAtTs: 10,
    serverTs: SERVER_TS,
    revision: 1,
    ...overrides,
  };
}

describe('expectedPosition', () => {
  it('holds at positionAtTs while paused, however much server time passes', () => {
    const snapshot = makeSnapshot({ paused: true, positionAtTs: 42.5 });

    expect(expectedPosition(snapshot, SERVER_TS)).toBe(42.5);
    expect(expectedPosition(snapshot, SERVER_TS + 60_000)).toBe(42.5);
  });

  it('advances in real time while playing', () => {
    const snapshot = makeSnapshot({ paused: false, positionAtTs: 10 });

    expect(expectedPosition(snapshot, SERVER_TS)).toBe(10);
    expect(expectedPosition(snapshot, SERVER_TS + 2_500)).toBe(12.5);
    expect(expectedPosition(snapshot, SERVER_TS + 90_000)).toBe(100);
  });

  it('clamps to durationSec once the video would have ended', () => {
    const snapshot = makeSnapshot({ positionAtTs: 95, durationSec: 100 });

    expect(expectedPosition(snapshot, SERVER_TS + 4_000)).toBe(99);
    expect(expectedPosition(snapshot, SERVER_TS + 5_000)).toBe(100);
    expect(expectedPosition(snapshot, SERVER_TS + 600_000)).toBe(100);
  });

  it('clamps a paused position that is already past durationSec', () => {
    const snapshot = makeSnapshot({ paused: true, positionAtTs: 120, durationSec: 100 });

    expect(expectedPosition(snapshot, SERVER_TS)).toBe(100);
  });

  it('clamps to 0 when server time is before the snapshot (negative drift)', () => {
    const snapshot = makeSnapshot({ positionAtTs: 1 });

    expect(expectedPosition(snapshot, SERVER_TS - 500)).toBe(0.5);
    expect(expectedPosition(snapshot, SERVER_TS - 5_000)).toBe(0);
  });

  it('clamps a negative positionAtTs to 0', () => {
    expect(expectedPosition(makeSnapshot({ paused: true, positionAtTs: -3 }), SERVER_TS)).toBe(0);
  });

  it('has no upper clamp when durationSec is absent', () => {
    const snapshot = makeSnapshot({ positionAtTs: 5 });

    expect(snapshot.durationSec).toBeUndefined();
    expect(expectedPosition(snapshot, SERVER_TS + 3_600_000)).toBe(3605);
  });

  it('has no upper clamp when durationSec is not positive', () => {
    expect(expectedPosition(makeSnapshot({ positionAtTs: 5, durationSec: 0 }), SERVER_TS + 10_000)).toBe(15);
    expect(expectedPosition(makeSnapshot({ positionAtTs: 5, durationSec: -1 }), SERVER_TS + 10_000)).toBe(15);
  });

  it('does not mutate the snapshot', () => {
    const snapshot = makeSnapshot();
    const before = { ...snapshot };

    expectedPosition(snapshot, SERVER_TS + 10_000);

    expect(snapshot).toEqual(before);
  });
});

describe('shouldCorrect', () => {
  it('uses a 1.5 s threshold', () => {
    expect(ROOM_VIDEO_DRIFT_THRESHOLD_SEC).toBe(1.5);
  });

  it('is false when exactly in sync', () => {
    expect(shouldCorrect(30, 30)).toBe(false);
  });

  it('is false just inside the threshold, in both directions', () => {
    expect(shouldCorrect(100, 101.49)).toBe(false);
    expect(shouldCorrect(101.49, 100)).toBe(false);
  });

  it('is false exactly on the threshold, in both directions', () => {
    expect(shouldCorrect(100, 101.5)).toBe(false);
    expect(shouldCorrect(101.5, 100)).toBe(false);
  });

  it('is true just outside the threshold, in both directions', () => {
    expect(shouldCorrect(100, 101.51)).toBe(true);
    expect(shouldCorrect(101.51, 100)).toBe(true);
  });

  it('is true for a large drift', () => {
    expect(shouldCorrect(0, 600)).toBe(true);
    expect(shouldCorrect(600, 0)).toBe(true);
  });
});

describe('estimateOffset', () => {
  it('is null with no samples', () => {
    expect(estimateOffset([])).toBeNull();
  });

  it('returns the only sample when there is one', () => {
    expect(estimateOffset([-120])).toBe(-120);
  });

  it('ignores a late-delivered sample (big transit delay drags it far down)', () => {
    // True offset +5000 ms; ordinary packets take 20-60 ms, one took 3 s.
    const samples = [4_960, 4_975, 2_000, 4_940, 4_970];

    expect(estimateOffset(samples)).toBe(4_975);
  });

  it('prefers the freshest packet, i.e. the largest sample', () => {
    expect(estimateOffset([-300, -50, -200])).toBe(-50);
  });

  it('uses whatever exists when there are fewer than N samples', () => {
    expect(ROOM_VIDEO_CLOCK_SAMPLE_COUNT).toBe(5);
    expect(estimateOffset([100, 140, 90])).toBe(140);
  });

  it('only counts the last N samples', () => {
    // An early freak sample (the max overall) has aged out of the window.
    const samples = [9_999, 100, 130, 120, 110, 125];

    expect(samples).toHaveLength(ROOM_VIDEO_CLOCK_SAMPLE_COUNT + 1);
    expect(estimateOffset(samples)).toBe(130);
  });

  it('still counts a sample that is exactly N back from the newest', () => {
    const samples = [9_999, 100, 130, 120, 110];

    expect(samples).toHaveLength(ROOM_VIDEO_CLOCK_SAMPLE_COUNT);
    expect(estimateOffset(samples)).toBe(9_999);
  });

  it('follows a real clock shift once old samples age out', () => {
    // Local clock jumped 1 s: new samples are 1000 lower and the old ones leave the window.
    const samples = [200, 205, 198, 202, 201, -800, -795, -802, -799, -801];

    expect(estimateOffset(samples)).toBe(-795);
  });

  it('does not mutate the input array', () => {
    const samples = [3, 1, 2, 5, 4, 6, 0];
    const before = [...samples];

    estimateOffset(samples);

    expect(samples).toEqual(before);
  });
});
