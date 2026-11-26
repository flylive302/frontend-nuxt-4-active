/**
 * The Rare Auction API seam.
 *
 * The ONLY place that knows the `/pretty-id/auctions*` routes. Unwraps the API
 * envelope and rejects with a `PrettyIdAuctionApiError` (an HTTP 404 becomes
 * `not_found`). A separate file from `usePrettyIdApi` (Step 1) on purpose.
 */

import { useApi } from '~/composables/shared/useApi'
import type {
  PrettyIdAuctionApi,
  PrettyIdAuctionBidResult,
  PrettyIdAuctionEnterResult,
  PrettyIdAuctionList,
  PrettyIdAuctionMe,
  PrettyIdAuctionSnapshot,
  PrettyIdAuctionUnseenWin,
  PrettyIdAuctionWeeklyRecord,
  PrettyIdAuctionWinnersBoard,
  PrettyIdAuctionWinSeenResult,
} from '~/types/pretty-id-auction'
import { toPrettyIdAuctionError } from '~/utils/pretty-id-auction-error'

interface Envelope<T> {
  data: T
}

export function usePrettyIdAuctionApi(): PrettyIdAuctionApi {
  const { api } = useApi()

  async function call<T>(url: string, options?: Parameters<typeof api>[1]): Promise<T> {
    try {
      // The no-options call stays `api(url)`: reads are asserted that way in the seam spec.
      const response = await (options === undefined ? api<Envelope<T>>(url) : api<Envelope<T>>(url, options))
      return response.data
    } catch (err) {
      throw toPrettyIdAuctionError(err)
    }
  }

  /** `/pretty-id/auctions/<path>` with an optional `?month=YYYY-MM` (omitted = the current month). */
  function historyUrl(path: 'winners' | 'weekly', month: string | undefined): string {
    const base = `/pretty-id/auctions/${path}`
    return month === undefined ? base : `${base}?month=${encodeURIComponent(month)}`
  }

  return {
    auctions: () => call<PrettyIdAuctionList>('/pretty-id/auctions'),
    auction: id => call<PrettyIdAuctionSnapshot>(`/pretty-id/auctions/${id}`),
    auctionMe: id => call<PrettyIdAuctionMe>(`/pretty-id/auctions/${id}/me`),
    enter: id => call<PrettyIdAuctionEnterResult>(`/pretty-id/auctions/${id}/enter`, { method: 'POST' }),
    bid: (id, amount) => call<PrettyIdAuctionBidResult>(`/pretty-id/auctions/${id}/bid`, { method: 'POST', body: { amount } }),
    unseenWins: () => call<PrettyIdAuctionUnseenWin[]>('/pretty-id/auctions/wins/unseen'),
    markWinSeen: id => call<PrettyIdAuctionWinSeenResult>(`/pretty-id/auctions/wins/${id}/seen`, { method: 'POST' }),
    winners: month => call<PrettyIdAuctionWinnersBoard>(historyUrl('winners', month)),
    weekly: month => call<PrettyIdAuctionWeeklyRecord>(historyUrl('weekly', month)),
  }
}
