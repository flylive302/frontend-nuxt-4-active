/**
 * The device identifier sent as the `X-Device-ID` header (device-level blocking).
 *
 * - Native (account-bans 05): the id the OS gives this app — `Device.getId()`:
 *   Android `ANDROID_ID` (survives a reinstall and an app-data clear), iOS
 *   `identifierForVendor`. Sent raw, never hashed.
 * - Web, or native when `getId()` returns nothing / rejects / hangs: a random
 *   UUID persisted in localStorage (cleared with browser storage).
 *
 * ⚠️ `getId()` is async but the request hook is sync, so the native id is
 * resolved ONCE at boot (`resolveNativeDeviceId`, awaited by the
 * `01.device-id.client` plugin before any other plugin can make an API call)
 * and cached here. A lazy lookup would send the UUID on the first requests —
 * including the login row.
 */
import { Capacitor } from '@capacitor/core'
import { Device } from '@capacitor/device'
import { NATIVE_DEVICE_ID_TIMEOUT_MS } from '~/constants/device-id'
import { createLogger } from '~/utils/logger'

const log = createLogger('[DeviceId]')

const STORAGE_KEY = 'flylive_device_id'

/** The native OS id once resolved at boot; null on web or when unavailable. */
let _nativeId: string | null = null

/**
 * Resolve and cache the native device id. Never throws and never waits longer
 * than `timeoutMs`: on a timeout, an empty id or a rejection the app runs on
 * the stored UUID instead.
 */
export async function resolveNativeDeviceId(timeoutMs: number = NATIVE_DEVICE_ID_TIMEOUT_MS): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs)
  })

  // Started once; a result that lands AFTER the timeout still fills the cache,
  // so a slow bridge costs the first requests only, not the whole session
  // (a Device Block keyed on the native id must not be escapable that way).
  // `Promise.resolve().then` so even a synchronous throw from the bridge
  // becomes a rejection handled below, never a failed boot plugin.
  const lookup = Promise.resolve().then(() => Device.getId()).then((result) => {
    const identifier = result?.identifier
    if (typeof identifier === 'string' && identifier.trim() !== '') _nativeId = identifier
    return _nativeId
  })

  try {
    const id = await Promise.race([lookup, timeout])
    if (id === null) log.warn('Device.getId() gave no id (empty or too slow); using the stored UUID for now')
  } catch (error) {
    log.warn('Device.getId() failed; using the stored UUID', error)
  } finally {
    clearTimeout(timer)
  }
}

function storedUuid(): string {
  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}

export function useDeviceId(): string {
  // No-storage guard (the app is a pure SPA, but a bare node context has no
  // localStorage) — an empty value means the header carries no id.
  if (typeof localStorage === 'undefined') return ''
  return _nativeId ?? storedUuid()
}

/** Test-only: forget the cached native id between specs. */
export function _resetDeviceIdCache(): void {
  _nativeId = null
}
