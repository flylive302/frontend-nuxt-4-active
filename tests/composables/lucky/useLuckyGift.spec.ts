/**
 * Tests for useLuckyGift no-draw notices + bust visibility (lucky-cap-ux 03).
 *
 * External behavior only: given a `lucky:no-draw` / `lucky:result` socket
 * payload, assert what lands in the floater store (copy, throttle, duration) —
 * never internal call order.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'
import { useLuckySessionStore } from '../../../app/stores/luckySession'
import {
  setupLuckyEventHandlers,
  cleanupLuckyEventHandlers,
} from '../../../app/composables/lucky/useLuckyGift'
import type { LuckyNoDrawReason } from '../../../app/types/lucky'

// Stub the Nuxt auto-imports the store/composable rely on BEFORE any store is
// instantiated (the store's setup runs `ref()` at creation time).
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', <T>(v: T) => v)
vi.stubGlobal('useLuckySessionStore', useLuckySessionStore)

// A single Pinia for the file: the composable caches its store reference on
// first setup (module-level `_store`), so the active store must stay stable.
setActivePinia(createPinia())
const store = useLuckySessionStore()

function createMockSocket() {
  const handlers = new Map<string, (payload: unknown) => void>()
  return {
    handlers,
    on: vi.fn((event: string, cb: (payload: unknown) => void) => {
      handlers.set(event, cb)
    }),
    off: vi.fn(),
  }
}

describe('useLuckyGift — no-draw notices + bust duration', () => {
  let socket: ReturnType<typeof createMockSocket>

  beforeEach(() => {
    vi.useFakeTimers()
    store.$reset()
    socket = createMockSocket()
    // cleanup first clears any throttle carried over from a prior test.
    cleanupLuckyEventHandlers(socket as never)
    setupLuckyEventHandlers(socket as never)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  function fireNoDraw(reason: LuckyNoDrawReason): void {
    socket.handlers.get('lucky:no-draw')!({ reason, gift_id: 1, batch_id: 'b1' })
  }

  function fireResult(multiplier: number): void {
    socket.handlers.get('lucky:result')!({
      multiplier,
      coins_won: Math.round(multiplier * 100),
      tier_name: 'T',
      gift_name: 'G',
    })
  }

  it.each([
    ['capped', 'pool capped for today'],
    ['user_capped', 'your daily win limit reached'],
    ['disabled', 'lucky draws unavailable'],
    ['no_eligible_tier', 'lucky draws unavailable'],
  ] as const)('renders one notice floater for reason %s', (reason, text) => {
    fireNoDraw(reason)

    expect(store.floatingMultipliers).toHaveLength(1)
    const floater = store.floatingMultipliers[0]!
    expect(floater.kind).toBe('notice')
    expect(floater.kind === 'notice' ? floater.text : null).toBe(text)
    expect(floater.colorClass).toBe('lucky-float--notice')
  })

  it('throttles repeat notices of the same reason within a session', () => {
    fireNoDraw('capped')
    fireNoDraw('capped')

    expect(store.floatingMultipliers).toHaveLength(1)

    // A different reason is not throttled.
    fireNoDraw('user_capped')
    expect(store.floatingMultipliers).toHaveLength(2)
  })

  it('resets the per-reason throttle on room leave', () => {
    fireNoDraw('capped')
    fireNoDraw('capped')
    expect(store.floatingMultipliers).toHaveLength(1)

    // Room leave → rejoin: the same reason may surface once again.
    cleanupLuckyEventHandlers(socket as never)
    setupLuckyEventHandlers(socket as never)

    fireNoDraw('capped')
    expect(store.floatingMultipliers).toHaveLength(2)
  })

  it('keeps a ×0 bust floater on screen exactly as long as a win floater', () => {
    fireResult(0) // bust
    fireResult(2) // win

    const bust = store.floatingMultipliers.find(
      (f) => f.kind === 'multiplier' && f.multiplier === 0,
    )
    expect(bust?.colorClass).toBe('lucky-float--bust')
    expect(store.floatingMultipliers).toHaveLength(2)

    // Just before the shared duration, both remain (bust never fades early).
    vi.advanceTimersByTime(2499)
    expect(store.floatingMultipliers).toHaveLength(2)

    // At the shared duration, both are removed together.
    vi.advanceTimersByTime(1)
    expect(store.floatingMultipliers).toHaveLength(0)
  })

  it('gives a notice floater a longer visible duration than a win floater', () => {
    fireNoDraw('capped')

    // Still visible after the win/bust duration (2500ms) elapses.
    vi.advanceTimersByTime(2500)
    expect(store.floatingMultipliers).toHaveLength(1)

    // Gone by its own longer notice duration (3500ms).
    vi.advanceTimersByTime(1000)
    expect(store.floatingMultipliers).toHaveLength(0)
  })
})
