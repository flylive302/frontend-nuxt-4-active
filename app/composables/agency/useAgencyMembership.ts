// ========================================
// Agency Membership Composable
// ========================================

import type { 
  Agency,
  UserAgencyResponse,
  LeaveAgencyRequest,
  ChangeCoinResellerRequest 
} from '~/types/agency/agency'
import { createLogger } from '~/utils/logger'

const log = createLogger('[useAgencyMembership]')

// ========================================
// Composable
// ========================================

/**
 * Composable for managing user's agency membership.
 * Handles fetching user agency, leaving, dissolving, and settings.
 */
export function useAgencyMembership() {
  const store = useAgencyStore()
  const { api, normalizeError } = useApi()
  const toast = useToast()

  // ========================================
  // User Agency Context
  // ========================================

  /**
   * Fetch user's agency context.
   * Should be called on app init for authenticated users.
   */
  async function fetchUserAgency(): Promise<void> {
    store.userAgency.loading = true
    store.userAgency.error = null

    try {
      const response = await api<{ data: UserAgencyResponse | null }>('/user/agency')
      
      if (response.data) {
        store.userAgency.agency = response.data.agency
        store.userAgency.membership = response.data.membership
        store.userAgency.isOwner = response.data.is_owner
      } else {
        store.userAgency.agency = null
        store.userAgency.membership = null
        store.userAgency.isOwner = false
      }
    } catch (error) {
      store.userAgency.error = 'Failed to load agency information'
      log.error(' fetchUserAgency failed:', error)
    } finally {
      store.userAgency.loading = false
    }
  }

  // ========================================
  // Member Actions
  // ========================================

  /**
   * Leave current agency (for members, not owners).
   * @param request - Optional leave reason
   */
  async function leaveAgency(request?: LeaveAgencyRequest): Promise<boolean> {
    if (!store.canLeaveAgency) {
      toast.add({ title: 'Cannot Leave', description: 'Owners cannot leave. Dissolve the agency instead.', color: 'error' })
      return false
    }

    try {
      await api('/user/agency/leave', {
        method: 'POST',
        body: request,
      })

      // Clear user agency state
      store.userAgency.agency = null
      store.userAgency.membership = null
      store.userAgency.isOwner = false

      toast.add({ title: 'Left Agency', description: 'You have left the agency.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      log.error(' leaveAgency failed:', error)
      return false
    }
  }

  // ========================================
  // Owner Actions
  // ========================================

  /**
   * Dissolve agency (owner only).
   */
  async function dissolveAgency(): Promise<boolean> {
    if (!store.isAgencyOwner) {
      toast.add({ title: 'Unauthorized', description: 'Only the owner can dissolve the agency.', color: 'error' })
      return false
    }

    try {
      await api('/user/agency', { method: 'DELETE' })

      // Clear user agency state
      store.userAgency.agency = null
      store.userAgency.membership = null
      store.userAgency.isOwner = false

      toast.add({ title: 'Agency Dissolved', description: 'Your agency has been dissolved.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      log.error(' dissolveAgency failed:', error)
      return false
    }
  }

  /**
   * Change coin reseller (owner only).
   * @param request - New coin reseller ID
   */
  async function changeCoinReseller(request: ChangeCoinResellerRequest): Promise<boolean> {
    if (!store.isAgencyOwner) {
      toast.add({ title: 'Unauthorized', description: 'Only the owner can change the coin reseller.', color: 'error' })
      return false
    }

    try {
      const response = await api<{ data: Agency }>('/user/agency/coin-reseller', {
        method: 'PUT',
        body: request,
      })

      if (store.userAgency.agency) {
        store.userAgency.agency = response.data
      }

      toast.add({ title: 'Updated', description: 'Coin reseller updated successfully.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      log.error(' changeCoinReseller failed:', error)
      return false
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    fetchUserAgency,
    leaveAgency,
    dissolveAgency,
    changeCoinReseller,
  }
}
