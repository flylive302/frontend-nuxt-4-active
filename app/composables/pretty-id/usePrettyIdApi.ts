/**
 * The Pretty ID API seam.
 *
 * The ONLY place that knows the `/pretty-id/*` routes. Every other Pretty ID
 * composable talks to `usePrettyIdApi()`, which unwraps the API envelope and
 * rejects with a `PrettyIdApiError` (error code mapped from the response).
 */

import { useApi } from '~/composables/shared/useApi'
import type {
  PrettyIdApi,
  PrettyIdClaimResult,
  PrettyIdListQuery,
  PrettyIdListResponse,
  PrettyIdMe,
} from '~/types/pretty-id'
import { toPrettyIdError } from '~/utils/pretty-id-error'

interface Envelope<T> {
  data: T
}

/** Query-string params for `GET /pretty-id/ids`; unset filters are left out. */
function listParams(query: PrettyIdListQuery): Record<string, string | number> {
  const params: Record<string, string | number> = { tier: query.tier }
  if (query.category) params.category = query.category
  if (query.q) params.q = query.q
  if (query.cursor) params.cursor = query.cursor
  return params
}

export function usePrettyIdApi(): PrettyIdApi {
  const { api } = useApi()

  async function call<T>(url: string, options: Parameters<typeof api>[1] = {}): Promise<T> {
    try {
      const response = await api<Envelope<T>>(url, options)
      return response.data
    } catch (err) {
      throw toPrettyIdError(err)
    }
  }

  return {
    me: () => call<PrettyIdMe>('/pretty-id/me'),
    list: query => call<PrettyIdListResponse>('/pretty-id/ids', { query: listParams(query) }),
    claim: signature => call<PrettyIdClaimResult>('/pretty-id/claim', { method: 'POST', body: { signature } }),
  }
}
