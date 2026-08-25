// ========================================
// Reload intent marker
// ========================================
//
// `pagehide` cannot tell a reload from a tab close, but the two need opposite
// seat handling:
//
//  - **close**  → emit `room:leave` so the seat frees instantly for everyone else
//  - **reload** → stay silent, so MSAB treats it as a disconnect and holds the
//                 seat through SEAT_RETENTION_GRACE_MS (120s) for the rejoin
//
// An app-initiated reload knows its own intent, so it records it here just
// before reloading. Anything that does NOT set this — a tab close, an OS kill —
// keeps the existing eager-leave behaviour untouched.
//
// sessionStorage is the right store: it is per-tab and survives a reload, so one
// tab's intent can never leak into another's.
// ========================================

const RELOAD_INTENT_KEY = 'reload-intent-at'

/**
 * Window in which a recorded intent is trusted. Short by design — the marker is
 * consumed within the same unload it was written in, so anything older is a
 * leftover and must not suppress a genuine leave.
 */
const RELOAD_INTENT_TTL_MS = 10_000

/** Record that the unload about to happen is a deliberate reload, not a close. */
export function markReloadIntent(): void {
  try {
    sessionStorage.setItem(RELOAD_INTENT_KEY, String(Date.now()))
  } catch {
    // Storage unavailable (private mode, quota) — fall back to eager-leave,
    // which is the safe direction: a freed seat beats a stuck one.
  }
}

/**
 * Whether the current unload was flagged as a reload. Reads without clearing:
 * the marker is scoped to this unload and the fresh page never observes it as
 * meaningful, so a TTL is a more robust reset than a delete that may not flush.
 */
export function isReloadIntended(): boolean {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_INTENT_KEY) ?? 0)
    return at > 0 && Date.now() - at < RELOAD_INTENT_TTL_MS
  } catch {
    return false
  }
}
