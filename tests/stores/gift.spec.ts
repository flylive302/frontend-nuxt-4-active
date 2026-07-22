import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

beforeEach(() => {
  setActivePinia(createPinia())
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
// Playback queue — serial, non-interrupting (FIFO)
// ============================================================

/** Minimal playback input; the store doesn't inspect gift internals. */
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

describe('useGiftStore playback queue', () => {
  it('auto-starts the first enqueued item', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(playback(1, 10))

    expect(store.isPlaying).toBe(true)
    expect(store.currentPlayback?.gift.id).toBe(1)
    expect(store.playbackQueue).toHaveLength(0)
  })

  it('does NOT interrupt the playing item when more are enqueued', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(playback(1, 10))
    const firstId = store.currentPlayback?.id

    // Two more sends arrive while the first is on screen
    store.enqueuePlayback(playback(2, 11))
    store.enqueuePlayback(playback(3, 12))

    // Current item is untouched; the rest wait their turn
    expect(store.currentPlayback?.id).toBe(firstId)
    expect(store.currentPlayback?.gift.id).toBe(1)
    expect(store.playbackQueue.map(i => i.gift.id)).toEqual([2, 3])
  })

  it('advances in FIFO order on completion, one after another', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(playback(1, 10))
    store.enqueuePlayback(playback(2, 11))
    store.enqueuePlayback(playback(3, 12))

    expect(store.currentPlayback?.gift.id).toBe(1)

    store.onPlaybackComplete()
    expect(store.currentPlayback?.gift.id).toBe(2)

    store.onPlaybackComplete()
    expect(store.currentPlayback?.gift.id).toBe(3)
  })

  it('clears playback state after the last item finishes', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(playback(1, 10))
    store.onPlaybackComplete()

    expect(store.currentPlayback).toBeNull()
    expect(store.isPlaying).toBe(false)
    expect(store.playbackQueue).toHaveLength(0)
  })

  it('coalesces fan-out: same batchId plays once (multi-recipient send)', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    // One send to 3 seats → 3 gift:received events sharing a batchId
    store.enqueuePlayback({ ...playback(1, 10), batchId: 'send-A' })
    store.enqueuePlayback({ ...playback(1, 10), batchId: 'send-A' })
    store.enqueuePlayback({ ...playback(1, 10), batchId: 'send-A' })

    expect(store.currentPlayback?.gift.id).toBe(1)
    expect(store.playbackQueue).toHaveLength(0) // siblings dropped, just 1 plays
  })

  it('distinct batchIds (separate combo presses) coalesce into one ×N queue entry', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback({ ...playback(1, 10), batchId: 'press-1' })
    store.enqueuePlayback({ ...playback(1, 10), batchId: 'press-2' })
    store.enqueuePlayback({ ...playback(1, 10), batchId: 'press-3' })

    // First plays; the two waiting identical presses merge into one entry ×2
    expect(store.currentPlayback?.gift.id).toBe(1)
    expect(store.playbackQueue).toHaveLength(1)
    expect(store.playbackQueue[0]?.repeats).toBe(2)
  })

  it('replays a coalesced item under a fresh id until repeats are exhausted', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(playback(1, 10))
    store.enqueuePlayback(playback(1, 10)) // queued
    store.enqueuePlayback(playback(1, 10)) // coalesced onto the queued entry

    store.onPlaybackComplete() // advance to the coalesced entry (repeats 2)
    const firstPassId = store.currentPlayback?.id
    expect(store.currentPlayback?.repeats).toBe(2)

    store.onPlaybackComplete() // replay 1 — same item, fresh id remounts player
    expect(store.currentPlayback?.repeats).toBe(1)
    expect(store.currentPlayback?.id).not.toBe(firstPassId)
    expect(store.currentPlayback?.gift.id).toBe(1)

    store.onPlaybackComplete() // exhausted → queue empty → stop
    expect(store.currentPlayback).toBeNull()
    expect(store.isPlaying).toBe(false)
  })

  it('does not coalesce different gifts or different senders', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback(playback(1, 10))
    store.enqueuePlayback(playback(2, 10)) // different gift
    store.enqueuePlayback(playback(2, 11)) // same gift, different sender

    expect(store.playbackQueue).toHaveLength(2)
    expect(store.playbackQueue.map(i => i.repeats ?? 1)).toEqual([1, 1])
  })
})

// ============================================================
// Burst-mode load shedding (msab-load-stability 11)
// ============================================================
describe('useGiftStore playback queue — burst-mode load shedding', () => {
  it('bounds the backlog under a synthetic burst of hundreds of non-critical sends', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const { BURST_SHED_QUEUE_DEPTH, MAX_PLAYBACK_QUEUE_SIZE } = await import('../../app/constants/gift')
    const store = useGiftStore()

    // Hundreds of distinct (gift, sender) pairs so nothing coalesces —
    // worst case for backlog growth.
    for (let i = 0; i < 500; i++) {
      store.enqueuePlayback(playback(i, i))
    }

    // The queue never grows anywhere near the hard cap; shedding kicks in
    // once backlog reaches BURST_SHED_QUEUE_DEPTH and holds it there.
    expect(store.playbackQueue.length).toBeLessThanOrEqual(BURST_SHED_QUEUE_DEPTH)
    expect(store.playbackQueue.length).toBeLessThan(MAX_PLAYBACK_QUEUE_SIZE)
    expect(store.isPlaying).toBe(true) // never froze — first item is on screen
  })

  it('sheds non-critical gifts once backlog reaches BURST_SHED_QUEUE_DEPTH', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const { BURST_SHED_QUEUE_DEPTH } = await import('../../app/constants/gift')
    const store = useGiftStore()

    for (let i = 0; i < BURST_SHED_QUEUE_DEPTH + 5; i++) {
      store.enqueuePlayback(playback(i, i))
    }

    // Backlog capped exactly at the shed threshold, not left to creep past it.
    expect(store.playbackQueue).toHaveLength(BURST_SHED_QUEUE_DEPTH)
  })

  it('never sheds critical gifts, even deep in a burst', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const { BURST_SHED_QUEUE_DEPTH } = await import('../../app/constants/gift')
    const store = useGiftStore()

    for (let i = 0; i < BURST_SHED_QUEUE_DEPTH + 10; i++) {
      store.enqueuePlayback(playback(i, i))
    }
    const depthBeforeCritical = store.playbackQueue.length

    store.enqueuePlayback({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gift: { id: 999, asset_type: 'image', is_critical: true } as any,
      senderId: 999,
      senderName: 'Tester',
      recipientIds: [99],
      quantity: 1,
    })

    expect(store.playbackQueue).toHaveLength(depthBeforeCritical + 1)
    expect(store.playbackQueue[store.playbackQueue.length - 1]?.gift.id).toBe(999)
  })

  it('below the shed threshold, behaves exactly as before (no shedding)', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const { BURST_SHED_QUEUE_DEPTH } = await import('../../app/constants/gift')
    const store = useGiftStore()

    for (let i = 0; i < BURST_SHED_QUEUE_DEPTH - 1; i++) {
      store.enqueuePlayback(playback(i, i))
    }

    // queue holds one less than the current item, i.e. nothing shed yet
    expect(store.playbackQueue).toHaveLength(BURST_SHED_QUEUE_DEPTH - 2)
  })
})
