// ========================================
// useDeferredVisibility Composable Tests
// ========================================
// Covers capacitor-performance issue 02 (seat avatar frames pause off-screen):
//   - enabled=false: always visible, no observer-driven changes
//   - enabled=true: starts hidden, tracks entry.isIntersecting both ways
//   - enabled flips false at runtime: falls back to visible immediately

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useDeferredVisibility } from '~/composables/shared/useDeferredVisibility'

// ========================================
// Mocks
// ========================================

// Capture the callback passed to useIntersectionObserver so tests can fire
// synthetic intersection entries directly (mirrors useRechargeLeaderboard's
// @vueuse/core mocking pattern).
let intersectionCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null

vi.mock('@vueuse/core', () => ({
  useIntersectionObserver: (
    _target: unknown,
    callback: (entries: Array<{ isIntersecting: boolean }>) => void,
  ) => {
    intersectionCallback = callback
    return { stop: vi.fn() }
  },
}))

vi.mock('~/constants/assets', () => ({
  DEFERRED_VISIBILITY_ROOT_MARGIN: '100px',
  DEFERRED_VISIBILITY_THRESHOLD: 0.01,
}))

function fireIntersection(isIntersecting: boolean) {
  intersectionCallback?.([{ isIntersecting }])
}

describe('useDeferredVisibility', () => {
  beforeEach(() => {
    intersectionCallback = null
  })

  it('disabled: starts visible and stays visible regardless of intersection', () => {
    const scope = effectScope()
    const { isVisible } = scope.run(() => useDeferredVisibility(ref(null), false))!

    expect(isVisible.value).toBe(true)
    fireIntersection(false)
    expect(isVisible.value).toBe(true)
    scope.stop()
  })

  it('enabled: starts hidden until the target intersects', () => {
    const scope = effectScope()
    const { isVisible } = scope.run(() => useDeferredVisibility(ref(null), true))!

    expect(isVisible.value).toBe(false)
    scope.stop()
  })

  it('enabled: tracks isIntersecting true -> false -> true', () => {
    const scope = effectScope()
    const { isVisible } = scope.run(() => useDeferredVisibility(ref(null), true))!

    fireIntersection(true)
    expect(isVisible.value).toBe(true)

    fireIntersection(false)
    expect(isVisible.value).toBe(false)

    fireIntersection(true)
    expect(isVisible.value).toBe(true)
    scope.stop()
  })

  it('enabled flips to disabled at runtime: falls back to visible immediately', async () => {
    const scope = effectScope()
    const enabled = ref(true)
    const { isVisible } = scope.run(() => useDeferredVisibility(ref(null), enabled))!

    fireIntersection(false)
    expect(isVisible.value).toBe(false)

    enabled.value = false
    await nextTick()
    expect(isVisible.value).toBe(true)
    scope.stop()
  })
})
