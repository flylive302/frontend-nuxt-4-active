// ========================================
// Diamond Exchange Page Composable
// ========================================
// Orchestrates the exchange page's open flow: agency-membership GATE,
// concurrent EXECUTE of the agency check + exchange-info fetch, and the
// REACT redirect/toast for non-agency users.

import { ref } from 'vue'
import type { ExchangeInfo } from '~/types/economy/exchange'
import { createLogger } from '~/utils/logger'

const log = createLogger('[useDiamondExchangePage]')

export function useDiamondExchangePage() {
  // ========================================
  // Dependencies
  // ========================================

  const agencyStore = useAgencyStore()
  const { fetchUserAgency } = useAgencyMembership()
  const { fetchExchangeInfo: loadExchangeInfo, normalizeError } = useDiamondExchangeApi()
  const toast = useToast()

  // ========================================
  // State
  // ========================================

  const exchangeInfo = ref<ExchangeInfo | null>(null)
  const isLoading = ref(true)

  // ========================================
  // Open (page-mount orchestration)
  // ========================================

  /**
   * Open the exchange page: verify agency membership and load exchange
   * info concurrently, then apply the redirect decision.
   *
   * GATE:    agency membership (redirect non-members to /profile)
   * EXECUTE: agency check + exchange-info fetch run in parallel
   * REACT:   access-denied toast + redirect, or failed-fetch toast
   */
  async function open(): Promise<void> {
    let redirecting = false

    // EXECUTE — kick off both requests without waiting on each other.
    const agencyPromise = agencyStore.isAgencyMember ? Promise.resolve() : fetchUserAgency()

    const infoPromise = loadExchangeInfo()
      .then((info) => {
        exchangeInfo.value = info
      })
      .catch((err) => {
        // Redirect already decided → this settlement is late and harmless.
        if (redirecting) {
          log.warn('Exchange info settled after redirect; suppressing toast', err)
          return
        }
        const normalized = normalizeError(err)
        toast.add({
          title: 'Failed to load exchange info',
          description: normalized.message,
          color: 'error',
        })
      })

    // GATE — wait only for the agency result to make the redirect decision.
    await agencyPromise

    if (!agencyStore.isAgencyMember) {
      redirecting = true
      toast.add({
        title: 'Access Denied',
        description: 'Only agency members can convert diamonds to coins.',
        color: 'error',
      })
      await navigateTo('/profile')
      return
    }

    // Agency membership confirmed — reveal the form once info settles.
    await infoPromise
    isLoading.value = false
  }

  // ========================================
  // Return
  // ========================================

  return {
    exchangeInfo,
    isLoading,
    open,
  }
}
