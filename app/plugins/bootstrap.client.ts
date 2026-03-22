// ========================================
// Bootstrap Client Plugin
// ========================================

/**
 * Bootstrap plugin — thin INTENT trigger.
 * Delegates all orchestration to useBootstrapInit composable.
 */
export default defineNuxtPlugin(async () => {
  const { init } = useBootstrapInit()
  await init()
})
