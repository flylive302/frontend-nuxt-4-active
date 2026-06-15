/**
 * Foreground-service policy — pure, framework-agnostic.
 *
 * Decides which Android **foreground services** must run to keep the Capacitor
 * shell's process alive (and thus its WebRTC capture/playback) while the screen
 * is off or the app is backgrounded (capacitor-03 / ADR 0010).
 *
 * The input is the user's **set of concurrent audio activities**, NOT a single
 * one-at-a-time role: a Speaker is `producing` AND `consuming` at the same time,
 * every time. So `fgsPolicy` maps the activity set to the **union** of the
 * services each active capability requires:
 *
 *   producing (open mic on a Seat)        → 'microphone'      (capacitor-03, this slice)
 *   consuming (hearing the room — always  → 'mediaPlayback'   (capacitor-04, no native
 *              true for any in-room user)                       service yet)
 *
 * The DJ / music-playing capability does NOT enter this decision: music only
 * plays inside a Room where `consuming` is already true, so it adds no service
 * the Listener role didn't already demand. (DJ matters for the Local-monitor
 * policy — `utils/local-monitor-policy.ts` — not here.)
 *
 * No Android, no Capacitor, no Vue, no sockets — just the decision table and a
 * pure set-diff, so both functions are fully unit-testable. The impure executor
 * that actually starts/stops services lives in
 * `services/foregroundServiceCoordinator.ts`; it consumes only these two pure
 * functions.
 */

/** An Android foreground-service type the shell can run. */
export type FgsService = 'microphone' | 'mediaPlayback';

/** The user's concurrent audio activities — the policy's only input. */
export interface RoomActivity {
  /** Producing voice: a Speaker with an open mic on a Seat. Requires `microphone`. */
  producing: boolean;
  /** Consuming room audio: true for ANY in-room user (Speaker or Listener). Requires `mediaPlayback`. */
  consuming: boolean;
}

/** The concrete service transitions the coordinator must execute. */
export interface FgsDiff {
  /** Services in `desired` but not `running` — to be started. */
  start: FgsService[];
  /** Services in `running` but not `desired` — to be stopped. */
  stop: FgsService[];
}

/**
 * Pure: map the concurrent activity set to the union of required foreground
 * services. An empty set means no service is needed (idle / not in a Room).
 */
export function fgsPolicy({ producing, consuming }: RoomActivity): Set<FgsService> {
  const services = new Set<FgsService>();
  if (producing) services.add('microphone');
  if (consuming) services.add('mediaPlayback');
  return services;
}

/**
 * Pure: diff a running service set against a desired one into concrete
 * start/stop actions. This is the **transition** AC #1 is written against —
 * `producing→idle yields a stop of microphone` is a diff, not a state — so it is
 * a separate, independently-testable function rather than logic buried in the
 * coordinator.
 */
export function diffFgs(running: Set<FgsService>, desired: Set<FgsService>): FgsDiff {
  const start: FgsService[] = [];
  const stop: FgsService[] = [];

  for (const svc of desired) {
    if (!running.has(svc)) start.push(svc);
  }
  for (const svc of running) {
    if (!desired.has(svc)) stop.push(svc);
  }

  return { start, stop };
}
