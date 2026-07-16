/**
 * Push-transport resolver — pure, framework-agnostic.
 *
 * Maps the running platform to the push **transport** the app must register on
 * (ADR 0013). The Capacitor shell registers an FCM token; `webpush` is retired
 * (PWA layer removed, ADR 0020) so the web platform resolves to a transport the
 * subscriber treats as a no-op. `apns` is reserved for the future iOS phase so
 * callers and storage need no reshaping when it lands.
 *
 * No Capacitor, no Vue, no sockets — just the decision so it is fully
 * unit-testable. The impure registration paths live in
 * `composables/notification/usePushSubscription.ts`.
 */

/** The platform the app is running on. */
export type PushPlatform = 'web' | 'native'

/** The delivery rail a registration uses. */
export type PushTransport = 'webpush' | 'fcm' | 'apns'

/**
 * Resolve which transport to register for the given platform.
 *
 * `native` resolves to `fcm` today (Android-only; iOS/APNs is parked). When iOS
 * lands, the caller distinguishes the native platform and this returns `apns`.
 */
export function resolvePushTransport(platform: PushPlatform): PushTransport {
  return platform === 'native' ? 'fcm' : 'webpush'
}
