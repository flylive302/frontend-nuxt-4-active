/**
 * Room video sync clock — pure, framework-agnostic.
 *
 * The server stamps every `RoomVideoSnapshot` with its own clock (`serverTs`).
 * A listener turns that into "where should the video be right now" with
 * `expectedPosition`, decides whether its player has drifted far enough to seek
 * with `shouldCorrect`, and learns how far its local clock is from the server's
 * with `estimateOffset`. No Vue, store, socket or Nuxt imports.
 *
 * Clock convention: `offset = serverClock - localClock`, so
 * `serverNowMs = Date.now() + offset`.
 */
import { ROOM_VIDEO_CLOCK_SAMPLE_COUNT, ROOM_VIDEO_DRIFT_THRESHOLD_SEC } from '~/constants/room';
import type { RoomVideoSnapshot } from '~/types/room/video';

const MS_PER_SECOND = 1000;

/**
 * Where the video should be (seconds) at server time `serverNowMs`.
 *
 * Paused: frozen at `positionAtTs`. Playing: `positionAtTs` plus the server time
 * elapsed since the snapshot was stamped. Always clamped to `>= 0` (a clock that
 * runs slightly behind the snapshot would otherwise go negative) and, when the
 * duration is known and positive, to `<= durationSec`.
 */
export function expectedPosition(snapshot: RoomVideoSnapshot, serverNowMs: number): number {
  const position = snapshot.paused
    ? snapshot.positionAtTs
    : snapshot.positionAtTs + (serverNowMs - snapshot.serverTs) / MS_PER_SECOND;

  const floored = Math.max(0, position);
  const { durationSec } = snapshot;
  return durationSec !== undefined && durationSec > 0 ? Math.min(floored, durationSec) : floored;
}

/**
 * True only when the player is further than `ROOM_VIDEO_DRIFT_THRESHOLD_SEC`
 * from the expected position, in either direction. Exactly on the threshold is
 * still in sync: a seek smaller than the drift it fixes only adds stutter.
 */
export function shouldCorrect(localSec: number, expectedSec: number): boolean {
  return Math.abs(localSec - expectedSec) > ROOM_VIDEO_DRIFT_THRESHOLD_SEC;
}

/**
 * Best estimate of `serverClock - localClock` (ms) from recent clock samples, or
 * `null` when there are none.
 *
 * Each sample is `serverTs - receivedAtLocalMs` for one received snapshot. With
 * `trueOffset = serverClock - localClock` and a one-way transit delay `d >= 0`,
 * `receivedAt = (serverTs - trueOffset) + d`, so `sample = trueOffset - d`. Delay
 * only ever pushes a sample **down**, which makes the fastest packet (the
 * **maximum** sample) the closest to the truth; slow or late-delivered packets
 * are ignored. Taking the minimum would do the opposite and lock onto the
 * slowest packet.
 *
 * Only the last `ROOM_VIDEO_CLOCK_SAMPLE_COUNT` samples count (pass them oldest
 * first), so the estimate follows real clock drift instead of being pinned by one
 * lucky packet from long ago.
 */
export function estimateOffset(samples: number[]): number | null {
  if (samples.length === 0) return null;
  return Math.max(...samples.slice(-ROOM_VIDEO_CLOCK_SAMPLE_COUNT));
}
