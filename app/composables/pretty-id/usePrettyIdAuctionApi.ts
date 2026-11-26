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
  PrettyIdAuctionEnterResult,
  PrettyIdAuctionList,
  PrettyIdAuctionMe,
  PrettyIdAuctionSnapshot,
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

  return {
    auctions: () => call<PrettyIdAuctionList>('/pretty-id/auctions'),
    auction: id => call<PrettyIdAuctionSnapshot>(`/pretty-id/auctions/${id}`),
    auctionMe: id => call<PrettyIdAuctionMe>(`/pretty-id/auctions/${id}/me`),
    enter: id => call<PrettyIdAuctionEnterResult>(`/pretty-id/auctions/${id}/enter`, { method: 'POST' }),
  }
}
