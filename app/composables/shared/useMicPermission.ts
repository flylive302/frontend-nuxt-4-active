/**
 * Device-level microphone permission helper.
 *
 * The seat flow must show its rationale dialog AT MOST ONCE per device, not on
 * every seat take/switch. We can't rely on `navigator.permissions.query` for
 * this: in the Android WebView it keeps returning `'prompt'` even after the OS
 * grant persists, which is what made the dialog reappear every time.
 *
 * Instead we persist a device-scoped "granted once" flag in localStorage (same
 * pattern as {@link useDeviceId}) and treat `getUserMedia` as the source of
 * truth — it is silent when the grant already exists. Once the flag is set the
 * caller skips the rationale entirely; a real denial still surfaces feedback.
 */
import { createLogger } from '~/utils/logger'

const log = createLogger('[MicPermission]')
const STORAGE_KEY = 'flylive_mic_granted'

export type MicState = 'granted' | 'prompt' | 'denied' | 'unknown'
export type MicRequestResult = 'granted' | 'denied' | 'unavailable'

export function useMicPermission() {
  /** True once the mic has been granted on this device (persisted). */
  function hasGrantedMic(): boolean {
    if (!import.meta.client) return false
    return localStorage.getItem(STORAGE_KEY) === '1'
  }

  function markMicGranted(): void {
    if (!import.meta.client) return
    localStorage.setItem(STORAGE_KEY, '1')
  }

  /**
   * Best-effort read of the current permission state. Returns `'unknown'` when
   * the Permissions API is unsupported or throws (common in Android WebView),
   * so callers must fall back to the rationale dialog rather than trust it.
   */
  async function probeMicState(): Promise<MicState> {
    if (!import.meta.client || !navigator.permissions?.query) return 'unknown'
    try {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      if (status.state === 'granted') {
        markMicGranted()
        return 'granted'
      }
      if (status.state === 'denied') return 'denied'
      return 'prompt'
    } catch {
      return 'unknown'
    }
  }

  /**
   * Trigger the native permission grant by opening a short-lived mic stream,
   * then release it immediately. On success the device flag is set so the
   * rationale never shows again. Safe to call best-effort (e.g. at onboarding).
   */
  async function requestMicAccess(): Promise<MicRequestResult> {
    if (!import.meta.client || !navigator.mediaDevices?.getUserMedia) return 'unavailable'
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      markMicGranted()
      return 'granted'
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        return 'denied'
      }
      log.warn('Mic access request failed', err)
      return 'unavailable'
    }
  }

  return { hasGrantedMic, markMicGranted, probeMicState, requestMicAccess }
}
