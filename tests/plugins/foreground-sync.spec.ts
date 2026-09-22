/**
 * Unit tests for `plugins/foreground-sync.client.ts`.
 *
 * Capacitor is mocked to control the native/web branch directly (mirrors
 * `motionPauseOrchestrator.spec.ts`'s pattern), since there's no real
 * native bridge under Vitest. `App.addListener` must resolve — the plugin
 * calls `.catch()` on it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupNuxtMocks, cleanupNuxtMocks, createMockAuthStore, createMockUserSync, createMockInboxReconcile } from '../helpers/nuxtMocks'

const { mockIsNativePlatform, mockAddListener } = vi.hoisted(() => ({
  mockIsNativePlatform: vi.fn(() => false),
  mockAddListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mockIsNativePlatform },
}))

vi.mock('@capacitor/app', () => ({
  App: { addListener: mockAddListener },
}))

/** Minimal fake `document`: mutable `hidden` + a real listener registry. */
function makeFakeDocument() {
  const listeners = new Set<() => void>()
  return {
    hidden: false,
    addEventListener: vi.fn((_event: string, cb: () => void) => {
      listeners.add(cb)
    }),
    removeEventListener: vi.fn((_event: string, cb: () => void) => {
      listeners.delete(cb)
    }),
    fireVisibilityChange(hidden: boolean) {
      this.hidden = hidden
      for (const cb of listeners) cb()
    },
  }
}

describe('foreground-sync plugin', () => {
  let fakeDocument: ReturnType<typeof makeFakeDocument>

  beforeEach(() => {
    vi.useFakeTimers()
    mockIsNativePlatform.mockReturnValue(false)
    mockAddListener.mockClear()
    fakeDocument = makeFakeDocument()
    vi.stubGlobal('document', fakeDocument)
    vi.stubGlobal('defineNuxtPlugin', (fn: () => void) => fn)
  })

  afterEach(() => {
    cleanupNuxtMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  async function loadPlugin() {
    const plugin = (await import('../../app/plugins/foreground-sync.client')).default as unknown as () => void
    plugin()
    // Debounce clock starts at setup (boot already synced) — step past it.
    vi.advanceTimersByTime(10_000)
  }

  it('web visibility → syncUser and reconcileInbox called', async () => {
    const userSync = createMockUserSync()
    const inboxReconcile = createMockInboxReconcile()
    setupNuxtMocks({ authStore: createMockAuthStore(), userSync, inboxReconcile })

    await loadPlugin()
    fakeDocument.fireVisibilityChange(false)

    expect(userSync.syncUser).toHaveBeenCalledTimes(1)
    expect(inboxReconcile.reconcileInbox).toHaveBeenCalledTimes(1)
    expect(inboxReconcile.reconcileInbox).toHaveBeenCalledWith('foreground')
  })

  it('debounce: a second foreground within 10s is skipped', async () => {
    const userSync = createMockUserSync()
    const inboxReconcile = createMockInboxReconcile()
    setupNuxtMocks({ authStore: createMockAuthStore(), userSync, inboxReconcile })

    await loadPlugin()
    fakeDocument.fireVisibilityChange(false)
    fakeDocument.fireVisibilityChange(true)
    fakeDocument.fireVisibilityChange(false)

    expect(userSync.syncUser).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(10_000)
    fakeDocument.fireVisibilityChange(true)
    fakeDocument.fireVisibilityChange(false)

    expect(userSync.syncUser).toHaveBeenCalledTimes(2)
  })

  it('going hidden does not trigger a sync', async () => {
    const userSync = createMockUserSync()
    const inboxReconcile = createMockInboxReconcile()
    setupNuxtMocks({ authStore: createMockAuthStore(), userSync, inboxReconcile })

    await loadPlugin()
    fakeDocument.fireVisibilityChange(true)

    expect(userSync.syncUser).not.toHaveBeenCalled()
    expect(inboxReconcile.reconcileInbox).not.toHaveBeenCalled()
  })

  it('unauthenticated user: foreground does not sync', async () => {
    const userSync = createMockUserSync()
    const inboxReconcile = createMockInboxReconcile()
    setupNuxtMocks({ authStore: createMockAuthStore({ token: null }), userSync, inboxReconcile })

    await loadPlugin()
    fakeDocument.fireVisibilityChange(false)

    expect(userSync.syncUser).not.toHaveBeenCalled()
    expect(inboxReconcile.reconcileInbox).not.toHaveBeenCalled()
  })

  it('native: appStateChange isActive → syncUser called', async () => {
    mockIsNativePlatform.mockReturnValue(true)
    const userSync = createMockUserSync()
    const inboxReconcile = createMockInboxReconcile()
    setupNuxtMocks({ authStore: createMockAuthStore(), userSync, inboxReconcile })

    await loadPlugin()

    expect(mockAddListener).toHaveBeenCalledWith('appStateChange', expect.any(Function))
    const call = mockAddListener.mock.calls[0] as unknown as [string, (state: { isActive: boolean }) => void]
    const callback = call[1]

    callback({ isActive: false })
    expect(userSync.syncUser).not.toHaveBeenCalled()

    callback({ isActive: true })
    expect(userSync.syncUser).toHaveBeenCalledTimes(1)
    expect(inboxReconcile.reconcileInbox).toHaveBeenCalledWith('foreground')
  })
})
