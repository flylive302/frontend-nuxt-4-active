// ========================================
// Client Platform Resolver
// ========================================
//
// CE-03 (observability-audio-quality/07): not one measured production number
// can be attributed to the Android client — the primary client — because no
// Sentry event carries a platform dimension. Two other dimensions were
// checked and ruled out first:
//
//   - `release` cannot substitute: the web build's release is a commit hash
//     from the deploy platform, the native build's is a commit hash from a
//     git command at `cap:build` time — format-identical, so the string
//     alone can never tell them apart.
//   - Per-call-site tagging is not enough: it only covers events someone
//     remembered to instrument. This has to be attached once, at Sentry
//     init, so it lands on every event.
//
// This module is only the pure half of that: mapping "is this the Capacitor
// native shell?" to a taggable platform value. The native check itself
// (`Capacitor.isNativePlatform()`) is impure — it reads a global bridge flag
// — so it stays with the caller (`sentry.client.config.ts`) and is passed in
// here already resolved, the same split `evaluateOtaUpdate` uses in
// `utils/ota-gate.ts` for its own impure inputs.
// ========================================

/**
 * The platform values a Sentry event may be tagged with.
 *
 * ⛔ Deliberately a CLOSED set, and `resolveClientPlatform` is the only way to
 * produce one. The input is a bare `string` from a third-party bridge; passing
 * it through to a tag would let an unrecognised value mint a new tag value.
 * `unknown` is the catch-all instead — an honest bucket beats a wrong label.
 */
export type ClientPlatform = 'android' | 'ios' | 'web' | 'unknown'

/**
 * Pure: map Capacitor's platform id to a Sentry platform tag.
 *
 * Deliberately keyed on the Capacitor platform, NOT on `useClientInfo()` /
 * `getClientType()` — that pair answers a different question (browser vs
 * installed-PWA, by `display-mode`) for an HTTP header only, and has never
 * asked whether the code is inside the native shell. See the note left on
 * that composable.
 *
 * ⛔ **Do not "simplify" this back to a boolean `isNativeShell` parameter.**
 * It was written that way first. FlyLive ships Android only today (there is
 * no `ios/` directory), so a boolean is correct *right now* — and on the day
 * an iOS target is added it silently tags every iOS event `android`. That is
 * the failure this whole epic exists to prevent: not missing data, but data
 * that is present, plausible and wrong. `Capacitor.getPlatform()` is sync and
 * costs exactly the same as `isNativePlatform()`.
 */
export function resolveClientPlatform(capacitorPlatform: string): ClientPlatform {
  switch (capacitorPlatform) {
    case 'android':
      return 'android'
    case 'ios':
      return 'ios'
    case 'web':
      return 'web'
    default:
      return 'unknown'
  }
}
