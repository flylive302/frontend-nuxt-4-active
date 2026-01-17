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
 * Token is read from Pinia persisted state (localStorage) first,
 * then falls back to cookie for backwards compatibility.
 * This ensures token survives PWA refresh where cookies may be lost.
 */
export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore()
  const bootstrapStore = useBootstrapStore()
  const levelsStore = useLevelsStore()

  // Read token from Pinia persisted state first (survives PWA refresh)
  // Fall back to cookie for backwards compatibility
  const storedToken = authStore.token
  const cookieToken = useCookie('sanctum_token')
  const token = storedToken || cookieToken.value

  // Skip if no token from either source
  if (!token) {
    log.debug('No auth token found, skipping bootstrap')
    return
  }

  // Sync token to store if it came from cookie (migration path)
  if (!storedToken && cookieToken.value) {
    log.debug('Migrating token from cookie to store')
    authStore.setToken(cookieToken.value)
  }

  // Check if we need to fetch (token exists but no user, or data is stale)
  const needsFetch = !authStore.user || bootstrapStore.needsRefresh

  if (!needsFetch && bootstrapStore.isReady) {
    log.debug('Bootstrap data fresh, skipping fetch')
    
    // Even with cached data, check if assets need downloading
    // This handles the case where PWA was installed but assets weren't downloaded
    if (bootstrapStore.giftCatalog.length > 0 && bootstrapStore.assetPhase === 'idle') {
      log.debug('Starting asset download from cached data')
      bootstrapStore.startAssetDownload()
    }
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
