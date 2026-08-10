// ========================================
// Agency Application Composable
// ========================================

import type { Agency } from '~/types/agency/agency'
import { createLogger } from '~/utils/logger'

const log = createLogger('[useAgencyApplication]')

// ========================================
// Composable
// ========================================

/**
 * Composable for managing the caller's own agency application lifecycle:
 * cancelling a pending application and resubmitting a rejected/cancelled one.
 */
export function useAgencyApplication() {
  const { api, normalizeError } = useApi()
  const toast = useToast()
  const { fetchUserAgency } = useAgencyMembership()

  const loading = ref(false)
  const error = ref<string | null>(null)

  // ========================================
  // Actions
  // ========================================

  /**
   * Withdraw the caller's own PENDING agency application.
   */
  async function cancelApplication(): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      await api<{ data: Agency }>('/user/agency/application/cancel', {
        method: 'POST',
      })

      await fetchUserAgency()

      toast.add({ title: 'Application Cancelled', description: 'Your agency application has been withdrawn.', color: 'success' })
      return true
    } catch (err) {
      const normalized = normalizeError(err)
      log.warn('Failed to cancel application', err)
      error.value = normalized.message
      toast.add({ title: 'Error', description: normalized.message, color: 'error' })
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Edit and resubmit a REJECTED or CANCELLED agency application.
   * @param payload - Same body shape as the initial `/agencies` create request.
   */
  async function resubmitApplication(payload: Record<string, unknown>): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      await api<{ data: Agency }>('/user/agency/application', {
        method: 'PUT',
        body: payload,
      })

      await fetchUserAgency()

      toast.add({ title: 'Application Resubmitted', description: 'Your agency application has been submitted for review.', color: 'success' })
      return true
    } catch (err) {
      const normalized = normalizeError(err)
      log.warn('Failed to resubmit application', err)
      error.value = normalized.message
      toast.add({ title: 'Error', description: normalized.message, color: 'error' })
      return false
    } finally {
      loading.value = false
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    loading,
    error,
    cancelApplication,
    resubmitApplication,
  }
}
