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
