// ========================================
// useFollowBurst Composable Tests
// ========================================
// Covers docs/issues/profile-signature-page-audit step 5: the rAF scheduled by
// burst() is cancelled on scope dispose (tap Follow → back before next frame)
// and on re-trigger, so no timer is armed on a dead scope.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope, onScopeDispose } from 'vue'
import { useFollowBurst } from '~/composables/shared/useFollowBurst'

vi.stubGlobal('onScopeDispose', onScopeDispose)

let rafCallbacks: Map<number, FrameRequestCallback>
let nextRafId: number

function flushRaf() {
  const cbs = [...rafCallbacks.values()]
  rafCallbacks.clear()
  for (const cb of cbs) cb(0)
}

beforeEach(() => {
  vi.useFakeTimers()
  rafCallbacks = new Map()
  nextRafId = 1
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextRafId++
    rafCallbacks.set(id, cb)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks.delete(id)
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.stubGlobal('onScopeDispose', onScopeDispose)
})

describe('useFollowBurst', () => {
  it('animates for the burst duration then resets', () => {
    const scope = effectScope()
    const { followAnimating, burst } = scope.run(() => useFollowBurst())!

    burst()
    expect(followAnimating.value).toBe(false)
    flushRaf()
    expect(followAnimating.value).toBe(true)
    vi.advanceTimersByTime(600)
    expect(followAnimating.value).toBe(false)
    scope.stop()
  })

  it('cancels a pending rAF on dispose so no timer is armed afterwards', () => {
    const scope = effectScope()
    const { followAnimating, burst } = scope.run(() => useFollowBurst())!

    burst()
    expect(rafCallbacks.size).toBe(1)
    scope.stop()

    expect(rafCallbacks.size).toBe(0)
    flushRaf()
    expect(followAnimating.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('re-trigger before the frame replaces the pending rAF instead of stacking', () => {
    const scope = effectScope()
    const { burst } = scope.run(() => useFollowBurst())!

    burst()
    burst()
    expect(rafCallbacks.size).toBe(1)
    flushRaf()
    expect(vi.getTimerCount()).toBe(1)
    scope.stop()
  })
})
