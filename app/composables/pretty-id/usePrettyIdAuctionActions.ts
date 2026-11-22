/**
 * Action composable for the Rare Auction: pay the entry fee, place a bid.
 *
 * GATE → EXECUTE → REACT. The server is authoritative for the minimum bid,
 * escrow and level, so the only local GATE is "one submit at a time" and "the
 * amount is a positive whole number"; any refusal comes back as a toast.
 *
 * `isSubmitting` guards per composable instance: use one instance per page.
 */

import { usePrettyIdApi } from '~/composables/pretty-id/usePrettyIdApi'
import { usePrettyIdToast } from '~/composables/pretty-id/usePrettyIdToast'
import { usePrettyIdStore } from '~/stores/prettyId'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import type { PrettyIdAuctionActionResult } from '~/types/pretty-id'
import { formatCoins } from '~/utils/currency'
import { toPrettyIdError } from '~/utils/pretty-id-error'
import { createLogger } from '~/utils/logger'

const log = createLogger('[PrettyIdAuctionActions]')

const MSG_ENTERED = 'Entry fee paid. You can bid now.'
const MSG_BAD_AMOUNT = 'Enter a bid amount'

export function usePrettyIdAuctionActions() {
  const api = usePrettyIdApi()
  const store = usePrettyIdStore()
  const auctionStore = usePrettyIdAuctionStore()
  const toast = usePrettyIdToast()

  const isSubmitting = ref(false)

  /** EXECUTE + REACT shared by both actions. Callers have already passed their GATE. */
  async function submit(
    run: () => Promise<PrettyIdAuctionActionResult>,
    successMessage: string,
  ): Promise<boolean> {
    isSubmitting.value = true
    try {
      // EXECUTE
      const result = await run()
      auctionStore.upsertLot(result.auction)
      store.setCoins(result.coins)
      // REACT
      toast.success(successMessage)
      return true
    } catch (err) {
      const error = toPrettyIdError(err)
      toast.error(error.message)
      log.warn('Auction action refused', { code: error.code })
      return false
    } finally {
      isSubmitting.value = false
    }
  }

  /** @returns whether the entry fee was paid. */
  async function enterAuction(lotId: number): Promise<boolean> {
    // GATE
    if (isSubmitting.value) return false
    return submit(() => api.enter(lotId), MSG_ENTERED)
  }

  /** @returns whether the bid was accepted. */
  async function placeBid(lotId: number, amount: number): Promise<boolean> {
    // GATE
    if (isSubmitting.value) return false
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error(MSG_BAD_AMOUNT)
      return false
    }
    return submit(() => api.bid(lotId, amount), `Bid placed: ${formatCoins(amount)}`)
  }

  return { enterAuction, placeBid, isSubmitting: readonly(isSubmitting) }
}
