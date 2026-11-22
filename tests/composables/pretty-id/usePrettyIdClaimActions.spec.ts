import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, readonly, ref } from 'vue'
import { usePrettyIdClaimActions } from '~/composables/pretty-id/usePrettyIdClaimActions'
import { usePrettyIdStore } from '~/stores/prettyId'
import { PrettyIdApiError } from '~/utils/pretty-id-error'
import { createApiMock, makeMe, resetApiMock, SERVER_NOW } from '../../helpers/prettyIdFixtures'

const apiMock = createApiMock()
const toastAdd = vi.fn()
const navigateToMock = vi.fn()

vi.mock('~/composables/pretty-id/usePrettyIdApi', () => ({
  usePrettyIdApi: () => apiMock,
  usePrettyIdMockControls: () => null,
}))
vi.mock('~/utils/pretty-id-format', () => ({
  formatPrettyIdDuration: (ms: number) => `${ms}ms`,
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
const HOUR_MS = 3_600_000

function toastTitles(): string[] {
  return toastAdd.mock.calls.map(([options]) => (options as { title: string }).title)
}

function claimResult(id: string, slot: 'lv17' | 'lv34', changed: boolean) {
  return { id, slot, changed, me: makeMe({ coins: 5 }, { [slot]: { id } }) }
}

describe('usePrettyIdClaimActions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // Fake only Date: the device clock sits on SERVER_NOW (zero offset), real timers keep promises flowing.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(SERVER_NOW))
    resetApiMock(apiMock)
    toastAdd.mockReset()
    navigateToMock.mockReset()
  })

  afterEach(() => vi.useRealTimers())

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

    it('refuses a slot that already holds an ID outside change mode', () => {
      const { store, actions } = setup(makeMe({}, { lv17: { id: '999999' } }))
      actions.pickId(SIX)
      expect(store.claimTarget).toBeNull()
      expect(toastTitles()).toEqual(['Already claimed for this level. Use Change in My ID.'])
    })

    it('refuses a claimed slot when a different slot is being changed', () => {
      const { store, actions } = setup(makeMe({ level: 40 }, { lv17: { id: '999999' }, lv34: { unlocked: true, id: '8888' } }))
      store.setChangeSlot('lv34')
      actions.pickId(SIX)
      expect(store.claimTarget).toBeNull()
      expect(toastTitles()).toEqual(['Already claimed for this level. Use Change in My ID.'])
    })

    it('opens the confirm modal for an unlocked, empty slot and clears a race conflict', () => {
      const { store, actions } = setup()
      store.setRaceConflict({ id: '111111', suggestions: [] })
      actions.pickId(SIX)
      expect(store.claimTarget).toBe(SIX)
      expect(store.raceConflict).toBeNull()
      expect(toastAdd).not.toHaveBeenCalled()
    })

    it('opens the confirm modal for the slot being changed', () => {
      const { store, actions } = setup(makeMe({}, { lv17: { id: '999999' } }))
      store.setChangeSlot('lv17')
      actions.pickId(SIX)
      expect(store.claimTarget).toBe(SIX)
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
      apiMock.claim.mockResolvedValue(claimResult(SIX, 'lv17', false))
      const { store, actions } = setup()
      store.setClaimTarget(SIX)

      await actions.confirmClaim()

      expect(apiMock.claim).toHaveBeenCalledWith(SIX)
      expect(apiMock.change).not.toHaveBeenCalled()
      expect(store.me?.slots.lv17.id).toBe(SIX)
      expect(store.coins).toBe(5)
      expect(store.claimTarget).toBeNull()
      expect(store.changeSlot).toBeNull()
      expect(store.isClaiming).toBe(false)
      expect(store.celebration).toEqual({ id: SIX, slot: 'lv17', changed: false })
      expect(apiMock.list).toHaveBeenCalledWith({ length: 6, tier: null })
    })

    it('uses change() when that slot is being changed, and clears change mode', async () => {
      apiMock.change.mockResolvedValue(claimResult(SIX, 'lv17', true))
      const { store, actions } = setup(makeMe({}, { lv17: { id: '999999' } }))
      store.setChangeSlot('lv17')
      store.setClaimTarget(SIX)

      await actions.confirmClaim()

      expect(apiMock.change).toHaveBeenCalledWith(SIX, 'lv17')
      expect(apiMock.claim).not.toHaveBeenCalled()
      expect(store.changeSlot).toBeNull()
      expect(store.celebration).toEqual({ id: SIX, slot: 'lv17', changed: true })
    })

    it('uses claim() when the change is for the other slot', async () => {
      apiMock.claim.mockResolvedValue(claimResult(SIX, 'lv17', false))
      const { store, actions } = setup()
      store.setChangeSlot('lv34')
      store.setClaimTarget(SIX)

      await actions.confirmClaim()

      expect(apiMock.claim).toHaveBeenCalledWith(SIX)
      expect(apiMock.change).not.toHaveBeenCalled()
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

    it('keeps change mode after a "taken" refusal so another pick still changes the slot', async () => {
      apiMock.change.mockRejectedValue(new PrettyIdApiError('taken', 'Taken', []))
      const { store, actions } = setup(makeMe({}, { lv17: { id: '999999' } }))
      store.setChangeSlot('lv17')
      store.setClaimTarget(SIX)

      await actions.confirmClaim()

      expect(store.changeSlot).toBe('lv17')
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
      expect(apiMock.change).not.toHaveBeenCalled()
    })

    it('ignores a second confirm while the first is in flight', async () => {
      let resolve!: (value: unknown) => void
      apiMock.claim.mockReturnValue(new Promise((res) => { resolve = res }))
      const { store, actions } = setup()
      store.setClaimTarget(SIX)

      const first = actions.confirmClaim()
      await actions.confirmClaim()
      resolve(claimResult(SIX, 'lv17', false))
      await first

      expect(apiMock.claim).toHaveBeenCalledTimes(1)
    })
  })

  // ========================================
  // startChange / cancelChange / startClaim
  // ========================================

  describe('startChange', () => {
    const claimed = { id: '999999', change_tokens: 1 }

    it('refuses while me is not loaded', async () => {
      const actions = usePrettyIdClaimActions()
      await actions.startChange('lv17')
      expect(navigateToMock).not.toHaveBeenCalled()
      expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
    })

    it('refuses a slot that holds no ID', async () => {
      const { store, actions } = setup(makeMe({}, { lv17: { change_tokens: 1 } }))
      await actions.startChange('lv17')
      expect(store.changeSlot).toBeNull()
      expect(toastTitles()).toEqual(['Claim an ID first'])
    })

    it('refuses without change tokens', async () => {
      const { store, actions } = setup(makeMe({}, { lv17: { id: '999999', change_tokens: 0 } }))
      await actions.startChange('lv17')
      expect(store.changeSlot).toBeNull()
      expect(toastTitles()).toEqual(['No change tokens left'])
      expect(navigateToMock).not.toHaveBeenCalled()
    })

    it('refuses during the cooldown and says how long is left', async () => {
      const next = new Date(Date.parse(SERVER_NOW) + 2 * HOUR_MS).toISOString()
      const { store, actions } = setup(makeMe({}, { lv17: { ...claimed, next_change_at: next } }))
      await actions.startChange('lv17')
      expect(store.changeSlot).toBeNull()
      expect(toastTitles()).toEqual([`Too soon: next change in ${2 * HOUR_MS}ms`])
      expect(navigateToMock).not.toHaveBeenCalled()
    })

    it('measures the cooldown on the server clock, not the device clock', async () => {
      // Server is 5 h ahead of the device; the cooldown ends 1 h after the server's "now".
      const serverNow = Date.parse(SERVER_NOW) + 5 * HOUR_MS
      const next = new Date(serverNow + HOUR_MS).toISOString()
      const { actions } = setup(makeMe({ server_now: new Date(serverNow).toISOString() }, { lv17: { ...claimed, next_change_at: next } }))
      await actions.startChange('lv17')
      expect(toastTitles()).toEqual([`Too soon: next change in ${HOUR_MS}ms`])
    })

    it('starts the change once the cooldown has passed', async () => {
      const past = new Date(Date.parse(SERVER_NOW) - HOUR_MS).toISOString()
      const { store, actions } = setup(makeMe({}, { lv17: { ...claimed, next_change_at: past } }))
      await actions.startChange('lv17')
      expect(store.changeSlot).toBe('lv17')
      expect(toastAdd).not.toHaveBeenCalled()
    })

    it('opens Choose on the slot length with no tier filter', async () => {
      const { store, actions } = setup(makeMe({ level: 40 }, { lv34: { unlocked: true, id: '8888', change_tokens: 2 } }))
      store.setListTier('lucky')

      await actions.startChange('lv34')

      expect(store.changeSlot).toBe('lv34')
      expect(store.listLength).toBe(4)
      expect(store.listTier).toBeNull()
      expect(apiMock.list).toHaveBeenCalledWith({ length: 4, tier: null })
      expect(navigateToMock).toHaveBeenCalledWith('/pretty-id')
    })
  })

  it('cancelChange leaves change mode and closes an open confirm', () => {
    const { store, actions } = setup()
    store.setChangeSlot('lv17')
    store.setClaimTarget(SIX)
    actions.cancelChange()
    expect(store.changeSlot).toBeNull()
    expect(store.claimTarget).toBeNull()
  })

  it('startClaim opens Choose on that slot length in plain claim mode', async () => {
    const { store, actions } = setup()
    store.setChangeSlot('lv17')

    await actions.startClaim('lv34')

    expect(store.changeSlot).toBeNull()
    expect(store.listLength).toBe(4)
    expect(apiMock.list).toHaveBeenCalledWith({ length: 4, tier: null })
    expect(navigateToMock).toHaveBeenCalledWith('/pretty-id')
  })

  it('finishCelebration clears the overlay and goes to My ID', async () => {
    const { store, actions } = setup()
    store.setCelebration({ id: SIX, slot: 'lv17', changed: false })
    await actions.finishCelebration()
    expect(store.celebration).toBeNull()
    expect(navigateToMock).toHaveBeenCalledWith('/pretty-id/my')
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
