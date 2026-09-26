// ========================================
// Socket Client Plugin
// ========================================



/**
 * Socket Plugin - App-Wide Connection
 *
 * Sole owner of the audio socket connection lifecycle.
 * Connects on login (with async token refresh), disconnects on logout.
 * Stays connected for the entire user session.
 *
 * Room-specific lifecycle (join/leave/reconnect) is handled by
 * useRoomLifecycle composable in app.vue.
 *
 * ⚠️ Connects EAGERLY for a restored session — do not defer it past first paint.
 * The Laravel→MSAB bridge is at-most-once with no replay, and `useAudioSocket`
 * skips its self-heal resync on the first connect because bootstrap's
 * after-first-paint `syncUser()` snapshot is assumed to start once the socket is
 * already live. Deferring the connect puts that snapshot ahead of the socket on
 * nearly every cold start, so a balance/badge/DM push landing in between is lost
 * (boot-and-asset-delivery 08 tried it and dropped it for this reason).
 */
export default defineNuxtPlugin({
  name: 'audio-socket',
  parallel: true,
  setup() {
    // Maintenance wall: never open the audio socket. Without this the client
    // would sit on /maintenance burning battery on reconnect backoff against a
    // fleet that is intentionally unavailable.
    if (useRuntimeConfig().public.maintenanceMode) return

    const authStore = useAuthStore()
    const { connect, disconnect } = useAudioSocket()

    // Watch auth state and connect/disconnect accordingly
    watch(
      () => authStore.isAuthenticated,
      async (isAuth, wasAuth) => {
        if (isAuth && !wasAuth) {
          await connect()
        } else if (!isAuth && wasAuth) {
          disconnect()
        }
      },
      { immediate: true }
    )
  }
})
