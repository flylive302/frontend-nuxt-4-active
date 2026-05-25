// ========================================
// Wake Lock Composable
// ========================================
// Keeps the screen awake while the PWA is in the foreground.
// Automatically releases on page hide and re-acquires on page visible.
// Gracefully degrades on unsupported browsers (no-op).

import { createLogger } from '~/utils/logger'

const log = createLogger('[WakeLock]')

/** Module-level singleton — shared across all components */
let wakeLockSentinel: WakeLockSentinel | null = null
let isInitialized = false

export function useWakeLock() {
  const isActive = ref(false)
  const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator

  /**
   * Request a screen wake lock.
   * Safe to call multiple times — only acquires if not already held.
   */
  async function request(): Promise<void> {
    if (!isSupported) return
    if (wakeLockSentinel) return // Already held

    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen')
      isActive.value = true

      // The browser releases the lock when the page becomes hidden.
      // We listen for the release event to keep our state in sync.
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null
        isActive.value = false
      })
    } catch (err) {
      // Can fail if the page is hidden or battery saver is active
    }
  }

  /**
   * Explicitly release the wake lock.
   */
  async function release(): Promise<void> {
    if (!wakeLockSentinel) return

    try {
      await wakeLockSentinel.release()
      wakeLockSentinel = null
      isActive.value = false
    } catch (err) {
    }
  }

  /**
   * Initialize auto-management: acquire on visible, release on hidden.
   * Call once at app level — subsequent calls are no-ops.
   */
  function init(): void {
    if (!isSupported || isInitialized) return
    isInitialized = true

    // Re-acquire when page becomes visible again
    // (the browser auto-releases on hide, so we must re-acquire)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void request()
      } else {
        void release()
      }
    })

    // Must not call request() while hidden — Chrome throws NotAllowedError (see DevTools console)
    if (document.visibilityState === 'visible') {
      void request()
    }
  }

  return {
    isSupported,
    isActive: readonly(isActive),
    request,
    release,
    init,
  }
}
