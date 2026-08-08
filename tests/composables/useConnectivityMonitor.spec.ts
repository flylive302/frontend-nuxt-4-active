// ========================================
// Connectivity Monitor Tests (ADR 0026)
// ========================================
//
// The bug these exist to prevent is not a wrong behaviour but a MISSING one:
// `onConnectionChange` shipped with zero subscribers and `/offline` with zero
// callers, and nothing in the suite failed. The first test below is the wire
// itself — it fails if the subscription is ever removed again.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref, watch } from 'vue'

// ========================================
// Mocks
// ========================================

const subscribers: Array<(info: { isOnline: boolean }) => void> = []
const unsubscribe = vi.fn()

vi.mock('~/services/networkDetector', () => ({
  onConnectionChange: (cb: (info: { isOnline: boolean }) => void) => {
    subscribers.push(cb)
    return unsubscribe
  },
}))

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

let probeHealth: ReturnType<typeof vi.fn>

/** Drive the network detector as if the OS reported a change. */
function emitConnection(isOnline: boolean): void {
  subscribers.forEach((cb) => cb({ isOnline }))
}

beforeEach(async () => {
  vi.useFakeTimers()
  vi.resetModules()
  subscribers.length = 0
  unsubscribe.mockClear()

  setActivePinia(createPinia())
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)

  probeHealth = vi.fn().mockResolvedValue(true)
  const { useConnectivityStore } = await import('~/stores/connectivity')
  vi.stubGlobal('useConnectivityStore', useConnectivityStore)
  vi.stubGlobal('useConnectivityProbe', () => ({ probeHealth }))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function monitor() {
  const { useConnectivityMonitor } = await import('~/composables/shared/useConnectivityMonitor')
  return useConnectivityMonitor()
}

// ========================================
// The wire
// ========================================

describe('useConnectivityMonitor — the missing wire', () => {
  it('subscribes to the network detector (it had ZERO subscribers before)', async () => {
    const m = await monitor()

    m.start()

    expect(subscribers.length).toBe(1)
  })

  it('enters the offline state when the detector reports a drop', async () => {
    const { useConnectivityStore } = await import('~/stores/connectivity')
    const m = await monitor()
    m.start()

    emitConnection(false)

    expect(useConnectivityStore().isOffline).toBe(true)
  })

  it('unsubscribes on teardown', async () => {
    const m = await monitor()

    m.start()()

    expect(unsubscribe).toHaveBeenCalled()
  })
})

// ========================================
// Enter / exit asymmetry
// ========================================

describe('useConnectivityMonitor — exit is probe-only', () => {
  it('does NOT go online just because the link came back', async () => {
    // The captive-portal case: `navigator.onLine` flips true while the API is
    // still unreachable. Trusting the event here would clear the banner over a
    // dead network — the exact failure this design rejects.
    const { useConnectivityStore } = await import('~/stores/connectivity')
    const store = useConnectivityStore()
    const m = await monitor()
    m.start()

    emitConnection(false)
    probeHealth.mockResolvedValue(false)
    emitConnection(true)
    await vi.advanceTimersByTimeAsync(0)

    expect(store.isOffline).toBe(true)
  })

  it('goes online when the probe confirms the API answers', async () => {
    const { useConnectivityStore } = await import('~/stores/connectivity')
    const store = useConnectivityStore()
    const m = await monitor()
    m.start()

    emitConnection(false)
    emitConnection(true)
    await vi.advanceTimersByTimeAsync(0)

    expect(store.isOffline).toBe(false)
    expect(store.restoredAt).toBeGreaterThan(0)
  })

  it('keeps polling on a backoff while offline, so a captive portal still recovers', async () => {
    // No `online` event is ever emitted here — only the timer.
    const { useConnectivityStore } = await import('~/stores/connectivity')
    const store = useConnectivityStore()
    probeHealth.mockResolvedValue(false)
    const m = await monitor()
    m.start()

    emitConnection(false)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(probeHealth).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(4_000)
    expect(probeHealth).toHaveBeenCalledTimes(2)

    probeHealth.mockResolvedValue(true)
    await vi.advanceTimersByTimeAsync(8_000)

    expect(store.isOffline).toBe(false)
  })

  it('stops polling once recovered', async () => {
    const m = await monitor()
    m.start()

    emitConnection(false)
    await vi.advanceTimersByTimeAsync(2_000)
    const callsAtRecovery = probeHealth.mock.calls.length

    await vi.advanceTimersByTimeAsync(120_000)

    expect(probeHealth).toHaveBeenCalledTimes(callsAtRecovery)
  })
})

// ========================================
// The API-failure entry path
// ========================================

describe('useConnectivityMonitor — API failure entry', () => {
  it('ignores a single network failure', async () => {
    const { useConnectivityStore } = await import('~/stores/connectivity')
    const store = useConnectivityStore()
    const m = await monitor()
    m.start()

    store.recordFailure()
    await vi.advanceTimersByTimeAsync(0)

    expect(store.isOffline).toBe(false)
  })

  it('enters offline on consecutive network failures even though the link says online', async () => {
    const { useConnectivityStore } = await import('~/stores/connectivity')
    const store = useConnectivityStore()
    const m = await monitor()
    m.start()

    store.recordFailure()
    store.recordFailure()
    await vi.advanceTimersByTimeAsync(0)

    expect(store.isOffline).toBe(true)
  })
})

// ========================================
// Manual retry
// ========================================

describe('useConnectivityMonitor — retryNow', () => {
  it('probes immediately rather than waiting for the backoff', async () => {
    probeHealth.mockResolvedValue(false)
    const m = await monitor()
    m.start()
    emitConnection(false)

    probeHealth.mockResolvedValue(true)
    const recovered = await m.retryNow()

    expect(recovered).toBe(true)
  })

  it('does nothing when the app is not offline', async () => {
    const m = await monitor()
    m.start()

    const recovered = await m.retryNow()

    expect(recovered).toBe(false)
    expect(probeHealth).not.toHaveBeenCalled()
  })
})
