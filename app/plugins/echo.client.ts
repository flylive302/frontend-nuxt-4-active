// ========================================
// Laravel Echo Plugin (Reverb)
// ========================================
// Sets up the Echo instance backed by Reverb WebSocket.
// Authorizes private channels by injecting the Sanctum Bearer token
// directly into the /broadcasting/auth request.
//
// PERF: Echo + Pusher JS are dynamically imported only when the user
// authenticates. This keeps them out of the initial bundle for
// unauthenticated pages (login, signup) → better Lighthouse score.
//
// PATTERN: We provide a transparent Proxy once (never re-provide).
// When Echo initializes, _echoInstance is set and all method calls
// forward to it transparently. This avoids "Cannot redefine property"
// errors that occur when nuxtApp.provide() is called more than once.

import { createLogger } from '~/utils/logger'

const log = createLogger('[Echo]')

// Module-level Echo instance — set once when user first authenticates.
let _echoInstance: object | null = null

// Stable Proxy provided once to nuxtApp.$echo.
// Forwards all property access/calls to _echoInstance when available.
// Returns undefined for any access when Echo is not yet initialized.
const _echoProxy = new Proxy(Object.create(null), {
  get(_: never, prop: string | symbol) {
    if (!_echoInstance) return undefined
    const val = Reflect.get(_echoInstance, prop)
    return typeof val === 'function' ? (val as (...args: unknown[]) => unknown).bind(_echoInstance) : val
  },
  has(_: never, prop: string | symbol) {
    return _echoInstance !== null && Reflect.has(_echoInstance, prop)
  },
})

export default defineNuxtPlugin({
  name: 'echo',
  parallel: true,
  setup(nuxtApp) {
    const config = useRuntimeConfig()
    const authStore = useAuthStore()

    async function initEcho() {
      if (_echoInstance) return _echoInstance

      // Dynamic import — keeps laravel-echo + pusher-js out of the
      // initial bundle. Only loaded when first authenticated user needs it.
      const [{ default: Echo }, { default: Pusher }] = await Promise.all([
        import('laravel-echo'),
        import('pusher-js'),
      ])

      const wsHost = config.public.reverbHost as string
      const wsPort = Number(config.public.reverbPort)
      const wsScheme = config.public.reverbScheme as string
      const wsKey = config.public.reverbAppKey as string

      log.debug('Initializing Reverb connection', {
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
        authorizer: (channel: { name: string }) => ({
          authorize: (socketId: string, callback: (error: Error | null, authData: { auth: string; channel_data?: string } | null) => void) => {
            const token = useCookie('sanctum_token').value ?? authStore.token

            log.debug('Authorizing channel:', channel.name)

            $fetch<{ auth: string; channel_data?: string }>(`${config.public.apiRoot}/broadcasting/auth`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
              },
              body: { socket_id: socketId, channel_name: channel.name },
            })
              .then((data) => {
                log.debug('Channel authorized:', channel.name)
                callback(null, data)
              })
              .catch((err) => {
                log.error('Channel auth failed:', channel.name, err)
                callback(err instanceof Error ? err : new Error(String(err)), null)
              })
          },
        }),
      } as ConstructorParameters<typeof Echo>[0])

      echo.connector.pusher.connection.bind('connected', () => log.debug('✅ WebSocket connected'))
      echo.connector.pusher.connection.bind('error', (err: unknown) => log.error('❌ WebSocket error:', err))
      echo.connector.pusher.connection.bind('disconnected', () => log.warn('⚠️ WebSocket disconnected'))
      echo.connector.pusher.connection.bind('unavailable', () => log.error('❌ WebSocket unavailable — check host/port/key'))

      _echoInstance = echo
      return echo
    }

    // Lazy-init: start Echo when authenticated, then signal echo-inbox via hook.
    // The hook fires on every authentication so echo-inbox re-subscribes after logout+login.
    watch(
      () => authStore.isAuthenticated,
      async (isAuth) => {
        if (isAuth) {
          await initEcho()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (nuxtApp as any).callHook('echo:ready')
        }
      },
      { immediate: true },
    )

    // Provide the stable proxy once — never re-provided, avoids "Cannot redefine property"
    return {
      provide: {
        echo: _echoProxy,
      },
    }
  },
})
