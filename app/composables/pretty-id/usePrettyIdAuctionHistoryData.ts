/**
 * Data composable for the Big Winners and Weekly Record pages (pretty-id-step2 12).
 *
 * Queries only: one PKT month of winners or of the weekly record, written into
 * `usePrettyIdAuctionStore`. The newest request of each kind wins: a slower, older month
 * response (the pager tapped twice) never overwrites the month the user asked for last.
 *
 * Failures: a load toasts only when there is nothing on screen to fall back on. A 404 (the
 * auction switch went off) is reported as `not_found`, not as a failure.
 */

import { usePrettyIdAuctionApi } from '~/composables/pretty-id/usePrettyIdAuctionApi'
import { usePrettyIdToast } from '~/composables/pretty-id/usePrettyIdToast'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import type { PrettyIdAuctionLoadOutcome } from '~/types/pretty-id-auction'
import { createLogger } from '~/utils/logger'
import { toPrettyIdAuctionError } from '~/utils/pretty-id-auction-error'

const log = createLogger('[PrettyIdAuctionHistory]')

/** What a history load reports: the usual outcome, or `superseded` when a newer request replaced it. */
export type PrettyIdHistoryLoadOutcome = PrettyIdAuctionLoadOutcome | 'superseded'

export function usePrettyIdAuctionHistoryData() {
  const api = usePrettyIdAuctionApi()
  const store = usePrettyIdAuctionStore()
  const toast = usePrettyIdToast()

  let latestWinnersRequest = 0
  let latestWeeklyRequest = 0

  // ========================================
  // REACT: failure feedback
  // ========================================

  /** A 404 is an answer, not a failure. Anything else toasts only with nothing on screen. */
  function reactToFailure(code: string, message: string, hasData: boolean): void {
    if (code === 'not_found' || hasData) return
    toast.error(message)
  }

  // ========================================
  // Public loads
  // ========================================

  /** `month` is `YYYY-MM`; omitted = the current month. */
  async function loadWinners(month?: string): Promise<PrettyIdHistoryLoadOutcome> {
    const request = ++latestWinnersRequest
    store.setWinnersLoading(true)
    try {
      const board = await api.winners(month)
      if (request !== latestWinnersRequest) return 'superseded'
      store.setWinners(board)
      return 'ok'
    } catch (err) {
      if (request !== latestWinnersRequest) return 'superseded'
      const error = toPrettyIdAuctionError(err)
      reactToFailure(error.code, error.message, store.winners !== null)
      log.warn('Failed to load winners', { month, err })
      return error.code === 'not_found' ? 'not_found' : 'error'
    } finally {
      if (request === latestWinnersRequest) store.setWinnersLoading(false)
    }
  }

  /** `month` is `YYYY-MM`; omitted = the current month. */
  async function loadWeekly(month?: string): Promise<PrettyIdHistoryLoadOutcome> {
    const request = ++latestWeeklyRequest
    store.setWeeklyLoading(true)
    try {
      const record = await api.weekly(month)
      if (request !== latestWeeklyRequest) return 'superseded'
      store.setWeekly(record)
      return 'ok'
    } catch (err) {
      if (request !== latestWeeklyRequest) return 'superseded'
      const error = toPrettyIdAuctionError(err)
      reactToFailure(error.code, error.message, store.weekly !== null)
      log.warn('Failed to load the weekly record', { month, err })
      return error.code === 'not_found' ? 'not_found' : 'error'
    } finally {
      if (request === latestWeeklyRequest) store.setWeeklyLoading(false)
    }
  }

  return { loadWinners, loadWeekly }
}
