// ========================================
// Connectivity Store Tests (ADR 0026)
// ========================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'

import { OFFLINE_FAILURE_THRESHOLD } from '../../app/stores/connectivity'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

beforeEach(() => {
  setActivePinia(createPinia())
})

async function store() {
  const { useConnectivityStore } = await import('../../app/stores/connectivity')
  return useConnectivityStore()
}

describe('useConnectivityStore — failure threshold', () => {
  it('does not declare a failure state on a single failed request', async () => {
    const s = await store()

    s.recordFailure()

    expect(s.failureThresholdReached).toBe(false)
  })

  it('reaches the threshold on consecutive failures', async () => {
    const s = await store()

    for (let i = 0; i < OFFLINE_FAILURE_THRESHOLD; i++) s.recordFailure()

    expect(s.failureThresholdReached).toBe(true)
  })

  it('a success in between resets the run — a flaky request must not accumulate', async () => {
    const s = await store()

    s.recordFailure()
    s.resetFailures()
    s.recordFailure()

    expect(s.failureThresholdReached).toBe(false)
  })

  it('stops counting once offline, so the backoff poll owns recovery', async () => {
    const s = await store()

    s.goOffline()
    s.recordFailure()
    s.recordFailure()

    expect(s.consecutiveFailures).toBe(0)
  })
})

describe('useConnectivityStore — restored signal', () => {
  it('does not bump restoredAt when it was never offline', async () => {
    const s = await store()

    s.goOnline()

    expect(s.restoredAt).toBe(0)
  })

  it('bumps restoredAt exactly on the offline -> online edge', async () => {
    const s = await store()

    s.goOffline()
    s.goOnline()

    expect(s.restoredAt).toBeGreaterThan(0)
  })

  it('clears the failure run when it goes offline', async () => {
    const s = await store()

    s.recordFailure()
    s.goOffline()

    expect(s.consecutiveFailures).toBe(0)
  })

  it('is idempotent — a second goOffline does not re-enter', async () => {
    const s = await store()

    s.goOffline()
    s.recordFailure()
    s.goOffline()

    expect(s.isOffline).toBe(true)
    expect(s.consecutiveFailures).toBe(0)
  })
})
