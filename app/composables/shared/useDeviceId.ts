/**
 * Generates and persists a stable device identifier in localStorage.
 * Used for device-level blocking via X-Device-ID header.
 *
 * The ID persists across browser restarts and PWA re-launches,
 * but can be cleared by the user via browser storage settings.
 * This is inherent to client-side fingerprinting; for stronger
 * identification, consider FingerprintJS in a future iteration.
 */
const STORAGE_KEY = 'flylive_device_id'

export function useDeviceId(): string {
  // SSR guard — return empty string on server (header won't be set)
  if (!import.meta.client) return ''

  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}
