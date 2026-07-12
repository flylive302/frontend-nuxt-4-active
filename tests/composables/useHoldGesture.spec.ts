/**
 * Unit tests for the hold gesture state machine (slice 04, ADR 0018).
 *
 * Table-driven, behavior-only: pointer events in, tap/hold-start/hold-end
 * callbacks out. Fake timers drive the single threshold timeout. Nuxt
 * auto-imports (`onScopeDispose`) are stubbed the same way sibling composable
 * specs stub globals; every gesture is built inside a real Vue effect scope
 * so `onScopeDispose` behaves exactly as it would inside a component.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { effectScope, onScopeDispose } from 'vue'
import { useHoldGesture, type UseHoldGesture, type UseHoldGestureOptions } from '~/composables/useHoldGesture'

vi.stubGlobal('onScopeDispose', onScopeDispose)

// Plain Node test env has no `window` — stub a minimal EventTarget so the
// composable's blur-guard (`typeof window !== 'undefined'`) exercises real
// addEventListener/removeEventListener/dispatchEvent semantics.
vi.stubGlobal('window', new EventTarget())

const THRESHOLD_MS = 250

function createCallbacks() {
  return {
    onTap: vi.fn(),
    onHoldStart: vi.fn(),
    onHoldEnd: vi.fn(),
  }
}

/** Build a gesture inside a real effect scope, disposed at the end of the test. */
function buildGesture(options: UseHoldGestureOptions): { gesture: UseHoldGesture; dispose: () => void } {
  const scope = effectScope()
  const gesture = scope.run(() => useHoldGesture(options))!
  return { gesture, dispose: () => scope.stop() }
}

describe('useHoldGesture', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('release before the threshold fires only onTap', () => {
    const cb = createCallbacks()
    const { gesture, dispose } = buildGesture({ ...cb, thresholdMs: THRESHOLD_MS })

    gesture.onPointerDown({} as PointerEvent)
    vi.advanceTimersByTime(THRESHOLD_MS - 50)
    gesture.onPointerUp({} as PointerEvent)

    expect(cb.onTap).toHaveBeenCalledTimes(1)
    expect(cb.onHoldStart).not.toHaveBeenCalled()
    expect(cb.onHoldEnd).not.toHaveBeenCalled()
    dispose()
  })

  it('holding past the threshold fires onHoldStart, then release fires onHoldEnd (not onTap)', () => {
    const cb = createCallbacks()
    const { gesture, dispose } = buildGesture({ ...cb, thresholdMs: THRESHOLD_MS })

    gesture.onPointerDown({} as PointerEvent)
    vi.advanceTimersByTime(THRESHOLD_MS)
    expect(cb.onHoldStart).toHaveBeenCalledTimes(1)
    expect(cb.onTap).not.toHaveBeenCalled()

    gesture.onPointerUp({} as PointerEvent)
    expect(cb.onHoldEnd).toHaveBeenCalledTimes(1)
    expect(cb.onTap).not.toHaveBeenCalled()
    dispose()
  })

  const midHoldCancelCases: Array<{
    name: string
    trigger: (gesture: UseHoldGesture) => void
  }> = [
    { name: 'pointercancel', trigger: (g) => g.onPointerCancel({} as PointerEvent) },
    { name: 'pointerleave', trigger: (g) => g.onPointerLeave({} as PointerEvent) },
  ]

  it.each(midHoldCancelCases)('$name mid-hold fires onHoldEnd', ({ trigger }) => {
    const cb = createCallbacks()
    const { gesture, dispose } = buildGesture({ ...cb, thresholdMs: THRESHOLD_MS })

    gesture.onPointerDown({} as PointerEvent)
    vi.advanceTimersByTime(THRESHOLD_MS)
    expect(cb.onHoldStart).toHaveBeenCalledTimes(1)

    trigger(gesture)

    expect(cb.onHoldEnd).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('pointercancel before the threshold fires neither onTap nor onHoldEnd', () => {
    const cb = createCallbacks()
    const { gesture, dispose } = buildGesture({ ...cb, thresholdMs: THRESHOLD_MS })

    gesture.onPointerDown({} as PointerEvent)
    vi.advanceTimersByTime(THRESHOLD_MS - 50)
    gesture.onPointerCancel({} as PointerEvent)

    // Letting the original timer run out must not retroactively fire hold-start:
    // the press was already resolved by the cancel.
    vi.advanceTimersByTime(THRESHOLD_MS)

    expect(cb.onTap).not.toHaveBeenCalled()
    expect(cb.onHoldStart).not.toHaveBeenCalled()
    expect(cb.onHoldEnd).not.toHaveBeenCalled()
    dispose()
  })

  it('window blur mid-hold resolves like a cancel (onHoldEnd, never stuck)', () => {
    const cb = createCallbacks()
    const { gesture, dispose } = buildGesture({ ...cb, thresholdMs: THRESHOLD_MS })

    gesture.onPointerDown({} as PointerEvent)
    vi.advanceTimersByTime(THRESHOLD_MS)
    expect(cb.onHoldStart).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('blur'))
    expect(cb.onHoldEnd).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('rapid re-press: tap, then immediate hold, resolves each gesture independently', () => {
    const cb = createCallbacks()
    const { gesture, dispose } = buildGesture({ ...cb, thresholdMs: THRESHOLD_MS })

    // First press: quick tap.
    gesture.onPointerDown({} as PointerEvent)
    vi.advanceTimersByTime(50)
    gesture.onPointerUp({} as PointerEvent)
    expect(cb.onTap).toHaveBeenCalledTimes(1)

    // Immediately re-press and hold past threshold — no leaked timer from the tap.
    gesture.onPointerDown({} as PointerEvent)
    vi.advanceTimersByTime(THRESHOLD_MS)
    expect(cb.onHoldStart).toHaveBeenCalledTimes(1)
    expect(cb.onTap).toHaveBeenCalledTimes(1) // still just the one tap

    gesture.onPointerUp({} as PointerEvent)
    expect(cb.onHoldEnd).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('re-pressing while already pressed clears the stale timer instead of double-firing', () => {
    const cb = createCallbacks()
    const { gesture, dispose } = buildGesture({ ...cb, thresholdMs: THRESHOLD_MS })

    gesture.onPointerDown({} as PointerEvent) // press #1 (never released — e.g. multi-touch glitch)
    vi.advanceTimersByTime(THRESHOLD_MS - 50)
    gesture.onPointerDown({} as PointerEvent) // press #2 restarts the timer
    vi.advanceTimersByTime(THRESHOLD_MS - 50)
    // Original timer (press #1) would have elapsed by now if leaked.
    expect(cb.onHoldStart).not.toHaveBeenCalled()

    vi.advanceTimersByTime(50)
    expect(cb.onHoldStart).toHaveBeenCalledTimes(1)
    dispose()
  })
})
