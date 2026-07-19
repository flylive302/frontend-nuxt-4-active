/**
 * Device-level camera permission helper — mirrors {@link useMicPermission}.
 *
 * Same WebView caveat: `navigator.permissions.query` can keep returning
 * `'prompt'` after the OS grant persists, so we persist a device-scoped
 * "granted once" flag and treat a short-lived `getUserMedia` video stream as
 * the source of truth (silent when the grant already exists). Grabbed at
 * onboarding so the DM camera button can launch straight into the camera
 * without a capture-time prompt.
 */
import { createLogger } from '~/utils/logger'

const log = createLogger('[CameraPermission]')
const STORAGE_KEY = 'flylive_camera_granted'

export type CameraRequestResult = 'granted' | 'denied' | 'unavailable'

export function useCameraPermission() {
  /** True once the camera has been granted on this device (persisted). */
  function hasGrantedCamera(): boolean {
    if (!import.meta.client) return false
    return localStorage.getItem(STORAGE_KEY) === '1'
  }

  function markCameraGranted(): void {
    if (!import.meta.client) return
    localStorage.setItem(STORAGE_KEY, '1')
  }

  /**
   * Trigger the native permission grant by opening a short-lived camera
   * stream, then release it immediately. Safe to call best-effort.
   */
  async function requestCameraAccess(): Promise<CameraRequestResult> {
    if (!import.meta.client || !navigator.mediaDevices?.getUserMedia) return 'unavailable'
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach((track) => track.stop())
      markCameraGranted()
      return 'granted'
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        return 'denied'
      }
      log.warn('Camera access request failed', err)
      return 'unavailable'
    }
  }

  return { hasGrantedCamera, markCameraGranted, requestCameraAccess }
}
