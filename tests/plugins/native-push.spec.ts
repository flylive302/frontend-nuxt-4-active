/**
 * Unit tests for `plugins/native-push.client.ts`.
 *
 * Covers the cold-start tap race (capacitor-06 / boot-and-asset-delivery 08):
 * a launch tap delivered before `app:mounted` fires must be held and replayed
 * once mounted has happened, not navigated immediately (Nuxt's router replay
 * on `app:created` would clobber an early navigateTo).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { watch } from 'vue'

type TapCallback = (action: { notification: { data?: { url?: unknown } } }) => void

const { mockIsNativePlatform, mockAddListener, mockRegister } = vi.hoisted(() => ({
  mockIsNativePlatform: vi.fn(() => true),
  mockAddListener: vi.fn((_event: string, _cb: (action: { notification: { data?: { url?: unknown } } }) => void) => Promise.resolve({ remove: vi.fn() })),
  mockRegister: vi.fn(() => Promise.resolve()),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mockIsNativePlatform },
}))

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: { addListener: mockAddListener },
}))

vi.mock('~/composables/notification/usePushSubscription', () => ({
  usePushSubscription: () => ({ register: mockRegister }),
}))

const navigateTo = vi.fn(() => Promise.resolve())

describe('native-push plugin', () => {
  beforeEach(() => {
    mockIsNativePlatform.mockReturnValue(true)
    mockAddListener.mockClear()
    mockRegister.mockClear()
    navigateTo.mockClear()

    vi.stubGlobal('defineNuxtPlugin', (def: unknown) => def)
    vi.stubGlobal('navigateTo', navigateTo)
    vi.stubGlobal('watch', watch)
    vi.stubGlobal('useAuthStore', () => ({ isAuthenticated: false }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  /** Fake nuxtApp: runWithContext just runs the fn, hookOnce stores callbacks by name. */
  function makeFakeNuxtApp() {
    const hookOnceCallbacks = new Map<string, () => void>()
    return {
      runWithContext: (fn: () => unknown) => fn(),
      hooks: {
        hookOnce: (name: string, cb: () => void) => {
          hookOnceCallbacks.set(name, cb)
        },
      },
      fireMounted() {
        hookOnceCallbacks.get('app:mounted')?.()
      },
    }
  }

  async function loadPlugin(nuxtApp: ReturnType<typeof makeFakeNuxtApp>) {
    const plugin = (await import('../../app/plugins/native-push.client')).default as unknown as {
      setup: (app: unknown) => Promise<void>
    }
    await plugin.setup(nuxtApp)
  }

  it('tap before mount: holds the url, navigates only once app:mounted fires', async () => {
    const nuxtApp = makeFakeNuxtApp()
    await loadPlugin(nuxtApp)

    const tapCallback = mockAddListener.mock.calls[0]![1] as TapCallback
    tapCallback({ notification: { data: { url: '/inbox/42' } } })

    expect(navigateTo).not.toHaveBeenCalled()

    nuxtApp.fireMounted()

    expect(navigateTo).toHaveBeenCalledTimes(1)
    expect(navigateTo).toHaveBeenCalledWith('/inbox/42')
  })

  it('tap after mount: navigates immediately', async () => {
    const nuxtApp = makeFakeNuxtApp()
    await loadPlugin(nuxtApp)
    nuxtApp.fireMounted()

    const tapCallback = mockAddListener.mock.calls[0]![1] as TapCallback
    tapCallback({ notification: { data: { url: '/inbox/7' } } })

    expect(navigateTo).toHaveBeenCalledTimes(1)
    expect(navigateTo).toHaveBeenCalledWith('/inbox/7')
  })

  it('empty url is ignored', async () => {
    const nuxtApp = makeFakeNuxtApp()
    await loadPlugin(nuxtApp)
    nuxtApp.fireMounted()

    const tapCallback = mockAddListener.mock.calls[0]![1] as TapCallback
    tapCallback({ notification: { data: { url: '' } } })
    tapCallback({ notification: { data: {} } })

    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('web platform: addListener is never called', async () => {
    mockIsNativePlatform.mockReturnValue(false)
    const nuxtApp = makeFakeNuxtApp()
    await loadPlugin(nuxtApp)

    expect(mockAddListener).not.toHaveBeenCalled()
  })

  it('two taps before mount: only the last url is opened (single pending slot)', async () => {
    const nuxtApp = makeFakeNuxtApp()
    await loadPlugin(nuxtApp)

    const tapCallback = mockAddListener.mock.calls[0]![1] as TapCallback
    tapCallback({ notification: { data: { url: '/inbox/1' } } })
    tapCallback({ notification: { data: { url: '/inbox/2' } } })

    expect(navigateTo).not.toHaveBeenCalled()

    nuxtApp.fireMounted()

    expect(navigateTo).toHaveBeenCalledTimes(1)
    expect(navigateTo).toHaveBeenCalledWith('/inbox/2')
  })
})
