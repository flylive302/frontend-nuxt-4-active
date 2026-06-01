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
 */
export default defineNuxtPlugin({
  name: 'audio-socket',
  parallel: true,
  setup() {
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
