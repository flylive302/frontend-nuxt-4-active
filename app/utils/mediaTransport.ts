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
