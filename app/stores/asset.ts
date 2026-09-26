// ========================================
// Asset Store
// ========================================
// Stores = ref + computed + setters ONLY (no API, no toast, no cross-store calls)
// Ephemeral session state for asset download tracking.

import { defineStore } from 'pinia'
import type { DownloadProgress } from '~/types/asset/asset'

// ========================================
// Store Definition
// ========================================

export const useAssetStore = defineStore('asset', () => {
  // ========================================
  // State
  // ========================================

  /** Asset download phase */
  const phase = ref<'idle' | 'downloading' | 'complete' | 'partial' | 'error'>('idle')

  /** Download progress tracking */
  const progress = ref<DownloadProgress | null>(null)

  /** Error message if download failed */
  const error = ref<string | null>(null)

  /** Total failed downloads */
  const failedTotal = ref(0)

  /** URLs of assets that exhausted retries; reset when retry is triggered */
  const failedUrls = ref<string[]>([])

  // ========================================
  // Computed
  // ========================================

  /** Check if download is in progress */
  const isDownloading = computed(() => phase.value === 'downloading')

  /** Check if all assets are downloaded */
  const isComplete = computed(() => phase.value === 'complete')

  /** Check if download finished with some failures */
  const isPartial = computed(() => phase.value === 'partial')

  /** Count of cached/completed assets */
  const completedCount = computed(() => progress.value?.completed ?? 0)

  /** Count of total assets to download */
  const totalCount = computed(() => progress.value?.total ?? 0)

  /** Download percentage (0-100) */
  const downloadPercent = computed(() => {
    if (!progress.value || progress.value.total === 0) return 0
    return Math.round((progress.value.completed / progress.value.total) * 100)
  })

  // ========================================
  // Setters
  // ========================================

  /** Set download phase */
  function setPhase(newPhase: typeof phase.value): void {
    phase.value = newPhase
  }

  /** Set download progress */
  function setProgress(newProgress: DownloadProgress | null): void {
    progress.value = newProgress
  }

  /** Set error message */
  function setError(message: string | null): void {
    error.value = message
  }

  /** Record an asset that exhausted retries */
  function markFailed(url: string): void {
    failedTotal.value++
    failedUrls.value = [...failedUrls.value, url]
  }

  /** Reset failure tracking when the modal retry is triggered */
  function resetFailures(): void {
    failedTotal.value = 0
    failedUrls.value = []
  }

  /** Reset store state */
  function reset(): void {
    phase.value = 'idle'
    progress.value = null
    error.value = null
    failedTotal.value = 0
    failedUrls.value = []
  }

  // ========================================
  // Return
  // ========================================

  return {
    // State
    phase,
    progress,
    error,
    failedTotal,
    failedUrls,

    // Computed
    isDownloading,
    isComplete,
    isPartial,
    completedCount,
    totalCount,
    downloadPercent,

    // Setters
    setPhase,
    setProgress,
    setError,
    markFailed,
    resetFailures,
    reset,
  }
})
