// ========================================
// Echo Inbox Subscription Plugin
// ========================================
// Subscribes / unsubscribes the private DM channel in sync with auth state.
// Mirrors the pattern in socket.client.ts for the audio socket.

import { createLogger } from '~/utils/logger'

const log = createLogger('[EchoInbox]')

export default defineNuxtPlugin({
  name: 'echo-inbox',
  dependsOn: ['echo'],
  setup() {
    const authStore = useAuthStore()
    const { subscribe, unsubscribe } = useInboxEcho()

    watch(
      () => authStore.isAuthenticated,
      (isAuth, wasAuth) => {
        if (isAuth && !wasAuth) {
          log.debug('Subscribing to DM channel...')
          subscribe()
          // Fetch thread list in background so footer badge shows unread counts
          const { fetchThreads } = useInboxActions()
          fetchThreads()
        }
        else if (!isAuth && wasAuth) {
          log.debug('Unsubscribing from DM channel...')
          unsubscribe()
        }
      },
      { immediate: true },
    )
  },
})
