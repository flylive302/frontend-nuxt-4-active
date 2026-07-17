/**
 * Motion Pause Orchestrator
 *
 * Combines three "is the room actually visible to the user" signals and
 * drives `motionPauseRegistry` accordingly (room-battery-perf issue 03 /
 * PRD "Global motion pause"):
 *
 *   1. Capacitor app-state (backgrounded / foregrounded)
 *   2. Page visibility (`document.visibilityState`)
 *   3. Room-covered (a full-screen overlay/drawer/sheet obscuring the room)
 *
 * Semantics: paused while ANY signal indicates hidden; resumed only when
 * ALL signals clear. Overlapping signals must not resume prematurely — e.g.
 * backgrounding while a drawer is open, then foregrounding, must stay paused
 * until the drawer also closes. This is tracked as a set of active "reasons"
 * rather than a single boolean so overlapping signals compose correctly; the
 * covered signal itself is reference-counted (a token per acquire) so two
 * overlays opening concurrently don't let the first one's release resume
 * early.
 *
 * GATE→EXECUTE split: `recompute()` (GATE) reads the combined signal state
 * and decides pause vs. resume; the actual dispatch to registrants (EXECUTE)
 * is delegated to `motionPauseRegistry`. Registrants stay dumb.
 *
 * Framework-light: no Vue reactivity. Wired once, app-wide, from
 * `plugins/motion-pause.client.ts`. Web-only signals (visibility) work
 * everywhere; the Capacitor app-state listener is only attached on native
 * platforms.
 */
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { createLogger } from '~/utils/logger';
import * as motionPauseRegistry from '~/services/motionPauseRegistry';

const log = createLogger('[MotionPauseOrchestrator]');

type PauseReason = 'background' | 'hidden';

let reasons = new Set<PauseReason>();
let coveredTokens = new Set<string>();
let nextCoveredToken = 0;

let appStateListenerHandle: { remove: () => void } | null = null;
let visibilityListenerAttached = false;
let initialized = false;

// ========================================
// GATE — combine signals, decide pause vs. resume
// ========================================

function recompute(): void {
  const shouldPause = reasons.size > 0 || coveredTokens.size > 0;
  if (shouldPause) {
    motionPauseRegistry.pause();
  } else {
    motionPauseRegistry.resume();
  }
}

function setReason(reason: PauseReason, active: boolean): void {
  if (active) {
    reasons.add(reason);
  } else {
    reasons.delete(reason);
  }
  recompute();
}

// ========================================
// Signal: page visibility
// ========================================

function handleVisibilityChange(): void {
  setReason('hidden', document.visibilityState === 'hidden');
}

// ========================================
// Signal: Capacitor app-state
// ========================================

async function attachAppStateListener(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    appStateListenerHandle = await App.addListener('appStateChange', ({ isActive }) => {
      setReason('background', !isActive);
    });
  } catch (err) {
    log.warn('Failed to attach Capacitor app-state listener', err);
  }
}

// ========================================
// Signal: room-covered (overlay/drawer/sheet)
// ========================================

/**
 * Called by a full-screen overlay/drawer/sheet when it opens. Returns a
 * token to pass to `releaseCovered`. Reference-counted so concurrently open
 * overlays don't let an early close resume the room prematurely.
 */
export function acquireCovered(): string {
  const token = `covered-${nextCoveredToken++}`;
  coveredTokens.add(token);
  recompute();
  return token;
}

/** Called when the overlay that acquired `token` closes. Safe to call once. */
export function releaseCovered(token: string): void {
  coveredTokens.delete(token);
  recompute();
}

// ========================================
// Lifecycle
// ========================================

/** Wire up all signals. Idempotent — safe to call more than once. */
export function init(): void {
  if (initialized) return;
  initialized = true;

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    visibilityListenerAttached = true;
    setReason('hidden', document.visibilityState === 'hidden');
  }

  void attachAppStateListener();
}

/** Test-only: tear down listeners and reset singleton state between cases. */
export function __resetForTest(): void {
  if (visibilityListenerAttached && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }
  visibilityListenerAttached = false;
  appStateListenerHandle?.remove();
  appStateListenerHandle = null;
  reasons = new Set<PauseReason>();
  coveredTokens = new Set<string>();
  nextCoveredToken = 0;
  initialized = false;
}
