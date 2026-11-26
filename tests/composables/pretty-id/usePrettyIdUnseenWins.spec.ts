import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, readonly, ref } from 'vue'
import { usePrettyIdUnseenWins } from '~/composables/pretty-id/usePrettyIdUnseenWins'
import { PRETTY_ID_MY_PROPS_ROUTE } from '~/constants/pretty-id'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import type { PrettyIdAuctionUnseenWin } from '~/types/pretty-id-auction'
import { PrettyIdAuctionApiError } from '~/utils/pretty-id-auction-error'
import { deferred } from '../../helpers/prettyIdFixtures'
import { createAuctionApiMock, resetAuctionApiMock } from '../../helpers/prettyIdAuctionFixtures'

const apiMock = createAuctionApiMock()
const fireConfetti = vi.fn()
const syncUser = vi.fn()
const navigateToMock = vi.fn()
const emitProfileSync = vi.fn()
const auth: { isAuthenticated: boolean; user: { signature: string | null } } = { isAuthenticated: true, user: { signature: null } }
const bootstrap = { prettyIdAuctionEnabled: true }

vi.mock('~/composables/pretty-id/usePrettyIdAuctionApi', () => ({
  usePrettyIdAuctionApi: () => apiMock,
}))
vi.mock('~/composables/pretty-id/usePrettyIdConfetti', () => ({
  usePrettyIdConfetti: () => ({ fireConfetti }),
}))
vi.mock('~/composables/shared/useUserSync', () => ({
  useUserSync: () => ({ syncUser }),
}))
vi.mock('~/stores/auth', () => ({
  useAuthStore: () => auth,
}))
vi.mock('~/stores/bootstrap', () => ({
  useBootstrapStore: () => bootstrap,
}))
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('navigateTo', navigateToMock)
vi.stubGlobal('useProfileActions', () => ({ emitProfileSync }))

function makeWin(overrides: Partial<PrettyIdAuctionUnseenWin> = {}): PrettyIdAuctionUnseenWin {
  return {
    auction_id: 5,
    rare_id: '777',
    winning_bid: 250_000,
    won_at: '2026-11-26T09:00:00.000Z',
    expires_at: '2026-12-03T09:00:00.000Z',
    keep_days: 7,
    ...overrides,
  }
}

/** Lets the fire-and-forget mark-seen + user refresh settle. */
async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('usePrettyIdUnseenWins', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetAuctionApiMock(apiMock)
    fireConfetti.mockReset()
    syncUser.mockReset().mockResolvedValue(undefined)
    navigateToMock.mockReset()
    emitProfileSync.mockReset()
    auth.isAuthenticated = true
    auth.user = { signature: null }
    bootstrap.prettyIdAuctionEnabled = true
  })

  it('shows the first unseen win, fires confetti, marks it seen and refreshes the user', async () => {
    apiMock.unseenWins.mockResolvedValue([makeWin({ auction_id: 5 }), makeWin({ auction_id: 6, rare_id: '888' })])
    const store = usePrettyIdAuctionStore()

    await usePrettyIdUnseenWins().checkUnseenWins()

    expect(store.winCelebration).toEqual(expect.objectContaining({ auction_id: 5, rare_id: '777' }))
    expect(fireConfetti).toHaveBeenCalledTimes(1)
    await settle()
    expect(apiMock.markWinSeen).toHaveBeenCalledTimes(1)
    expect(apiMock.markWinSeen).toHaveBeenCalledWith(5)
    expect(syncUser).toHaveBeenCalledTimes(1)
  })

  it('shows the win before the seen call answers, then refreshes the user after it', async () => {
    apiMock.unseenWins.mockResolvedValue([makeWin()])
    const seen = deferred<{ auction_id: number; seen: true }>()
    apiMock.markWinSeen.mockReturnValue(seen.promise)
    const store = usePrettyIdAuctionStore()

    await usePrettyIdUnseenWins().checkUnseenWins()
    await settle()

    expect(store.winCelebration).not.toBeNull()
    expect(syncUser).not.toHaveBeenCalled()
    seen.resolve({ auction_id: 5, seen: true })
    await settle()
    expect(syncUser).toHaveBeenCalledTimes(1)
  })

  it('does not re-show the same win after it is dismissed, on a later check', async () => {
    apiMock.unseenWins.mockResolvedValue([makeWin()])
    const store = usePrettyIdAuctionStore()
    const wins = usePrettyIdUnseenWins()

    await wins.checkUnseenWins()
    wins.finishWinCelebration()
    await wins.checkUnseenWins()
    await settle()

    expect(apiMock.markWinSeen).toHaveBeenCalledTimes(1)
    expect(store.winCelebration).toBeNull()
  })

  it('a foreground re-check shows a win that landed while the app was alive', async () => {
    apiMock.unseenWins.mockResolvedValueOnce([])
    const store = usePrettyIdAuctionStore()
    const wins = usePrettyIdUnseenWins()
    await wins.checkUnseenWins()
    expect(store.winCelebration).toBeNull()

    apiMock.unseenWins.mockResolvedValueOnce([makeWin({ auction_id: 9, rare_id: '999' })])
    await wins.checkUnseenWins()

    expect(store.winCelebration).toEqual(expect.objectContaining({ auction_id: 9 }))
    expect(apiMock.unseenWins).toHaveBeenCalledTimes(2)
  })

  it('skips an already shown win and shows the next unseen one', async () => {
    const store = usePrettyIdAuctionStore()
    store.markWinShown(5)
    apiMock.unseenWins.mockResolvedValue([makeWin({ auction_id: 5 }), makeWin({ auction_id: 6, rare_id: '888' })])

    await usePrettyIdUnseenWins().checkUnseenWins()

    expect(store.winCelebration).toEqual(expect.objectContaining({ auction_id: 6 }))
  })

  it('shows nothing when the only win was already shown (server still lists it)', async () => {
    const store = usePrettyIdAuctionStore()
    store.markWinShown(5)
    apiMock.unseenWins.mockResolvedValue([makeWin({ auction_id: 5 })])

    await usePrettyIdUnseenWins().checkUnseenWins()
    await settle()

    expect(store.winCelebration).toBeNull()
    expect(apiMock.markWinSeen).not.toHaveBeenCalled()
  })

  it('does not fetch while a celebration is on screen', async () => {
    const store = usePrettyIdAuctionStore()
    store.setWinCelebration(makeWin())

    await usePrettyIdUnseenWins().checkUnseenWins()

    expect(apiMock.unseenWins).not.toHaveBeenCalled()
  })

  it('does not double-fetch when checks overlap', async () => {
    const pending = deferred<PrettyIdAuctionUnseenWin[]>()
    apiMock.unseenWins.mockReturnValue(pending.promise)
    const wins = usePrettyIdUnseenWins()

    const first = wins.checkUnseenWins()
    const second = wins.checkUnseenWins()
    pending.resolve([])
    await Promise.all([first, second])

    expect(apiMock.unseenWins).toHaveBeenCalledTimes(1)
    expect(usePrettyIdAuctionStore().isCheckingWins).toBe(false)
  })

  it('makes no request while the Pretty ID event or auction switch is off', async () => {
    bootstrap.prettyIdAuctionEnabled = false

    await usePrettyIdUnseenWins().checkUnseenWins()

    expect(apiMock.unseenWins).not.toHaveBeenCalled()
    expect(usePrettyIdAuctionStore().isCheckingWins).toBe(false)
  })

  it('checks as soon as the switches turn on', async () => {
    bootstrap.prettyIdAuctionEnabled = false
    const wins = usePrettyIdUnseenWins()
    await wins.checkUnseenWins()
    bootstrap.prettyIdAuctionEnabled = true
    apiMock.unseenWins.mockResolvedValue([makeWin()])

    await wins.checkUnseenWins()

    expect(usePrettyIdAuctionStore().winCelebration).not.toBeNull()
  })

  it('tells the room the new Signature after the user refresh', async () => {
    apiMock.unseenWins.mockResolvedValue([makeWin()])
    syncUser.mockImplementation(async () => {
      expect(emitProfileSync).not.toHaveBeenCalled()
      auth.user = { signature: '777' }
    })

    await usePrettyIdUnseenWins().checkUnseenWins()
    await settle()

    expect(syncUser).toHaveBeenCalledTimes(1)
    expect(emitProfileSync).toHaveBeenCalledTimes(1)
    expect(emitProfileSync).toHaveBeenCalledWith({ signature: '777' })
  })

  it('does not emit to the room when the refreshed user has no Signature', async () => {
    apiMock.unseenWins.mockResolvedValue([makeWin()])

    await usePrettyIdUnseenWins().checkUnseenWins()
    await settle()

    expect(emitProfileSync).not.toHaveBeenCalled()
  })

  it('an emit failure is swallowed', async () => {
    apiMock.unseenWins.mockResolvedValue([makeWin()])
    syncUser.mockImplementation(async () => { auth.user = { signature: '777' } })
    emitProfileSync.mockImplementation(() => { throw new Error('socket') })

    await expect(usePrettyIdUnseenWins().checkUnseenWins()).resolves.toBeUndefined()
    await settle()
  })

  it('a failed seen call neither re-shows the win nor skips the user refresh', async () => {
    apiMock.unseenWins.mockResolvedValue([makeWin()])
    apiMock.markWinSeen.mockRejectedValue(new PrettyIdAuctionApiError('unknown'))
    const wins = usePrettyIdUnseenWins()

    await wins.checkUnseenWins()
    await settle()
    wins.finishWinCelebration()
    await wins.checkUnseenWins()
    await settle()

    expect(apiMock.markWinSeen).toHaveBeenCalledTimes(1)
    expect(syncUser).toHaveBeenCalledTimes(1)
  })

  it('does nothing for an empty list', async () => {
    apiMock.unseenWins.mockResolvedValue([])
    const store = usePrettyIdAuctionStore()

    await usePrettyIdUnseenWins().checkUnseenWins()
    await settle()

    expect(store.winCelebration).toBeNull()
    expect(apiMock.markWinSeen).not.toHaveBeenCalled()
    expect(fireConfetti).not.toHaveBeenCalled()
    expect(syncUser).not.toHaveBeenCalled()
  })

  it('does nothing and stays silent on a 404 (auction switch off)', async () => {
    apiMock.unseenWins.mockRejectedValue(new PrettyIdAuctionApiError('not_found'))
    const store = usePrettyIdAuctionStore()

    await expect(usePrettyIdUnseenWins().checkUnseenWins()).resolves.toBeUndefined()
    await settle()

    expect(store.winCelebration).toBeNull()
    expect(apiMock.markWinSeen).not.toHaveBeenCalled()
    expect(syncUser).not.toHaveBeenCalled()
  })

  it('does nothing on a network failure', async () => {
    apiMock.unseenWins.mockRejectedValue(new Error('offline'))
    const store = usePrettyIdAuctionStore()

    await expect(usePrettyIdUnseenWins().checkUnseenWins()).resolves.toBeUndefined()

    expect(store.winCelebration).toBeNull()
  })

  it('does not call the API for a signed-out visitor', async () => {
    auth.isAuthenticated = false

    await usePrettyIdUnseenWins().checkUnseenWins()

    expect(apiMock.unseenWins).not.toHaveBeenCalled()
  })

  it('drops the win when the user logged out while the request was in flight', async () => {
    const pending = deferred<PrettyIdAuctionUnseenWin[]>()
    apiMock.unseenWins.mockReturnValue(pending.promise)
    const store = usePrettyIdAuctionStore()

    const check = usePrettyIdUnseenWins().checkUnseenWins()
    auth.isAuthenticated = false
    pending.resolve([makeWin()])
    await check

    expect(store.winCelebration).toBeNull()
    expect(apiMock.markWinSeen).not.toHaveBeenCalled()
  })

  it('forgets the shown wins after the store is reset (a new login)', async () => {
    apiMock.unseenWins.mockResolvedValue([makeWin()])
    const store = usePrettyIdAuctionStore()
    const wins = usePrettyIdUnseenWins()

    await wins.checkUnseenWins()
    wins.finishWinCelebration()
    store.reset()
    await wins.checkUnseenWins()

    expect(store.winCelebration).not.toBeNull()
  })

  it('"Done" closes the celebration', async () => {
    apiMock.unseenWins.mockResolvedValue([makeWin()])
    const store = usePrettyIdAuctionStore()
    const wins = usePrettyIdUnseenWins()
    await wins.checkUnseenWins()

    wins.finishWinCelebration()

    expect(store.winCelebration).toBeNull()
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('"View in My Props" closes the celebration and opens My Props', async () => {
    apiMock.unseenWins.mockResolvedValue([makeWin()])
    const store = usePrettyIdAuctionStore()
    const wins = usePrettyIdUnseenWins()
    await wins.checkUnseenWins()

    await wins.viewWinInMyProps()

    expect(store.winCelebration).toBeNull()
    expect(navigateToMock).toHaveBeenCalledWith(PRETTY_ID_MY_PROPS_ROUTE)
  })
})
