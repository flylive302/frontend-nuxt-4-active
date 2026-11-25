import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, readonly, ref } from 'vue'
import { usePrettyIdClaimActions } from '~/composables/pretty-id/usePrettyIdClaimActions'
import { usePrettyIdStore } from '~/stores/prettyId'
import { PrettyIdApiError } from '~/utils/pretty-id-error'
import { createApiMock, deferred, makeClaimed, makeItem, makeList, makeMe, resetApiMock } from '../../helpers/prettyIdFixtures'

const apiMock = createApiMock()
const toastAdd = vi.fn()
const navigateToMock = vi.fn()
const patchProfile = vi.fn()
const fireConfetti = vi.fn()
const emitProfileSync = vi.fn()

vi.mock('~/composables/pretty-id/usePrettyIdApi', () => ({
  usePrettyIdApi: () => apiMock,
}))
vi.mock('~/composables/pretty-id/usePrettyIdConfetti', () => ({
  usePrettyIdConfetti: () => ({ fireConfetti }),
}))
vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({ patchProfile }),
}))
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('useToast', () => ({ add: toastAdd }))
vi.stubGlobal('navigateTo', navigateToMock)
vi.stubGlobal('useProfileActions', () => ({ emitProfileSync }))

const SIX = makeItem('123456', 'mirror')
const FOUR = makeItem('1234', 'legend')

function toastTitles(): string[] {
  return toastAdd.mock.calls.map(([options]) => (options as { title: string }).title)
}

function claimResult(item: typeof SIX, tier: 6 | 4) {
  return { signature: item.signature, tier, category: item.category, user_prop_id: 77 }
}

/** Lets the fire-and-forget refresh (me, then list) settle. */
async function settle(): Promise<void> {
  await vi.waitFor(() => expect(apiMock.me).toHaveBeenCalled())
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('usePrettyIdClaimActions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetApiMock(apiMock)
    toastAdd.mockReset()
    navigateToMock.mockReset()
    patchProfile.mockReset()
    fireConfetti.mockReset()
    emitProfileSync.mockReset()
  })

  function setup(me = makeMe()) {
    const store = usePrettyIdStore()
    store.setMe(me)
    return { store, actions: usePrettyIdClaimActions() }
  }

  // ========================================
  // pickItem
  // ========================================

  describe('pickItem', () => {
    it('refuses while me is not loaded', () => {
      const store = usePrettyIdStore()
      usePrettyIdClaimActions().pickItem(SIX)
      expect(store.claimTarget).toBeNull()
      expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
    })

    it('refuses a tier that is not browsable', () => {
      const { store, actions } = setup()
      store.setActiveTier(4) // locked
      actions.pickItem(FOUR)
      expect(store.claimTarget).toBeNull()
      expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
    })

    it('opens the confirm modal with the picked item and clears an open race modal', () => {
      const { store, actions } = setup()
      store.setRaceConflict({ signature: '999999' })
      actions.pickItem(SIX)
      expect(store.claimTarget).toEqual(SIX)
      expect(store.raceConflict).toBeNull()
    })

    it('ignores a pick while a claim is in flight', () => {
      const { store, actions } = setup()
      store.setClaiming(true)
      actions.pickItem(SIX)
      expect(store.claimTarget).toBeNull()
    })
  })

  describe('closeClaim / closeRace', () => {
    it('closeClaim closes the dialog', () => {
      const { store, actions } = setup()
      store.setClaimTarget(SIX)
      actions.closeClaim()
      expect(store.claimTarget).toBeNull()
    })

    it('closeClaim is refused while the claim is in flight', () => {
      const { store, actions } = setup()
      store.setClaimTarget(SIX)
      store.setClaiming(true)
      actions.closeClaim()
      expect(store.claimTarget).toEqual(SIX)
    })

    it('closeRace clears the conflict', () => {
      const { store, actions } = setup()
      store.setRaceConflict({ signature: '123456' })
      actions.closeRace()
      expect(store.raceConflict).toBeNull()
    })
  })

  // ========================================
  // confirmClaim
  // ========================================

  describe('confirmClaim — success', () => {
    it('claims the signature, celebrates, patches the profile and refreshes me and the list', async () => {
      apiMock.claim.mockResolvedValue(claimResult(SIX, 6))
      apiMock.me.mockResolvedValue(makeMe({}, { six: { claimed: makeClaimed('123456', 'mirror') } }))
      const { store, actions } = setup()
      store.setClaimTarget(SIX)

      await actions.confirmClaim()

      expect(apiMock.claim).toHaveBeenCalledWith('123456')
      expect(store.celebration).toEqual({ signature: '123456', tier: 6, category: 'mirror' })
      expect(store.claimTarget).toBeNull()
      expect(store.isClaiming).toBe(false)
      expect(patchProfile).toHaveBeenCalledWith({ signature: '123456', pretty_id_tier: 6 })
      expect(emitProfileSync).toHaveBeenCalledWith({ signature: '123456' })
      expect(fireConfetti).toHaveBeenCalledTimes(1)
      expect(toastAdd).not.toHaveBeenCalled()

      // me is refreshed; the tier now shows its already-claimed panel
      await vi.waitFor(() => expect(store.tierMode).toBe('claimed'))
      expect(apiMock.me).toHaveBeenCalledTimes(1)
    })

    it('patches the claimed tier: a 4-digit claim wears tier 4', async () => {
      apiMock.claim.mockResolvedValue(claimResult(FOUR, 4))
      const { store, actions } = setup()
      store.setClaimTarget(FOUR)

      await actions.confirmClaim()

      expect(patchProfile).toHaveBeenCalledWith({ signature: '1234', pretty_id_tier: 4 })
      expect(emitProfileSync).toHaveBeenCalledWith({ signature: '1234' })
    })

    it('still succeeds when the room sync emit throws', async () => {
      apiMock.claim.mockResolvedValue(claimResult(SIX, 6))
      emitProfileSync.mockImplementation(() => { throw new Error('socket down') })
      const { store, actions } = setup()
      store.setClaimTarget(SIX)

      await actions.confirmClaim()

      expect(store.celebration).not.toBeNull()
      expect(toastAdd).not.toHaveBeenCalled()
    })

    it('refreshes the list while the tier is still browsable', async () => {
      apiMock.claim.mockResolvedValue(claimResult(SIX, 6))
      // The server answers me before it shows the claim (e.g. a replica): the list still reloads.
      const { store, actions } = setup()
      store.setClaimTarget(SIX)
      await actions.confirmClaim()
      await settle()
      await vi.waitFor(() => expect(apiMock.list).toHaveBeenCalledWith({ tier: 6, category: null }))
    })

    it('guards against a double confirm', async () => {
      const slow = deferred<ReturnType<typeof claimResult>>()
      apiMock.claim.mockReturnValue(slow.promise)
      const { store, actions } = setup()
      store.setClaimTarget(SIX)

      const first = actions.confirmClaim()
      await actions.confirmClaim()
      expect(apiMock.claim).toHaveBeenCalledTimes(1)
      slow.resolve(claimResult(SIX, 6))
      await first
    })

    it('does nothing without a target', async () => {
      const { actions } = setup()
      await actions.confirmClaim()
      expect(apiMock.claim).not.toHaveBeenCalled()
    })
  })

  describe('confirmClaim — refusals', () => {
    it('taken: shows the race message, refreshes the list, no toast, no celebration', async () => {
      apiMock.claim.mockRejectedValue(new PrettyIdApiError('taken'))
      const { store, actions } = setup()
      store.setClaimTarget(SIX)

      await actions.confirmClaim()

      expect(store.raceConflict).toEqual({ signature: '123456' })
      expect(store.claimTarget).toBeNull()
      expect(store.celebration).toBeNull()
      expect(patchProfile).not.toHaveBeenCalled()
      expect(emitProfileSync).not.toHaveBeenCalled()
      expect(toastAdd).not.toHaveBeenCalled()
      expect(apiMock.list).toHaveBeenCalledWith({ tier: 6, category: null })
    })

    it('taken: re-checks an inline search that still shows the number as available', async () => {
      apiMock.claim.mockRejectedValue(new PrettyIdApiError('taken'))
      apiMock.list.mockResolvedValue(makeList([]))
      const { store, actions } = setup()
      store.setSearch('123456', 'available', SIX)
      store.setClaimTarget(SIX)

      await actions.confirmClaim()

      await vi.waitFor(() => expect(store.searchStatus).toBe('unavailable'))
      expect(apiMock.list).toHaveBeenCalledWith({ tier: 6, q: '123456' })
    })

    it('already_claimed: toasts and refreshes me so the tier shows the claimed panel', async () => {
      apiMock.claim.mockRejectedValue(new PrettyIdApiError('already_claimed'))
      apiMock.me.mockResolvedValue(makeMe({}, { six: { claimed: makeClaimed('654321') } }))
      const { store, actions } = setup()
      store.setClaimTarget(SIX)

      await actions.confirmClaim()

      expect(toastTitles()).toEqual(['You already claimed a Pretty ID for this level.'])
      expect(store.raceConflict).toBeNull()
      expect(store.celebration).toBeNull()
      await vi.waitFor(() => expect(store.tierMode).toBe('claimed'))
    })

    it('level_required: toasts and refreshes me so the tier shows the locked panel', async () => {
      apiMock.claim.mockRejectedValue(new PrettyIdApiError('level_required'))
      apiMock.me.mockResolvedValue(makeMe({ wealth_level: 5 }, { six: { unlocked: false } }))
      const { store, actions } = setup()
      store.setClaimTarget(SIX)

      await actions.confirmClaim()

      expect(toastTitles()).toEqual(['Your level is too low for this Pretty ID.'])
      await vi.waitFor(() => expect(store.tierMode).toBe('locked'))
      expect(patchProfile).not.toHaveBeenCalled()
    })

    it.each(['invalid', 'unknown'] as const)('%s: toasts the message and changes nothing else', async (code) => {
      apiMock.claim.mockRejectedValue(new PrettyIdApiError(code, 'Bad number'))
      const { store, actions } = setup()
      store.setClaimTarget(SIX)

      await actions.confirmClaim()

      expect(toastTitles()).toEqual(['Bad number'])
      expect(store.claimTarget).toBeNull()
      expect(store.raceConflict).toBeNull()
      expect(store.celebration).toBeNull()
      expect(store.isClaiming).toBe(false)
      expect(apiMock.me).not.toHaveBeenCalled()
    })
  })

  // ========================================
  // After success / help
  // ========================================

  describe('celebration buttons', () => {
    it('finishCelebration closes it and does not navigate', () => {
      const { store, actions } = setup()
      store.setCelebration({ signature: '123456', tier: 6, category: 'mirror' })
      actions.finishCelebration()
      expect(store.celebration).toBeNull()
      expect(navigateToMock).not.toHaveBeenCalled()
    })

    it('viewInMyProps closes it and opens My Props on the signature tab', async () => {
      const { store, actions } = setup()
      store.setCelebration({ signature: '123456', tier: 6, category: 'mirror' })
      await actions.viewInMyProps()
      expect(store.celebration).toBeNull()
      expect(navigateToMock).toHaveBeenCalledWith({ path: '/mall/my-props', query: { type: 'signature' } })
    })

    it('openLevelHelp goes to the wealth levels page', async () => {
      const { actions } = setup()
      await actions.openLevelHelp()
      expect(navigateToMock).toHaveBeenCalledWith('/levels/wealth')
    })
  })
})
