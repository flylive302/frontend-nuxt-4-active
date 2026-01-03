// ========================================
// Auth Middleware
// ========================================

import { useLevelsStore } from '~/stores/levels'
import { useBadgesStore } from '~/stores/badges'

/**
 * Protects authenticated routes.
 * - Redirects to login if not authenticated
 * - Redirects to profile completion if profile incomplete
 * - Hydrates user data (levels, badges) on first access
 */
export default defineNuxtRouteMiddleware(async () => {
    const authStore = useAuthStore()

    // Check authentication
    if (!authStore.isAuthenticated) {
        return navigateTo('/log-in')
    }

    // Check profile completion
    if (!authStore.user?.profile_completion?.is_complete) {
        return navigateTo('/complete-profile-data')
    }

    // Hydrate user data (lazy - only if stores need refresh)
    const levelsStore = useLevelsStore()
    const badgesStore = useBadgesStore()

    // Parallel fetch - only fetch if data is stale or missing
    await Promise.all([
        levelsStore.needsRefresh ? levelsStore.fetchLevels() : Promise.resolve(),
        badgesStore.userBadges.items.length === 0 ? badgesStore.fetchUserBadges() : Promise.resolve(),
    ])
})