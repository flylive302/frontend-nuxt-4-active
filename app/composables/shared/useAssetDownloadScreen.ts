// ========================================
// Asset Download Screen Composable
// ========================================
// Role: Orchestrator for the full-screen download gate.
// Pipeline: GATE → EXECUTE → REACT

export function useAssetDownloadScreen() {
  const assetStore = useAssetStore()
  const { isCriticalGateOpen, hasCriticalFailures } = storeToRefs(assetStore)
  const { retryFailedCriticals } = useBootstrapAssets()

  // ========================================
  // State
  // ========================================

  /** Tracks how many times the user has clicked Retry this session */
  const retryAttempts = ref(0)

  // ========================================
  // Computed
  // ========================================

  const displayState = computed((): 'downloading' | 'retry' | 'continue-anyway' | 'complete' => {
    if (isCriticalGateOpen.value) return 'complete'
    if (hasCriticalFailures.value) {
      return retryAttempts.value >= 2 ? 'continue-anyway' : 'retry'
    }
    return 'downloading'
  })

  // ========================================
  // Handlers
  // ========================================

  async function retryDownload(): Promise<void> {
    // GATE: increment before re-enqueue so UI reflects the new attempt count
    retryAttempts.value++
    // EXECUTE: re-enqueue failed critical URLs using their original metadata
    await retryFailedCriticals()
  }

  function continueAnyway(): void {
    // EXECUTE
    assetStore.setHasDegradedAssets(true)
    // REACT: dismiss gate and proceed to home
    assetStore.setShowDownloadGate(false)
    navigateTo('/')
  }

  // ========================================
  // REACT: auto-navigate when gate opens
  // ========================================

  watch(
    isCriticalGateOpen,
    (isOpen) => {
      if (!isOpen) return
      assetStore.setShowDownloadGate(false)
      navigateTo('/')
    },
    { immediate: true },
  )

  return {
    displayState,
    retryAttempts,
    retryDownload,
    continueAnyway,
  }
}
