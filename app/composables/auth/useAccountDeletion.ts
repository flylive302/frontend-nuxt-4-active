// ========================================
// Account Deletion Composable
// ========================================
// Handles self-service account deletion with GDPR-compliant grace period.
// Follows GATE → EXECUTE → REACT pipeline.



export function useAccountDeletion() {
  // ========================================
  // Dependencies
  // ========================================

  const authStore = useAuthStore()
  const { api, fetchCsrfToken } = useApi()
  const toast = useToast()

  // ========================================
  // State
  // ========================================

  const isDeleting = ref(false)

  // ========================================
  // Actions
  // ========================================

  /**
   * Schedule account deletion with a 30-day grace period.
   *
   * GATE:    Verify authentication
   * SETUP:   Fetch CSRF token
   * EXECUTE: DELETE /account → clear local state
   * REACT:   Show toast, navigate to login
   */
  async function deleteAccount(reason?: string): Promise<void> {
    // GATE — must be authenticated
    if (!authStore.isAuthenticated) {
      return
    }

    // SETUP
    await fetchCsrfToken()
    isDeleting.value = true

    try {
      // EXECUTE — call API
      const response = await api<{
        status: string
        message: string
        data: {
          grace_period_days: number
          scheduled_purge_at: string
        }
      }>('/account', {
        method: 'DELETE',
        body: reason ? { reason } : {},
      })


      // EXECUTE — clear all local state
      authStore.logout()

      // REACT — feedback and navigation
      toast.add({
        title: 'Account Deletion Scheduled',
        description: `Your account will be permanently deleted in ${response.data.grace_period_days} days. Contact support to cancel.`,
        color: 'warning',
        duration: 8000,
      })

      await navigateTo('/log-in')
    } catch (error) {

      toast.add({
        title: 'Deletion Failed',
        description: 'Unable to delete your account. Please try again or contact support.',
        color: 'error',
      })

      throw error
    } finally {
      isDeleting.value = false
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    deleteAccount,
    isDeleting,
  }
}
