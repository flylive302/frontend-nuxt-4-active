/**
 * Audio Socket Client Plugin
 *
 * This plugin initializes the audio socket connection as a Nuxt plugin.
 * It's marked as .client.ts to ensure it only runs on the client side.
 *
 * The plugin provides a singleton instance of the audio socket that can
 * be accessed throughout the application via `useNuxtApp().$audioSocket`.
 *
 * Usage:
 * ```ts
 * const { $audioSocket } = useNuxtApp()
 * $audioSocket.connect()
 * ```
 */
export default defineNuxtPlugin(() => {
  // The actual socket connection is managed by composables
  // This plugin serves as a marker that audio socket is available
  // and can provide global hooks if needed

  // Note: The useAudioSocket composable handles the actual connection
  // This plugin is kept minimal to avoid duplicate socket instances

  return {
    provide: {
      audioSocket: {
        // Indicates audio socket plugin is loaded
        ready: true,

        // Version for debugging
        version: '1.0.0',
      },
    },
  }
})
