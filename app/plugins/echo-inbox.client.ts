// ========================================
// Echo Inbox Subscription Plugin
// ========================================
// Subscribes / unsubscribes the private DM channel in sync with auth state.
// Uses 'echo:ready' hook (fired by echo.client.ts) instead of watching
// isAuthenticated directly — this eliminates the race condition where
// echo-inbox would try to subscribe before Echo's async init completes.

import { createLogger } from '~/utils/logger'
import { scheduleAfterFirstPaint } from '~/utils/schedule-after-first-paint'

const log = createLogger('[EchoInbox]')

export default defineNuxtPlugin({
  name: 'echo-inbox',
  dependsOn: ['echo'],
  parallel: true,
  setup(nuxtApp) {
    const authStore = useAuthStore()
    // Capture during plugin init (setup context) so callbacks
    // don't call these composables outside of Vue's component setup.
    const { subscribe, unsubscribe } = useInboxEcho()
    const { fetchThreads } = useInboxActions()

    // Subscribe when Echo is ready AND user is authenticated.
    // echo:ready is fired by echo.client.ts after initEcho() completes,
    // including on re-login after logout.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(nuxtApp as any).hook('echo:ready', () => {
      if (!authStore.isAuthenticated) return
      // PERF: inbox + /broadcasting/auth + /inbox/threads after first paint — not LCP-critical.
      scheduleAfterFirstPaint(() => {
        log.debug('Subscribing to DM channel...')
        subscribe()
        fetchThreads()
      })
    })

    // Unsubscribe on logout only (no immediate — only react to transitions).
    watch(
      () => authStore.isAuthenticated,
      (isAuth, wasAuth) => {
        if (!isAuth && wasAuth) {
          log.debug('Unsubscribing from DM channel...')
          unsubscribe()
        }
      },
    )
  },
})
