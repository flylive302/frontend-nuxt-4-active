// ========================================
// Auth Middleware
// ========================================
import { Capacitor } from '@capacitor/core'

/**
 * Protects authenticated routes.
 * - Redirects to login if no token present
 * - Redirects to profile completion if profile incomplete
 * - NOTE: User data is hydrated by bootstrap.client.ts plugin after middleware runs.
 *   We only check token here; if the token is stale/invalid, the bootstrap API call
 *   will 401 and the plugin's catch block calls authStore.logout().
 */
export default defineNuxtRouteMiddleware(async () => {
  const authStore = useAuthStore()

  // Check for token — user data is hydrated by bootstrap plugin
  if (!authStore.token) {
    // `/welcome` is a web-only marketing page served outside this SPA (hence the
    // external hard-nav). The native bundle has no such page, so a hard-nav there
    // 404s — send native users to the in-app login route instead.
    if (Capacitor.isNativePlatform()) {
      return navigateTo('/log-in')
    }
    return navigateTo('/welcome', { external: true })
  }

  // Check profile completion only if user is already hydrated
  // (skip if user is null — bootstrap plugin will hydrate after middleware)
  if (authStore.user && !authStore.user.is_profile_complete) {
    return navigateTo('/complete-profile-data')
  }
})