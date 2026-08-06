/**
 * aws-app-affinity/04 — the join-time catch-up loop.
 *
 * This is the loop that restores every active speaker when a user joins or
 * REJOINS a room (`useRoomAudio.joinRoom`, reached by every reconnect path:
 * network blip, backgrounded app, socket drop, PWA resume). It used to be
 * strictly serial, so recovery cost one awaited round trip per speaker and a
 * large room could exhaust `ROOM_OP_TIMEOUT_MS` before finishing.
 *
 * 🔴 Every test here holds the consume calls open with a gate and asserts on
 * what is IN FLIGHT. A test that lets each call resolve before checking proves
 * nothing about concurrency — it would pass just as happily against the serial
 * loop this ticket replaced.
 *
 * What this file does NOT cover: audible recovery. A resolved ack is not sound
 * — the ICE/DTLS handshake that makes audio hearable is never awaited (CE-02),
 * so the acceptance check for "the room came back" is user-run, by design.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  consumeCatchupProducers,
  type CatchupProducer,
  type ConsumeProducerFn,
} from '~/utils/catchup-producers';

/** A latch the test opens when it chooses, so calls overlap for real. */
function openableGate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => {
    open = () => resolve();
  });
  return { opened, open };
}

function producer(producerId: string, userId: number, source?: 'mic' | 'music'): CatchupProducer {
  return source === undefined ? { producerId, userId } : { producerId, userId, source };
}

/**
 * Mocks are given their signature explicitly: a bare `vi.fn(async () => {})`
 * infers zero parameters, so asserting on `mock.calls[n][argIndex]` — which is
 * how these tests prove the RIGHT producer was consumed, not just that some
 * call happened — would not typecheck.
 */
function makeConsume(impl: ConsumeProducerFn = async () => {}) {
  return vi.fn<ConsumeProducerFn>(impl);
}

function makeOnError() {
  return vi.fn<(error: unknown, producer: CatchupProducer) => void>();
}

/**
 * Records every consume call and holds it open until the test releases the
 * gate, so `started` can be inspected while calls are still pending.
 */
function makeGatedConsume() {
  const started: string[] = [];
  const finished: string[] = [];
  const gate = openableGate();

  const consume = makeConsume(async (producerId) => {
    started.push(producerId);
    await gate.opened;
    finished.push(producerId);
  });

  return { consume, started, finished, release: gate.open };
}

/** Lets pending microtasks drain so in-flight counts settle before asserting. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

describe('consumeCatchupProducers', () => {
  it('holds several consumes in flight at once instead of one at a time', async () => {
    const { consume, started, release } = makeGatedConsume();
    const producers = [
      producer('p1', 1),
      producer('p2', 2),
      producer('p3', 3),
      producer('p4', 4),
    ];

    const done = consumeCatchupProducers(producers, 'room-1', consume, makeOnError(), 4);
    await settle();

    // The load-bearing assertion: all four started before ANY was allowed to
    // finish. Serially this would read 1.
    expect(started).toHaveLength(4);

    release();
    await done;
  });

  it('never exceeds the concurrency ceiling', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const gate = openableGate();
    const consume = makeConsume(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await gate.opened;
      inFlight--;
    });

    const producers = Array.from({ length: 12 }, (_, i) => producer(`p${i}`, i));
    const done = consumeCatchupProducers(producers, 'room-1', consume, makeOnError(), 3);
    await settle();

    // Bounded on purpose — an unbounded burst on a 30-seat room fires 30
    // simultaneous emits into an already-unhealthy link.
    expect(maxInFlight).toBe(3);

    gate.open();
    await done;
    expect(consume).toHaveBeenCalledTimes(12);
  });

  it('completes every producer, so the whole room is restored', async () => {
    const consume = makeConsume();
    const producers = Array.from({ length: 7 }, (_, i) => producer(`p${i}`, i));

    await consumeCatchupProducers(producers, 'room-1', consume, makeOnError(), 3);

    expect(consume).toHaveBeenCalledTimes(7);
    expect(consume.mock.calls.map((call) => call[0])).toEqual(
      producers.map((entry) => entry.producerId),
    );
  });

  it('leaves the other speakers consumed when one producer fails', async () => {
    // The failure mode that matters: one unrecoverable speaker must not
    // silence the rest of the room. Rejection (a socket timeout) is the only
    // path that reaches the catch — a server "no" returns quietly instead.
    const onError = makeOnError();
    const consume = makeConsume(async (producerId) => {
      if (producerId === 'p2') {
        throw new Error('socket timed out');
      }
    });
    const producers = [producer('p1', 1), producer('p2', 2), producer('p3', 3)];

    await expect(
      consumeCatchupProducers(producers, 'room-1', consume, onError, 2),
    ).resolves.toBeUndefined();

    expect(consume).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[1]).toEqual(producers[1]);
  });

  it('keeps draining after a failure even when the failure is first to settle', async () => {
    // A rejection escaping the task would abandon the caller while the other
    // workers kept running in the background — half a room, plus an unhandled
    // rejection. Fail item 0 immediately, with more work still queued behind.
    const onError = makeOnError();
    const consume = makeConsume(async (producerId) => {
      if (producerId === 'p0') {
        throw new Error('socket timed out');
      }
    });
    const producers = Array.from({ length: 6 }, (_, i) => producer(`p${i}`, i));

    await consumeCatchupProducers(producers, 'room-1', consume, onError, 2);

    expect(consume).toHaveBeenCalledTimes(6);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('consumes only the newest producer per user and source', async () => {
    // 🔴 The voice-doubling guard. Run concurrently WITHOUT this, both entries
    // read an empty displacement slot, neither displaces the other, and one
    // speaker ends up audible twice.
    const consume = makeConsume();
    const producers = [
      producer('stale-mic', 7, 'mic'),
      producer('fresh-mic', 7, 'mic'),
    ];

    await consumeCatchupProducers(producers, 'room-1', consume, makeOnError(), 4);

    expect(consume).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledWith('fresh-mic', 'room-1', 7, 'mic');
    // The negative matters as much as the count: "called once" would also pass
    // if dedup kept the STALE entry, which is silence instead of doubling —
    // a different bug, equally bad, and invisible to a count assertion.
    expect(consume).not.toHaveBeenCalledWith('stale-mic', 'room-1', 7, 'mic');
  });

  it('still consumes a user mic AND music producer', async () => {
    // The counterpart to the test above: collapsing on userId alone would
    // silence one of the two, so dedup must key on (user, source).
    const consume = makeConsume();
    const producers = [producer('mic-1', 7, 'mic'), producer('music-1', 7, 'music')];

    await consumeCatchupProducers(producers, 'room-1', consume, makeOnError(), 4);

    expect(consume).toHaveBeenCalledTimes(2);
  });

  it('treats a producer with no source as mic, matching the server compat default', async () => {
    const consume = makeConsume();
    const producers = [producer('legacy', 7), producer('explicit', 7, 'mic')];

    await consumeCatchupProducers(producers, 'room-1', consume, makeOnError(), 4);

    // Both are that user's mic, so they collide and the newest wins — and the
    // surviving call must pass `'mic'`, not `undefined`, or the displacement
    // key inside `consumeProducer` would differ from the one dedup used.
    expect(consume).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledWith('explicit', 'room-1', 7, 'mic');
  });

  it('does nothing when the room has no active speakers', async () => {
    const consume = makeConsume();

    await consumeCatchupProducers([], 'room-1', consume, makeOnError(), 4);

    expect(consume).not.toHaveBeenCalled();
  });
});
