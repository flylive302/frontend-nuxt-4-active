/**
 * Unit tests for the gift playback stall detector (handleProgress heartbeat).
 *
 * The composable arms an 8s (GIFT_PLAYBACK_TIMEOUT_MS) stall timeout whenever
 * `currentPlayback.id` changes; each `handleProgress()` heartbeat (throttled
 * to 1/1000ms) re-arms it. If no heartbeat lands within the window, the
 * timeout force-advances the queue via `giftStore.onPlaybackComplete()`.
 *
 * Uses the REAL Pinia gift store (not a plain-object mock) — Pinia wraps
 * setup stores in `reactive()`, which auto-unwraps top-level refs on
 * property access (`giftStore.currentPlayback` returns the unwrapped
 * value, not the Ref). A hand-rolled `{ currentPlayback: ref(...) }` mock
 * does not get that unwrapping and silently breaks the composable's
 * internal `watch`. This mirrors the pattern in useGiftEligibility.spec.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, effectScope, onScopeDispose, ref, watch } from 'vue'
import type { GiftPlaybackItem } from '../../app/types/gift/gift'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('watch', watch)
vi.stubGlobal('onScopeDispose', onScopeDispose)

const GIFT_PLAYBACK_TIMEOUT_MS = 8000

function makePlaybackItem(id: string): GiftPlaybackItem {
  return {
    id,
    gift: {
      id: 1,
      name: 'Rose',
      label: null,
      description: null,
      price: 10,
      thumbnail_url: 'https://cdn.example.com/thumb.png',
      animation_url: 'https://cdn.example.com/rose.mp4',
      asset_type: 'video',
      category: 'normal',
      rarity: 'common',
      sort_order: 1,
      is_critical: false,
    },
    senderId: 2,
    senderName: 'Sender',
    recipientIds: [1],
    quantity: 1,
    timestamp: Date.now(),
  }
}

/** Build the composable inside a real effect scope, disposed at test end. */
async function buildPlayback() {
  const { useGiftPlayback } = await import('../../app/composables/gift/useGiftPlayback')
  const scope = effectScope()
  const playback = scope.run(() => useGiftPlayback())!
  return { playback, dispose: () => scope.stop() }
}

beforeEach(async () => {
  vi.useFakeTimers()
  setActivePinia(createPinia())

  const { useGiftStore } = await import('../../app/stores/gift')
  ;(globalThis as Record<string, unknown>).useGiftStore = useGiftStore
  ;(globalThis as Record<string, unknown>).useAuthStore = () => ({ user: { id: 1 } })
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetModules()
  Reflect.deleteProperty(globalThis, 'useGiftStore')
  Reflect.deleteProperty(globalThis, 'useAuthStore')
})

describe('useGiftPlayback — stall detector', () => {
  it('force-advances after 8s of silence when an item starts with no progress', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const giftStore = useGiftStore()
    const onPlaybackComplete = vi.spyOn(giftStore, 'onPlaybackComplete')

    const { playback, dispose } = await buildPlayback()
    void playback

    giftStore.currentPlayback = makePlaybackItem('item-1')
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(GIFT_PLAYBACK_TIMEOUT_MS)

    expect(onPlaybackComplete).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('survives a long healthy playback when handleProgress heartbeats every 1000ms for 20s', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const giftStore = useGiftStore()
    const onPlaybackComplete = vi.spyOn(giftStore, 'onPlaybackComplete')

    const { playback, dispose } = await buildPlayback()

    giftStore.currentPlayback = makePlaybackItem('item-1')
    await Promise.resolve()

    for (let elapsed = 0; elapsed < 20_000; elapsed += 1000) {
      await vi.advanceTimersByTimeAsync(1000)
      playback.handleProgress()
    }

    expect(onPlaybackComplete).not.toHaveBeenCalled()
    dispose()
  })

  it('force-advances ~8s after the last heartbeat when progress stops mid-play', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const giftStore = useGiftStore()
    const onPlaybackComplete = vi.spyOn(giftStore, 'onPlaybackComplete')

    const { playback, dispose } = await buildPlayback()

    giftStore.currentPlayback = makePlaybackItem('item-1')
    await Promise.resolve()

    // Three healthy heartbeats spaced 1000ms apart (each re-arms the timer).
    await vi.advanceTimersByTimeAsync(1000)
    playback.handleProgress()
    await vi.advanceTimersByTimeAsync(1000)
    playback.handleProgress()
    await vi.advanceTimersByTimeAsync(1000)
    playback.handleProgress()

    expect(onPlaybackComplete).not.toHaveBeenCalled()

    // Progress stops here — nothing re-arms the timer from now on.
    await vi.advanceTimersByTimeAsync(GIFT_PLAYBACK_TIMEOUT_MS - 1)
    expect(onPlaybackComplete).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(onPlaybackComplete).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('handleProgress is a no-op when nothing is playing — no crash, no timer armed', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const giftStore = useGiftStore()
    const onPlaybackComplete = vi.spyOn(giftStore, 'onPlaybackComplete')

    const { playback, dispose } = await buildPlayback()

    expect(giftStore.currentPlayback).toBeNull()
    expect(() => playback.handleProgress()).not.toThrow()

    // Advance well past the timeout window — nothing should fire since no
    // item ever started and handleProgress had nothing to re-arm.
    await vi.advanceTimersByTimeAsync(GIFT_PLAYBACK_TIMEOUT_MS * 2)

    expect(onPlaybackComplete).not.toHaveBeenCalled()
    dispose()
  })
})
