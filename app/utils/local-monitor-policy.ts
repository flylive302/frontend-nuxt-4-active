/**
 * Local-monitor policy — pure, framework-agnostic.
 *
 * Decides whether the Room-music engine should route the DJ's own music to the
 * **local loudspeaker monitor** (the `gain → AudioContext.destination` edge the
 * DJ hears themselves on). It does NOT touch the `musicProducer` edge that feeds
 * Listeners — that is always connected; this module only governs the DJ's own
 * monitor.
 *
 * The pain it fixes is **acoustic, not a wiring bug** (capacitor-02 / ADR 0006):
 * a DJ on a Seat has an open mic. If their own music plays out the loudspeaker,
 * it bleeds into that mic and the browser's echo-cancellation ducks the whole
 * voice — so the room cannot hear the DJ talk over the music. Cutting the local
 * monitor while the DJ is producing on speaker keeps the voice clean; the music
 * still reaches Listeners untouched.
 *
 * No Web Audio, no DOM, no Vue, no sockets — just the decision table, so it is
 * fully unit-testable. The impure "what route are we on?" detection lives in
 * `services/audioRouteDetector.ts`; the engine consumes only the `monitorOn`
 * boolean via `setLocalMonitor`.
 *
 * Decision table (the only four cases):
 *
 *   producing=false                    → monitorOn: true                       // no open mic, loudspeaker is fine
 *   producing=true,  route='wired'     → monitorOn: true                       // headphones isolate, voice stays clean
 *   producing=true,  route='speaker'   → monitorOn: false, hint                // the bug case — cut the monitor, nudge headphones
 *   producing=true,  route='bluetooth' → monitorOn: true,  degraded            // A2DP→SCO drops the link to mono when the mic opens
 */

/** Best-effort classification of the active audio-output route. */
export type AudioRoute = 'wired' | 'speaker' | 'bluetooth';

/** Reason code for the no-headphones-while-talking nudge (UI maps it to copy). */
export type LocalMonitorHint = 'plug-in-headphones';

export interface LocalMonitorInput {
  /** Is the DJ producing voice (on a Seat with an open mic)? */
  producing: boolean;
  /** Best-effort active output route. */
  route: AudioRoute;
}

export interface LocalMonitorDecision {
  /** Connect the local loudspeaker monitor (`gain → destination`)? */
  monitorOn: boolean;
  /** Present only in the no-headphones-while-talking case (AC #6). */
  hint?: LocalMonitorHint;
  /** Monitor is on but the route degrades the mic to mono (Bluetooth A2DP→SCO). */
  degraded?: boolean;
}

/**
 * Pure decision: given whether the DJ is producing voice and the active output
 * route, decide whether the local loudspeaker monitor should be connected.
 */
export function monitorPolicy({ producing, route }: LocalMonitorInput): LocalMonitorDecision {
  // No open mic → nothing to duck, the loudspeaker monitor is always fine.
  if (!producing) {
    return { monitorOn: true };
  }

  switch (route) {
    // Wired headphones acoustically isolate the music from the mic → keep the
    // monitor on; the DJ hears their music and the room hears a clean voice.
    case 'wired':
      return { monitorOn: true };

    // The bug case: open mic + music out the loudspeaker = echo-cancellation
    // ducks the voice. Cut the monitor and nudge the DJ to plug in headphones.
    case 'speaker':
      return { monitorOn: false, hint: 'plug-in-headphones' };

    // Bluetooth isolates like wired, so keep the monitor on — but flag degraded:
    // opening the mic forces the headset off A2DP onto mono SCO (the OS, not us).
    case 'bluetooth':
      return { monitorOn: true, degraded: true };
  }
}
