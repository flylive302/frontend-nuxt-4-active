/**
 * Resolve the MSAB WebSocket URL the client should connect to for a room.
 *
 * Laravel is the source of truth for a room's media endpoint (realtime-05):
 * in production we connect to the room's `hosting_url`, which Laravel always
 * resolves to a deployed region — there is no client-side region map and no
 * localhost / undeployed-region fallback path.
 *
 * In development we ignore the production `hosting_url` and return `undefined`
 * so the caller's `connect()` uses the local config URL (prod endpoints reject
 * localhost origins).
 *
 * Pure: `isDev` is passed in rather than read from `import.meta.dev`.
 */
export function resolveMediaTransportUrl(
  hostingUrl: string | null | undefined,
  isDev: boolean,
): string | undefined {
  if (isDev) {
    return undefined;
  }

  return hostingUrl ?? undefined;
}

/** Which audio transport the local client should use for a Room (realtime-09). */
export type MediaTransport = 'webrtc' | 'hls';

/**
 * Decide the local client's audio transport (realtime-09).
 *
 * Interactive tier and every Speaker stay on WebRTC. A **passive Listener**
 * (not on a seat / not producing) in a **broadcast-mode** Room with a published
 * `hls_playback_url` plays the single CDN HLS stream instead of N WebRTC
 * consumers — the cost lever that makes 30k Listeners a CDN problem.
 *
 * Pure + total: callers `watch()` the inputs and switch transport on change.
 * Promotion/demotion (a Listener taking a seat → `isSpeaker` true → WebRTC) is
 * the realtime-10 path; here it falls out of `isSpeaker` naturally.
 */
export function selectMediaTransport(input: {
  mode: 'interactive' | 'broadcast';
  isSpeaker: boolean;
  hlsPlaybackUrl: string | null | undefined;
}): MediaTransport {
  const { mode, isSpeaker, hlsPlaybackUrl } = input;
  if (mode === 'broadcast' && !isSpeaker && Boolean(hlsPlaybackUrl)) {
    return 'hls';
  }
  return 'webrtc';
}

/**
 * The concrete side-effect plan for an HLS↔WebRTC handoff (realtime-10).
 *
 * `changed === false` → the client is already on the target tier; do nothing.
 * Otherwise `tier` is the tier to switch TO, `webrtcVolume` is the volume to
 * apply to the WebRTC consumers (0 while HLS is audible so only one tier plays;
 * the Listener's saved volume on the way back), and `hlsVolume` is the volume
 * for the HLS element on a switch INTO broadcast (undefined otherwise).
 */
export interface TransportHandoffPlan {
  changed: boolean;
  tier: MediaTransport;
  webrtcVolume: number;
  hlsVolume?: number;
}

/**
 * Pure reducer for the promotion/demotion handoff (realtime-10). Given the tier
 * the client is currently on, the tier it should be on, and the Listener's saved
 * WebRTC volume, decide the mute/restore plan.
 *
 * Guards the two bugs the handoff fix targets:
 *  - **volume clobber:** the WebRTC restore returns `savedVolume`, never a
 *    hardcoded 1.
 *  - **spurious churn:** a same-tier re-fire is `changed: false` (no stop/start
 *    storm), so the caller edge-triggers off `current` rather than reading back
 *    `hls.js`'s async-lagging `isActive` flag.
 */
export function planTransportHandoff(
  current: MediaTransport,
  next: MediaTransport,
  savedVolume: number,
): TransportHandoffPlan {
  if (current === next) {
    return { changed: false, tier: current, webrtcVolume: savedVolume };
  }
  if (next === 'hls') {
    // WebRTC → HLS: silence the WebRTC consumers, play HLS at the saved volume.
    return { changed: true, tier: 'hls', webrtcVolume: 0, hlsVolume: savedVolume };
  }
  // HLS → WebRTC: stop HLS, restore the Listener's chosen WebRTC volume.
  return { changed: true, tier: 'webrtc', webrtcVolume: savedVolume };
}
