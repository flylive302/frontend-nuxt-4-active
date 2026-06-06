/**
 * Intent-based asset preloader for the Recharge Activity mission.
 *
 * Preloads static decorative assets (RECHARGE_ACTIVITY constants) so the
 * page opens without visible lag. Designed to be triggered on intent —
 * e.g. when a recharge banner enters the viewport or the user hovers.
 *
 * Dynamic assets (announcement sounds, finale VAP) are not preloaded here —
 * those land in later slices once the admin config surface ships their URLs.
 *
 * Mirrors the pattern of useVipAssetPreloader but uses Image() preloading
 * for static PNGs rather than plugin caches.
 */

import { RECHARGE_ACTIVITY } from '~/constants/assets'
import { createLogger } from '~/utils/logger'

const log = createLogger('[MissionAssetPreloader]')

// ========================================
// Types
// ========================================

interface UseMissionAssetPreloaderReturn {
  /** Trigger the preload. Safe to call multiple times — only runs once. */
  preload: () => void
  /** Whether preloading has been triggered at least once. */
  hasPreloaded: Readonly<ReturnType<typeof ref<boolean>>>
}

// ========================================
// Module-level flag — preload is a one-shot across all instances
// ========================================

let _hasPreloaded = false

// ========================================
// Composable
// ========================================

export function useMissionAssetPreloader(): UseMissionAssetPreloaderReturn {
  const hasPreloaded = ref(_hasPreloaded)

  function preload(): void {
    if (!import.meta.client) return
    if (_hasPreloaded) return

    _hasPreloaded = true
    hasPreloaded.value = true

    const urls = Object.values(RECHARGE_ACTIVITY).filter(
      (v): v is string => typeof v === 'string',
    )

    for (const url of urls) {
      const img = new Image()
      img.onerror = () => log.warn('Failed to preload mission asset', url)
      img.src = url
    }
  }

  return {
    preload,
    hasPreloaded: readonly(hasPreloaded),
  }
}
