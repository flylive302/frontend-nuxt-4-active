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
  init()
})
