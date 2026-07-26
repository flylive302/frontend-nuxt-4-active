import { describe, it, expect } from 'vitest'
import { evaluateHasMore } from '../../app/utils/infinite-scroll-pagination'
import type { InfiniteScrollItem, InfiniteScrollPaginationMeta } from '../../app/types/ui/infinite-scroll'

/** `count` rows. Only `id` matters — nothing here reads any other field. */
function rows(count: number): InfiniteScrollItem[] {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1 }))
}

/** What the component actually asked for; every missing meta field degrades to this. */
const REQUESTED = { page: 1, perPage: 15 }

describe('evaluateHasMore', () => {
  describe('with a server-reported total', () => {
    it('has more while the pages consumed so far fall short of the total', () => {
      const meta: InfiniteScrollPaginationMeta = { page: 1, perPage: 15, total: 30 }

      expect(evaluateHasMore({ data: rows(15), meta }, rows(15), REQUESTED)).toBe(true)
    })

    it('stops on the last page, where consumed exactly meets the total', () => {
      const meta: InfiniteScrollPaginationMeta = { page: 2, perPage: 15, total: 30 }

      expect(evaluateHasMore({ data: rows(15), meta }, rows(15), { page: 2, perPage: 15 })).toBe(false)
    })

    it('stops on a partial last page', () => {
      const meta: InfiniteScrollPaginationMeta = { page: 2, perPage: 15, total: 22 }

      expect(evaluateHasMore({ data: rows(7), meta }, rows(7), { page: 2, perPage: 15 })).toBe(false)
    })

    it('stops when the whole list fits inside page 1', () => {
      const meta: InfiniteScrollPaginationMeta = { page: 1, perPage: 15, total: 8 }

      expect(evaluateHasMore({ data: rows(8), meta }, rows(8), REQUESTED)).toBe(false)
    })

    // The home carousel skims 5 rooms off page 1, so the rows the grid receives
    // are always fewer than the page the server sent. Counting them would end
    // the feed early; the server's own numbers are immune.
    it('ignores how many rows the consumer kept, and trusts the server count', () => {
      const meta: InfiniteScrollPaginationMeta = { page: 1, perPage: 15, total: 30 }
      const sliced = rows(10) // 15 fetched, 5 taken by the carousel

      expect(evaluateHasMore({ data: sliced, meta }, sliced, REQUESTED)).toBe(true)
    })

    it('has more on an empty total-bearing page only if the total says so', () => {
      const meta: InfiniteScrollPaginationMeta = { page: 3, perPage: 15, total: 30 }

      expect(evaluateHasMore({ data: [], meta }, [], { page: 3, perPage: 15 })).toBe(false)
    })
  })

  describe('without a total', () => {
    it('assumes another page follows a full one', () => {
      const meta = { page: 1, perPage: 15 } as InfiniteScrollPaginationMeta

      expect(evaluateHasMore({ data: rows(15), meta }, rows(15), REQUESTED)).toBe(true)
    })

    it('stops on a short page', () => {
      const meta = { page: 1, perPage: 15 } as InfiniteScrollPaginationMeta

      expect(evaluateHasMore({ data: rows(9), meta }, rows(9), REQUESTED)).toBe(false)
    })
  })

  describe('degrading past a meta the consumer forgot to normalize', () => {
    // This is the exact failure the ticket exists to fix: destructuring
    // `{page, perPage, total}` off Laravel's `{pagination, active_countries}`
    // yields three undefineds. Before the fallbacks it read `15 >= undefined`
    // → false, and the feed stopped dead after one page.
    it('falls back to the requested perPage rather than halting on undefined', () => {
      const meta = {} as InfiniteScrollPaginationMeta

      expect(evaluateHasMore({ data: rows(15), meta }, rows(15), REQUESTED)).toBe(true)
      expect(evaluateHasMore({ data: rows(9), meta }, rows(9), REQUESTED)).toBe(false)
    })

    // `page * undefined` is NaN, and `NaN < total` is false — a total present
    // without a perPage halts just as silently as no meta at all.
    it('falls back to the requested perPage when a total is present but perPage is not', () => {
      const meta = { total: 30 } as InfiniteScrollPaginationMeta

      expect(evaluateHasMore({ data: rows(15), meta }, rows(15), REQUESTED)).toBe(true)
    })

    it('falls back to the requested page when the payload omits it', () => {
      const meta = { perPage: 15, total: 30 } as InfiniteScrollPaginationMeta

      expect(evaluateHasMore({ data: rows(15), meta }, rows(15), { page: 2, perPage: 15 })).toBe(false)
    })

    it('leaves a fully-supplied meta untouched by the fallbacks', () => {
      const meta: InfiniteScrollPaginationMeta = { page: 1, perPage: 15, total: 30 }
      const wrongFallback = { page: 99, perPage: 1 }

      // If either fallback leaked in, page 99 * 1 < 30 would be false.
      expect(evaluateHasMore({ data: rows(15), meta }, rows(15), wrongFallback)).toBe(true)
    })
  })

  describe('with no meta at all', () => {
    it('treats a bare array as a full page and keeps going', () => {
      expect(evaluateHasMore(rows(15), rows(15), REQUESTED)).toBe(true)
    })

    it('stops on a short bare array', () => {
      expect(evaluateHasMore(rows(3), rows(3), REQUESTED)).toBe(false)
    })

    it('stops on a data payload whose meta is absent and page is short', () => {
      expect(evaluateHasMore({ data: rows(3) }, rows(3), REQUESTED)).toBe(false)
    })
  })
})
