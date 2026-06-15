// ========================================
// Foreground Service — native plugin bridge
// ========================================
//
// Typed wrapper around the custom Android `ForegroundService` Capacitor plugin
// (capacitor-03). The plugin holds the shell's process in the foreground via a
// `microphone`-typed Android foreground service so a Speaker keeps producing
// with the screen off. See `android/app/src/main/java/com/flylive/app/fgs/`.
//
// Every method is a NO-OP off Android: on web / iOS / SSR the plugin is absent,
// so the coordinator that consumes this stays harmlessly inert and the
// `producing` watch can be installed unconditionally. The only service backed by
// a native handler this slice is `microphone`; `mediaPlayback` is capacitor-04.

import { Capacitor, registerPlugin } from '@capacitor/core'
import type { FgsService } from '~/utils/fgs-policy'

/** The native `microphone` service is the only one implemented this slice. */
type NativeFgsService = Extract<FgsService, 'microphone'>

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
