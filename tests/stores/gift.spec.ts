import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

const { mockIsAway } = vi.hoisted(() => ({
  mockIsAway: vi.fn(() => false),
}))

vi.mock('~/services/motionPauseOrchestrator', () => ({
  isAway: mockIsAway,
}))

beforeEach(() => {
  setActivePinia(createPinia())
  mockIsAway.mockReset().mockReturnValue(false)
})

// ============================================================
// setLockedRecipient
// ============================================================
describe('useGiftStore.setLockedRecipient', () => {
  it('sets lockedRecipientId to the given id', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.setLockedRecipient(42)

    expect(store.lockedRecipientId).toBe(42)
  })
})

// ============================================================
// clearLockedRecipient
// ============================================================
describe('useGiftStore.clearLockedRecipient', () => {
  it('resets lockedRecipientId to null', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.setLockedRecipient(42)
    store.clearLockedRecipient()

    expect(store.lockedRecipientId).toBeNull()
  })
})

// ============================================================
// clearSelection
// ============================================================
describe('useGiftStore.clearSelection', () => {
  it('resets lockedRecipientId to null', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.setLockedRecipient(42)
    store.clearSelection()

    expect(store.lockedRecipientId).toBeNull()
  })
})

// ============================================================
// Playback lanes (gift-backlog-and-lag 06)
//
// Critical gifts (`gift.is_critical: true`) play in the CENTER lane
// (`currentPlayback`/`playbackQueue` — unchanged FIFO semantics, kept as
// aliases of the center lane). Everything else plays in one of SIDE_LANES
// concurrent SIDE lanes (`currentSides`/`sideQueue`). Shared behavior (FIFO,
// coalescing, stale-drop, away-gating) is exercised on both lanes below.
// ============================================================

/** Minimal non-critical (side-lane) playback input. */
function playback(giftId: number, senderId: number) {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gift: { id: giftId, asset_type: 'image' } as any,
    senderId,
    senderName: 'Tester',
    recipientIds: [99],
    quantity: 1,
  }
}

/** Minimal is_critical center-lane playback input (lucky/big/slide). */
function criticalPlayback(giftId: number, senderId: number) {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gift: { id: giftId, asset_type: 'image', is_critical: true } as any,
    senderId,
    senderName: 'Tester',
    recipientIds: [99],
    quantity: 1,
  }
}

/**
 * The real-catalog center-lane case: `asset_type: 'video'`, `is_critical`
 * false/unset (no gift in the prod catalog sets is_critical — see laneFor()
 * in app/stores/gift.ts).
 */
function videoPlayback(giftId: number, senderId: number) {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gift: { id: giftId, asset_type: 'video', is_critical: false } as any,
    senderId,
    senderName: 'Tester',
    recipientIds: [99],
    quantity: 1,
  }
}

// ============================================================
// Center lane — serial, non-interrupting (FIFO), unchanged semantics
// ============================================================
describe('useGiftStore playback queue — center lane (critical gifts)', () => {
  it('auto-starts the first enqueued item', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(criticalPlayback(1, 10))

    expect(store.isPlaying).toBe(true)
    expect(store.currentPlayback?.gift.id).toBe(1)
    expect(store.playbackQueue).toHaveLength(0)
  })

  it('does NOT interrupt the playing item when more are enqueued', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(criticalPlayback(1, 10))
    const firstId = store.currentPlayback?.id

    // Two more sends arrive while the first is on screen
    store.enqueuePlayback(criticalPlayback(2, 11))
    store.enqueuePlayback(criticalPlayback(3, 12))

    // Current item is untouched; the rest wait their turn
    expect(store.currentPlayback?.id).toBe(firstId)
    expect(store.currentPlayback?.gift.id).toBe(1)
    expect(store.playbackQueue.map(i => i.gift.id)).toEqual([2, 3])
  })

  it('advances in FIFO order on completion, one after another', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(criticalPlayback(1, 10))
    store.enqueuePlayback(criticalPlayback(2, 11))
    store.enqueuePlayback(criticalPlayback(3, 12))

    expect(store.currentPlayback?.gift.id).toBe(1)

    store.onPlaybackComplete()
    expect(store.currentPlayback?.gift.id).toBe(2)

    store.onPlaybackComplete()
    expect(store.currentPlayback?.gift.id).toBe(3)
  })

  it('clears playback state after the last item finishes', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(criticalPlayback(1, 10))
    store.onPlaybackComplete()

    expect(store.currentPlayback).toBeNull()
    expect(store.isPlaying).toBe(false)
    expect(store.playbackQueue).toHaveLength(0)
  })

  it('coalesces fan-out: same batchId plays once (multi-recipient send)', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    // One send to 3 seats → 3 gift:received events sharing a batchId
    store.enqueuePlayback({ ...criticalPlayback(1, 10), batchId: 'send-A' })
    store.enqueuePlayback({ ...criticalPlayback(1, 10), batchId: 'send-A' })
    store.enqueuePlayback({ ...criticalPlayback(1, 10), batchId: 'send-A' })

    expect(store.currentPlayback?.gift.id).toBe(1)
    expect(store.playbackQueue).toHaveLength(0) // siblings dropped, just 1 plays
  })

  it('distinct batchIds (separate combo presses) coalesce onto the playing item when the queue is empty (06: merge anywhere in the lane, including the item on screen)', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback({ ...criticalPlayback(1, 10), batchId: 'press-1' })
    store.enqueuePlayback({ ...criticalPlayback(1, 10), batchId: 'press-2' })
    store.enqueuePlayback({ ...criticalPlayback(1, 10), batchId: 'press-3' })

    // Queue is empty when press-2/3 land, so they merge onto the PLAYING
    // item's badge live instead of queuing a second play.
    expect(store.currentPlayback?.gift.id).toBe(1)
    expect(store.currentPlayback?.repeats).toBe(3)
    expect(store.playbackQueue).toHaveLength(0)
  })

  it('distinct batchIds land in an already-non-empty queue and coalesce there instead of on the playing item', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(criticalPlayback(1, 10)) // plays immediately
    store.enqueuePlayback({ ...criticalPlayback(2, 11), batchId: 'press-1' }) // queued, different gift
    store.enqueuePlayback({ ...criticalPlayback(2, 11), batchId: 'press-2' }) // merges onto the QUEUED entry, not the playing item

    expect(store.currentPlayback?.gift.id).toBe(1)
    expect(store.currentPlayback?.repeats ?? 1).toBe(1)
    expect(store.playbackQueue).toHaveLength(1)
    expect(store.playbackQueue[0]?.repeats).toBe(2)
  })

  it('replays a coalesced item under a fresh id until repeats are exhausted (merged onto a QUEUED entry)', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(criticalPlayback(1, 10)) // plays
    store.enqueuePlayback(criticalPlayback(2, 11)) // queued (different gift, so it doesn't merge onto item 1)
    store.enqueuePlayback(criticalPlayback(2, 11)) // coalesced onto the queued entry
    store.enqueuePlayback(criticalPlayback(2, 11)) // coalesced again

    store.onPlaybackComplete() // advance to the coalesced entry (repeats 3)
    const firstPassId = store.currentPlayback?.id
    expect(store.currentPlayback?.gift.id).toBe(2)
    expect(store.currentPlayback?.repeats).toBe(3)

    store.onPlaybackComplete() // replay 1 — same item, fresh id remounts player
    expect(store.currentPlayback?.repeats).toBe(2)
    expect(store.currentPlayback?.id).not.toBe(firstPassId)
    expect(store.currentPlayback?.gift.id).toBe(2)

    store.onPlaybackComplete() // replay 2
    expect(store.currentPlayback?.repeats).toBe(1)

    store.onPlaybackComplete() // exhausted → queue empty → stop
    expect(store.currentPlayback).toBeNull()
    expect(store.isPlaying).toBe(false)
  })

  it('coalesces repeatedly onto the playing item when the queue is empty, live badge bump', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(criticalPlayback(1, 10))
    store.enqueuePlayback(criticalPlayback(1, 10))
    store.enqueuePlayback(criticalPlayback(1, 10))

    expect(store.playbackQueue).toHaveLength(0)
    expect(store.currentPlayback?.repeats).toBe(3)
  })

  it('does not coalesce different gifts or different senders', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(criticalPlayback(1, 10))
    store.enqueuePlayback(criticalPlayback(2, 10)) // different gift
    store.enqueuePlayback(criticalPlayback(2, 11)) // same gift, different sender

    expect(store.playbackQueue).toHaveLength(2)
    expect(store.playbackQueue.map(i => i.repeats ?? 1)).toEqual([1, 1])
  })

  it('merges onto the CURRENTLY PLAYING item, not just the queue — badge bumps, no new slot', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(criticalPlayback(1, 10)) // plays immediately
    store.enqueuePlayback(criticalPlayback(1, 10)) // matches the PLAYING item, not the (empty) queue

    expect(store.playbackQueue).toHaveLength(0)
    expect(store.currentPlayback?.repeats).toBe(2)
  })

  it('a non-critical gift never lands in the center lane', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(playback(1, 10))

    expect(store.currentPlayback).toBeNull()
    expect(store.playbackQueue).toHaveLength(0)
  })

  it('lane routing matches the real catalog: video → center (even with is_critical false), image → side, svga → side', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(videoPlayback(1, 10)) // video, not is_critical
    expect(store.currentPlayback?.gift.id).toBe(1)
    expect(store.currentSides.some(i => i?.gift.id === 1)).toBe(false)

    store.enqueuePlayback(playback(2, 11)) // image
    expect(store.currentSides.some(i => i?.gift.id === 2)).toBe(true)
    expect(store.currentPlayback?.gift.id).toBe(1) // center untouched

    store.enqueuePlayback({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gift: { id: 3, asset_type: 'svga', is_critical: false } as any,
      senderId: 12,
      senderName: 'Tester',
      recipientIds: [99],
      quantity: 1,
    })
    expect(store.currentSides.some(i => i?.gift.id === 3)).toBe(true)
  })

  it('vap gifts also play in the center lane', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gift: { id: 1, asset_type: 'vap', is_critical: false } as any,
      senderId: 10,
      senderName: 'Tester',
      recipientIds: [99],
      quantity: 1,
    })

    expect(store.currentPlayback?.gift.id).toBe(1)
    expect(store.currentSides.every(i => i === null)).toBe(true)
  })
})

// ============================================================
// Side lanes — up to SIDE_LANES concurrent players
// ============================================================
describe('useGiftStore playback queue — side lanes (non-critical gifts)', () => {
  it('fills up to SIDE_LANES concurrently; a 4th item waits in sideQueue', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const { SIDE_LANES } = await import('../../app/constants/gift')
    const store = useGiftStore()

    for (let i = 1; i <= SIDE_LANES + 1; i++) {
      store.enqueuePlayback(playback(i, i))
    }

    expect(store.currentSides.filter(Boolean)).toHaveLength(SIDE_LANES)
    expect(store.currentSides.map(i => i?.gift.id)).toEqual([1, 2, 3])
    expect(store.sideQueue.map(i => i.gift.id)).toEqual([4])
  })

  it('lane completion pulls the next waiting item into that slot', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const { SIDE_LANES } = await import('../../app/constants/gift')
    const store = useGiftStore()

    for (let i = 1; i <= SIDE_LANES + 1; i++) {
      store.enqueuePlayback(playback(i, i))
    }

    store.onPlaybackComplete('side', 0)

    expect(store.currentSides[0]?.gift.id).toBe(4)
    expect(store.sideQueue).toHaveLength(0)
  })

  it('a critical gift never occupies a side lane; a side gift never blocks the center lane', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(playback(1, 10))
    store.enqueuePlayback(criticalPlayback(2, 11))

    expect(store.currentPlayback?.gift.id).toBe(2) // center starts immediately
    expect(store.isPlaying).toBe(true)
    expect(store.currentSides.some(i => i?.gift.id === 2)).toBe(false)
    expect(store.currentSides.some(i => i?.gift.id === 1)).toBe(true)
  })

  it('merges repeats onto the newest matching queued item anywhere in the lookback window, interleaved across senders', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    // Interleaved: A(X) A(Y) B(Y) A(X) — the two A(X) plays are not adjacent.
    store.enqueuePlayback(playback(1, 10)) // A(X) → side slot 0
    store.enqueuePlayback(playback(1, 11)) // A(Y) → side slot 1
    store.enqueuePlayback(playback(2, 11)) // B(Y) → side slot 2
    store.enqueuePlayback(playback(1, 10)) // A(X) again → merges onto the PLAYING A(X)

    expect(store.currentSides.filter(Boolean)).toHaveLength(3)
    expect(store.sideQueue).toHaveLength(0)
    const aX = store.currentSides.find(i => i?.gift.id === 1 && i?.senderId === 10)
    expect(aX?.repeats).toBe(2)
  })

  it('merges onto a queued (not yet playing) match within MERGE_LOOKBACK', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const { SIDE_LANES } = await import('../../app/constants/gift')
    const store = useGiftStore()

    // Fill all 3 lanes with distinct items so the next enqueue must queue.
    for (let i = 1; i <= SIDE_LANES; i++) store.enqueuePlayback(playback(i, i))

    store.enqueuePlayback(playback(99, 99)) // queued
    store.enqueuePlayback(playback(99, 99)) // merges onto the queued entry

    expect(store.sideQueue).toHaveLength(1)
    expect(store.sideQueue[0]?.repeats).toBe(2)
  })

  it('a currently-playing match bumps repeats without growing sideQueue', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(playback(1, 10))
    store.enqueuePlayback(playback(1, 10))

    expect(store.sideQueue).toHaveLength(0)
    expect(store.currentSides[0]?.repeats).toBe(2)
  })

  it('does not coalesce different gifts or different senders', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(playback(1, 10))
    store.enqueuePlayback(playback(2, 10)) // different gift
    store.enqueuePlayback(playback(2, 11)) // same gift, different sender

    expect(store.currentSides.map(i => i?.repeats ?? 1)).toEqual([1, 1, 1])
  })

  it('a coalesced side item replays under a fresh id until repeats are exhausted', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(playback(1, 10))
    store.enqueuePlayback(playback(1, 10)) // repeats 2 on the playing item

    const firstPassId = store.currentSides[0]?.id
    expect(store.currentSides[0]?.repeats).toBe(2)

    store.onPlaybackComplete('side', 0) // replay 1 — fresh id
    expect(store.currentSides[0]?.repeats).toBe(1)
    expect(store.currentSides[0]?.id).not.toBe(firstPassId)

    store.onPlaybackComplete('side', 0) // exhausted → slot frees (nothing else queued)
    expect(store.currentSides[0]).toBeNull()
  })

  it('plays the SVGA when the side queue is empty on assignment', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gift: { id: 1, asset_type: 'svga' } as any,
      senderId: 1,
      senderName: 'Tester',
      recipientIds: [99],
      quantity: 1,
    })

    expect(store.currentSides[0]?.playSvga).toBe(true)
  })

  it('falls back to static (never video/vap) when the side queue is deep on assignment', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const { SIDE_LANES } = await import('../../app/constants/gift')
    const store = useGiftStore()

    function svgaPlayback(giftId: number, senderId: number) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { gift: { id: giftId, asset_type: 'svga' } as any, senderId, senderName: 'Tester', recipientIds: [99], quantity: 1 }
    }

    // Fill all 3 lanes with non-svga fillers, then queue 5 distinct SVGA items
    // — well past SIDE_LANES, so the queue stays deep when a lane frees up.
    for (let i = 1; i <= SIDE_LANES; i++) store.enqueuePlayback(playback(i, i))
    for (let i = 100; i < 105; i++) store.enqueuePlayback(svgaPlayback(i, i))
    expect(store.sideQueue.length).toBeGreaterThanOrEqual(SIDE_LANES)

    store.onPlaybackComplete('side', 0) // frees a lane; queue is still deep
    const filled = store.currentSides[0]
    expect(filled?.gift.asset_type).toBe('svga')
    expect(filled?.playSvga).toBe(false)
  })
})

// ============================================================
// Burst-mode load shedding (msab-load-stability 11) — side lane
// (non-critical gifts always land in the side lane; center is never shed)
// ============================================================
describe('useGiftStore playback queue — burst-mode load shedding', () => {
  it('bounds the backlog under a synthetic burst of hundreds of non-critical sends', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const { BURST_SHED_QUEUE_DEPTH, MAX_PLAYBACK_QUEUE_SIZE, SIDE_LANES } = await import('../../app/constants/gift')
    const store = useGiftStore()

    // Hundreds of distinct (gift, sender) pairs so nothing coalesces —
    // worst case for backlog growth.
    for (let i = 0; i < 500; i++) {
      store.enqueuePlayback(playback(i, i))
    }

    // The queue never grows anywhere near the hard cap; shedding kicks in
    // once backlog reaches BURST_SHED_QUEUE_DEPTH and holds it there.
    expect(store.sideQueue.length).toBeLessThanOrEqual(BURST_SHED_QUEUE_DEPTH)
    expect(store.sideQueue.length).toBeLessThan(MAX_PLAYBACK_QUEUE_SIZE)
    expect(store.currentSides.filter(Boolean)).toHaveLength(SIDE_LANES) // never froze — lanes stay busy
  })

  it('sheds non-critical gifts once backlog reaches BURST_SHED_QUEUE_DEPTH', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const { BURST_SHED_QUEUE_DEPTH } = await import('../../app/constants/gift')
    const store = useGiftStore()

    for (let i = 0; i < BURST_SHED_QUEUE_DEPTH + 5; i++) {
      store.enqueuePlayback(playback(i, i))
    }

    // Backlog capped exactly at the shed threshold, not left to creep past it.
    expect(store.sideQueue).toHaveLength(BURST_SHED_QUEUE_DEPTH)
  })

  it('never sheds critical gifts, even deep in a side-lane burst — plays immediately in the center lane', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const { BURST_SHED_QUEUE_DEPTH } = await import('../../app/constants/gift')
    const store = useGiftStore()

    for (let i = 0; i < BURST_SHED_QUEUE_DEPTH + 10; i++) {
      store.enqueuePlayback(playback(i, i))
    }
    const sideDepthBeforeCritical = store.sideQueue.length

    store.enqueuePlayback(criticalPlayback(999, 999))

    // Never shed: it plays immediately in the center lane, untouched side backlog.
    expect(store.currentPlayback?.gift.id).toBe(999)
    expect(store.sideQueue).toHaveLength(sideDepthBeforeCritical)
  })

  it('below the shed threshold, behaves exactly as before (no shedding)', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const { BURST_SHED_QUEUE_DEPTH, SIDE_LANES } = await import('../../app/constants/gift')
    const store = useGiftStore()

    for (let i = 0; i < BURST_SHED_QUEUE_DEPTH - 1; i++) {
      store.enqueuePlayback(playback(i, i))
    }

    // SIDE_LANES items are playing concurrently; the rest sit in sideQueue.
    expect(store.sideQueue).toHaveLength(BURST_SHED_QUEUE_DEPTH - 1 - SIDE_LANES)
  })
})

// ============================================================
// Away gating (gift-backlog-and-lag 01) — reused per lane
// ============================================================
describe('useGiftStore playback queue — away gating', () => {
  it('enqueuePlayback queues nothing while isAway() is true (center lane)', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    mockIsAway.mockReturnValue(true)
    store.enqueuePlayback(criticalPlayback(1, 10))

    expect(store.isPlaying).toBe(false)
    expect(store.currentPlayback).toBeNull()
    expect(store.playbackQueue).toHaveLength(0)
  })

  it('enqueuePlayback queues nothing while isAway() is true (side lane)', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    mockIsAway.mockReturnValue(true)
    store.enqueuePlayback(playback(1, 10))

    expect(store.currentSides.filter(Boolean)).toHaveLength(0)
    expect(store.sideQueue).toHaveLength(0)
  })

  it('playNext skips center items older than GIFT_PLAYBACK_MAX_AGE_MS', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const { GIFT_PLAYBACK_MAX_AGE_MS } = await import('../../app/constants/gift')
    const store = useGiftStore()

    // First item plays immediately (auto-start); second sits in the queue and
    // is aged out directly, simulating it having waited too long.
    store.enqueuePlayback(criticalPlayback(1, 10))
    store.enqueuePlayback(criticalPlayback(2, 11))
    expect(store.playbackQueue).toHaveLength(1)
    store.playbackQueue[0]!.timestamp = Date.now() - GIFT_PLAYBACK_MAX_AGE_MS - 1

    store.onPlaybackComplete() // advances past item 1, playNextCenter() should skip stale item 2

    expect(store.currentPlayback).toBeNull()
    expect(store.isPlaying).toBe(false)
    expect(store.playbackQueue).toHaveLength(0)
  })

  it('fillSideLanes skips queued side items older than GIFT_PLAYBACK_MAX_AGE_MS', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const { GIFT_PLAYBACK_MAX_AGE_MS, SIDE_LANES } = await import('../../app/constants/gift')
    const store = useGiftStore()

    for (let i = 1; i <= SIDE_LANES + 1; i++) store.enqueuePlayback(playback(i, i))
    expect(store.sideQueue).toHaveLength(1)
    store.sideQueue[0]!.timestamp = Date.now() - GIFT_PLAYBACK_MAX_AGE_MS - 1

    store.onPlaybackComplete('side', 0) // slot 0 frees; stale queued item is skipped, not played

    expect(store.currentSides[0]).toBeNull()
    expect(store.sideQueue).toHaveLength(0)
  })

  it('a fresh item behind a stale one still plays (center lane)', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const { GIFT_PLAYBACK_MAX_AGE_MS } = await import('../../app/constants/gift')
    const store = useGiftStore()

    store.enqueuePlayback(criticalPlayback(1, 10))
    store.enqueuePlayback(criticalPlayback(2, 11))
    store.enqueuePlayback(criticalPlayback(3, 12))
    expect(store.playbackQueue).toHaveLength(2)

    // Age out only the first queued item; the second is fresh.
    store.playbackQueue[0]!.timestamp = Date.now() - GIFT_PLAYBACK_MAX_AGE_MS - 1

    store.onPlaybackComplete()

    expect(store.currentPlayback?.gift.id).toBe(3)
    expect(store.isPlaying).toBe(true)
    expect(store.playbackQueue).toHaveLength(0)
  })

  it('dropQueuedPlayback empties both lane queues but leaves what is on screen untouched', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const { SIDE_LANES } = await import('../../app/constants/gift')
    const store = useGiftStore()

    store.enqueuePlayback(criticalPlayback(1, 10))
    store.enqueuePlayback(criticalPlayback(2, 11))
    store.enqueuePlayback(criticalPlayback(3, 12))
    expect(store.playbackQueue).toHaveLength(2)

    for (let i = 1; i <= SIDE_LANES + 1; i++) store.enqueuePlayback(playback(i, i))
    expect(store.sideQueue).toHaveLength(1)

    store.dropQueuedPlayback()

    expect(store.playbackQueue).toHaveLength(0)
    expect(store.sideQueue).toHaveLength(0)
    expect(store.currentPlayback?.gift.id).toBe(1)
    expect(store.isPlaying).toBe(true)
    expect(store.currentSides.filter(Boolean)).toHaveLength(SIDE_LANES)
  })
})
