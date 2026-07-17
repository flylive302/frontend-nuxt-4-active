/**
 * Motion Pause Registry
 *
 * Framework-light registry (no Vue, no Capacitor, no DOM) that any animated
 * surface — SVGA player, canvas loop, decorative CSS motion — registers with
 * to receive pause()/resume() callbacks. This module owns only the
 * dispatch mechanics; deciding *when* to pause is the orchestrator's job
 * (`motionPauseOrchestrator.ts`), which combines Capacitor app-state, page
 * visibility, and the room-covered signal.
 *
 * Registrants stay dumb: they implement pause/resume only, they never decide
 * when to pause themselves (room-battery-perf issue 03 / PRD "Global motion
 * pause").
 *
 * Process-wide singleton — there is exactly one motion-pause reality per app
 * process, mirroring `foregroundServiceCoordinator`'s module-level `running`
 * set.
 */
import { createLogger } from '~/utils/logger';

const log = createLogger('[MotionPauseRegistry]');

export interface MotionPauseRegistrant {
  pause(): void;
  resume(): void;
}

let registrants = new Map<string, MotionPauseRegistrant>();
let nextId = 0;
let paused = false;

/**
 * Register an animated surface. Returns an id to pass to `unregister`.
 * If the registry is currently paused, the registrant immediately receives
 * `pause()` so a late-mounted surface (e.g. an SVGA player mounted while the
 * app is backgrounded) never starts out animated.
 */
export function register(registrant: MotionPauseRegistrant): string {
  const id = `motion-${nextId++}`;
  registrants.set(id, registrant);
  if (paused) {
    try {
      registrant.pause();
    } catch (err) {
      log.warn('Registrant threw on inherited pause()', err);
    }
  }
  return id;
}

/** Unregister a surface (e.g. on unmount). Safe to call mid-pause; no error. */
export function unregister(id: string): void {
  registrants.delete(id);
}

/** Pause every registrant. Idempotent — a no-op if already paused. */
export function pause(): void {
  if (paused) return;
  paused = true;
  for (const registrant of registrants.values()) {
    try {
      registrant.pause();
    } catch (err) {
      log.warn('Registrant threw on pause()', err);
    }
  }
}

/** Resume every currently-registered registrant. Idempotent — a no-op if already resumed. */
export function resume(): void {
  if (!paused) return;
  paused = false;
  for (const registrant of registrants.values()) {
    try {
      registrant.resume();
    } catch (err) {
      log.warn('Registrant threw on resume()', err);
    }
  }
}

/** Whether the registry is currently in the paused state. */
export function isPaused(): boolean {
  return paused;
}

/** Test-only: clear singleton state between cases. */
export function __resetForTest(): void {
  registrants = new Map<string, MotionPauseRegistrant>();
  nextId = 0;
  paused = false;
}
