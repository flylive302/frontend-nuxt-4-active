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
    // Capture during plugin init (setup context) so the watcher callback
    // doesn't call useToast() outside of Vue's component setup.
    const { fetchThreads } = useInboxActions()

    watch(
      () => authStore.isAuthenticated,
      (isAuth, wasAuth) => {
        if (isAuth && !wasAuth) {
          log.debug('Subscribing to DM channel...')
          subscribe()
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
