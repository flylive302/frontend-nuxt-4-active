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
  const phase = ref<'idle' | 'downloading' | 'complete' | 'error'>('idle')

  /** Download progress tracking */
  const progress = ref<DownloadProgress | null>(null)

  /** Error message if download failed */
  const error = ref<string | null>(null)

  // ── Critical-gate tracking ──────────────────────────────────────────

  /** Critical-priority assets actually enqueued (post cache-filter) */
  const criticalTotal = ref(0)

  /** Critical assets confirmed downloaded this session */
  const criticalSucceeded = ref(0)

  /** Critical assets that exhausted retries */
  const criticalFailed = ref(0)

  /** URLs of critical assets that exhausted retries; reset when retry is triggered */
  const criticalFailedUrls = ref<string[]>([])

  /** Total failed downloads across all priorities */
  const failedTotal = ref(0)

  /** URLs of all assets (any priority) that exhausted retries; reset when retry is triggered */
  const failedUrls = ref<string[]>([])

  /**
   * Set to true by the route guard (issue #16) when a cache sweep confirms all
   * critical URLs are present — allows fast-path on subsequent home navigations.
   */
  const cacheSweptAndConfirmed = ref(false)

  /**
   * Set to true when the user taps "Continue anyway" on the download screen.
   * Not persisted — resets to false on each app start.
   */
  const hasDegradedAssets = ref(false)

  /**
   * Set to true by the route guard (issue #16) to show the full-screen download gate.
   * Cleared by the download screen itself on completion or "Continue anyway".
   */
  const showDownloadGate = ref(false)

  // ========================================
  // Computed
  // ========================================

  /** Check if download is in progress */
  const isDownloading = computed(() => phase.value === 'downloading')

  /** Check if all assets are downloaded */
  const isComplete = computed(() => phase.value === 'complete')

  /** Count of cached/completed assets */
  const completedCount = computed(() => progress.value?.completed ?? 0)

  /** Count of total assets to download */
  const totalCount = computed(() => progress.value?.total ?? 0)

  /** Download percentage (0-100) */
  const downloadPercent = computed(() => {
    if (!progress.value || progress.value.total === 0) return 0
    return Math.round((progress.value.completed / progress.value.total) * 100)
  })

  /**
   * True when the critical asset set is fully downloaded (or confirmed cached by the route guard).
   * False when criticalTotal === 0 — bootstrap has not yet started.
   */
  const isCriticalGateOpen = computed(
    () => cacheSweptAndConfirmed.value || (criticalTotal.value > 0 && criticalSucceeded.value >= criticalTotal.value),
  )

  /** True when at least one critical asset exhausted all retries */
  const hasCriticalFailures = computed(() => criticalFailed.value > 0)

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

  /** Set how many critical items were enqueued this session (post cache-filter) */
  function setCriticalTotal(n: number): void {
    criticalTotal.value = n
  }

  /** Increment criticalSucceeded when a critical asset is confirmed downloaded */
  function markCriticalSucceeded(): void {
    criticalSucceeded.value++
  }

  /** Record a critical asset that exhausted retries */
  function markCriticalFailed(url: string): void {
    criticalFailed.value++
    criticalFailedUrls.value = [...criticalFailedUrls.value, url]
  }

  /** Record any asset (any priority) that exhausted retries */
  function markFailed(url: string): void {
    failedTotal.value++
    failedUrls.value = [...failedUrls.value, url]
  }

  /** Called by the route guard (issue #16) when cache sweep confirms all criticals are cached */
  function setCacheSweptAndConfirmed(val: boolean): void {
    cacheSweptAndConfirmed.value = val
  }

  /** Called when the user taps "Continue anyway" on the download screen */
  function setHasDegradedAssets(val: boolean): void {
    hasDegradedAssets.value = val
  }

  /** Show or hide the full-screen download gate overlay */
  function setShowDownloadGate(val: boolean): void {
    showDownloadGate.value = val
  }

  /** Reset failed URL lists when a retry action is triggered */
  function resetFailedUrls(): void {
    criticalFailedUrls.value = []
    failedUrls.value = []
  }

  /** Reset only critical failure tracking for the retry flow — leaves failedUrls/failedTotal intact */
  function resetCriticalFailures(): void {
    criticalFailed.value = 0
    criticalFailedUrls.value = []
  }

  /** Reset store state */
  function reset(): void {
    phase.value = 'idle'
    progress.value = null
    error.value = null
    criticalTotal.value = 0
    criticalSucceeded.value = 0
    criticalFailed.value = 0
    criticalFailedUrls.value = []
    failedTotal.value = 0
    failedUrls.value = []
    cacheSweptAndConfirmed.value = false
    hasDegradedAssets.value = false
    showDownloadGate.value = false
  }

  // ========================================
  // Return
  // ========================================

  return {
    // State
    phase,
    progress,
    error,
    criticalTotal,
    criticalSucceeded,
    criticalFailed,
    criticalFailedUrls,
    failedTotal,
    failedUrls,
    cacheSweptAndConfirmed,
    hasDegradedAssets,
    showDownloadGate,

    // Computed
    isDownloading,
    isComplete,
    completedCount,
    totalCount,
    downloadPercent,
    isCriticalGateOpen,
    hasCriticalFailures,

    // Setters
    setPhase,
    setProgress,
    setError,
    setCriticalTotal,
    markCriticalSucceeded,
    markCriticalFailed,
    markFailed,
    setCacheSweptAndConfirmed,
    setHasDegradedAssets,
    setShowDownloadGate,
    resetFailedUrls,
    resetCriticalFailures,
    reset,
  }
})
