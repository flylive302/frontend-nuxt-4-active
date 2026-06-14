// ========================================
// Auth Constants
// ========================================

/**
 * Native social-auth (Capacitor) timing.
 *
 * GRACE: after the system-browser Custom Tab is dismissed, wait this long for a
 * deep-link callback before treating the dismissal as a silent user cancel. The
 * deep link and `browserFinished` race on success; the grace window lets the
 * callback win so a successful sign-in is never mistaken for a cancel.
 *
 * TIMEOUT: hard ceiling on the whole round-trip (browser open → deep link →
 * code exchange). If nothing resolves by then, surface feedback and reset so the
 * button is usable again.
 */
export const NATIVE_SOCIAL_AUTH_CANCEL_GRACE_MS = 1500
export const NATIVE_SOCIAL_AUTH_TIMEOUT_MS = 120_000
