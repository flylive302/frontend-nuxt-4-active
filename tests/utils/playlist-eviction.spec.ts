import { describe, it, expect } from 'vitest'

import { planEviction, type EvictableRecord } from '~/utils/playlist-eviction'

const NONE: ReadonlySet<string> = new Set()

function rec(
  key: string,
  size: number,
  addedAt: number,
  lastPlayedAt: number | null = null,
): EvictableRecord {
  return { key, size, addedAt, lastPlayedAt }
}

describe('planEviction', () => {
  describe('when the incoming song already fits', () => {
    it('returns no evictions for an empty library', () => {
      expect(planEviction([], NONE, 50, 100)).toEqual({ evictKeys: [], fits: true })
    })

    it('returns no evictions when used + incoming is under the cap', () => {
      const records = [rec('a', 30, 1), rec('b', 30, 2)]

      expect(planEviction(records, NONE, 20, 100)).toEqual({ evictKeys: [], fits: true })
    })

    it('treats used + incoming === cap as fitting (inclusive boundary)', () => {
      const records = [rec('a', 40, 1), rec('b', 40, 2)]

      expect(planEviction(records, NONE, 20, 100)).toEqual({ evictKeys: [], fits: true })
    })

    it('needs an eviction when it is one byte over the cap', () => {
      const records = [rec('a', 40, 1), rec('b', 40, 2)]

      const plan = planEviction(records, NONE, 21, 100)

      expect(plan.fits).toBe(true)
      expect(plan.evictKeys).toEqual(['a'])
    })
  })

  describe('eviction order', () => {
    it('evicts least-recently-played first', () => {
      const records = [
        rec('recent', 40, 1, 300),
        rec('oldest', 40, 2, 100),
        rec('middle', 40, 3, 200),
      ]

      // used 120, incoming 80, cap 150 → need to free 50 → two records.
      const plan = planEviction(records, NONE, 80, 150)

      expect(plan).toEqual({ evictKeys: ['oldest', 'middle'], fits: true })
    })

    it('falls back to addedAt for never-played songs', () => {
      const records = [
        rec('added-late', 40, 500, null),
        rec('added-early', 40, 100, null),
        rec('added-mid', 40, 300, null),
      ]

      const plan = planEviction(records, NONE, 80, 150)

      expect(plan).toEqual({ evictKeys: ['added-early', 'added-mid'], fits: true })
    })

    it('interleaves played and never-played songs by their effective recency', () => {
      const records = [
        rec('played-recently', 40, 1, 1000), // recency 1000
        rec('never-played-old', 40, 200, null), // recency 200
        rec('played-long-ago', 40, 5000, 300), // recency 300 (lastPlayedAt wins over addedAt)
      ]

      const plan = planEviction(records, NONE, 80, 150)

      expect(plan).toEqual({ evictKeys: ['never-played-old', 'played-long-ago'], fits: true })
    })

    it('uses lastPlayedAt of 0 as a real timestamp, not as "never played"', () => {
      const records = [
        rec('epoch-played', 40, 900, 0), // recency 0 (?? keeps 0)
        rec('never-played', 40, 100, null), // recency 100
        rec('later', 40, 50, 500),
      ]

      const plan = planEviction(records, NONE, 80, 150)

      expect(plan.evictKeys).toEqual(['epoch-played', 'never-played'])
    })

    it('does not mutate the input records array', () => {
      const records = [rec('b', 40, 2), rec('a', 40, 1)]
      const snapshot = records.map((r) => r.key)

      planEviction(records, NONE, 80, 100)

      expect(records.map((r) => r.key)).toEqual(snapshot)
    })
  })

  describe('stops as soon as it fits', () => {
    it('evicts only as many songs as needed', () => {
      const records = [
        rec('a', 10, 1),
        rec('b', 10, 2),
        rec('c', 10, 3),
        rec('d', 10, 4),
      ]

      // used 40, incoming 15, cap 50 → over by 5 → one 10-byte eviction suffices.
      const plan = planEviction(records, NONE, 15, 50)

      expect(plan).toEqual({ evictKeys: ['a'], fits: true })
    })

    it('stops exactly at the boundary (freed space === required)', () => {
      const records = [rec('a', 30, 1), rec('b', 30, 2), rec('c', 30, 3)]

      // used 90, incoming 40, cap 100 → must free 30 → exactly one record.
      const plan = planEviction(records, NONE, 40, 100)

      expect(plan).toEqual({ evictKeys: ['a'], fits: true })
    })

    it('keeps evicting past a small record when one is not enough', () => {
      const records = [rec('small', 5, 1), rec('big', 60, 2), rec('keep', 30, 3)]

      // used 95, incoming 50, cap 100 → free 45 → small (5) is not enough → + big (60).
      const plan = planEviction(records, NONE, 50, 100)

      expect(plan).toEqual({ evictKeys: ['small', 'big'], fits: true })
    })
  })

  describe('protected keys', () => {
    it('never evicts a protected key even if it is the oldest', () => {
      const records = [rec('queued', 40, 1), rec('other', 40, 2), rec('newer', 40, 3)]

      const plan = planEviction(records, new Set(['queued']), 40, 130)

      expect(plan.fits).toBe(true)
      expect(plan.evictKeys).toEqual(['other'])
      expect(plan.evictKeys).not.toContain('queued')
    })

    it('skips protected records but still evicts the next-oldest candidates in order', () => {
      const records = [
        rec('p1', 20, 1),
        rec('u1', 20, 2),
        rec('p2', 20, 3),
        rec('u2', 20, 4),
        rec('u3', 20, 5),
      ]

      // used 100, incoming 40, cap 100 → free 40 → u1 + u2.
      const plan = planEviction(records, new Set(['p1', 'p2']), 40, 100)

      expect(plan).toEqual({ evictKeys: ['u1', 'u2'], fits: true })
    })

    it('ignores protected keys that are not in the library', () => {
      const records = [rec('a', 60, 1)]

      const plan = planEviction(records, new Set(['ghost']), 50, 100)

      expect(plan).toEqual({ evictKeys: ['a'], fits: true })
    })

    it('still counts protected bytes toward used space', () => {
      const records = [rec('queued', 90, 1), rec('other', 5, 2)]

      // Evicting `other` frees only 5 → used 90 + incoming 20 = 110 > 100 → cannot fit.
      const plan = planEviction(records, new Set(['queued']), 20, 100)

      expect(plan).toEqual({ evictKeys: [], fits: false })
    })
  })

  describe('when it cannot fit', () => {
    it('returns fits:false with NO evictions when evicting everything unprotected is not enough', () => {
      const records = [rec('a', 10, 1), rec('b', 10, 2), rec('queued', 50, 3)]

      const plan = planEviction(records, new Set(['queued']), 60, 100)

      expect(plan).toEqual({ evictKeys: [], fits: false })
    })

    it('returns fits:false when the incoming song alone exceeds the cap', () => {
      const records = [rec('a', 10, 1), rec('b', 10, 2)]

      const plan = planEviction(records, NONE, 101, 100)

      expect(plan).toEqual({ evictKeys: [], fits: false })
    })

    it('returns fits:false with no evictions on an empty library when incoming exceeds the cap', () => {
      expect(planEviction([], NONE, 101, 100)).toEqual({ evictKeys: [], fits: false })
    })

    it('returns fits:false when every record is protected', () => {
      const records = [rec('a', 60, 1), rec('b', 60, 2)]

      const plan = planEviction(records, new Set(['a', 'b']), 10, 100)

      expect(plan).toEqual({ evictKeys: [], fits: false })
    })

    it('fits when evicting every unprotected record is exactly enough', () => {
      const records = [rec('a', 30, 1), rec('b', 30, 2), rec('queued', 40, 3)]

      // used 100, incoming 60, cap 100 → evict a + b → used 40 + 60 === 100 → fits.
      const plan = planEviction(records, new Set(['queued']), 60, 100)

      expect(plan).toEqual({ evictKeys: ['a', 'b'], fits: true })
    })
  })
})
