/**
 * Action composable for claiming and changing a Pretty ID.
 *
 * Every function runs GATE → EXECUTE → REACT. The refusal rules are pure
 * helpers (`pickRefusal`, `changeRefusal`) that return the toast message, or
 * `null` when the action may proceed. The server stays authoritative: a gate
 * that passes here can still be refused by the API (and is surfaced as a toast).
 */

import { usePrettyIdApi } from '~/composables/pretty-id/usePrettyIdApi'
import { usePrettyIdData } from '~/composables/pretty-id/usePrettyIdData'
import { usePrettyIdToast } from '~/composables/pretty-id/usePrettyIdToast'
import { PRETTY_ID_ROUTES, PRETTY_ID_SLOT_LENGTH } from '~/constants/pretty-id'
import { usePrettyIdStore } from '~/stores/prettyId'
import type { PrettyIdSlot, PrettyIdSlotKey } from '~/types/pretty-id'
import { formatPrettyIdDuration } from '~/utils/pretty-id-format'
import { toPrettyIdError } from '~/utils/pretty-id-error'
import { prettyIdSlotKeyForLength } from '~/utils/pretty-id-slots'
import { createLogger } from '~/utils/logger'

const log = createLogger('[PrettyIdClaimActions]')

const MSG_ME_LOADING = 'Still loading your profile. Try again in a moment.'
const MSG_ALREADY_CLAIMED = 'Already claimed for this level. Use Change in My ID.'
const MSG_LEVEL_HELP = 'Level up by chatting, gifting and joining rooms.'

// ========================================
// GATE helpers (pure)
// ========================================

function pickRefusal(slot: PrettyIdSlot, changeSlot: PrettyIdSlotKey | null): string | null {
  if (!slot.unlocked) return `Reach Lv ${slot.required_level} to claim ${slot.length}-digit IDs`
  if (slot.id !== null && changeSlot !== slot.key) return MSG_ALREADY_CLAIMED
  return null
}

/** `serverNow` is epoch ms on the server's clock. */
function changeRefusal(slot: PrettyIdSlot, serverNow: number): string | null {
  if (slot.id === null) return 'Claim an ID first'
  if (slot.change_tokens <= 0) return 'No change tokens left'
  if (slot.next_change_at !== null) {
    const remaining = Date.parse(slot.next_change_at) - serverNow
    if (remaining > 0) return `Too soon: next change in ${formatPrettyIdDuration(remaining)}`
  }
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

  /** A tapped ID: opens the confirm modal if the user may claim (or change to) it. */
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
    const refusal = pickRefusal(me.slots[slotKey], store.changeSlot)
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
      // EXECUTE — a change when this slot is being replaced, else a first claim
      const result = store.changeSlot === slotKey
        ? await api.change(id, slotKey)
        : await api.claim(id)
      store.setMe(result.me)
      store.setClaimTarget(null)
      store.setChangeSlot(null)
      // REACT
      store.setCelebration({ id: result.id, slot: result.slot, changed: result.changed })
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
  // Change / claim from My ID
  // ========================================

  /** "Change" on a claimed slot: pick a replacement from the Choose list. */
  async function startChange(slotKey: PrettyIdSlotKey): Promise<void> {
    // GATE
    const me = store.me
    if (!me) {
      toast.error(MSG_ME_LOADING)
      return
    }
    const refusal = changeRefusal(me.slots[slotKey], Date.now() + store.clockOffsetMs)
    if (refusal !== null) {
      toast.error(refusal)
      return
    }
    // EXECUTE
    store.setChangeSlot(slotKey)
    store.setListLength(PRETTY_ID_SLOT_LENGTH[slotKey])
    store.setListTier(null)
    void loadList()
    await navigateTo(PRETTY_ID_ROUTES.choose)
  }

  function cancelChange(): void {
    store.setChangeSlot(null)
    store.setClaimTarget(null)
  }

  /** "Claim" on an unclaimed, unlocked slot: open Choose on that slot's length. */
  async function startClaim(slotKey: PrettyIdSlotKey): Promise<void> {
    store.setChangeSlot(null)
    store.setListLength(PRETTY_ID_SLOT_LENGTH[slotKey])
    void loadList()
    await navigateTo(PRETTY_ID_ROUTES.choose)
  }

  // ========================================
  // After success / help
  // ========================================

  async function finishCelebration(): Promise<void> {
    store.setCelebration(null)
    await navigateTo(PRETTY_ID_ROUTES.my)
  }

  function showLevelHelp(): void {
    toast.info(MSG_LEVEL_HELP)
  }

  return {
    pickId,
    closeClaim,
    closeRace,
    confirmClaim,
    startChange,
    cancelChange,
    startClaim,
    finishCelebration,
    showLevelHelp,
  }
}
