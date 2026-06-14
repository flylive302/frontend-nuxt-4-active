import { describe, it, expect, beforeEach } from 'vitest'

import { SlideQueue } from '../../app/utils/slide-queue'
import type { SlideEnqueueInput, SlideQueueConfig } from '../../app/utils/slide-queue'

/** A render-ready trigger the way `slide.events.ts` hands it over, with overrides. */
function input(overrides: Partial<SlideEnqueueInput> = {}): SlideEnqueueInput {
  return {
    slideId: 1,
    svgaUrl: 'https://cdn.example/x.svga',
    top: 0,
    height: 100,
    scope: 'room',
    priority: 0,
    replaceElements: {},
    texts: {},
    link: { type: 'none', userId: null },
    senderId: null,
    recipientId: null,
    ...overrides,
  }
}

const BASE: SlideQueueConfig = {
  ttlMs: 8_000,
  perBandDepth: 3,
  globalCap: 5,
  coalesceWindowMs: 2_500,
}

/** Map the playing/waiting snapshot to slide ids for terse assertions. */
const ids = (slides: readonly { slideId: number }[]) => slides.map((s) => s.slideId)

describe('SlideQueue', () => {
  let queue: SlideQueue

  beforeEach(() => {
    queue = new SlideQueue(BASE)
  })

  describe('collision-band bucketing', () => {
    it('queues a slide whose band intersects a playing slide', () => {
      queue.enqueue(input({ slideId: 1, top: 0, height: 100 }), 0)
      queue.enqueue(input({ slideId: 2, top: 50, height: 100 }), 0)

      expect(ids(queue.playing)).toEqual([1])
      expect(ids(queue.waiting)).toEqual([2])
    })

    it('plays the queued slide once the colliding band frees on completion', () => {
      queue.enqueue(input({ slideId: 1, top: 0, height: 100 }), 0)
      queue.enqueue(input({ slideId: 2, top: 50, height: 100 }), 0)

      const first = queue.playing[0]!.instanceId
      queue.onComplete(first, 1)

      expect(ids(queue.playing)).toEqual([2])
      expect(queue.waiting).toHaveLength(0)
    })

    it('plays disjoint bands concurrently (touching edges are disjoint)', () => {
      queue.enqueue(input({ slideId: 1, top: 0, height: 100 }), 0)
      queue.enqueue(input({ slideId: 2, top: 100, height: 100 }), 0)

      expect(ids(queue.playing)).toEqual([1, 2])
      expect(queue.waiting).toHaveLength(0)
    })
  })

  describe('priority', () => {
    it('jumps to its band queue head, plays first on free, and never cuts a playing slide', () => {
      queue.enqueue(input({ slideId: 1 }), 0) // plays
      queue.enqueue(input({ slideId: 2, priority: 0 }), 1) // waits (same band)
      queue.enqueue(input({ slideId: 3, priority: 5 }), 2) // waits, head of band

      // The high-priority arrival does not interrupt the playing slide.
      expect(ids(queue.playing)).toEqual([1])

      queue.onComplete(queue.playing[0]!.instanceId, 3)

      // ...but it is promoted ahead of the older normal-priority waiter.
      expect(ids(queue.playing)).toEqual([3])
      expect(ids(queue.waiting)).toEqual([2])
    })
  })

  describe('per-band depth cap', () => {
    it('drops the oldest low-priority queued item beyond the cap', () => {
      queue.enqueue(input({ slideId: 1 }), 0) // plays, holds the band
      queue.enqueue(input({ slideId: 2 }), 1) // waits
      queue.enqueue(input({ slideId: 3 }), 2) // waits
      queue.enqueue(input({ slideId: 4 }), 3) // waits — band depth now 3
      queue.enqueue(input({ slideId: 5 }), 4) // 4 > cap → drop oldest (2)

      expect(ids(queue.waiting)).toEqual([3, 4, 5])
    })

    it('never drops an exempt (high-priority) waiter', () => {
      const q = new SlideQueue({ ...BASE, perBandDepth: 1 })
      q.enqueue(input({ slideId: 1 }), 0) // plays
      q.enqueue(input({ slideId: 2, priority: 9 }), 1) // exempt waiter
      q.enqueue(input({ slideId: 3, priority: 9 }), 2) // exempt waiter — exceeds cap, kept

      expect(ids(q.waiting).sort()).toEqual([2, 3])
    })
  })

  describe('freshness TTL', () => {
    it('expires a stale waiter on tick so it never plays; exempt waiters survive', () => {
      queue.enqueue(input({ slideId: 1 }), 0) // plays
      queue.enqueue(input({ slideId: 2, priority: 0 }), 0) // normal waiter
      queue.enqueue(input({ slideId: 3, priority: 5 }), 0) // exempt waiter

      queue.tick(9_000) // > ttlMs (8_000)
      expect(ids(queue.waiting)).toEqual([3])

      // The expired waiter is never promoted when the band frees.
      queue.onComplete(queue.playing[0]!.instanceId, 9_000)
      expect(ids(queue.playing)).toEqual([3])
    })
  })

  describe('combo-coalesce', () => {
    it('coalesces a repeated (slide, sender, recipient) within the window into one item', () => {
      queue.enqueue(input({ slideId: 1, senderId: 10, recipientId: 20 }), 0)
      queue.enqueue(input({ slideId: 1, senderId: 10, recipientId: 20 }), 1_000)

      expect(queue.playing).toHaveLength(1)
      expect(queue.playing[0]!.count).toBe(2)
    })

    it('keeps the instanceId stable across a coalesce so the SVGA never remounts', () => {
      queue.enqueue(input({ slideId: 1, senderId: 10, recipientId: 20 }), 0)
      const id = queue.playing[0]!.instanceId
      queue.enqueue(input({ slideId: 1, senderId: 10, recipientId: 20 }), 1_000)

      expect(queue.playing[0]!.instanceId).toBe(id)
    })

    it('does not coalesce past the window or across a different trigger', () => {
      queue.enqueue(input({ slideId: 1, senderId: 10, recipientId: 20 }), 0)
      queue.enqueue(input({ slideId: 1, senderId: 10, recipientId: 20 }), 5_000) // > window
      queue.enqueue(input({ slideId: 1, senderId: 99, recipientId: 20 }), 5_001) // different sender

      expect(queue.playing[0]!.count).toBe(1)
      expect(queue.waiting).toHaveLength(2)
    })
  })

  describe('global concurrent cap', () => {
    it('caps concurrent playback even across disjoint bands, then promotes on completion', () => {
      const q = new SlideQueue({ ...BASE, globalCap: 2 })
      q.enqueue(input({ slideId: 1, top: 0, height: 100 }), 0)
      q.enqueue(input({ slideId: 2, top: 100, height: 100 }), 0)
      q.enqueue(input({ slideId: 3, top: 200, height: 100 }), 0) // disjoint but capped out

      expect(ids(q.playing)).toEqual([1, 2])
      expect(ids(q.waiting)).toEqual([3])

      q.onComplete(q.playing[0]!.instanceId, 1)
      expect(ids(q.playing).sort()).toEqual([2, 3])
    })
  })

  describe('onComplete', () => {
    it('is an idempotent no-op for an unknown instance id', () => {
      queue.enqueue(input({ slideId: 1 }), 0)
      const before = ids(queue.playing)

      queue.onComplete('does-not-exist', 1)
      expect(ids(queue.playing)).toEqual(before)
    })
  })

  describe('clearScope (room leave)', () => {
    it('drops room-scope playing + waiting slides but keeps app-scope ones', () => {
      // Two disjoint bands playing: one room, one app.
      queue.enqueue(input({ slideId: 1, scope: 'room', top: 0, height: 100 }), 0)
      queue.enqueue(input({ slideId: 2, scope: 'app', top: 200, height: 100 }), 0)
      // A room slide waiting behind the room band.
      queue.enqueue(input({ slideId: 3, scope: 'room', top: 0, height: 100 }), 0)

      const playing = queue.clearScope('room', 1)

      expect(ids(playing)).toEqual([2])
      expect(queue.waiting).toHaveLength(0)
    })

    it('promotes a waiting app slide into a band freed by a cleared room slide', () => {
      // Room slide plays; a colliding app slide waits behind it.
      queue.enqueue(input({ slideId: 1, scope: 'room', top: 0, height: 100 }), 0)
      queue.enqueue(input({ slideId: 2, scope: 'app', top: 0, height: 100 }), 0)
      expect(ids(queue.waiting)).toEqual([2])

      const playing = queue.clearScope('room', 1)

      expect(ids(playing)).toEqual([2])
      expect(queue.waiting).toHaveLength(0)
    })
  })
})
