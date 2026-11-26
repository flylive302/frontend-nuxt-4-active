import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, effectScope, nextTick, readonly, ref } from 'vue'
import type { EffectScope } from 'vue'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import { PrettyIdAuctionApiError } from '~/utils/pretty-id-auction-error'
import { emitAppForeground } from '~/services/appForeground'
import {
  createAuctionApiMock,
  HOUR,
  iso,
  makeCard,
  makeList,
  makeMe,
  makeSnapshot,
  makeUser,
  resetAuctionApiMock,
  SERVER_NOW_MS,
} from '../../helpers/prettyIdAuctionFixtures'

const apiMock = createAuctionApiMock()
const toastAdd = vi.fn()
const visibilityState = vi.hoisted(() => ({ ref: null as null | { value: 'visible' | 'hidden' } }))

vi.mock('~/composables/pretty-id/usePrettyIdAuctionApi', () => ({
  usePrettyIdAuctionApi: () => apiMock,
}))
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  const { ref: vueRef } = await import('vue')
  visibilityState.ref = vueRef<'visible' | 'hidden'>('visible')
  return { ...actual, useDocumentVisibility: () => visibilityState.ref }
})

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('useToast', () => ({ add: toastAdd }))

const { isPrettyIdDisqualificationSeen, usePrettyIdAuctionPagePolling, usePrettyIdAuctionsPolling } = await import(
  '~/composables/pretty-id/usePrettyIdAuctionPolling'
)

async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
}

function notFound(): PrettyIdAuctionApiError {
  return new PrettyIdAuctionApiError('not_found')
}

describe('Rare Auction polling', () => {
  let scope: EffectScope

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime(SERVER_NOW_MS)
    resetAuctionApiMock(apiMock)
    toastAdd.mockReset()
    visibilityState.ref!.value = 'visible'
  })

  afterEach(() => {
    scope?.stop()
    vi.useRealTimers()
  })

  describe('auction page', () => {
    function open(id = 1) {
      const auctionId = ref(id)
      scope = effectScope()
      const polling = scope.run(() => usePrettyIdAuctionPagePolling(() => auctionId.value))!
      return { polling, auctionId }
    }

    it('loads the snapshot and `me` once on open', async () => {
      const { polling } = open()
      expect(polling.status.value).toBe('loading')
      await settle()
      expect(apiMock.auction).toHaveBeenCalledTimes(1)
      expect(apiMock.auction).toHaveBeenCalledWith(1)
      expect(apiMock.auctionMe).toHaveBeenCalledTimes(1)
      expect(apiMock.auctionMe).toHaveBeenCalledWith(1)
      expect(polling.status.value).toBe('ready')
      expect(usePrettyIdAuctionStore().snapshotById(1)?.rare_id).toBe('007')
      expect(usePrettyIdAuctionStore().myStandingById(1)).toEqual(makeMe())
    })

    it('polls every 60 s while more than an hour is left, and never re-fetches me', async () => {
      apiMock.auction.mockResolvedValue(makeSnapshot({ ends_at: iso(5 * HOUR) }))
      open()
      await settle()
      await vi.advanceTimersByTimeAsync(59_000)
      expect(apiMock.auction).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1_000)
      expect(apiMock.auction).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(60_000)
      expect(apiMock.auction).toHaveBeenCalledTimes(3)
      expect(apiMock.auctionMe).toHaveBeenCalledTimes(1)
    })

    it('switches to 3 s once under an hour is left (judged on the server clock, not the device clock)', async () => {
      // The DEVICE clock is 3 h behind the server. The auction ends 1 h 1 min after server-now at open.
      const skewMs = 3 * HOUR
      vi.setSystemTime(SERVER_NOW_MS - skewMs)
      const endsAt = iso(HOUR + 60_000)
      apiMock.auction.mockImplementation(() =>
        Promise.resolve(makeSnapshot({ ends_at: endsAt, server_now: new Date(Date.now() + skewMs).toISOString() })),
      )
      open()
      await settle()
      expect(apiMock.auction).toHaveBeenCalledTimes(1)

      // Slow cadence while more than an hour remains (on the server clock)...
      await vi.advanceTimersByTimeAsync(59_999)
      expect(apiMock.auction).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(apiMock.auction).toHaveBeenCalledTimes(2)
      // ...the remaining time is now exactly one hour: still slow. One tick later it is under an hour,
      // and from that fetch on the cadence is 3 s.
      await vi.advanceTimersByTimeAsync(60_000)
      expect(apiMock.auction).toHaveBeenCalledTimes(3)
      await vi.advanceTimersByTimeAsync(3_000)
      expect(apiMock.auction).toHaveBeenCalledTimes(4)
      await vi.advanceTimersByTimeAsync(3_000)
      expect(apiMock.auction).toHaveBeenCalledTimes(5)
      expect(apiMock.auctionMe).toHaveBeenCalledTimes(1)
    })

    it('stays at 3 s when ends_at is extended', async () => {
      apiMock.auction.mockResolvedValue(makeSnapshot({ ends_at: iso(30_000) }))
      open()
      await settle()
      await vi.advanceTimersByTimeAsync(3_000)
      expect(apiMock.auction).toHaveBeenCalledTimes(2)
      // a last-minute bid pushes the end 60 s out: still far below an hour
      apiMock.auction.mockResolvedValue(makeSnapshot({ ends_at: iso(90_000) }))
      await vi.advanceTimersByTimeAsync(3_000)
      expect(apiMock.auction).toHaveBeenCalledTimes(3)
      await vi.advanceTimersByTimeAsync(3_000)
      expect(apiMock.auction).toHaveBeenCalledTimes(4)
    })

    it('keeps 3 s past ends_at while awaiting settlement', async () => {
      apiMock.auction.mockResolvedValue(makeSnapshot({ state: 'live', ends_at: iso(-10_000) }))
      open()
      await settle()
      await vi.advanceTimersByTimeAsync(3_000)
      await vi.advanceTimersByTimeAsync(3_000)
      expect(apiMock.auction).toHaveBeenCalledTimes(3)
    })

    it('an upcoming auction refetches one second after its start (at least 3 s)', async () => {
      apiMock.auction.mockResolvedValue(
        makeSnapshot({ state: 'upcoming', starts_at: iso(20_000), ends_at: iso(HOUR), planned_ends_at: iso(HOUR) }),
      )
      open()
      await settle()
      await vi.advanceTimersByTimeAsync(20_999)
      expect(apiMock.auction).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(apiMock.auction).toHaveBeenCalledTimes(2)
    })

    it.each(['ended', 'cancelled'] as const)('stops polling once the auction is %s', async (state) => {
      apiMock.auction.mockResolvedValue(makeSnapshot({ state, ends_at: iso(-HOUR) }))
      open()
      await settle()
      await vi.advanceTimersByTimeAsync(10 * 60_000)
      expect(apiMock.auction).toHaveBeenCalledTimes(1)
    })

    it('a live auction that turns ended stops after that fetch', async () => {
      apiMock.auction.mockResolvedValueOnce(makeSnapshot({ ends_at: iso(1_000) }))
      open()
      await settle()
      apiMock.auction.mockResolvedValue(makeSnapshot({ state: 'ended', ends_at: iso(1_000) }))
      await vi.advanceTimersByTimeAsync(3_000)
      expect(apiMock.auction).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(10 * 60_000)
      expect(apiMock.auction).toHaveBeenCalledTimes(2)
    })

    it('a hidden page stops polling; visible again fetches at once and resumes', async () => {
      open()
      await settle()
      visibilityState.ref!.value = 'hidden'
      await settle()
      await vi.advanceTimersByTimeAsync(5 * 60_000)
      expect(apiMock.auction).toHaveBeenCalledTimes(1)

      visibilityState.ref!.value = 'visible'
      await settle()
      expect(apiMock.auction).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(60_000)
      expect(apiMock.auction).toHaveBeenCalledTimes(3)
      expect(apiMock.auctionMe).toHaveBeenCalledTimes(1)
    })

    it('an app foreground refetches at once', async () => {
      open()
      await settle()
      emitAppForeground()
      await settle()
      expect(apiMock.auction).toHaveBeenCalledTimes(2)
      expect(apiMock.auctionMe).toHaveBeenCalledTimes(1)
    })

    it('a 404 shows not_found (no toast) and stops polling', async () => {
      apiMock.auction.mockRejectedValue(notFound())
      const { polling } = open(99)
      await settle()
      expect(polling.status.value).toBe('not_found')
      expect(toastAdd).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(10 * 60_000)
      expect(apiMock.auction).toHaveBeenCalledTimes(1)
    })

    it('a failed first load is an error (toast once), not not_found, and is retried slowly', async () => {
      apiMock.auction.mockRejectedValue(new PrettyIdAuctionApiError('unknown', 'Server down'))
      const { polling } = open()
      await settle()
      expect(polling.status.value).toBe('error')
      expect(toastAdd).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(60_000)
      expect(apiMock.auction).toHaveBeenCalledTimes(2)
      expect(toastAdd).toHaveBeenCalledTimes(1) // the retry tick is quiet
    })

    it('retry() goes back to loading and refetches', async () => {
      apiMock.auction.mockRejectedValueOnce(new PrettyIdAuctionApiError('unknown', 'Server down'))
      const { polling } = open()
      await settle()
      expect(polling.status.value).toBe('error')

      polling.retry()
      expect(polling.status.value).toBe('loading')
      await settle()
      expect(polling.status.value).toBe('ready')
      expect(apiMock.auction).toHaveBeenCalledTimes(2)
    })

    it('a failed quiet tick keeps the auction on screen and keeps the cadence', async () => {
      apiMock.auction.mockResolvedValueOnce(makeSnapshot({ ends_at: iso(30_000) }))
      const { polling } = open()
      await settle()
      apiMock.auction.mockRejectedValue(new PrettyIdAuctionApiError('unknown', 'blip'))
      await vi.advanceTimersByTimeAsync(3_000)
      expect(polling.status.value).toBe('ready')
      expect(toastAdd).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(3_000)
      expect(apiMock.auction).toHaveBeenCalledTimes(3)
    })

    it('a changed id loads the new auction and its me, and the old chain is gone', async () => {
      const { auctionId } = open(1)
      await settle()
      auctionId.value = 2
      await nextTick()
      await settle()
      expect(apiMock.auction).toHaveBeenLastCalledWith(2)
      expect(apiMock.auctionMe).toHaveBeenCalledTimes(2)
      expect(apiMock.auctionMe).toHaveBeenLastCalledWith(2)

      apiMock.auction.mockClear()
      await vi.advanceTimersByTimeAsync(60_000)
      expect(apiMock.auction).toHaveBeenCalledTimes(1)
      expect(apiMock.auction).toHaveBeenCalledWith(2)
    })

    it('does nothing after the scope is disposed', async () => {
      open()
      await settle()
      scope.stop()
      await vi.advanceTimersByTimeAsync(10 * 60_000)
      expect(apiMock.auction).toHaveBeenCalledTimes(1)
    })
  })

  describe('clock offset from server_now', () => {
    it('is set from every snapshot (server 5 s ahead of the device)', async () => {
      apiMock.auction.mockResolvedValue(makeSnapshot({ server_now: new Date(SERVER_NOW_MS + 5_000).toISOString() }))
      scope = effectScope()
      scope.run(() => usePrettyIdAuctionPagePolling(() => 1))
      await settle()
      expect(usePrettyIdAuctionStore().clockOffsetMs).toBe(5_000)
    })

    it('keeps the previous offset when server_now is not a date', async () => {
      const store = usePrettyIdAuctionStore()
      store.setClockOffsetMs(1_234)
      apiMock.auction.mockResolvedValue(makeSnapshot({ server_now: 'garbage' }))
      scope = effectScope()
      scope.run(() => usePrettyIdAuctionPagePolling(() => 1))
      await settle()
      expect(store.clockOffsetMs).toBe(1_234)
    })
  })

  describe('tab', () => {
    function mountTab(enabled: { value: boolean }) {
      scope = effectScope()
      return scope.run(() => usePrettyIdAuctionsPolling(() => enabled.value))!
    }

    it('makes NO call while the auction switch is off', async () => {
      const enabled = ref(false)
      mountTab(enabled)
      await vi.advanceTimersByTimeAsync(10 * 60_000)
      expect(apiMock.auctions).not.toHaveBeenCalled()
      emitAppForeground()
      visibilityState.ref!.value = 'hidden'
      await settle()
      visibilityState.ref!.value = 'visible'
      await settle()
      expect(apiMock.auctions).not.toHaveBeenCalled()
    })

    it('loads at once and every 60 s while the switch is on', async () => {
      apiMock.auctions.mockResolvedValue(makeList([makeCard()]))
      mountTab(ref(true))
      await settle()
      expect(apiMock.auctions).toHaveBeenCalledTimes(1)
      expect(usePrettyIdAuctionStore().auctions).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(59_999)
      expect(apiMock.auctions).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(apiMock.auctions).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(60_000)
      expect(apiMock.auctions).toHaveBeenCalledTimes(3)
    })

    it('starts when the switch turns on and stops when it turns off', async () => {
      const enabled = ref(false)
      mountTab(enabled)
      await settle()
      expect(apiMock.auctions).not.toHaveBeenCalled()

      enabled.value = true
      await settle()
      expect(apiMock.auctions).toHaveBeenCalledTimes(1)

      enabled.value = false
      await settle()
      await vi.advanceTimersByTimeAsync(5 * 60_000)
      expect(apiMock.auctions).toHaveBeenCalledTimes(1)
    })

    it('a 404 on the list (auction off server-side) is silent: no toast, no failed flag, polling ends', async () => {
      apiMock.auctions.mockRejectedValue(notFound())
      mountTab(ref(true))
      await settle()
      const store = usePrettyIdAuctionStore()
      expect(toastAdd).not.toHaveBeenCalled()
      expect(store.isAuctionsFailed).toBe(false)
      await vi.advanceTimersByTimeAsync(10 * 60_000)
      expect(apiMock.auctions).toHaveBeenCalledTimes(1)
    })

    it('retry() restarts the tab after a 404', async () => {
      apiMock.auctions.mockRejectedValueOnce(notFound())
      const { retry } = mountTab(ref(true))
      await settle()
      apiMock.auctions.mockResolvedValue(makeList([makeCard()]))
      retry()
      await settle()
      expect(apiMock.auctions).toHaveBeenCalledTimes(2)
      expect(usePrettyIdAuctionStore().auctions).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(60_000)
      expect(apiMock.auctions).toHaveBeenCalledTimes(3)
    })

    it('stops while hidden and refetches on visible and on foreground', async () => {
      mountTab(ref(true))
      await settle()
      visibilityState.ref!.value = 'hidden'
      await settle()
      await vi.advanceTimersByTimeAsync(5 * 60_000)
      expect(apiMock.auctions).toHaveBeenCalledTimes(1)
      visibilityState.ref!.value = 'visible'
      await settle()
      expect(apiMock.auctions).toHaveBeenCalledTimes(2)
      emitAppForeground()
      await settle()
      expect(apiMock.auctions).toHaveBeenCalledTimes(3)
    })

    it('sets the clock offset from the list server_now', async () => {
      apiMock.auctions.mockResolvedValue(makeList([], new Date(SERVER_NOW_MS - 8_000).toISOString()))
      mountTab(ref(true))
      await settle()
      expect(usePrettyIdAuctionStore().clockOffsetMs).toBe(-8_000)
    })

    it('a failed first load toasts once and flags the list failed; ticks are quiet', async () => {
      apiMock.auctions.mockRejectedValue(new PrettyIdAuctionApiError('unknown', 'down'))
      mountTab(ref(true))
      await settle()
      const store = usePrettyIdAuctionStore()
      expect(store.isAuctionsFailed).toBe(true)
      expect(toastAdd).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(60_000)
      expect(apiMock.auctions).toHaveBeenCalledTimes(2)
      expect(toastAdd).toHaveBeenCalledTimes(1)
    })
  })
})

describe('isPrettyIdDisqualificationSeen (pretty-id-step2 11)', () => {
  const leader = makeUser(10)

  it('is false for an ordinary outbid (leader changes, bidder count grows or stays)', () => {
    const before = makeSnapshot({ leader, bidder_count: 1, price_floor: 1_000 })
    const after = makeSnapshot({ leader: makeUser(7), bidder_count: 2, price_floor: 1_100 })
    expect(isPrettyIdDisqualificationSeen(before, after)).toBe(false)
  })

  it('is true when the bidder count drops (anyone disqualified)', () => {
    const before = makeSnapshot({ leader, bidder_count: 2, price_floor: 1_100 })
    const after = makeSnapshot({ leader, bidder_count: 1, price_floor: 1_100 })
    expect(isPrettyIdDisqualificationSeen(before, after)).toBe(true)
  })

  it('is true when a live auction loses its leader but keeps a price floor', () => {
    const before = makeSnapshot({ leader, bidder_count: 2, price_floor: 1_100 })
    const after = makeSnapshot({ leader: null, bidder_count: 2, price_floor: 1_000 })
    expect(isPrettyIdDisqualificationSeen(before, after)).toBe(true)
  })

  it('is false on the first load and once the auction is not live', () => {
    const after = makeSnapshot({ leader: null, bidder_count: 1, price_floor: 1_000 })
    expect(isPrettyIdDisqualificationSeen(undefined, after)).toBe(false)
    expect(isPrettyIdDisqualificationSeen(makeSnapshot({ leader, bidder_count: 1 }), makeSnapshot({ state: 'ended', leader: null, bidder_count: 1, price_floor: 1_000 }))).toBe(false)
  })
})
