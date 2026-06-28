// ========================================
// useRechargeLeaderboard Composable Tests
// ========================================
// Covers issue-21 finale mechanics:
//   AC1: poll rate switches to finale_poll_seconds inside finale_warning_seconds window
//   AC3: mission.finale.ready stops polling and fetches the honor-wall snapshot once

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, computed } from 'vue'

// ========================================
// Module mocks (hoisted — must precede imports of the SUT)
// ========================================

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

vi.mock('@vueuse/core', () => ({
  useDocumentVisibility: () => ref('visible'),
}))

// Mock useApi statically so useRuntimeConfig is never reached
let apiMock = vi.fn()
vi.mock('~/composables/shared/useApi', () => ({
  useApi: () => ({
    api: (...args: unknown[]) => apiMock(...args),
    normalizeError: (e: unknown) => ({ message: String(e) }),
  }),
}))

// ========================================
// Helpers
// ========================================

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    ranking_poll_seconds: 30,
    finale_poll_seconds: 3,
    finale_warning_seconds: 180,
    ...overrides,
  }
}

function resetsAtMs(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString()
}

function makeMissionStore(progressConfig = makeConfig(), resetsAt?: string) {
  const finaleReady = ref<Record<string, boolean>>({})
  const finaleSnapshots = ref<Record<string, unknown>>({})

  return {
    progressFor: vi.fn(() => ({ config: progressConfig })),
    leaderboardFor: vi.fn(() =>
      resetsAt ? { resets_at: resetsAt, entries: [], self: null } : null,
    ),
    setLeaderboard: vi.fn(),
    setFinaleReady: vi.fn((tf: string, data: unknown) => {
      finaleSnapshots.value[tf] = data
      finaleReady.value[tf] = true
    }),
    isFinaleReadyFor: vi.fn((tf: string) => finaleReady.value[tf] ?? false),
    finaleSnapshotFor: vi.fn((tf: string) => finaleSnapshots.value[tf] ?? null),
  }
}

function makeEcho() {
  const listeners: Record<string, (payload: unknown) => void> = {}
  const channel = {
    listen: vi.fn((event: string, cb: (p: unknown) => void) => {
      listeners[event] = cb
      return channel
    }),
    stopListening: vi.fn(),
    _trigger: (event: string, payload: unknown) => listeners[event]?.(payload),
  }
  return {
    private: vi.fn(() => channel),
    channel,
  }
}

// ========================================
// Setup / teardown
// ========================================

let missionStore: ReturnType<typeof makeMissionStore>
let echo: ReturnType<typeof makeEcho>

beforeEach(async () => {
  vi.useFakeTimers()

  apiMock = vi.fn().mockImplementation((url: string) => {
    if (url.includes('honor-wall')) {
      return Promise.resolve({ data: { weekly: { instance_key: 'w1', entries: [] }, monthly: { instance_key: 'm1', entries: [] } } })
    }
    return Promise.resolve({ data: { entries: [], self: null, resets_at: new Date().toISOString() } })
  })

  missionStore = makeMissionStore()
  echo = makeEcho()

  ;(globalThis as Record<string, unknown>).useMissionStore = () => missionStore
  ;(globalThis as Record<string, unknown>).useAuthStore = () => ({ user: { id: 42 } })
  ;(globalThis as Record<string, unknown>).useNuxtApp = () => ({ $echo: echo })
  ;(globalThis as Record<string, unknown>).ref = ref
  ;(globalThis as Record<string, unknown>).computed = computed
  ;(globalThis as Record<string, unknown>).readonly = <T>(v: T) => v
  ;(globalThis as Record<string, unknown>).onMounted = (fn: () => void) => fn()
  ;(globalThis as Record<string, unknown>).onUnmounted = vi.fn()

  vi.resetModules()
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetModules()
  const keys = [
    'useMissionStore', 'useAuthStore', 'useNuxtApp',
    'ref', 'computed', 'readonly', 'onMounted', 'onUnmounted',
  ]
  for (const key of keys) Reflect.deleteProperty(globalThis, key)
})

// ========================================
// AC1: Adaptive poll rate
// ========================================

describe('adaptive poll rate', () => {
  it('uses ranking_poll_seconds when outside the finale window', async () => {
    missionStore = makeMissionStore(makeConfig(), resetsAtMs(10 * 60 * 1000)) // 10 min out
    ;(globalThis as Record<string, unknown>).useMissionStore = () => missionStore

    vi.resetModules()
    const mod = await import('~/composables/recharge/useRechargeLeaderboard')
    mod.useRechargeLeaderboard('weekly')

    await vi.runAllTicks()

    // Advance 30 s — exactly one normal-rate poll tick
    await vi.advanceTimersByTimeAsync(30_000)
    expect(apiMock).toHaveBeenCalledTimes(2) // mount + 1 poll
  })

  it('uses finale_poll_seconds when inside the finale window', async () => {
    missionStore = makeMissionStore(makeConfig(), resetsAtMs(60_000)) // 60s out → inside 180s window
    ;(globalThis as Record<string, unknown>).useMissionStore = () => missionStore

    vi.resetModules()
    const mod = await import('~/composables/recharge/useRechargeLeaderboard')
    mod.useRechargeLeaderboard('weekly')

    await vi.runAllTicks()

    // Advance 3 s — the fast poll rate fires; 30 s would be needed for normal rate
    await vi.advanceTimersByTimeAsync(3_000)
    expect(apiMock).toHaveBeenCalledTimes(2) // mount + 1 fast tick
  })
})

// ========================================
// AC3: mission.finale.ready
// ========================================

describe('mission.finale.ready handling', () => {
  it('stops polling and fetches honor-wall snapshot for the matching timeframe', async () => {
    missionStore = makeMissionStore(makeConfig(), resetsAtMs(60_000))
    ;(globalThis as Record<string, unknown>).useMissionStore = () => missionStore

    vi.resetModules()
    const mod = await import('~/composables/recharge/useRechargeLeaderboard')
    mod.useRechargeLeaderboard('weekly')

    await vi.runAllTicks()

    expect(echo.private).toHaveBeenCalledWith('user.42')
    expect(echo.channel.listen).toHaveBeenCalledWith('.mission.finale.ready', expect.any(Function))

    // Fire finale.ready for the matching timeframe
    echo.channel._trigger('.mission.finale.ready', { timeframe: 'weekly', instance_key: 'w-2026-23' })
    await vi.runAllTicks()

    // Honor-wall endpoint fetched exactly once
    const honorWallCalls = apiMock.mock.calls.filter((args: unknown[]) => String(args[0]).includes('honor-wall'))
    expect(honorWallCalls).toHaveLength(1)

    // Store updated with the weekly snapshot
    expect(missionStore.setFinaleReady).toHaveBeenCalledWith('weekly', expect.objectContaining({ instance_key: 'w1' }))

    // No more polls after finale — advance 60 s (would fire 20 fast ticks if still polling)
    const callsAtFinale = apiMock.mock.calls.length
    await vi.advanceTimersByTimeAsync(60_000)
    expect(apiMock.mock.calls.length).toBe(callsAtFinale)
  })

  it('ignores finale.ready for a different timeframe and keeps polling', async () => {
    missionStore = makeMissionStore(makeConfig(), resetsAtMs(60_000))
    ;(globalThis as Record<string, unknown>).useMissionStore = () => missionStore

    vi.resetModules()
    const mod = await import('~/composables/recharge/useRechargeLeaderboard')
    mod.useRechargeLeaderboard('weekly') // weekly composable

    await vi.runAllTicks()

    // Fire for monthly (wrong timeframe)
    echo.channel._trigger('.mission.finale.ready', { timeframe: 'monthly', instance_key: 'm-2026-06' })
    await vi.runAllTicks()

    // No honor-wall fetch, no finaleReady
    const honorWallCalls = apiMock.mock.calls.filter((args: unknown[]) => String(args[0]).includes('honor-wall'))
    expect(honorWallCalls).toHaveLength(0)
    expect(missionStore.setFinaleReady).not.toHaveBeenCalled()

    // Polling continues (3 s fast-poll tick fires)
    await vi.advanceTimersByTimeAsync(3_000)
    expect(apiMock.mock.calls.length).toBeGreaterThan(1)
  })
})
