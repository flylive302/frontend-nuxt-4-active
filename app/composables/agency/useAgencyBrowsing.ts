// ========================================
// Agency Browsing Composable
// ========================================

import type { Agency, AgencyMember, AgencyListFilters, CreateAgencyRequest } from '~/types/agency'

// ========================================
// Composable
// ========================================

/**
 * Composable for browsing and creating agencies.
 * Handles agency list, details, members, and creation.
 */
export function useAgencyBrowsing() {
  const store = useAgencyStore()
  const { api } = useApi()
  const toast = useToast()

  // ========================================
  // Agency List
  // ========================================

  /**
   * Fetch list of approved agencies.
   * @param filters - Optional search and country filters
   * @param reset - Whether to reset pagination
   */
  async function fetchAgencies(filters?: AgencyListFilters, reset = false): Promise<void> {
    if (reset) {
      store.agencies.items = []
      store.agencies.cursor = null
      store.agencies.hasMore = true
    }

    if (!store.agencies.hasMore || store.agencies.loading) return

    store.agencies.loading = true
    store.agencies.error = null

    try {
      // Merge filters with stored filters
      const mergedFilters = { ...store.agencies.filters, ...filters }
      
      // Build params, only including non-empty values
      const params: Record<string, unknown> = {
        per_page: 20,
      }
      
      if (store.agencies.cursor) {
        params.cursor = store.agencies.cursor
      }
      
      if (mergedFilters.search && mergedFilters.search.trim()) {
        params.search = mergedFilters.search.trim()
      }
      
      if (mergedFilters.country && mergedFilters.country.trim()) {
        params.country = mergedFilters.country.trim()
      }

      const response = await api<{
        data: Agency[]
        meta: { next_cursor: string | null }
      }>('/agencies', { params })

      store.agencies.items.push(...response.data)
      store.agencies.cursor = response.meta.next_cursor
      store.agencies.hasMore = response.meta.next_cursor !== null
    } catch (error) {
      store.agencies.error = 'Failed to load agencies'
      console.error('[useAgencyBrowsing] fetchAgencies failed:', error)
    } finally {
      store.agencies.loading = false
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
    store.currentAgency.loading = true
    store.currentAgency.error = null
    store.currentAgency.members = []
    store.currentAgency.membersCursor = null
    store.currentAgency.membersHasMore = true

    try {
      const response = await api<{ data: Agency }>(`/agencies/${id}`)
      store.currentAgency.agency = response.data
    } catch (error) {
      store.currentAgency.error = 'Failed to load agency'
      console.error('[useAgencyBrowsing] fetchAgencyById failed:', error)
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
    if (reset) {
      store.currentAgency.members = []
      store.currentAgency.membersCursor = null
      store.currentAgency.membersHasMore = true
    }

    if (!store.currentAgency.membersHasMore || store.currentAgency.membersLoading) return

    store.currentAgency.membersLoading = true

    try {
      const params = {
        cursor: store.currentAgency.membersCursor,
        per_page: 20,
      }

      const response = await api<{
        data: AgencyMember[]
        meta: { next_cursor: string | null }
      }>(`/agencies/${agencyId}/members`, { params })

      store.currentAgency.members.push(...response.data)
      store.currentAgency.membersCursor = response.meta.next_cursor
      store.currentAgency.membersHasMore = response.meta.next_cursor !== null
    } catch (error) {
      console.error('[useAgencyBrowsing] fetchAgencyMembers failed:', error)
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
      toast.add({ title: 'Error', description: 'Failed to create agency.', color: 'error' })
      console.error('[useAgencyBrowsing] createAgency failed:', error)
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
