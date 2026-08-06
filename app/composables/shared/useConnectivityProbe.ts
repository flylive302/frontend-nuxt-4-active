/**
 * Health / connectivity probe (ARCHITECTURE: pages stay free of $fetch).
 *
 * observability-audio-quality/12 — this used to issue a bare, RELATIVE fetch to
 * the v1 health path. A relative URL resolves against the FRONTEND's origin,
 * where nothing serves it: there is no matching Nitro server route, no route
 * rule, and the native shim does not rewrite it. The real endpoint lives on the
 * API (`GET /api/v1/health`, `backend/routes/api.php`), and `apiBase` already
 * ends in `/api/v1` — so the correct call is `api('/health')`.
 *
 * 🔴 It was broken in OPPOSITE directions per platform, which is why nobody
 * caught it:
 *   web    → the SPA fallback answers, so the probe reported "online" even
 *            with the API down, and Retry bounced the user off this page.
 *   native → no server at that origin at all, so the probe ALWAYS failed and
 *            Retry could never succeed — a user restored to full connectivity
 *            stayed stuck on the offline screen.
 *
 * Going through `useApi` also means the probe now carries the auth, correlation
 * and device headers every other API call carries.
 */

/** Matches the previous probe's budget; the shared client's default is longer. */
const PROBE_TIMEOUT_MS = 5000

export function useConnectivityProbe() {
  const { api } = useApi()

  /**
   * Checks whether the API is reachable.
   *
   * @returns True when the health endpoint answers, false on any failure.
   */
  async function probeHealth(): Promise<boolean> {
    try {
      await api('/health', { timeout: PROBE_TIMEOUT_MS })
      return true
    } catch {
      return false
    }
  }

  return { probeHealth }
}
