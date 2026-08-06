import type { ProducerSource } from '~/types/room/audio';
import { runWithConcurrency } from '~/utils/async-pool';
import { ROOM_RECONSUME_CONCURRENCY } from '~/constants/room';

/**
 * The shape `room:join` returns for each speaker already producing when we
 * arrive. Structurally matched rather than imported wholesale so this stays a
 * pure function over data, testable without a socket.
 */
export interface CatchupProducer {
  producerId: string;
  userId: number;
  source?: ProducerSource;
}

/**
 * The key `consumeProducer()` displaces on: one live consumer per user *per
 * source*, so a user's fresh mic producer replaces only their stale mic
 * consumer and never touches their music consumer.
 *
 * Mirrors `useMediasoupStreaming.ts`'s `trackingKey`, including the `'mic'`
 * compat default for an entry from a pre-`source` server. If the two ever
 * disagree, dedup silently stops matching displacement and the doubling this
 * function exists to prevent comes back.
 */
function displacementKey(producer: CatchupProducer): string {
  return `${producer.userId}:${producer.source ?? 'mic'}`;
}

/**
 * Collapse a join snapshot to at most one producer per (user, source).
 *
 * # 🔴 This is a correctness prerequisite for consuming the snapshot in
 * parallel — not an optimisation.
 *
 * `consumeProducer()` displaces a stale consumer by *reading*
 * `consumerProducerByKey` (`useMediasoupStreaming.ts:509`) and *writing* it two
 * awaits later, inside `buildConsumer()` (`:590`). The serial loop made that
 * read-modify-write safe by construction: entry N always observed entry N−1's
 * write.
 *
 * Run the same snapshot concurrently and two entries sharing a key both read an
 * empty slot, so **neither displaces the other**. Both build a consumer, both
 * attach an `<audio>` element, and the second write orphans the first — still
 * playing, no longer reachable by `stopConsumer()`. That is audible as **one
 * speaker heard twice**, the voice-doubling class of defect this codebase has
 * already had to fix once.
 *
 * Deduping up front removes the race by construction rather than guarding it,
 * and **preserves the serial loop's end state exactly**: for duplicates A then
 * B, serial ends with B consumed and A stopped; this ends with only B ever
 * built. Same result, two fewer round trips, no window to race in.
 *
 * Last entry wins because the server appends, so the newest producer for a key
 * is the live one — the same one the serial loop converged on. Relative order
 * follows each key's *first* appearance; ordering is not load-bearing once the
 * callers run concurrently, but keeping it stable makes tests readable.
 */
export function dedupeCatchupProducers<T extends CatchupProducer>(producers: readonly T[]): T[] {
  const byKey = new Map<string, T>();

  for (const producer of producers) {
    byKey.set(displacementKey(producer), producer);
  }

  return [...byKey.values()];
}

/** What `consumeCatchupProducers` needs from `useMediasoupStreaming`. */
export type ConsumeProducerFn = (
  producerId: string,
  roomId: string,
  producerUserId?: number,
  source?: ProducerSource,
) => Promise<void>;

/**
 * Restore every speaker already producing when we joined — deduped, then
 * consumed with bounded concurrency (aws-app-affinity/04).
 *
 * Lives here rather than inline in `useRoomAudio` so the loop's mechanics —
 * dedup, ceiling, per-producer failure tolerance — are testable without
 * standing up the whole room orchestrator. `consume` is injected for the same
 * reason; nothing in this module touches Vue, a store, or a socket.
 *
 * **This never rejects.** A speaker that cannot be restored is reported through
 * `onError` and skipped: one unrecoverable producer must not silence the rest
 * of the room, which is exactly what the serial loop's `try`/`catch` bought and
 * what `runWithConcurrency` requires of its task.
 */
export async function consumeCatchupProducers(
  producers: readonly CatchupProducer[],
  roomId: string,
  consume: ConsumeProducerFn,
  onError: (error: unknown, producer: CatchupProducer) => void,
  concurrency: number = ROOM_RECONSUME_CONCURRENCY,
): Promise<void> {
  await runWithConcurrency(
    dedupeCatchupProducers(producers),
    concurrency,
    async (producer) => {
      try {
        // Compat: an entry without `source` (pre-feature server) is `mic`, and
        // must resolve identically to `displacementKey`'s default or dedup and
        // displacement would disagree about which consumer replaces which.
        await consume(producer.producerId, roomId, producer.userId, producer.source ?? 'mic');
      } catch (error) {
        onError(error, producer);
      }
    },
  );
}
