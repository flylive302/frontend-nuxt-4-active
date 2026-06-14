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

  it('distinct batchIds (separate combo presses) each enqueue', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.enqueuePlayback({ ...playback(1, 10), batchId: 'press-1' })
    store.enqueuePlayback({ ...playback(1, 10), batchId: 'press-2' })
    store.enqueuePlayback({ ...playback(1, 10), batchId: 'press-3' })

    // First plays, the other two presses wait their turn — serial, not merged
    expect(store.currentPlayback?.gift.id).toBe(1)
    expect(store.playbackQueue).toHaveLength(2)
  })
})
