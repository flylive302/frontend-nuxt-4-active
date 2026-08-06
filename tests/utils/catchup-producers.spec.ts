import { describe, expect, it } from 'vitest';
import { dedupeCatchupProducers, type CatchupProducer } from '~/utils/catchup-producers';

describe('dedupeCatchupProducers', () => {
  it('returns a list with no duplicate (user, source) pairs unchanged', () => {
    const producers: CatchupProducer[] = [
      { producerId: 'p1', userId: 1, source: 'mic' },
      { producerId: 'p2', userId: 2, source: 'mic' },
      { producerId: 'p3', userId: 1, source: 'music' },
    ];

    const result = dedupeCatchupProducers(producers);

    expect(result.length).toBe(producers.length);
    expect(result.map((p) => p.producerId)).toEqual(['p1', 'p2', 'p3']);
  });

  it('collapses two producers for the same user and source, keeping the LAST one', () => {
    // This is the case that prevents voice doubling: the stale producer must
    // be dropped, not the fresh one, or the user is heard twice.
    const producers: CatchupProducer[] = [
      { producerId: 'stale', userId: 1, source: 'mic' },
      { producerId: 'fresh', userId: 1, source: 'mic' },
    ];

    const result = dedupeCatchupProducers(producers);

    expect(result.length).toBe(1);
    expect(result[0]!.producerId).toBe('fresh');
  });

  it('does not collapse the same user across different sources', () => {
    // A user's mic and music producers are independent and both must be
    // consumed — collapsing on userId alone would silence one of them.
    const producers: CatchupProducer[] = [
      { producerId: 'mic-p', userId: 1, source: 'mic' },
      { producerId: 'music-p', userId: 1, source: 'music' },
    ];

    const result = dedupeCatchupProducers(producers);

    expect(result.length).toBe(2);
    expect(result.map((p) => p.producerId)).toEqual(['mic-p', 'music-p']);
  });

  it('collides an omitted source with an explicit "mic" for the same user, last wins', () => {
    // No `source` on the wire means a pre-`source` server peer — the `?? 'mic'`
    // compat default must key it the same as an explicit 'mic' entry.
    const producers: CatchupProducer[] = [
      { producerId: 'no-source', userId: 1 },
      { producerId: 'explicit-mic', userId: 1, source: 'mic' },
    ];

    const result = dedupeCatchupProducers(producers);

    expect(result.length).toBe(1);
    expect(result[0]!.producerId).toBe('explicit-mic');
  });

  it('never collapses different users sharing the same source', () => {
    const producers: CatchupProducer[] = [
      { producerId: 'p1', userId: 1, source: 'mic' },
      { producerId: 'p2', userId: 2, source: 'mic' },
    ];

    const result = dedupeCatchupProducers(producers);

    expect(result.length).toBe(2);
  });

  it('returns an empty array for an empty array', () => {
    expect(dedupeCatchupProducers([])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const producers: CatchupProducer[] = [
      { producerId: 'stale', userId: 1, source: 'mic' },
      { producerId: 'fresh', userId: 1, source: 'mic' },
    ];
    const snapshot = [...producers];

    dedupeCatchupProducers(producers);

    expect(producers).toEqual(snapshot);
  });
});
