// ========================================
// Socket Client Plugin
// ========================================

import { createLogger } from '~/utils/logger'

const log = createLogger('[Socket]')

/**
 * Socket Plugin - App-Wide Connection
 *
 * Connects to MSAB socket on authentication.
 * Stays connected for the entire user session.
 * Disconnects only on logout.
 *
 * This is a CRITICAL change from the old behavior where
 * socket connected only on room entry.
 */
export default defineNuxtPlugin(() => {
  const authStore = useAuthStore()
  const { connect, disconnect } = useAudioSocket()

  // Watch auth state and connect/disconnect accordingly
  watch(
    () => authStore.isAuthenticated,
    (isAuth, wasAuth) => {
      if (isAuth && !wasAuth) {
        log.debug('User authenticated, connecting socket...')
        connect()
      } else if (!isAuth && wasAuth) {
        log.debug('User logged out, disconnecting socket...')
        disconnect()
      }
    },
    { immediate: true }
  )
})
