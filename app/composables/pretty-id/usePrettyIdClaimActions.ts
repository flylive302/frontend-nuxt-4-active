/**
 * Action composable for claiming a Pretty ID.
 *
 * Every function runs GATE → EXECUTE → REACT. The server stays authoritative: a
 * gate that passes here can still be refused by the API, and each refusal code
 * has its own REACT (race modal, refreshed `me`, toast).
 */

import { usePrettyIdApi } from '~/composables/pretty-id/usePrettyIdApi'
import { usePrettyIdConfetti } from '~/composables/pretty-id/usePrettyIdConfetti'
import { usePrettyIdData } from '~/composables/pretty-id/usePrettyIdData'
import { usePrettyIdToast } from '~/composables/pretty-id/usePrettyIdToast'
import { PRETTY_ID_LEVELS_ROUTE, PRETTY_ID_MY_PROPS_ROUTE } from '~/constants/pretty-id'
import { useAuthStore } from '~/stores/auth'
import { usePrettyIdStore } from '~/stores/prettyId'
import type { PrettyIdErrorCode, PrettyIdItem } from '~/types/pretty-id'
import { toPrettyIdError } from '~/utils/pretty-id-error'
import { createLogger } from '~/utils/logger'

const log = createLogger('[PrettyIdClaimActions]')

const MSG_ME_LOADING = 'Still loading your profile. Try again in a moment.'
const MSG_NOT_BROWSABLE = 'This level is not open for claiming right now.'

export function usePrettyIdClaimActions() {
  const api = usePrettyIdApi()
  const store = usePrettyIdStore()
  const authStore = useAuthStore()
  const toast = usePrettyIdToast()
  const { loadMe, loadList, runSearch } = usePrettyIdData()
  const { fireConfetti } = usePrettyIdConfetti()
  const { emitProfileSync } = useProfileActions()

  // ========================================
  // Pick → confirm modal
  // ========================================

  /** A tapped number: opens the confirm modal if the user may claim in the active tier. */
  function pickItem(item: PrettyIdItem): void {
    // GATE
    if (store.isClaiming) return
    if (store.me === null) {
      toast.error(MSG_ME_LOADING)
      return
    }
    if (store.tierMode !== 'browse') {
      toast.error(MSG_NOT_BROWSABLE)
      return
    }
    // EXECUTE
    store.setRaceConflict(null)
    store.setClaimTarget(item)
  }

  /** Refused while a claim is in flight: the dialog must stay up until the server answers. */
  function closeClaim(): void {
    if (store.isClaiming) return
    store.setClaimTarget(null)
  }

  function closeRace(): void {
    store.setRaceConflict(null)
  }

  // ========================================
  // Confirm
  // ========================================

  /** REACT — `me` and the list follow the server after any claim outcome. */
  async function refreshAfterClaim(): Promise<void> {
    await loadMe()
    await loadList()
  }

  /** REACT — tells room participants the new number. Best-effort, like the mall's signature equip. */
  function emitSignatureToRoom(signature: string): void {
    try {
      emitProfileSync({ signature })
    } catch {
      // Silent — best-effort optimization
    }
  }

  async function confirmClaim(): Promise<void> {
    // GATE
    const target = store.claimTarget
    if (target === null || store.isClaiming) return

    store.setClaiming(true)
    try {
      // EXECUTE
      const result = await api.claim(target.signature)
      store.setClaimTarget(null)
      // REACT
      store.setCelebration({ signature: result.signature, tier: result.tier, category: result.category })
      // The claim auto-equips the number: profile shows it (and its plate) without a reload.
      authStore.patchProfile({ signature: result.signature, pretty_id_tier: result.tier })
      emitSignatureToRoom(result.signature)
      void fireConfetti()
      void refreshAfterClaim()
    } catch (err) {
      const error = toPrettyIdError(err)
      store.setClaimTarget(null)
      reactToRefusal(error.code, error.message, target)
      log.warn('Claim failed', { signature: target.signature, code: error.code })
    } finally {
      store.setClaiming(false)
    }
  }

  function reactToRefusal(code: PrettyIdErrorCode, message: string, target: PrettyIdItem): void {
    switch (code) {
      case 'taken':
        // Someone got there first: say so (no look-alikes) and refresh the grid.
        store.setRaceConflict({ signature: target.signature })
        void loadList()
        // The inline search may still be showing this number as available.
        if (store.searchQuery === target.signature) void runSearch(target.signature)
        break
      case 'already_claimed':
      case 'level_required':
        // Our `me` is stale: refreshing it swaps the tier to its right panel.
        toast.error(message)
        void refreshAfterClaim()
        break
      default:
        toast.error(message)
    }
  }

  // ========================================
  // After success / help
  // ========================================

  /** "Done": closes the celebration and stays on the Choose tab. */
  function finishCelebration(): void {
    store.setCelebration(null)
  }

  /** "View in My Props": closes the celebration and opens My Props on the signature tab. */
  async function viewInMyProps(): Promise<void> {
    store.setCelebration(null)
    await navigateTo(PRETTY_ID_MY_PROPS_ROUTE)
  }

  /** "How to level up": the wealth levels page. */
  async function openLevelHelp(): Promise<void> {
    await navigateTo(PRETTY_ID_LEVELS_ROUTE)
  }

  return {
    pickItem,
    closeClaim,
    closeRace,
    confirmClaim,
    finishCelebration,
    viewInMyProps,
    openLevelHelp,
  }
}
