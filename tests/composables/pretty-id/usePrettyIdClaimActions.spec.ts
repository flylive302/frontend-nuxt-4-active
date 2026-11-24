import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, readonly, ref } from 'vue'
import { usePrettyIdClaimActions } from '~/composables/pretty-id/usePrettyIdClaimActions'
import { usePrettyIdStore } from '~/stores/prettyId'
import { PrettyIdApiError } from '~/utils/pretty-id-error'
import { createApiMock, makeMe, resetApiMock } from '../../helpers/prettyIdFixtures'

const apiMock = createApiMock()
const toastAdd = vi.fn()
const navigateToMock = vi.fn()

vi.mock('~/composables/pretty-id/usePrettyIdApi', () => ({
  usePrettyIdApi: () => apiMock,
}))
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('useToast', () => ({ add: toastAdd }))
vi.stubGlobal('navigateTo', navigateToMock)

const SIX = '123456'
const FOUR = '1234'

function toastTitles(): string[] {
  return toastAdd.mock.calls.map(([options]) => (options as { title: string }).title)
}

function claimResult(id: string, slot: 'lv17' | 'lv34') {
  return { id, slot, me: makeMe({}, { [slot]: { id } }) }
}

describe('usePrettyIdClaimActions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetApiMock(apiMock)
    toastAdd.mockReset()
    navigateToMock.mockReset()
  })

  function setup(me = makeMe()) {
    const store = usePrettyIdStore()
    store.setMe(me)
    return { store, actions: usePrettyIdClaimActions() }
  }

  // ========================================
  // pickId
  // ========================================

  describe('pickId', () => {
    it('refuses while me is not loaded', () => {
      const store = usePrettyIdStore()
      const actions = usePrettyIdClaimActions()
      actions.pickId(SIX)
      expect(store.claimTarget).toBeNull()
      expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
    })

    it('refuses a locked slot with the level it needs', () => {
      const { store, actions } = setup()
      actions.pickId(FOUR)
      expect(store.claimTarget).toBeNull()
      expect(toastTitles()).toEqual(['Reach Lv 34 to claim 4-digit IDs'])
    })

    it('checks the level before the already-claimed rule', () => {
      const { actions } = setup(makeMe({}, { lv34: { id: FOUR, unlocked: false } }))
      actions.pickId(FOUR)
      expect(toastTitles()).toEqual(['Reach Lv 34 to claim 4-digit IDs'])
    })

    it('refuses a slot that already holds an ID', () => {
      const { store, actions } = setup(makeMe({}, { lv17: { id: '999999' } }))
      actions.pickId(SIX)
      expect(store.claimTarget).toBeNull()
      expect(toastTitles()).toEqual(['You already claimed an ID for this level.'])
    })

    it('only refuses the slot that is claimed, not the other one', () => {
      const { store, actions } = setup(makeMe({ level: 40 }, { lv17: { id: '999999' }, lv34: { unlocked: true } }))
      actions.pickId(FOUR)
      expect(store.claimTarget).toBe(FOUR)
      expect(toastAdd).not.toHaveBeenCalled()
    })

    it('opens the confirm modal for an unlocked, empty slot and clears a race conflict', () => {
      const { store, actions } = setup()
      store.setRaceConflict({ id: '111111', suggestions: [] })
      actions.pickId(SIX)
      expect(store.claimTarget).toBe(SIX)
      expect(store.raceConflict).toBeNull()
      expect(toastAdd).not.toHaveBeenCalled()
    })

    it('ignores an ID that fits no slot', () => {
      const { store, actions } = setup()
      actions.pickId('12')
      expect(store.claimTarget).toBeNull()
      expect(toastAdd).not.toHaveBeenCalled()
    })

    it('does nothing while a claim is in flight', () => {
      const { store, actions } = setup()
      store.setClaiming(true)
      actions.pickId(SIX)
      expect(store.claimTarget).toBeNull()
    })
  })

  // ========================================
  // closeClaim / closeRace
  // ========================================

  it('closeClaim and closeRace clear their modals', () => {
    const { store, actions } = setup()
    store.setClaimTarget(SIX)
    store.setRaceConflict({ id: SIX, suggestions: [] })
    actions.closeClaim()
    actions.closeRace()
    expect(store.claimTarget).toBeNull()
    expect(store.raceConflict).toBeNull()
  })

  // ========================================
  // confirmClaim
  // ========================================

  describe('confirmClaim', () => {
    it('claims, stores the new me, celebrates and reloads the list', async () => {
      apiMock.claim.mockResolvedValue(claimResult(SIX, 'lv17'))
      const { store, actions } = setup()
      store.setClaimTarget(SIX)

      await actions.confirmClaim()

      expect(apiMock.claim).toHaveBeenCalledWith(SIX)
      expect(store.me?.slots.lv17.id).toBe(SIX)
      expect(store.claimTarget).toBeNull()
      expect(store.isClaiming).toBe(false)
      expect(store.celebration).toEqual({ id: SIX, slot: 'lv17' })
      expect(apiMock.list).toHaveBeenCalledWith({ length: 6, tier: null })
    })

    it('turns a "taken" refusal into a race conflict with suggestions, without a toast', async () => {
      const suggestions = [{ id: '123457', tier: 'standard' as const }]
      apiMock.claim.mockRejectedValue(new PrettyIdApiError('taken', 'Taken', suggestions))
      const { store, actions } = setup()
      store.setClaimTarget(SIX)

      await actions.confirmClaim()

      expect(store.claimTarget).toBeNull()
      expect(store.raceConflict).toEqual({ id: SIX, suggestions })
      expect(store.celebration).toBeNull()
      expect(store.isClaiming).toBe(false)
      expect(toastAdd).not.toHaveBeenCalled()
      expect(apiMock.list).toHaveBeenCalledTimes(1)
    })

    it('toasts the message of any other refusal and closes the modal', async () => {
      apiMock.claim.mockRejectedValue(new PrettyIdApiError('level_required', 'Level too low'))
      const { store, actions } = setup()
      store.setClaimTarget(SIX)

      await actions.confirmClaim()

      expect(toastTitles()).toEqual(['Level too low'])
      expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
      expect(store.claimTarget).toBeNull()
      expect(store.raceConflict).toBeNull()
      expect(store.isClaiming).toBe(false)
    })

    it('shows the generic message for a non-Pretty-ID error', async () => {
      apiMock.claim.mockRejectedValue(new Error('network down'))
      const { store, actions } = setup()
      store.setClaimTarget(SIX)

      await actions.confirmClaim()

      expect(toastTitles()).toEqual(['Something went wrong. Please try again.'])
    })

    it('does nothing without a claim target', async () => {
      const { actions } = setup()
      await actions.confirmClaim()
      expect(apiMock.claim).not.toHaveBeenCalled()
    })

    it('ignores a second confirm while the first is in flight', async () => {
      let resolve!: (value: unknown) => void
      apiMock.claim.mockReturnValue(new Promise((res) => { resolve = res }))
      const { store, actions } = setup()
      store.setClaimTarget(SIX)

      const first = actions.confirmClaim()
      await actions.confirmClaim()
      resolve(claimResult(SIX, 'lv17'))
      await first

      expect(apiMock.claim).toHaveBeenCalledTimes(1)
    })
  })

  // ========================================
  // finishCelebration
  // ========================================

  it('finishCelebration clears the celebration and does not navigate', () => {
    const { store, actions } = setup()
    store.setCelebration({ id: SIX, slot: 'lv17' })
    actions.finishCelebration()
    expect(store.celebration).toBeNull()
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('showLevelHelp shows an info toast', () => {
    const { actions } = setup()
    actions.showLevelHelp()
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Level up by chatting, gifting and joining rooms.',
      color: 'info',
    }))
  })
})
