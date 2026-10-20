// ========================================
// Bootstrap Constants
// ========================================

/**
 * Shape version of the persisted bootstrap catalog (`stores/bootstrap.ts`).
 *
 * The catalog is revalidated with `If-None-Match`, and the server's ETag covers
 * the payload only — never the client code that parsed it. So when a release
 * starts reading a NEW field from an UNCHANGED payload (or changes how a stored
 * field is interpreted), the server keeps answering 304 and the persisted
 * catalog never gains that field. Bump this number in that release: a persisted
 * catalog with any other version is discarded and refetched without a
 * validator (boot-and-asset-delivery 07).
 *
 * Persisted state written before this existed has no version → one cold fetch.
 */
export const BOOTSTRAP_SHAPE_VERSION = 1

/**
 * CP Event config used while the server has not sent a `cp` block (older
 * server, fresh install, discarded catalog). Off by default.
 */
export const CP_BOOTSTRAP_DEFAULTS = {
  enabled: false,
  poll_seconds: 30,
  frame_male: null,
  frame_female: null,
} as const

/** Longest the CP route gate waits for a cold-start bootstrap before treating CP as off. */
export const CP_GATE_WAIT_MS = 8000
