// ========================================
// User Blocks Bootstrap Plugin
// ========================================
// Fetches the profile-level blocked-users list once on login, mirroring
// inbox-bootstrap.client.ts's auth-state-driven pattern (Apple-1.2: block
// list must be loaded before room chat can filter blocked senders).

import { scheduleAfterFirstPaint } from '~/utils/schedule-after-first-paint'

export default defineNuxtPlugin({
  name: 'user-blocks-bootstrap',
  parallel: true,
  setup() {
    if (useRuntimeConfig().public.maintenanceMode) return

    const authStore = useAuthStore()
    const { fetchBlockedUsers } = useUserBlocking()

    watch(
      () => authStore.isAuthenticated,
      (isAuth, wasAuth) => {
        if (isAuth && !wasAuth) {
          // PERF: not LCP-critical — fetch after first paint like inbox threads.
          scheduleAfterFirstPaint(() => {
            fetchBlockedUsers()
          })
        }
      },
      { immediate: true }
    )
  },
})
