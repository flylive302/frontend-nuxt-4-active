// ========================================
// Asset Delivery Policy Composable
// ========================================
// Role: Infrastructure composable — decides WHEN the asset downloader runs and
// WHAT it may fetch on the current network (boot-and-asset-delivery 04).
// Pipeline: INTENT (home settled / room entered / fallback timer) → GATE
// (catalog ready, signed in, once per session, network) → EXECUTE
// (useBootstrapAssets passes).
//
// Rules:
// - Nothing starts during cold boot: the boot pass waits for the first screen
//   to settle (home feed on screen) or for the fallback timer.
// - Unmetered (known Wi-Fi / ethernet): the boot pass queues the full
//   animation set. Metered (cellular, Data Saver, or unknown — iOS, most
//   desktop browsers): the boot pass only evicts; nothing is downloaded until
//   the first room entry, which queues the gift animations.
// - Both passes are quiet: no progress bar. Only the asset-manager modal's
//   manual button drives the bar.

import { ASSET_CONFIG } from '~/constants/asset'
import { isMeteredConnection } from '~/services/networkDetector'
import { createLogger } from '~/utils/logger'

const log = createLogger('[AssetDeliveryPolicy]')

/** Idle-callback deadline once the start delay has elapsed. */
const PASS_IDLE_TIMEOUT_MS = 5000

export function useAssetDeliveryPolicy() {
  const assetStore = useAssetStore()
  const bootstrapStore = useBootstrapStore()
  const authStore = useAuthStore()
  const { startAssetDownload, startRoomAssetDownload, evictAssets } = useBootstrapAssets()

  /** Fallback timer for a first screen that never reports settled. */
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null

  // ========================================
  // INTENT
  // ========================================

  /** The home feed is on screen (called by the home page). */
  function notifyHomeSettled(): void {
    assetStore.markBootSettled()
  }

  /** The user entered a room (called once the join attempt has finished). */
  function notifyRoomEntered(): void {
    assetStore.markRoomEntered()
  }

  /**
   * Install the trigger watcher. Called once, by the bootstrap plugin; every
   * other caller only flips the store flags through the INTENT functions.
   */
  function watchDeliveryTriggers(): void {
    watch(
      () => [bootstrapStore.isReady, Boolean(authStore.token), assetStore.bootSettled, assetStore.roomEntered] as const,
      () => evaluate(),
      { immediate: true },
    )
  }

  // ========================================
  // GATE
  // ========================================

  function evaluate(): void {
    // No catalog, no pass. A cold open whose fetch failed has discarded the
    // catalog; the catalog-diff eviction would read that as "all removed".
    // Guests have no use for gifts.
    if (!bootstrapStore.isReady || !authStore.token) return

    armFallback()

    // A room entered before the first screen settled (deep link) also opens
    // the boot pass: the user is past cold boot by then.
    if (!assetStore.bootPassStarted && (assetStore.bootSettled || assetStore.roomEntered)) {
      assetStore.markBootPassStarted()
      afterDelay(runBootPass)
    }

    if (!assetStore.roomPassStarted && assetStore.roomEntered) {
      assetStore.markRoomPassStarted()
      afterDelay(runRoomPass)
    }
  }

  function armFallback(): void {
    if (fallbackTimer !== null || assetStore.bootSettled) return
    fallbackTimer = setTimeout(() => {
      assetStore.markBootSettled()
    }, ASSET_CONFIG.BOOT_SETTLE_FALLBACK_MS)
  }

  // ========================================
  // EXECUTE
  // ========================================

  /**
   * Eviction runs on every network (local work only), so stale picture
   * entries leave the bucket for metered users too. Downloads need Wi-Fi.
   */
  async function runBootPass(): Promise<void> {
    try {
      if (isMeteredConnection()) {
        log.info('Metered connection: boot pass evicts only; gifts wait for the first room entry')
        await evictAssets()
        return
      }
      await startAssetDownload({ quiet: true })
    } catch (e) {
      log.warn('Boot asset pass failed', e)
    }
  }

  /**
   * Gift animations on every network: on metered links this is the only
   * download there is; on Wi-Fi they are already queued and dedupe away.
   */
  async function runRoomPass(): Promise<void> {
    try {
      await startRoomAssetDownload()
    } catch (e) {
      log.warn('Room asset pass failed', e)
    }
  }

  // ========================================
  // Helpers
  // ========================================

  /** Start delay, then the next idle slot, so a pass never lands on the screen's own work. */
  function afterDelay(pass: () => Promise<void>): void {
    setTimeout(() => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => { void pass() }, { timeout: PASS_IDLE_TIMEOUT_MS })
      } else {
        void pass()
      }
    }, ASSET_CONFIG.PASS_START_DELAY_MS)
  }

  return {
    notifyHomeSettled,
    notifyRoomEntered,
    watchDeliveryTriggers,
  }
}
