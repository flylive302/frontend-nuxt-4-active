/**
 * Action composable for claiming a Pretty ID.
 *
 * Every function runs GATE → EXECUTE → REACT. The refusal rule is a pure
 * helper (`pickRefusal`) that returns the toast message, or `null` when the
 * action may proceed. The server stays authoritative: a gate
 * that passes here can still be refused by the API (and is surfaced as a toast).
 */

import { usePrettyIdApi } from '~/composables/pretty-id/usePrettyIdApi'
import { usePrettyIdData } from '~/composables/pretty-id/usePrettyIdData'
import { usePrettyIdToast } from '~/composables/pretty-id/usePrettyIdToast'
import { usePrettyIdStore } from '~/stores/prettyId'
import type { PrettyIdSlot } from '~/types/pretty-id'
import { toPrettyIdError } from '~/utils/pretty-id-error'
import { prettyIdSlotKeyForLength } from '~/utils/pretty-id-slots'
import { createLogger } from '~/utils/logger'

const log = createLogger('[PrettyIdClaimActions]')

const MSG_ME_LOADING = 'Still loading your profile. Try again in a moment.'
const MSG_ALREADY_CLAIMED = 'You already claimed an ID for this level.'
const MSG_LEVEL_HELP = 'Level up by chatting, gifting and joining rooms.'

// ========================================
// GATE helpers (pure)
// ========================================

function pickRefusal(slot: PrettyIdSlot): string | null {
  if (!slot.unlocked) return `Reach Lv ${slot.required_level} to claim ${slot.length}-digit IDs`
  if (slot.id !== null) return MSG_ALREADY_CLAIMED
  return null
}

export function usePrettyIdClaimActions() {
  const api = usePrettyIdApi()
  const store = usePrettyIdStore()
  const toast = usePrettyIdToast()
  const { loadList, runSearch } = usePrettyIdData()

  // ========================================
  // Pick → confirm modal
  // ========================================

  /** A tapped ID: opens the confirm modal if the user may claim it. */
  function pickId(id: string): void {
    // GATE
    if (store.isClaiming) return
    const me = store.me
    if (!me) {
      toast.error(MSG_ME_LOADING)
      return
    }
    const slotKey = prettyIdSlotKeyForLength(id.length)
    if (slotKey === null) return
    const refusal = pickRefusal(me.slots[slotKey])
    if (refusal !== null) {
      toast.error(refusal)
      return
    }
    // EXECUTE
    store.setRaceConflict(null)
    store.setClaimTarget(id)
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

  async function confirmClaim(): Promise<void> {
    // GATE
    const id = store.claimTarget
    if (id === null || store.isClaiming) return
    const slotKey = prettyIdSlotKeyForLength(id.length)
    if (slotKey === null) {
      store.setClaimTarget(null)
      return
    }

    store.setClaiming(true)
    try {
      // EXECUTE
      const result = await api.claim(id)
      store.setMe(result.me)
      store.setClaimTarget(null)
      // REACT
      store.setCelebration({ id: result.id, slot: result.slot })
      void loadList()
    } catch (err) {
      const error = toPrettyIdError(err)
      store.setClaimTarget(null)
      if (error.code === 'taken') {
        // REACT — someone got there first: offer look-alikes and refresh the grid
        store.setRaceConflict({ id, suggestions: error.suggestions })
        void loadList()
        // The search page may still be showing this ID as "Available".
        if (store.searchQuery === id) void runSearch(id)
      } else {
        toast.error(error.message)
        log.warn('Claim failed', { id, code: error.code })
      }
    } finally {
      store.setClaiming(false)
    }
  }

  // ========================================
  // After success / help
  // ========================================

  /** "Done": closes the celebration and stays on the page. */
  function finishCelebration(): void {
    store.setCelebration(null)
  }

  function showLevelHelp(): void {
    toast.info(MSG_LEVEL_HELP)
  }

  return {
    pickId,
    closeClaim,
    closeRace,
    confirmClaim,
    finishCelebration,
    showLevelHelp,
  }
}
