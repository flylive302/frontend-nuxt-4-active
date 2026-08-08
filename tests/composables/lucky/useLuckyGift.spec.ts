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

    // Room leave → rejoin: cleanup resets ALL lucky visual state (floaters
    // included), and the same reason may surface once again.
    cleanupLuckyEventHandlers(socket as never)
    expect(store.floatingMultipliers).toHaveLength(0)
    setupLuckyEventHandlers(socket as never)

    fireNoDraw('capped')
    expect(store.floatingMultipliers).toHaveLength(1)
  })

  it('renders no center cashback for a ×0 bust, only for the win', () => {
    fireResult(0) // bust — silent by design
    expect(store.centerCashback).toBeNull()

    fireResult(2) // win → the single center cashback visual
    expect(store.centerCashback?.multiplier).toBe(2)
    expect(store.centerCashback?.coinsWon).toBe(200)
    expect(store.floatingMultipliers).toHaveLength(0) // wins never float now
  })

  it('keeps a notice floater visible for its full 3500ms duration', () => {
    fireNoDraw('capped')

    vi.advanceTimersByTime(3499)
    expect(store.floatingMultipliers).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(store.floatingMultipliers).toHaveLength(0)
  })
})

describe('useLuckyGift — center cashback state (lucky-animation-ux)', () => {
  let socket: ReturnType<typeof createMockSocket>

  beforeEach(() => {
    vi.useFakeTimers()
    store.$reset()
    socket = createMockSocket()
    cleanupLuckyEventHandlers(socket as never)
    setupLuckyEventHandlers(socket as never)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  function fireResult(multiplier: number, coins = Math.round(multiplier * 100)): void {
    socket.handlers.get('lucky:result')!({
      multiplier,
      coins_won: coins,
      tier_name: 'T',
      gift_name: 'G',
    })
  }

  it('rapid wins overwrite the single visual — never a queue', () => {
    fireResult(5)
    fireResult(5, 700)
    fireResult(10)

    expect(store.centerCashback?.tier).toBe(10)
    expect(store.centerCashback?.phase).toBe('visible')
    expect(store.floatingMultipliers).toHaveLength(0)
  })

  it('a lower tier during a visible higher one replaces it — most recent wins', () => {
    fireResult(10)
    fireResult(5, 500)

    expect(store.centerCashback?.tier).toBe(5)
    expect(store.centerCashback?.coinsWon).toBe(500) // NOT accumulated

    // Timer was renewed by the newer win: still visible past the original window.
    vi.advanceTimersByTime(4999)
    expect(store.centerCashback?.phase).toBe('visible')
  })

  it('fades after the visible duration, then clears after the fade duration', () => {
    fireResult(5)

    vi.advanceTimersByTime(5000)
    expect(store.centerCashback?.phase).toBe('fading')

    vi.advanceTimersByTime(3000)
    expect(store.centerCashback).toBeNull()
  })

  it('a new win during the fade interrupts it and restores full visibility', () => {
    fireResult(10)
    vi.advanceTimersByTime(5000)
    expect(store.centerCashback?.phase).toBe('fading')

    fireResult(5) // lower tier, but the fade is interruptible by ANY win
    expect(store.centerCashback?.phase).toBe('visible')
    expect(store.centerCashback?.tier).toBe(5)
  })

  it('room leave cleanup cancels pending timers and clears the visual', () => {
    fireResult(5)
    cleanupLuckyEventHandlers(socket as never)

    expect(store.centerCashback).toBeNull()
    vi.advanceTimersByTime(10_000) // orphaned timers must not resurrect state
    expect(store.centerCashback).toBeNull()
  })
})
