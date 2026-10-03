// ========================================
// useScrolledFromTop Composable Tests
// ========================================
// Covers the home header's transparent-at-top / tinted-on-scroll switch:
//   - starts at top (not scrolled) before the observer reports
//   - sentinel leaves the viewport → scrolled
//   - sentinel re-enters → back at top
//   - an empty entry list leaves the state untouched

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { effectScope, ref } from 'vue'
import { useScrolledFromTop } from '~/composables/shared/useScrolledFromTop'

// ========================================
// Mocks
// ========================================

// Capture the observer callback so tests can fire synthetic entries directly
// (same @vueuse/core mocking pattern as useDeferredVisibility.spec.ts).
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

function fireIntersection(isIntersecting: boolean) {
  intersectionCallback?.([{ isIntersecting }])
}

describe('useScrolledFromTop', () => {
  beforeEach(() => {
    intersectionCallback = null
  })

  it('starts not scrolled before the observer reports', () => {
    const scope = effectScope()
    const { isScrolled } = scope.run(() => useScrolledFromTop(ref(null)))!

    expect(isScrolled.value).toBe(false)
    scope.stop()
  })

  it('tracks the sentinel leaving and re-entering the viewport', () => {
    const scope = effectScope()
    const { isScrolled } = scope.run(() => useScrolledFromTop(ref(null)))!

    fireIntersection(false)
    expect(isScrolled.value).toBe(true)

    fireIntersection(true)
    expect(isScrolled.value).toBe(false)
    scope.stop()
  })

  it('ignores a callback with no entries', () => {
    const scope = effectScope()
    const { isScrolled } = scope.run(() => useScrolledFromTop(ref(null)))!

    fireIntersection(false)
    intersectionCallback?.([])
    expect(isScrolled.value).toBe(true)
    scope.stop()
  })
})
