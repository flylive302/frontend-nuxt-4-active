import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, nextTick, readonly, ref } from 'vue'
import { usePrettyIdAuctionHistoryActions } from '~/composables/pretty-id/usePrettyIdAuctionHistoryActions'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import { PrettyIdAuctionApiError } from '~/utils/pretty-id-auction-error'
import {
  createAuctionApiMock,
  makeWeeklyRecord,
  makeWinnerEntry,
  makeWinnersBoard,
  resetAuctionApiMock,
} from '../../helpers/prettyIdAuctionFixtures'

const apiMock = createAuctionApiMock()
const navigateToMock = vi.fn()

vi.mock('~/composables/pretty-id/usePrettyIdAuctionApi', () => ({
  usePrettyIdAuctionApi: () => apiMock,
}))
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
vi.stubGlobal('navigateTo', navigateToMock)

/** Lets the immediate watch and the load it starts settle. */
async function settle(): Promise<void> {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
}

describe('usePrettyIdAuctionHistoryActions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetAuctionApiMock(apiMock)
    navigateToMock.mockReset()
  })

  it('loads the winners of the URL month on open and is ready after', async () => {
    apiMock.winners.mockResolvedValue(makeWinnersBoard({ month: '2026-10' }))
    const month = ref<string | null>('2026-10')
    const page = usePrettyIdAuctionHistoryActions('winners', month)
    expect(page.status.value).toBe('loading')
    await settle()

    expect(apiMock.winners).toHaveBeenCalledWith('2026-10')
    expect(apiMock.weekly).not.toHaveBeenCalled()
    expect(page.status.value).toBe('ready')
    expect(usePrettyIdAuctionStore().winners?.month).toBe('2026-10')
  })

  it('asks for the current month when the URL has none', async () => {
    usePrettyIdAuctionHistoryActions('winners', ref<string | null>(null))
    await settle()
    expect(apiMock.winners).toHaveBeenCalledWith(undefined)
  })

  it('loads the weekly record for the weekly kind and reloads when the month changes', async () => {
    const month = ref<string | null>(null)
    const page = usePrettyIdAuctionHistoryActions('weekly', month)
    await settle()
    expect(apiMock.weekly).toHaveBeenLastCalledWith(undefined)
    expect(apiMock.winners).not.toHaveBeenCalled()

    apiMock.weekly.mockResolvedValue(makeWeeklyRecord({ month: '2026-09' }))
    month.value = '2026-09'
    await settle()
    expect(apiMock.weekly).toHaveBeenLastCalledWith('2026-09')
    expect(usePrettyIdAuctionStore().weekly?.month).toBe('2026-09')
    expect(page.status.value).toBe('ready')
  })

  it('goToMonth moves the URL with replace, leaving the load to the month watcher', async () => {
    const page = usePrettyIdAuctionHistoryActions('winners', ref<string | null>(null))
    await settle()
    page.goToMonth('2026-10')
    expect(navigateToMock).toHaveBeenCalledWith({ path: '/pretty-id/winners', query: { month: '2026-10' } }, { replace: true })

    const weekly = usePrettyIdAuctionHistoryActions('weekly', ref<string | null>(null))
    weekly.goToMonth('2026-08')
    expect(navigateToMock).toHaveBeenLastCalledWith({ path: '/pretty-id/weekly', query: { month: '2026-08' } }, { replace: true })
  })

  it('a first failure with nothing to show is `error`, and retry recovers', async () => {
    apiMock.winners.mockRejectedValueOnce(new PrettyIdAuctionApiError('unknown', 'Server down'))
    const page = usePrettyIdAuctionHistoryActions('winners', ref<string | null>(null))
    await settle()
    expect(page.status.value).toBe('error')

    apiMock.winners.mockResolvedValue(makeWinnersBoard())
    page.retry()
    expect(page.status.value).toBe('loading')
    await settle()
    expect(page.status.value).toBe('ready')
  })

  it('a failure with a board already on screen stays ready', async () => {
    usePrettyIdAuctionStore().setWinners(makeWinnersBoard())
    apiMock.winners.mockRejectedValue(new PrettyIdAuctionApiError('unknown', 'Server down'))
    const page = usePrettyIdAuctionHistoryActions('winners', ref<string | null>('2026-10'))
    await settle()
    expect(page.status.value).toBe('ready')
  })

  it('a 404 is `not_found`', async () => {
    apiMock.weekly.mockRejectedValue(new PrettyIdAuctionApiError('not_found'))
    const page = usePrettyIdAuctionHistoryActions('weekly', ref<string | null>(null))
    await settle()
    expect(page.status.value).toBe('not_found')
  })

  it('selectWinner opens the winner sheet with a winner and closes it with null', async () => {
    const page = usePrettyIdAuctionHistoryActions('winners', ref<string | null>(null))
    await settle()
    const entry = makeWinnerEntry({ auction_id: 9 })

    page.selectWinner(entry)
    expect(page.selectedWinner.value).toEqual(entry)
    expect(usePrettyIdAuctionStore().selectedWinner).toEqual(entry)
    page.selectWinner(null)
    expect(page.selectedWinner.value).toBeNull()
  })
})
