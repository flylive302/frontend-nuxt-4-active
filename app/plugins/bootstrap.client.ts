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
  const { startAssetDownload, pause, resume } = useBootstrapAssets()
  const authStore = useAuthStore()

  init()

  // After first paint / LCP, prefetch bootstrap gift videos (multi-MB .webm) so they do not
  // contend with ImageKit on `/` (see useBootstrapAssets home-path skip + second phase).
  if (import.meta.client) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause()
      else resume()
    })

    window.addEventListener(
      'load',
      () => {
        const schedule =
          typeof requestIdleCallback !== 'undefined'
            ? (cb: IdleRequestCallback) => requestIdleCallback(cb, { timeout: 12_000 })
            : (cb: () => void) => setTimeout(cb, 1500)
        schedule(() => {
          void startAssetDownload({ giftBootstrapVideosOnly: true })
        })
      },
      { once: true },
    )
  }

  // When a user registers or completes OAuth mid-session, the plugin has already run
  // with no token. This watcher catches the null → token transition, triggers bootstrap
  // immediately, and lets init()'s REACT step call startAssetDownload() directly so
  // the profile wizard's 30–60 s of interaction is used as free download time.
  watch(
    () => authStore.token,
    (token, prevToken) => {
      if (token && !prevToken) {
        void init({ freshAuth: true })
      }
    },
  )
})
