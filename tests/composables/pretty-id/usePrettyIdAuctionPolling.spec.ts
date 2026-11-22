import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, readonly, ref, toValue, watch } from 'vue'

const loadLot = vi.fn()
const loadLots = vi.fn()

vi.mock('~/composables/pretty-id/usePrettyIdAuctionData', () => ({
  usePrettyIdAuctionData: () => ({ loadLot, loadLots }),
}))

vi.stubGlobal('ref', ref)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('watch', watch)
vi.stubGlobal('toValue', toValue)
// VueUse only starts timers where a browser exists (`isClient`). Stubbed before
// VueUse is first imported, which happens inside `loadPolling()`.
vi.stubGlobal('window', globalThis)
vi.stubGlobal('document', {})

const LOT_POLL_MS = 7_000
const LOTS_POLL_MS = 15_000

async function loadPolling() {
  return import('~/composables/pretty-id/usePrettyIdAuctionPolling')
}

describe('auction polling hooks', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    loadLot.mockReset()
    loadLots.mockReset()
  })

  afterEach(() => vi.useRealTimers())

  it('usePrettyIdLotPolling loads at once, then quietly on every tick', async () => {
    const { usePrettyIdLotPolling } = await loadPolling()
    usePrettyIdLotPolling(7)

    expect(loadLot).toHaveBeenCalledTimes(1)
    expect(loadLot).toHaveBeenLastCalledWith(7)

    vi.advanceTimersByTime(LOT_POLL_MS)
    expect(loadLot).toHaveBeenCalledTimes(2)
    expect(loadLot).toHaveBeenLastCalledWith(7, { quiet: true })

    vi.advanceTimersByTime(LOT_POLL_MS)
    expect(loadLot).toHaveBeenCalledTimes(3)
  })

  it('usePrettyIdLotPolling reloads at once, loudly, when the lot id changes', async () => {
    const { usePrettyIdLotPolling } = await loadPolling()
    const lotId = ref(7)
    usePrettyIdLotPolling(lotId)
    loadLot.mockClear()

    lotId.value = 8
    await nextTick()

    expect(loadLot).toHaveBeenCalledTimes(1)
    expect(loadLot).toHaveBeenLastCalledWith(8)

    vi.advanceTimersByTime(LOT_POLL_MS)
    expect(loadLot).toHaveBeenLastCalledWith(8, { quiet: true })
  })

  it('usePrettyIdLotPolling settles once the first load finishes, even when it found nothing', async () => {
    let finishLoad: (applied: boolean) => void = () => {}
    loadLot.mockImplementationOnce(() => new Promise<boolean>((resolve) => { finishLoad = resolve }))
    const { usePrettyIdLotPolling } = await loadPolling()
    const { isSettled } = usePrettyIdLotPolling(7)

    expect(isSettled.value).toBe(false)

    finishLoad(false)
    await vi.advanceTimersByTimeAsync(0)

    expect(isSettled.value).toBe(true)
  })

  it('usePrettyIdLotPolling is unsettled again while a new lot id loads', async () => {
    const { usePrettyIdLotPolling } = await loadPolling()
    const lotId = ref(7)
    const { isSettled } = usePrettyIdLotPolling(lotId)
    await vi.advanceTimersByTimeAsync(0)
    expect(isSettled.value).toBe(true)

    let finishLoad: (applied: boolean) => void = () => {}
    loadLot.mockImplementationOnce(() => new Promise<boolean>((resolve) => { finishLoad = resolve }))
    lotId.value = 8
    await nextTick()
    expect(isSettled.value).toBe(false)

    finishLoad(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(isSettled.value).toBe(true)
  })

  it('usePrettyIdLotsPolling loads at once, then quietly on every tick', async () => {
    const { usePrettyIdLotsPolling } = await loadPolling()
    usePrettyIdLotsPolling()

    expect(loadLots).toHaveBeenCalledTimes(1)
    expect(loadLots).toHaveBeenLastCalledWith()

    vi.advanceTimersByTime(LOTS_POLL_MS)
    expect(loadLots).toHaveBeenCalledTimes(2)
    expect(loadLots).toHaveBeenLastCalledWith({ quiet: true })
  })
})
