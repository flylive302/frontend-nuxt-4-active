// ========================================
// Bootstrap Client Plugin
// ========================================

import { createLogger } from '~/utils/logger'

const log = createLogger('[Bootstrap]')

/**
 * Bootstrap plugin - Orchestrates app initialization.
 *
 * On app start (if authenticated):
 * 1. Fetch bootstrap data from /api/v1/bootstrap
 * 2. Seed auth store with user data
 * 3. Seed levels store with level status
 * 4. Seed income store with active target
 * 5. Seed bootstrap store with config/gifts
 *
 * This replaces the old auth.ts plugin's fetchUser() call.
 */
export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore()
  const bootstrapStore = useBootstrapStore()
  const levelsStore = useLevelsStore()
  const token = useCookie('sanctum_token')

  // Skip if no token
  if (!token.value) {
    log.debug('No auth token, skipping bootstrap')
    return
  }

  // Set token first
  authStore.setToken(token.value)

  // Check if we need to fetch (token exists but no user, or data is stale)
  const needsFetch = !authStore.user || bootstrapStore.needsRefresh

  if (!needsFetch && bootstrapStore.isReady) {
    log.debug('Bootstrap data fresh, skipping fetch')
    return
  }

  log.debug('Starting bootstrap fetch...')

  try {
    const data = await bootstrapStore.fetchBootstrap()

    if (!data) {
      log.error('Bootstrap returned null')
      return
    }

    // Seed auth store with user
    authStore.setUser(data.user)

    // Seed levels store
    levelsStore.setLevels(data.user_data.levels.wealth, data.user_data.levels.charm)

    log.debug('Bootstrap complete, stores seeded')

    // Request persistent storage (for Safari/iOS)
    if (navigator.storage?.persist) {
      const isPersisted = await navigator.storage.persist()
      log.debug('Persistent storage:', isPersisted ? 'granted' : 'denied')
    }

    // Start asset download in background
    if (data.gifts.catalog.length > 0) {
      bootstrapStore.startAssetDownload()
    }
  } catch (e) {
    log.error('Bootstrap failed:', e)
    // Clear token if bootstrap fails (likely auth issue)
    authStore.logout()
  }
})
