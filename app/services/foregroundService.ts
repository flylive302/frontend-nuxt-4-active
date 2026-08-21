// ========================================
// Foreground Service — native plugin bridge
// ========================================
//
// Typed wrapper around the custom Android `ForegroundService` Capacitor plugin
// (capacitor-03/04). The plugin holds the shell's process in the foreground via a
// typed Android foreground service so a Speaker keeps producing (`microphone`) and
// a Listener keeps hearing (`mediaPlayback`) with the screen off. See
// `android/app/src/main/java/com/flylive/app/fgs/`.
//
// Every method is a NO-OP off Android: on web / iOS / SSR the plugin is absent,
// so the coordinator that consumes this stays harmlessly inert and the FGS watch
// can be installed unconditionally. Both `microphone` and `mediaPlayback` are
// backed by native handlers.

import { Capacitor, registerPlugin } from '@capacitor/core'
import type { FgsService } from '~/utils/fgs-policy'

/** Both services are backed by a native handler. */
type NativeFgsService = FgsService

interface ForegroundServicePlugin {
  /** Start the given foreground service (with its persistent notification). */
  start(options: { service: NativeFgsService }): Promise<void>
  /** Stop the given foreground service. */
  stop(options: { service: NativeFgsService }): Promise<void>
  /**
   * Request POST_NOTIFICATIONS (API 33+) so the broadcasting notification can
   * render. Returns whether it was granted — but the caller must NOT gate the
   * FGS on it (a denied notification still leaves the service running; D3).
   */
  ensureNotificationPermission(): Promise<{ granted: boolean }>
  /**
   * Emitted by a service whose foreground start Android REJECTED (mic-fgs-crash
   * 04). The native side survives the rejection instead of dying, so nothing
   * else would record it — no process death for Play Console, and this app ships
   * no native crash reporter.
   */
  addListener(
    event: 'foregroundServiceFailed',
    handler: (payload: { service: NativeFgsService, error: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>
}

/** Payload of a rejected native foreground-service start. */
export interface ForegroundServiceFailure {
  service: NativeFgsService
  error: string
}

/** Android-only — `true` when the native plugin is actually present. */
export function isForegroundServiceAvailable(): boolean {
  return Capacitor.getPlatform() === 'android'
}

const plugin = registerPlugin<ForegroundServicePlugin>('ForegroundService')

export async function startForegroundService(service: NativeFgsService): Promise<void> {
  if (!isForegroundServiceAvailable()) return
  await plugin.start({ service })
}

export async function stopForegroundService(service: NativeFgsService): Promise<void> {
  if (!isForegroundServiceAvailable()) return
  await plugin.stop({ service })
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isForegroundServiceAvailable()) return false
  const { granted } = await plugin.ensureNotificationPermission()
  return granted
}

/**
 * Subscribe to native foreground-service start rejections (mic-fgs-crash 04).
 *
 * ⚠️ Inert until the native half ships. This is web-bundle code and reaches
 * users by OTA; the plugin that emits the event needs a store release (spec
 * D11). Registering early is deliberate — the listener simply never fires
 * against an older shell, and the two halves need no coordinated release.
 *
 * Never throws: on a shell without the event, `addListener` rejects and we
 * degrade to no reporting rather than breaking the caller.
 */
export async function onForegroundServiceFailure(
  handler: (failure: ForegroundServiceFailure) => void,
): Promise<void> {
  if (!isForegroundServiceAvailable()) return
  try {
    await plugin.addListener('foregroundServiceFailed', handler)
  } catch {
    // Older native shell: no such event. Nothing to report through.
  }
}
