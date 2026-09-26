// ========================================
// Bootstrap Client Plugin
// ========================================

/**
 * Bootstrap plugin — thin INTENT trigger.
 * Delegates all orchestration to useBootstrapInit composable.
 *
 * PERF: Fire-and-forget — never blocks app mounting.
 * The automatic animation passes are quiet; only the asset-manager modal's
 * manual download drives the progress bar.
 */
export default defineNuxtPlugin(() => {
  // Maintenance wall: the app renders one static page and nothing else, so skip
  // the /bootstrap fetch and the multi-MB gift-asset prefetch. Both would only
  // retry against a backend that is intentionally down.
  if (useRuntimeConfig().public.maintenanceMode) return

  const { init } = useBootstrapInit()
  const { pause, resume } = useBootstrapAssets()
  const { watchDeliveryTriggers } = useAssetDeliveryPolicy()
  const authStore = useAuthStore()

  init()

  // Animation downloads start once the catalog is ready AND the first screen
  // has settled, on Wi-Fi only; on mobile data they wait for the first room
  // entry (boot-and-asset-delivery 04). Never during cold boot.
  watchDeliveryTriggers()

  if (import.meta.client) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause()
      else resume()
    })
  }

  // When a user registers or completes OAuth mid-session, the plugin has already run
  // with no token. This watcher catches the null → token transition and bootstraps;
  // the delivery policy's watcher sees the token + catalog and waits for home to settle.
  watch(
    () => authStore.token,
    (token, prevToken) => {
      if (token && !prevToken) {
        void init()
      }
    },
  )
})
