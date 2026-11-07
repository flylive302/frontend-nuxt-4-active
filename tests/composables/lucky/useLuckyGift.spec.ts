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
import { useGiftComboStore } from '../../../app/stores/giftCombo'
import { useBalanceStore } from '../../../app/stores/balance'
import {
  setupLuckyEventHandlers,
  cleanupLuckyEventHandlers,
  flushLuckyGiftWrites,
} from '../../../app/composables/lucky/useLuckyGift'
import type { LuckyNoDrawReason, LuckyRoomResultPayload } from '../../../app/types/lucky'

// Stub the Nuxt auto-imports the store/composable rely on BEFORE any store is
// instantiated (the store's setup runs `ref()` at creation time).
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', <T>(v: T) => v)
vi.stubGlobal('useLuckySessionStore', useLuckySessionStore)
vi.stubGlobal('useGiftComboStore', useGiftComboStore)

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
    // Center cashback is a STORE WRITE now frame-coalesced (ticket 15) — flush
    // synchronously so the test can assert against the same event's effect
    // without waiting a real animation frame.
    flushLuckyGiftWrites()
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
    // Center cashback is a STORE WRITE now frame-coalesced (ticket 15) — flush
    // synchronously so the test can assert against the same event's effect
    // without waiting a real animation frame.
    flushLuckyGiftWrites()
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

describe('useLuckyGift — lucky:room-result band writes, frame-coalesced (gift-authority-tick-fanout ticket 15)', () => {
  let socket: ReturnType<typeof createMockSocket>
  const addMessageMock = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    store.$reset()
    socket = createMockSocket()

    vi.stubGlobal('useRoomAudioStore', () => ({ addMessage: addMessageMock, messages: [] }))
    vi.stubGlobal('useRoomParticipantsStore', () => ({ participants: new Map([[2, { name: 'Ali' }], [3, { name: 'Sara' }]]) }))

    cleanupLuckyEventHandlers(socket as never)
    setupLuckyEventHandlers(socket as never)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  function win(senderId: number, coinsWon: number, overrides: Partial<LuckyRoomResultPayload> = {}): LuckyRoomResultPayload {
    return { sender_id: senderId, gift_id: 11, gift_name: 'Lucky Coin', multiplier: 5, coins_won: coinsWon, tier_name: 'T', room_id: 1, has_slide: false, ...overrides }
  }

  function fireRoomResult(payload: LuckyRoomResultPayload): void {
    socket.handlers.get('lucky:room-result')!(payload as never)
  }

  it('the chat bubble fires immediately per win — never coalesced or dropped, even before a flush', () => {
    store.upsertBand({ senderId: 2, senderName: 'Ali', senderAvatar: null, giftName: 'Lucky Coin', recipientName: null, recipientCount: 1, quantity: 0, coinsWon: 0, slot: 0, phase: 'visible', lastActivityAt: Date.now() })

    fireRoomResult(win(2, 100))
    fireRoomResult(win(2, 200))
    fireRoomResult(win(2, 300))

    // Three distinct wins → three distinct chat bubbles, with NO flush yet.
    expect(addMessageMock).toHaveBeenCalledTimes(3)
  })

  it('list-merge: multiple wins for the SAME sender within one frame sum into one flushed store write', () => {
    store.upsertBand({ senderId: 2, senderName: 'Ali', senderAvatar: null, giftName: 'Lucky Coin', recipientName: null, recipientCount: 1, quantity: 0, coinsWon: 0, slot: 0, phase: 'visible', lastActivityAt: Date.now() })

    fireRoomResult(win(2, 100))
    fireRoomResult(win(2, 200))
    fireRoomResult(win(2, 300))
    // Not flushed yet — the store write is deferred to the next frame.
    expect(store.senderBands.get(2)?.coinsWon).toBe(0)

    flushLuckyGiftWrites()
    expect(store.senderBands.get(2)?.coinsWon).toBe(600)
  })

  it('list-merge: wins for DIFFERENT senders within one frame each apply independently', () => {
    store.upsertBand({ senderId: 2, senderName: 'Ali', senderAvatar: null, giftName: 'Lucky Coin', recipientName: null, recipientCount: 1, quantity: 0, coinsWon: 0, slot: 0, phase: 'visible', lastActivityAt: Date.now() })
    store.upsertBand({ senderId: 3, senderName: 'Sara', senderAvatar: null, giftName: 'Lucky Coin', recipientName: null, recipientCount: 1, quantity: 0, coinsWon: 0, slot: 1, phase: 'visible', lastActivityAt: Date.now() })

    fireRoomResult(win(2, 100))
    fireRoomResult(win(3, 500))
    flushLuckyGiftWrites()

    expect(store.senderBands.get(2)?.coinsWon).toBe(100)
    expect(store.senderBands.get(3)?.coinsWon).toBe(500)
  })

  it('a win for a sender with no live band is a no-op store write (chat bubble still fires)', () => {
    fireRoomResult(win(99, 100))
    flushLuckyGiftWrites()

    expect(store.senderBands.has(99)).toBe(false)
    expect(addMessageMock).toHaveBeenCalledTimes(1)
  })

  it('cleanup drops any pending (unflushed) coalesced win instead of applying it later', () => {
    store.upsertBand({ senderId: 2, senderName: 'Ali', senderAvatar: null, giftName: 'Lucky Coin', recipientName: null, recipientCount: 1, quantity: 0, coinsWon: 0, slot: 0, phase: 'visible', lastActivityAt: Date.now() })

    fireRoomResult(win(2, 100))
    cleanupLuckyEventHandlers(socket as never)
    flushLuckyGiftWrites() // no-op: cleanup cleared the pending delta and reset the store

    expect(store.senderBands.has(2)).toBe(false)
  })
})

describe('useLuckyGift — "+N won this combo" sum (gift-cashback-latency 06)', () => {
  let socket: ReturnType<typeof createMockSocket>
  const comboStore = useGiftComboStore()
  const balanceStore = useBalanceStore()
  const addMessageMock = vi.fn()
  const COMBO_CTX = { gift: { id: 7, price: 100 } as never, senderId: 1, recipientIds: [2], quantity: 1 }
  const STARTING_COINS = '1000'

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('useRoomAudioStore', () => ({ addMessage: addMessageMock, messages: [] }))
    vi.stubGlobal('useRoomParticipantsStore', () => ({ participants: new Map([[2, { name: 'Ali' }]]) }))
    store.$reset()
    comboStore.$reset()
    balanceStore.reset()
    balanceStore.seed({ coins: STARTING_COINS, diamonds: '0', wealth_xp: '0', charm_xp: '0' })
    socket = createMockSocket()
    cleanupLuckyEventHandlers(socket as never)
    setupLuckyEventHandlers(socket as never)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  function fireOwnResult(multiplier: number, coins: number): void {
    socket.handlers.get('lucky:result')!({ multiplier, coins_won: coins, tier_name: 'T', gift_name: 'G' })
  }

  function fireRoomResult(senderId: number, coins: number): void {
    socket.handlers.get('lucky:room-result')!({
      sender_id: senderId, gift_id: 1, gift_name: 'G', multiplier: 5, coins_won: coins,
      tier_name: 'T', room_id: 1, has_slide: true,
    } satisfies LuckyRoomResultPayload)
  }

  it('sums the sender\'s own lucky:result coins since the combo started', () => {
    const wins = [500, 200, 1_300]
    comboStore.setLuckyContext(COMBO_CTX)

    for (const coins of wins) {
      fireOwnResult(5, coins)
      flushLuckyGiftWrites()
    }

    expect(comboStore.luckyComboWonCoins).toBe(wins.reduce((sum, coins) => sum + coins, 0))
  })

  it('folds a same-frame burst of wins into ONE store write (ADR 0034 frame batching)', () => {
    const wins = [500, 200, 1_300]
    comboStore.setLuckyContext(COMBO_CTX)
    const addWon = vi.spyOn(comboStore, 'addLuckyComboWon')

    for (const coins of wins) fireOwnResult(5, coins)
    // Not flushed yet — the write is deferred to the next frame, like the cashback.
    expect(comboStore.luckyComboWonCoins).toBe(0)
    expect(addWon).not.toHaveBeenCalled()

    flushLuckyGiftWrites()

    expect(addWon).toHaveBeenCalledTimes(1)
    expect(comboStore.luckyComboWonCoins).toBe(wins.reduce((sum, coins) => sum + coins, 0))
  })

  it('resets when the combo ends and starts from zero on the next combo', () => {
    comboStore.setLuckyContext(COMBO_CTX)
    fireOwnResult(5, 500)
    flushLuckyGiftWrites()
    expect(comboStore.luckyComboWonCoins).toBe(500)

    comboStore.clearLuckyContext()
    expect(comboStore.luckyComboWonCoins).toBe(0)

    comboStore.setLuckyContext(COMBO_CTX)
    fireOwnResult(5, 70)
    flushLuckyGiftWrites()
    expect(comboStore.luckyComboWonCoins).toBe(70)
  })

  it('counts only the sender\'s own lucky:result — never lucky:room-result, not even the sender\'s echo', () => {
    comboStore.setLuckyContext(COMBO_CTX)
    const OWN_SENDER_ID = COMBO_CTX.senderId
    const OTHER_SENDER_ID = 2

    fireRoomResult(OTHER_SENDER_ID, 900)
    fireRoomResult(OWN_SENDER_ID, 900) // the sender also receives their own room broadcast
    flushLuckyGiftWrites()
    expect(comboStore.luckyComboWonCoins).toBe(0)

    fireOwnResult(5, 400)
    flushLuckyGiftWrites()
    expect(comboStore.luckyComboWonCoins).toBe(400)
  })

  it('a bust (×0) adds nothing', () => {
    comboStore.setLuckyContext(COMBO_CTX)
    fireOwnResult(0, 0)
    flushLuckyGiftWrites()
    expect(comboStore.luckyComboWonCoins).toBe(0)
  })

  it('a result with no live lucky combo is not added to the sum', () => {
    fireOwnResult(5, 500)
    flushLuckyGiftWrites()
    expect(comboStore.luckyComboWonCoins).toBe(0)

    // ...and it does not leak into the NEXT combo either.
    comboStore.setLuckyContext(COMBO_CTX)
    flushLuckyGiftWrites()
    expect(comboStore.luckyComboWonCoins).toBe(0)
  })

  it('room leave drops a pending unflushed win instead of applying it later', () => {
    comboStore.setLuckyContext(COMBO_CTX)
    fireOwnResult(5, 500)
    cleanupLuckyEventHandlers(socket as never)
    flushLuckyGiftWrites()
    expect(comboStore.luckyComboWonCoins).toBe(0)
  })

  it('never writes the balance store — a win moves the display sum, not the spendable coins', () => {
    const apply = vi.spyOn(balanceStore, 'apply')
    const patch = vi.spyOn(balanceStore, 'patch')
    const seed = vi.spyOn(balanceStore, 'seed')
    const reset = vi.spyOn(balanceStore, 'reset')
    const seqBefore = balanceStore.seq

    comboStore.setLuckyContext(COMBO_CTX)
    fireOwnResult(5, 500)
    fireOwnResult(10, 1_000)
    fireOwnResult(0, 0)
    fireRoomResult(1, 500)
    flushLuckyGiftWrites()

    expect(comboStore.luckyComboWonCoins).toBe(1_500)
    expect(apply).not.toHaveBeenCalled()
    expect(patch).not.toHaveBeenCalled()
    expect(seed).not.toHaveBeenCalled()
    expect(reset).not.toHaveBeenCalled()
    expect(balanceStore.coins).toBe(STARTING_COINS)
    expect(balanceStore.seq).toBe(seqBefore)
  })
})
