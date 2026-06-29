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
