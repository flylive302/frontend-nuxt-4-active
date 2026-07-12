/**
 * Hold Gesture — pure, UI-agnostic pointer state machine.
 *
 * Disambiguates a short tap from a deliberate press-and-hold, driven entirely
 * by pointer events. Used by the DJ talk-over duck (ADR 0018): holding the
 * player vinyl ducks the music; a quick tap on the minimized widget expands
 * it instead.
 *
 *   idle ──pointerdown──> pressed ──(release before threshold)──> tap
 *                            │
 *                            └──(threshold elapses)──> held ──release/cancel/
 *                                                        leave/blur──> hold-end
 *
 * Exactly ONE timeout is ever live at a time; no polling, no reactive
 * watchers. Callbacks-in (onTap/onHoldStart/onHoldEnd), handlers-out — bind
 * the returned handlers to an element's pointer events in the template.
 */
import { HOLD_GESTURE_THRESHOLD_MS } from '~/constants/room';

// ========================================
// Types
// ========================================

export interface UseHoldGestureOptions {
  /** Fires when the pointer releases before the hold threshold elapses. */
  onTap?: () => void;
  /** Fires the moment the hold threshold elapses while the pointer is still down. */
  onHoldStart?: () => void;
  /** Fires when a hold ends (release, cancel, leave, or window blur) — never for a plain tap. */
  onHoldEnd?: () => void;
  /** Hold threshold in ms (default `HOLD_GESTURE_THRESHOLD_MS`). */
  thresholdMs?: number;
}

export interface UseHoldGesture {
  /** Bind to `pointerdown`. */
  onPointerDown: (event: PointerEvent) => void;
  /** Bind to `pointerup`. */
  onPointerUp: (event: PointerEvent) => void;
  /** Bind to `pointercancel`. */
  onPointerCancel: (event: PointerEvent) => void;
  /** Bind to `pointerleave`. */
  onPointerLeave: (event: PointerEvent) => void;
}

type GestureState = 'idle' | 'pressed' | 'held';

// ========================================
// Composable
// ========================================

export function useHoldGesture(options: UseHoldGestureOptions = {}): UseHoldGesture {
  const threshold = options.thresholdMs ?? HOLD_GESTURE_THRESHOLD_MS;

  let state: GestureState = 'idle';
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  /** Held threshold elapsed while the pointer is still down. */
  function onThresholdElapsed(): void {
    timer = null;
    if (state !== 'pressed') return; // already released — the tap already fired
    state = 'held';
    options.onHoldStart?.();
  }

  /** Shared release path for pointerup/cancel/leave/blur. */
  function endGesture(): void {
    const wasHeld = state === 'held';
    clearTimer();
    state = 'idle';
    if (wasHeld) {
      options.onHoldEnd?.();
    }
  }

  function onPointerDown(): void {
    // Rapid re-press safety: a stray leftover timer from a prior gesture
    // (there should never be one, but a defensive clear costs nothing) is
    // cleared before starting a fresh press.
    clearTimer();
    state = 'pressed';
    timer = setTimeout(onThresholdElapsed, threshold);
  }

  function onPointerUp(): void {
    if (state === 'pressed') {
      clearTimer();
      state = 'idle';
      options.onTap?.();
      return;
    }
    endGesture(); // held → hold-end
  }

  function onPointerCancel(): void {
    endGesture();
  }

  function onPointerLeave(): void {
    endGesture();
  }

  // Window blur (tab switch, incoming call, etc.) must never leave a hold
  // stuck engaged — resolve it exactly like a cancel. Guarded by a feature
  // check (not `import.meta.client`) so the state machine stays test-friendly
  // in a plain Node/Vitest environment with a stubbed `window`.
  if (typeof window !== 'undefined') {
    window.addEventListener('blur', endGesture, { passive: true });
    onScopeDispose(() => window.removeEventListener('blur', endGesture));
  }

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
  };
}
