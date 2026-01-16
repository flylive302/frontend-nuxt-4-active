// ========================================
// Auth Middleware
// ========================================

/**
 * Protects authenticated routes.
 * - Redirects to login if not authenticated
 * - Redirects to profile completion if profile incomplete
 * - NOTE: User data now comes from bootstrap, no hydration needed here
 */
export default defineNuxtRouteMiddleware(async () => {
  const authStore = useAuthStore()

  // Check authentication
  if (!authStore.isAuthenticated) {
    return navigateTo('/log-in')
  }

  // Check profile completion (BootstrapUser uses is_profile_complete)
  if (!authStore.user?.is_profile_complete) {
    return navigateTo('/complete-profile-data')
  }
})