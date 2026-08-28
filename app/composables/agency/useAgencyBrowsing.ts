// ========================================
// Agency Browsing Composable
// ========================================

import type { Agency, AgencyMember, AgencyListFilters, CreateAgencyRequest } from '~/types/agency/agency'
import { createLogger } from '~/utils/logger'

const log = createLogger('[useAgencyBrowsing]')

/**
 * Monotonic id for the agency-list request in flight.
 *
 * Module scope, not composable scope: the list it guards lives on the (global)
 * Pinia store, so two component instances sharing that store must share the
 * generation counter too.
 */
let agencyListRequestId = 0

// ========================================
// GATE Helpers
// ========================================

/**
 * Validate an agency/member id before it is interpolated into a URL.
 * Guards against NaN reaching the API (e.g. `Number(route.params.id)`
 * on a broken `/agency/undefined` link).
 */
function isValidAgencyId(id: number): boolean {
  return Number.isInteger(id) && id > 0
}

// ========================================
// Composable
// ========================================

/**
 * Composable for browsing and creating agencies.
 * Handles agency list, details, members, and creation.
 */
export function useAgencyBrowsing() {
  const store = useAgencyStore()
  const { api, normalizeError } = useApi()
  const toast = useToast()

  // ========================================
  // Agency List
  // ========================================

  /**
   * Fetch list of approved agencies.
   *
   * A `reset` (new search / country filter) always supersedes a request already
   * in flight — the older response is discarded on arrival. Without that, a
   * filter change typed while page N was loading was silently dropped by the
   * `loading` guard and the list kept showing the previous filter's rows.
   *
   * @param filters - Optional search and country filters
   * @param reset - Whether to reset pagination
   */
  async function fetchAgencies(filters?: AgencyListFilters, reset = false): Promise<void> {
    if (reset) {
      store.agencies.items = []
      store.agencies.cursor = null
      store.agencies.hasMore = true
    } else if (!store.agencies.hasMore || store.agencies.loading) {
      return
    }

    const requestId = ++agencyListRequestId
    const sentCursor = store.agencies.cursor

    store.agencies.loading = true
    store.agencies.error = null

    try {
      // Merge filters with stored filters
      const mergedFilters = { ...store.agencies.filters, ...filters }
      
      // Build params, only including non-empty values
      const params: Record<string, unknown> = {
        per_page: 20,
      }
      
      if (sentCursor) {
        params.cursor = sentCursor
      }
      
      if (mergedFilters.search && mergedFilters.search.trim()) {
        params.search = mergedFilters.search.trim()
      }
      
      if (mergedFilters.country && mergedFilters.country.trim()) {
        params.country = mergedFilters.country.trim()
      }

      const response = await api<{
        data: Agency[]
        meta?: { next_cursor?: string | null }
      }>('/agencies', { params })

      // A newer reset started while this was in flight — its result wins.
      if (requestId !== agencyListRequestId) return

      const nextCursor = response.meta?.next_cursor ?? null

      // Drop rows already on screen. Duplicate ids break the grid's keyed
      // reconciliation, and a server that replays a page would otherwise grow
      // the list forever.
      const seen = new Set(store.agencies.items.map(agency => agency.id))
      const fresh = response.data.filter((agency) => {
        if (seen.has(agency.id)) return false
        seen.add(agency.id)
        return true
      })

      store.agencies.items.push(...fresh)
      store.agencies.cursor = nextCursor
      // Termination guard: stop unless the server actually moved us forward.
      // An absent, null or unchanged cursor — or an empty page — means the next
      // request would return exactly what we just got.
      store.agencies.hasMore = nextCursor !== null
        && nextCursor !== sentCursor
        && response.data.length > 0
    } catch (error) {
      if (requestId !== agencyListRequestId) return
      log.warn('Failed to fetch agencies', error)
      store.agencies.error = 'Failed to load agencies'
    } finally {
      if (requestId === agencyListRequestId) {
        store.agencies.loading = false
      }
    }
  }

  // ========================================
  // Agency Details
  // ========================================

  /**
   * Fetch single agency by ID.
   * @param id - Agency ID
   */
  async function fetchAgencyById(id: number): Promise<void> {
    if (!isValidAgencyId(id)) {
      log.warn('Aborted fetchAgencyById: invalid id', { id })
      store.currentAgency.error = 'Failed to load agency'
      return
    }

    store.currentAgency.loading = true
    store.currentAgency.error = null
    store.currentAgency.members = []
    store.currentAgency.membersCursor = null
    store.currentAgency.membersHasMore = true

    try {
      const response = await api<{ data: Agency }>(`/agencies/${id}`)
      store.currentAgency.agency = response.data
    } catch (error) {
      log.warn('Failed to fetch agency by ID', error)
      store.currentAgency.error = 'Failed to load agency'
    } finally {
      store.currentAgency.loading = false
    }
  }

  /**
   * Fetch members of an agency.
   * @param agencyId - Agency ID
   * @param reset - Whether to reset pagination
   */
  async function fetchAgencyMembers(agencyId: number, reset = false): Promise<void> {
    if (!isValidAgencyId(agencyId)) {
      log.warn('Aborted fetchAgencyMembers: invalid id', { agencyId })
      return
    }

    if (reset) {
      store.currentAgency.members = []
      store.currentAgency.membersCursor = null
      store.currentAgency.membersHasMore = true
    }

    if (!store.currentAgency.membersHasMore || store.currentAgency.membersLoading) return

    store.currentAgency.membersLoading = true

    try {
      const params: Record<string, unknown> = {
        per_page: 20,
      }

      if (store.currentAgency.membersCursor) {
        params.cursor = store.currentAgency.membersCursor
      }

      const response = await api<{
        data: AgencyMember[]
        meta: { next_cursor: string | null }
      }>(`/agencies/${agencyId}/members`, { params })

      store.currentAgency.members.push(...response.data)
      store.currentAgency.membersCursor = response.meta.next_cursor
      store.currentAgency.membersHasMore = response.meta.next_cursor !== null
    } catch (error) {
      log.warn('Failed to fetch agency members', error)
    } finally {
      store.currentAgency.membersLoading = false
    }
  }

  // ========================================
  // Agency Creation
  // ========================================

  /**
   * Create new agency application.
   * @param request - Agency creation request data
   */
  async function createAgency(request: CreateAgencyRequest): Promise<Agency | null> {
    try {
      const formData = new FormData()
      formData.append('name', request.name)
      formData.append('country', request.country)
      formData.append('address', request.address)
      
      if (request.logo) {
        formData.append('logo', request.logo)
      }
      
      if (request.national_id_images) {
        request.national_id_images.forEach((file, index) => {
          formData.append(`national_id_images[${index}]`, file)
        })
      }
      
      if (request.coin_reseller_id) {
        formData.append('coin_reseller_id', String(request.coin_reseller_id))
      }

      const response = await api<{ data: Agency }>('/agencies', {
        method: 'POST',
        body: formData,
      })

      // Update user agency state
      store.userAgency.agency = response.data
      store.userAgency.isOwner = true
      store.userAgency.membership = null

      toast.add({ title: 'Success', description: 'Agency application submitted for review.', color: 'success' })
      return response.data
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      return null
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    fetchAgencies,
    fetchAgencyById,
    fetchAgencyMembers,
    createAgency,
  }
}
