/**
 * Singleton HLS↔WebRTC transport handoff (realtime-10, hoisted in
 * room-page-runtime-audit 01).
 *
 * WHY MODULE-SCOPED: `useRoomAudio()` is called from ~10 files (page, header,
 * info, seat drawer, composer, gift composables, lifecycle…). The handoff
 * `watch` used to live in its body, so one broadcast-tier flip ran the callback
 * once PER CALLER: N concurrent `broadcastHls.start()` (N−1 leaked `Hls`
 * instances on one `<audio>`) and N competing `setMediasoupVolume()` restores,
 * each with its own stale copy of `webrtcVolume`. See
 * `hard-won-gotchas.md` § "A watch() inside a shared composable fires once PER
 * CALLER".
 *
 * There is exactly one audio output per app process, so there is exactly one
 * handoff watcher: installed once in a detached `effectScope(true)` (same
 * shape as `fgsScope` in useRoomAudio) so it survives room page unmount and
 * remount, and one shared `webrtcVolume` so the restore is deterministic.
 *
 * Every input is a plain getter/function so the singleton never captures a
 * caller-scoped computed (a component's computed is disposed with it).
 */
import { effectScope, watch, type EffectScope } from 'vue';
import { selectMediaTransport, planTransportHandoff, type MediaTransport } from '~/utils/mediaTransport';

export interface TransportHandoffDeps {
  /** Current Room's mode (interactive/broadcast), or null when not in a room. */
  getMode: () => 'interactive' | 'broadcast' | null | undefined;
  /** Current Room's published HLS playback URL, if any. */
  getHlsPlaybackUrl: () => string | null | undefined;
  /** Whether the local user is producing (a Speaker). Read from the store. */
  isSpeaker: () => boolean;
  /** WebRTC consumer volume (0-1). */
  setMediasoupVolume: (v: number) => void;
  getMediasoupVolume: () => number;
  /** The singleton broadcast HLS player. */
  broadcastHls: {
    start: (url: string) => Promise<void>;
    stop: () => void;
    setVolume: (v: number) => void;
  };
}

export interface TransportHandoffHandle {
  /**
   * Tier-aware volume setter: drives the HLS element on the broadcast tier and
   * the WebRTC consumers otherwise, and remembers the value so a later
   * HLS→WebRTC handoff restores it instead of hardcoding 1.
   */
  setVolume: (volume: number) => void;
  /** The tier this client is currently on (synchronous, see below). */
  activeTransport: () => MediaTransport;
  /**
   * Called by leaveRoom() right after `broadcastHls.stop()` so the invariant
   * "HLS stopped ⟺ activeTransport === 'webrtc'" holds — otherwise a rejoin to
   * a still-broadcast Room would hit the watcher's same-tier early-return and
   * never restart HLS (silent Listener).
   */
  resetToWebrtc: () => void;
}

let scope: EffectScope | null = null;
let handle: TransportHandoffHandle | null = null;

/**
 * Install the handoff watcher once and return the shared handle. Later calls
 * (from other `useRoomAudio()` callers) return the same handle; their `deps`
 * are ignored — stores and the HLS player are module singletons, so the first
 * caller's deps are the only ones there are.
 */
export function ensureTransportHandoff(deps: TransportHandoffDeps): TransportHandoffHandle {
  if (handle) return handle;

  // `activeTransport` is the tier this client is currently on, tracked
  // SYNCHRONOUSLY here rather than read back from `broadcastHls.isActive` —
  // which only flips true AFTER the async `import('hls.js')` inside start().
  // A promotion (take Seat → isSpeaker) landing in that import window would,
  // with an `isActive`-gated guard, skip the volume restore and strand the
  // WebRTC tier at volume 0. Edge-triggering off this flag closes that race.
  //
  // `webrtcVolume` remembers the Listener's chosen consumer volume across a
  // broadcast detour so the restore doesn't clobber it back to a hardcoded 1.
  let activeTransport: MediaTransport = 'webrtc';
  let webrtcVolume = deps.getMediasoupVolume();

  scope = effectScope(true);
  scope.run(() => {
    watch(
      () =>
        [
          deps.getMode() ?? 'interactive',
          deps.isSpeaker(),
          deps.getHlsPlaybackUrl() ?? null,
        ] as const,
      ([mode, isSpeaker, hlsUrl]) => {
        const transport = selectMediaTransport({ mode, isSpeaker, hlsPlaybackUrl: hlsUrl });
        const plan = planTransportHandoff(activeTransport, transport, webrtcVolume);
        if (!plan.changed) return; // already on the target tier → nothing to do

        activeTransport = plan.tier;
        if (plan.tier === 'hls' && hlsUrl) {
          // WebRTC → HLS (a Speaker stepping down, or the Room flipping to
          // broadcast): silence the muted WebRTC consumers and play the single
          // CDN stream at the same volume. One catch-up jump, no reconnect storm.
          deps.setMediasoupVolume(plan.webrtcVolume);
          deps.broadcastHls.setVolume(plan.hlsVolume ?? webrtcVolume);
          void deps.broadcastHls.start(hlsUrl);
        } else {
          // HLS → WebRTC (a Listener taking a Seat, or the Room flipping back to
          // interactive): stop the CDN stream and restore the Listener's chosen
          // WebRTC volume. Restore is UNCONDITIONAL (not gated on
          // broadcastHls.isActive) so a switch during the hls.js import can't
          // leave WebRTC muted.
          deps.broadcastHls.stop();
          deps.setMediasoupVolume(plan.webrtcVolume);
        }
      },
      { immediate: true },
    );
  });

  handle = {
    setVolume(volume: number): void {
      webrtcVolume = volume;
      if (activeTransport === 'hls') {
        deps.broadcastHls.setVolume(volume);
      } else {
        deps.setMediasoupVolume(volume);
      }
    },
    activeTransport: () => activeTransport,
    resetToWebrtc: () => {
      activeTransport = 'webrtc';
    },
  };
  return handle;
}

/** Test-only: tear down the singleton so each spec starts clean. */
export function __resetTransportHandoffForTests(): void {
  scope?.stop();
  scope = null;
  handle = null;
}
