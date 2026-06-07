/**
 * Announcement sound for the Recharge Activity finale cinematic.
 *
 * Prefetch: downloads the admin-uploaded sound as a blob URL so reveal
 * playback doesn't stall on a cold network request.
 *
 * Gesture prime: attaches a one-shot pointerdown listener that plays and
 * immediately pauses a silent Audio element, unlocking the browser's
 * autoplay policy.  This is necessary because the Ranking tab mounts as
 * the default tab (not from a user gesture), so a programmatic play() on
 * reveal would otherwise be blocked on iOS/Android.
 *
 * Module-level state is intentional: blob cache and unlock flag persist
 * across mount/unmount cycles (tab switches) so resources are not
 * re-downloaded or re-listened.
 */

import { createLogger } from '~/utils/logger'

const log = createLogger('[MissionFinaleSound]')

// ========================================
// Module-level state
// ========================================

const _blobCache: Record<string, string> = {}
let _gestureUnlocked = false
let _primeListenerAttached = false

// ========================================
// Composable
// ========================================

export function useMissionFinaleSound() {
  function prefetch(timeframe: string, url: string | null): void {
    if (!import.meta.client) return
    if (!url || _blobCache[timeframe]) return

    fetch(url)
      .then(r => r.blob())
      .then(b => {
        _blobCache[timeframe] = URL.createObjectURL(b)
        log.debug('Finale sound prefetched', { timeframe })
      })
      .catch((err: unknown) => {
        log.warn('Failed to prefetch finale sound', { timeframe, err })
      })
  }

  function primeGesture(): void {
    if (!import.meta.client || _gestureUnlocked || _primeListenerAttached) return
    _primeListenerAttached = true

    document.addEventListener('pointerdown', function handler() {
      _gestureUnlocked = true
      _primeListenerAttached = false
      document.removeEventListener('pointerdown', handler)
      const dummy = new Audio()
      dummy.play().then(() => dummy.pause()).catch(() => {})
    }, { once: true })
  }

  function play(timeframe: string): void {
    if (!import.meta.client) return
    const src = _blobCache[timeframe]
    if (!src) return
    const audio = new Audio(src)
    audio.play().catch((err: unknown) => {
      log.warn('Finale sound play failed', { timeframe, err })
    })
  }

  return { prefetch, primeGesture, play }
}
