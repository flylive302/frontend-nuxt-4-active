// ========================================
// useMissionFinale — State Machine Tests
// ========================================
// Covers issue-22 AC4: useMissionFinale state-machine tests pass
//
// Phases under test:
//   idle → warning (time < threshold, self in Top-N)
//   warning → burst (finaleReady fires)
//   burst → reveal (burstComplete called)
//   any → dismissed (dismiss called)
//   once-per-instance guard (session + localStorage)
//   already-finalized-on-mount (skip straight to reveal or dismissed)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, computed } from 'vue'

// ========================================
// Module mocks
// ========================================

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

// ========================================
// Store mock factory
// ========================================

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    ranking_poll_seconds: 30,
    finale_poll_seconds: 3,
    finale_warning_seconds: 180,
    ranking_depth: 3,
    announcement_sounds: { weekly: null, monthly: null },
    ...overrides,
  }
}

function resetsAtMs(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString()
}

function makeMissionStore(opts: {
  self?: { rank: number } | null
  rankingDepth?: number
  finaleReadyInitial?: boolean
  resetsAt?: string
  instanceKey?: string | null
  finaleSnapshotKey?: string | null
} = {}) {
  const {
    self = { rank: 2 },
    rankingDepth = 3,
    finaleReadyInitial = false,
    resetsAt,
    instanceKey = 'w-2026-23',
    finaleSnapshotKey = null,
  } = opts

  const finaleReady = ref<Record<string, boolean>>({
    weekly: finaleReadyInitial,
    monthly: false,
  })

  const config = makeConfig({ ranking_depth: rankingDepth })

  return {
    progressFor: vi.fn(() => ({ config })),
    leaderboardFor: vi.fn(() =>
      resetsAt
        ? { resets_at: resetsAt, entries: [], self, instance_key: instanceKey }
        : null,
    ),
    isFinaleReadyFor: vi.fn((tf: string) => finaleReady.value[tf] ?? false),
    finaleSnapshotFor: vi.fn(() =>
      finaleReadyInitial || finaleSnapshotKey
        ? { instance_key: finaleSnapshotKey ?? instanceKey, entries: [] }
        : null,
    ),
    setLeaderboard: vi.fn(),
    setFinaleReady: vi.fn(),
    // Helper for tests to trigger finale-ready
    _triggerFinaleReady: (tf: string) => {
      finaleReady.value[tf] = true
    },
  }
}

// ========================================
// localStorage mock
// ========================================

const mockStorage: Record<string, string> = {}

function setupLocalStorage() {
  ;(globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => mockStorage[k] ?? null,
    setItem: (k: string, v: string) => { mockStorage[k] = v },
    removeItem: (k: string) => { Reflect.deleteProperty(mockStorage, k) },
  }
}

function clearLocalStorage() {
  for (const k of Object.keys(mockStorage)) Reflect.deleteProperty(mockStorage, k)
}

// ========================================
// Setup / teardown
// ========================================

let useMissionFinale: typeof import('~/composables/recharge/useMissionFinale')['useMissionFinale']
let missionStore: ReturnType<typeof makeMissionStore>

beforeEach(async () => {
  vi.useFakeTimers()
  clearLocalStorage()
  setupLocalStorage()

  missionStore = makeMissionStore({
    self: { rank: 2 },
    rankingDepth: 3,
    resetsAt: resetsAtMs(60_000),  // 60 s → inside 180 s warning window
  })

  ;(globalThis as Record<string, unknown>).useMissionStore = () => missionStore
  ;(globalThis as Record<string, unknown>).ref = ref
  ;(globalThis as Record<string, unknown>).computed = computed
  ;(globalThis as Record<string, unknown>).readonly = <T>(v: T) => v
  ;(globalThis as Record<string, unknown>).watch = vi.fn()
  ;(globalThis as Record<string, unknown>).onMounted = (fn: () => void) => fn()
  ;(globalThis as Record<string, unknown>).onUnmounted = vi.fn()

  vi.resetModules()
  const mod = await import('~/composables/recharge/useMissionFinale')
  useMissionFinale = mod.useMissionFinale
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetModules()
  const keys = [
    'useMissionStore', 'ref', 'computed', 'readonly',
    'watch', 'onMounted', 'onUnmounted', 'localStorage',
  ]
  for (const k of keys) Reflect.deleteProperty(globalThis, k)
  clearLocalStorage()
})

// ========================================
// idle → warning
// ========================================

describe('idle → warning', () => {
  it('transitions to warning within the window for a Top-N user', () => {
    const { phase } = useMissionFinale('weekly')
    // onMounted called immediately (calls tick()); self.rank=2 ≤ ranking_depth=3
    expect(phase.value).toBe('warning')
  })

  it('stays idle when self is not in Top-N', async () => {
    missionStore = makeMissionStore({ self: { rank: 5 }, resetsAt: resetsAtMs(60_000) })
    ;(globalThis as Record<string, unknown>).useMissionStore = () => missionStore

    vi.resetModules()
    const mod = await import('~/composables/recharge/useMissionFinale')
    const { phase } = mod.useMissionFinale('weekly')

    expect(phase.value).toBe('idle')
  })

  it('stays idle when self is null (user has no volume)', async () => {
    missionStore = makeMissionStore({ self: null, resetsAt: resetsAtMs(60_000) })
    ;(globalThis as Record<string, unknown>).useMissionStore = () => missionStore

    vi.resetModules()
    const mod = await import('~/composables/recharge/useMissionFinale')
    const { phase } = mod.useMissionFinale('weekly')

    expect(phase.value).toBe('idle')
  })

  it('stays idle when outside the warning window', async () => {
    missionStore = makeMissionStore({ self: { rank: 1 }, resetsAt: resetsAtMs(10 * 60 * 1000) })
    ;(globalThis as Record<string, unknown>).useMissionStore = () => missionStore

    vi.resetModules()
    const mod = await import('~/composables/recharge/useMissionFinale')
    const { phase } = mod.useMissionFinale('weekly')

    expect(phase.value).toBe('idle')
  })

  it('stays idle when leaderboard is null', async () => {
    missionStore = makeMissionStore({ resetsAt: undefined })
    ;(globalThis as Record<string, unknown>).useMissionStore = () => missionStore

    vi.resetModules()
    const mod = await import('~/composables/recharge/useMissionFinale')
    const { phase } = mod.useMissionFinale('weekly')

    expect(phase.value).toBe('idle')
  })
})

// ========================================
// warning → burst
// ========================================

describe('warning → burst', () => {
  it('transitions to burst when finaleReady fires during warning phase', async () => {
    const { phase } = useMissionFinale('weekly')
    expect(phase.value).toBe('warning')

    // Trigger finale-ready in the store
    missionStore._triggerFinaleReady('weekly')

    // Advance 1 s to fire the next tick
    await vi.advanceTimersByTimeAsync(1_000)
    expect(phase.value).toBe('burst')
  })

  it('does not transition to burst for a different timeframe', async () => {
    const { phase } = useMissionFinale('weekly')
    expect(phase.value).toBe('warning')

    missionStore._triggerFinaleReady('monthly') // wrong timeframe

    await vi.advanceTimersByTimeAsync(1_000)
    expect(phase.value).toBe('warning')
  })
})

// ========================================
// burst → reveal
// ========================================

describe('burst → reveal', () => {
  it('transitions to reveal when burstComplete() is called', async () => {
    const { phase, burstComplete } = useMissionFinale('weekly')
    expect(phase.value).toBe('warning')

    missionStore._triggerFinaleReady('weekly')
    await vi.advanceTimersByTimeAsync(1_000)
    expect(phase.value).toBe('burst')

    burstComplete()
    expect(phase.value).toBe('reveal')
  })

  it('ignores burstComplete() when not in burst phase', () => {
    const { phase, burstComplete } = useMissionFinale('weekly')
    expect(phase.value).toBe('warning')

    burstComplete() // called from 'warning', not 'burst'
    expect(phase.value).toBe('warning')
  })
})

// ========================================
// dismiss()
// ========================================

describe('dismiss()', () => {
  it('transitions to dismissed from warning and writes localStorage', () => {
    const { phase, dismiss } = useMissionFinale('weekly')
    expect(phase.value).toBe('warning')

    dismiss()
    expect(phase.value).toBe('dismissed')
    expect(mockStorage['mf_seen_weekly_w-2026-23']).toBe('1')
  })

  it('transitions to dismissed from reveal', async () => {
    const { phase, burstComplete, dismiss } = useMissionFinale('weekly')
    missionStore._triggerFinaleReady('weekly')
    await vi.advanceTimersByTimeAsync(1_000)
    burstComplete()
    expect(phase.value).toBe('reveal')

    dismiss()
    expect(phase.value).toBe('dismissed')
  })
})

// ========================================
// Once-per-instance guard
// ========================================

describe('once-per-instance guard', () => {
  it('does not reopen after dismiss (localStorage guard)', async () => {
    const { dismiss } = useMissionFinale('weekly')
    dismiss()
    expect(mockStorage['mf_seen_weekly_w-2026-23']).toBe('1')

    // Fresh composable for the same instance
    vi.resetModules()
    const mod = await import('~/composables/recharge/useMissionFinale')
    const { phase } = mod.useMissionFinale('weekly')

    // First tick sees localStorage dismiss → goes to 'dismissed' (not 'warning')
    expect(phase.value).toBe('dismissed')
  })
})

// ========================================
// Already-finalized on mount
// ========================================

describe('already-finalized on mount', () => {
  it('starts in reveal when store is already finalized', async () => {
    missionStore = makeMissionStore({
      finaleReadyInitial: true,
      instanceKey: 'w-2026-23',
    })
    ;(globalThis as Record<string, unknown>).useMissionStore = () => missionStore

    vi.resetModules()
    const mod = await import('~/composables/recharge/useMissionFinale')
    const { phase } = mod.useMissionFinale('weekly')

    expect(phase.value).toBe('reveal')
  })

  it('starts in dismissed when instance was already dismissed', async () => {
    mockStorage['mf_seen_weekly_w-2026-23'] = '1'

    missionStore = makeMissionStore({
      finaleReadyInitial: true,
      instanceKey: 'w-2026-23',
      finaleSnapshotKey: 'w-2026-23',
    })
    ;(globalThis as Record<string, unknown>).useMissionStore = () => missionStore

    vi.resetModules()
    const mod = await import('~/composables/recharge/useMissionFinale')
    const { phase } = mod.useMissionFinale('weekly')

    expect(phase.value).toBe('dismissed')
  })
})

// ========================================
// isOpen computed
// ========================================

describe('isOpen', () => {
  it('is true during warning, burst, and reveal phases', async () => {
    const { phase, isOpen, burstComplete } = useMissionFinale('weekly')

    expect(phase.value).toBe('warning')
    expect(isOpen.value).toBe(true)

    missionStore._triggerFinaleReady('weekly')
    await vi.advanceTimersByTimeAsync(1_000)
    expect(isOpen.value).toBe(true) // burst

    burstComplete()
    expect(isOpen.value).toBe(true) // reveal
  })

  it('is false when dismissed', () => {
    const { isOpen, dismiss } = useMissionFinale('weekly')
    dismiss()
    expect(isOpen.value).toBe(false)
  })
})
