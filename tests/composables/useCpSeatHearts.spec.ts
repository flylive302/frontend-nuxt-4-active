import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  computed,
  effectScope,
  nextTick,
  onScopeDispose,
  readonly,
  ref,
  watch,
  type EffectScope,
} from 'vue'
import { CP_BIND_REFETCH_DELAYS_MS, CP_SEAT_HEARTS_DEBOUNCE_MS } from '~/constants/cp-event'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

interface PairsResponse {
  data: { pairs: { binder_id: number; partner_id: number }[] }
}

let apiMock = vi.fn<(url: string, opts: { body: { user_ids: number[] } }) => Promise<PairsResponse>>()
vi.mock('~/composables/shared/useApi', () => ({
  useApi: () => ({ api: (...a: Parameters<typeof apiMock>) => apiMock(...a) }),
}))

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual<typeof import('@vueuse/core')>('@vueuse/core')
  return {
    ...actual,
    useDocumentVisibility: () => ref('visible'),
    useEventListener: () => () => {},
    useResizeObserver: () => ({ stop: () => {} }),
  }
})

const A = 11
const B = 22
const C = 33

let scope: EffectScope | undefined

async function setup(pairs: { binder_id: number; partner_id: number }[] = [{ binder_id: A, partner_id: B }]) {
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('readonly', readonly)
  vi.stubGlobal('nextTick', nextTick)
  vi.stubGlobal('onScopeDispose', onScopeDispose)
  setActivePinia(createPinia())
  const { useRoomSeatsStore } = await import('~/stores/roomSeats')
  const { useRoomStore } = await import('~/stores/room')
  const { useBootstrapStore } = await import('~/stores/bootstrap')
  const { useCpStore } = await import('~/stores/cp')
  const seatsStore = useRoomSeatsStore()
  const roomStore = useRoomStore()
  const bootstrapStore = useBootstrapStore()
  const cpStore = useCpStore()
  vi.stubGlobal('useRoomSeatsStore', () => seatsStore)
  vi.stubGlobal('useRoomStore', () => roomStore)
  vi.stubGlobal('useBootstrapStore', () => bootstrapStore)
  vi.stubGlobal('useCpStore', () => cpStore)

  bootstrapStore.cpConfig = { ...bootstrapStore.cpConfig, enabled: true }
  roomStore.setCurrentRoom({ max_seats: 10 } as never)
  apiMock = vi.fn().mockResolvedValue({ data: { pairs } })

  const { useCpSeatHearts } = await import('~/composables/room/useCpSeatHearts')
  const container = ref<HTMLElement | null>(null)
  const s = effectScope()
  scope = s
  const result = s.run(() => useCpSeatHearts(container))!
  return { seatsStore, cpStore, result }
}

/** Advance fake timers and flush promise microtasks. */
async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  scope?.stop()
  scope = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useCpSeatHearts', () => {
  it('is synced with no couples and never calls the api when 0 or 1 seated', async () => {
    const { seatsStore, result } = await setup()
    await advance(CP_SEAT_HEARTS_DEBOUNCE_MS + 10)
    expect(result.pairsSynced.value).toBe(true)
    expect(result.couples.value).toEqual([])

    seatsStore.updateSeat(0, A, false)
    await advance(CP_SEAT_HEARTS_DEBOUNCE_MS + 10)
    expect(result.pairsSynced.value).toBe(true)
    expect(result.couples.value).toEqual([])
    expect(apiMock).not.toHaveBeenCalled()
  })

  it('returns adjacent partners left-first after the debounced fetch', async () => {
    const { seatsStore, result } = await setup([{ binder_id: B, partner_id: A }])
    seatsStore.updateSeat(0, A, false)
    seatsStore.updateSeat(1, B, false)
    await advance(CP_SEAT_HEARTS_DEBOUNCE_MS + 10)

    expect(apiMock).toHaveBeenCalledTimes(1)
    const body = apiMock.mock.calls[0]![1].body
    expect(body.user_ids).toEqual(expect.arrayContaining([A, B]))
    expect(result.couples.value).toEqual([{ leftUserId: A, rightUserId: B }])
    expect(result.pairsSynced.value).toBe(true)
    expect(result.hasSeatedPairs.value).toBe(true)
  })

  it('is unsynced after an occupant change until the fetch resolves', async () => {
    const { seatsStore, result } = await setup()
    seatsStore.updateSeat(0, A, false)
    seatsStore.updateSeat(1, B, false)
    await advance(CP_SEAT_HEARTS_DEBOUNCE_MS + 10)
    expect(result.pairsSynced.value).toBe(true)

    seatsStore.updateSeat(2, C, false)
    await nextTick()
    expect(result.pairsSynced.value).toBe(false)

    await advance(CP_SEAT_HEARTS_DEBOUNCE_MS + 10)
    expect(apiMock).toHaveBeenCalledTimes(2)
    expect(result.pairsSynced.value).toBe(true)
  })

  it('has seated pairs but no couples when partners wrap across rows', async () => {
    const { seatsStore, result } = await setup()
    seatsStore.updateSeat(4, A, false)
    seatsStore.updateSeat(5, B, false)
    await advance(CP_SEAT_HEARTS_DEBOUNCE_MS + 10)

    expect(apiMock).toHaveBeenCalledTimes(1)
    expect(result.couples.value).toEqual([])
    expect(result.hasSeatedPairs.value).toBe(true)
  })

  it('schedules forced refetches per bind delay and restarts on a newer bump', async () => {
    const { seatsStore, cpStore } = await setup()
    seatsStore.updateSeat(0, A, false)
    seatsStore.updateSeat(1, B, false)
    await advance(CP_SEAT_HEARTS_DEBOUNCE_MS + 10)
    expect(apiMock).toHaveBeenCalledTimes(1)
    const [first, second] = CP_BIND_REFETCH_DELAYS_MS as readonly [number, number]

    cpStore.bumpRoomBindingGiftSignal()
    await nextTick()
    await advance(first - 10)
    expect(apiMock).toHaveBeenCalledTimes(1)
    await advance(10)
    expect(apiMock).toHaveBeenCalledTimes(2)
    await advance(second - first)
    expect(apiMock).toHaveBeenCalledTimes(3)

    // second bump before first delay elapses restarts the schedule
    cpStore.bumpRoomBindingGiftSignal()
    await nextTick()
    await advance(first - 100)
    cpStore.bumpRoomBindingGiftSignal()
    await nextTick()
    await advance(second + 10)
    // 3 prior + exactly one forced call per delay (not doubled)
    expect(apiMock).toHaveBeenCalledTimes(3 + CP_BIND_REFETCH_DELAYS_MS.length)
  })

  it('clears pending bind timers when the scope stops', async () => {
    const { seatsStore, cpStore } = await setup()
    seatsStore.updateSeat(0, A, false)
    seatsStore.updateSeat(1, B, false)
    await advance(CP_SEAT_HEARTS_DEBOUNCE_MS + 10)
    expect(apiMock).toHaveBeenCalledTimes(1)

    cpStore.bumpRoomBindingGiftSignal()
    await nextTick()
    scope?.stop()
    await advance(Math.max(...CP_BIND_REFETCH_DELAYS_MS) + 10)
    expect(apiMock).toHaveBeenCalledTimes(1)
  })
})
