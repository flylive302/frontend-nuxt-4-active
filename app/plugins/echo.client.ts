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

    const wsHost = config.public.reverbHost as string
    const wsPort = Number(config.public.reverbPort)
    const wsScheme = config.public.reverbScheme as string
    const wsKey = config.public.reverbAppKey as string

    console.log('[Echo] Initializing Reverb connection', {
      host: wsHost,
      port: wsPort,
      scheme: wsScheme,
      keyPrefix: wsKey?.substring(0, 6) + '...',
      forceTLS: wsScheme === 'https',
    })

    // Pusher is Echo's transport layer when using Reverb
    // @ts-expect-error - Pusher needs to be on window for Echo
    window.Pusher = Pusher

    // Enable Pusher logging in non-production for debugging
    Pusher.logToConsole = import.meta.dev

    const echo = new Echo({
      broadcaster: 'reverb',
      key: wsKey,
      wsHost,
      wsPort,
      wssPort: wsPort,
      forceTLS: wsScheme === 'https',
      enabledTransports: ['ws', 'wss'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      authorizer: (channel: { name: string }) => ({
        authorize: (socketId: string, callback: (error: Error | null, authData: { auth: string; channel_data?: string } | null) => void) => {
          const authStore = useAuthStore()
          const token = useCookie('sanctum_token').value ?? authStore.token

          console.log('[Echo] Authorizing channel:', channel.name)

          $fetch<{ auth: string; channel_data?: string }>(`${config.public.apiRoot}/broadcasting/auth`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
            body: { socket_id: socketId, channel_name: channel.name },
          })
            .then((data) => {
              console.log('[Echo] Channel authorized:', channel.name)
              callback(null, data)
            })
            .catch((err) => {
              console.error('[Echo] Channel auth failed:', channel.name, err)
              callback(err instanceof Error ? err : new Error(String(err)), null)
            })
        },
      }) as any,
    })

    // Log connection state changes
    echo.connector.pusher.connection.bind('connected', () => {
      console.log('[Echo] ✅ WebSocket connected')
    })
    echo.connector.pusher.connection.bind('error', (err: unknown) => {
      console.error('[Echo] ❌ WebSocket error:', err)
    })
    echo.connector.pusher.connection.bind('disconnected', () => {
      console.warn('[Echo] ⚠️ WebSocket disconnected')
    })
    echo.connector.pusher.connection.bind('unavailable', () => {
      console.error('[Echo] ❌ WebSocket unavailable — check host/port/key')
    })

    return {
      provide: { echo },
    }
  },
})
