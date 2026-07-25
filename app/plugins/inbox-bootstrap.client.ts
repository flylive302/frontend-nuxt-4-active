// ========================================
// Inbox Bootstrap Plugin
// ========================================
// Fetches the inbox thread list once the user is authenticated. Formerly
// gated on an 'echo:ready' hook fired by the (now removed) Echo/Reverb
// plugin — DM/official realtime hints ride the MSAB socket relay instead
// (see app/events/inbox.events.ts), so this plugin now triggers directly
// off auth state, matching the pattern in socket.client.ts.

import { scheduleAfterFirstPaint } from '~/utils/schedule-after-first-paint'

export default defineNuxtPlugin({
  name: 'inbox-bootstrap',
  parallel: true,
  setup() {
    // Maintenance wall: no inbox to fetch, and the request would only fail
    // against a backend that is intentionally down.
    if (useRuntimeConfig().public.maintenanceMode) return

    const authStore = useAuthStore()
    const { fetchThreads } = useInboxActions()

    watch(
      () => authStore.isAuthenticated,
      (isAuth, wasAuth) => {
        if (isAuth && !wasAuth) {
          // PERF: inbox threads fetch after first paint — not LCP-critical.
          scheduleAfterFirstPaint(() => {
            fetchThreads()
          })
        }
      },
      { immediate: true }
    )
  },
})
