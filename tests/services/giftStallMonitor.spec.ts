/**
 * Unit tests for the gift stall monitor (msab-load-stability 11).
 *
 * Exercises the `PerformanceObserver('longtask')` wiring by driving the
 * registered callback directly (jsdom has no real longtask support), and
 * asserts the Sentry report + throttle + isPlaying/queue-depth context.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'

const { mockSentry } = vi.hoisted(() => ({
  mockSentry: {
    captureMessage: vi.fn(),
  },
}))

vi.mock('@sentry/nuxt', () => mockSentry)
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

/** Captures the callback passed to `new PerformanceObserver(cb)` so tests can drive it. */
let observeSpy: ReturnType<typeof vi.fn>
let disconnectSpy: ReturnType<typeof vi.fn>
let registeredCallback: ((list: { getEntries: () => { duration: number }[] }) => void) | null

function installFakePerformanceObserver(supported: string[] = ['longtask']) {
  observeSpy = vi.fn()
  disconnectSpy = vi.fn()
  registeredCallback = null

  class FakePerformanceObserver {
    static supportedEntryTypes = supported
    constructor(cb: (list: { getEntries: () => { duration: number }[] }) => void) {
      registeredCallback = cb
    }
    observe = observeSpy
    disconnect = disconnectSpy
  }

  vi.stubGlobal('PerformanceObserver', FakePerformanceObserver)
}

function fireLongTasks(durations: number[]) {
  registeredCallback!({ getEntries: () => durations.map((duration) => ({ duration })) })
}

beforeEach(() => {
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  setActivePinia(createPinia())
  ;(globalThis as Record<string, unknown>).useGiftStore = undefined
  vi.resetModules()
  mockSentry.captureMessage.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('giftStallMonitor', () => {
  it('does nothing when PerformanceObserver is unsupported (no longtask entry type)', async () => {
    installFakePerformanceObserver([]) // no 'longtask' in supportedEntryTypes
    const { init } = await import('../../app/services/giftStallMonitor')

    init()

    expect(observeSpy).not.toHaveBeenCalled()
  })

  it('does nothing when PerformanceObserver is undefined entirely', async () => {
    vi.stubGlobal('PerformanceObserver', undefined)
    const { init } = await import('../../app/services/giftStallMonitor')

    expect(() => init()).not.toThrow()
  })

  it('observes longtask entries on init', async () => {
    installFakePerformanceObserver()
    const { init } = await import('../../app/services/giftStallMonitor')

    init()

    expect(observeSpy).toHaveBeenCalledWith({ type: 'longtask', buffered: true })
  })

  it('reports a sustained stall (>=200ms) to Sentry with the injected load context', async () => {
    installFakePerformanceObserver()

    const { init } = await import('../../app/services/giftStallMonitor')
    // Store-free service: the load context arrives via the getter the plugin
    // injects (services must not import stores).
    init(() => ({ giftQueueDepth: 1, isPlaying: true }))

    fireLongTasks([250])

    expect(mockSentry.captureMessage).toHaveBeenCalledTimes(1)
    const [message, context] = mockSentry.captureMessage.mock.calls[0]!
    expect(message).toMatch(/stall/i)
    expect(context.level).toBe('warning')
    expect(context.extra.longestTaskMs).toBe(250)
    expect(context.extra.isPlaying).toBe(true)
    expect(context.extra.giftQueueDepth).toBe(1)

    Reflect.deleteProperty(globalThis, 'useGiftStore')
  })

  it('does not report short tasks below the stall threshold', async () => {
    installFakePerformanceObserver()
    const { useGiftStore } = await import('../../app/stores/gift')
    ;(globalThis as Record<string, unknown>).useGiftStore = useGiftStore

    const { init } = await import('../../app/services/giftStallMonitor')
    init()

    fireLongTasks([50])

    expect(mockSentry.captureMessage).not.toHaveBeenCalled()
    Reflect.deleteProperty(globalThis, 'useGiftStore')
  })

  it('throttles repeated reports to at most one per throttle window', async () => {
    vi.useFakeTimers()
    installFakePerformanceObserver()
    const { useGiftStore } = await import('../../app/stores/gift')
    ;(globalThis as Record<string, unknown>).useGiftStore = useGiftStore

    const { init } = await import('../../app/services/giftStallMonitor')
    init()

    fireLongTasks([300])
    fireLongTasks([400])
    fireLongTasks([500])

    expect(mockSentry.captureMessage).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(60_000)
    fireLongTasks([300])

    expect(mockSentry.captureMessage).toHaveBeenCalledTimes(2)
    Reflect.deleteProperty(globalThis, 'useGiftStore')
  })
})
