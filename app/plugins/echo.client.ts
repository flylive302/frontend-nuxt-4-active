// ========================================
// Laravel Echo Plugin (Reverb)
// ========================================
// Sets up the Echo instance backed by Reverb WebSocket.
// Authorizes private channels by injecting the Sanctum Bearer token
// directly into the /broadcasting/auth request.

import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

export default defineNuxtPlugin({
  name: 'echo',
  setup() {
    const config = useRuntimeConfig()

    // Pusher is Echo's transport layer when using Reverb
    // @ts-expect-error - Pusher needs to be on window for Echo
    window.Pusher = Pusher

    const echo = new Echo({
      broadcaster: 'reverb',
      key: config.public.reverbAppKey as string,
      wsHost: config.public.reverbHost as string,
      wsPort: Number(config.public.reverbPort),
      wssPort: Number(config.public.reverbPort),
      forceTLS: (config.public.reverbScheme as string) === 'https',
      enabledTransports: ['ws', 'wss'],
      authorizer: (channel: { name: string }) => ({
        authorize: (socketId: string, callback: (error: unknown, data: unknown) => void) => {
          const authStore = useAuthStore()
          const token = useCookie('sanctum_token').value ?? authStore.token

          $fetch(`${config.public.apiRoot}/broadcasting/auth`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
            body: { socket_id: socketId, channel_name: channel.name },
          })
            .then(data => callback(null, data))
            .catch(err => callback(err, null))
        },
      }),
    })

    return {
      provide: { echo },
    }
  },
})
