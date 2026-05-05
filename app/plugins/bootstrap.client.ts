// ========================================
// Bootstrap Client Plugin
// ========================================

/**
 * Bootstrap plugin — thin INTENT trigger.
 * Delegates all orchestration to useBootstrapInit composable.
 *
 * PERF: Fire-and-forget — never blocks app mounting.
 * fetch(), Cache Storage, and IndexedDB are async I/O on browser
 * threads — they don't touch the main JS thread or affect UI.
 * The only visible indicator is the download progress bar.
 */
export default defineNuxtPlugin(() => {
  const { init } = useBootstrapInit()
  const { startAssetDownload } = useBootstrapAssets()
  const authStore = useAuthStore()

  init()

  // When a user logs in or registers mid-session, the plugin has already run
  // with no token. This watcher catches the null → token transition and starts
  // the asset download so gifts/badges preload during the onboarding flow.
  watch(
    () => authStore.token,
    (token, prevToken) => {
      if (token && !prevToken) {
        const schedule = typeof requestIdleCallback !== 'undefined'
          ? requestIdleCallback
          : (cb: () => void) => setTimeout(cb, 100)
        schedule(() => startAssetDownload())
      }
    },
  )
})
