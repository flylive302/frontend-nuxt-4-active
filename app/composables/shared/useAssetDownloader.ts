// ========================================
// Asset Downloader Composable
// ========================================

import type { DownloadProgress, EnqueueOptions } from '~/types/asset/asset'
import * as assetDownloader from '~/services/assetDownloader'
import { createLogger } from '~/utils/logger'

const log = createLogger('[useAssetDownloader]')

// ========================================
// Composable
// ========================================

/**
 * Composable wrapper for asset downloader service.
 * Provides reactive state and lifecycle management.
 */
export function useAssetDownloader() {
  // Reactive state
  const progress = ref<DownloadProgress | null>(null)
  const needsConsent = ref(false)
  const consentSizeBytes = ref(0)
  const isDownloading = ref(false)

  // Subscriptions cleanup
  let unsubProgress: (() => void) | null = null
  let unsubComplete: (() => void) | null = null
  let unsubConsent: (() => void) | null = null

  /**
   * Initialize subscriptions.
   */
  function init(): void {
    unsubProgress = assetDownloader.onProgress((p) => {
      progress.value = p
      isDownloading.value = assetDownloader.isDownloading()
    })

    unsubComplete = assetDownloader.onComplete(() => {

      isDownloading.value = false
    })

    unsubConsent = assetDownloader.onNeedConsent((sizeBytes) => {

      needsConsent.value = true
      consentSizeBytes.value = sizeBytes
    })

    // Get initial state
    progress.value = assetDownloader.getProgress()
    isDownloading.value = assetDownloader.isDownloading()


  }

  /**
   * Cleanup subscriptions.
   */
  function cleanup(): void {
    unsubProgress?.()
    unsubComplete?.()
    unsubConsent?.()
    unsubProgress = null
    unsubComplete = null
    unsubConsent = null
  }

  /**
   * Enqueue a single asset for download.
   */
  function enqueue(url: string, options: EnqueueOptions): void {
    assetDownloader.enqueueManual(url, options)
  }

  /**
   * Grant cellular consent and resume downloads.
   */
  function grantConsent(): void {
    needsConsent.value = false
    assetDownloader.setCellularConsent(true)
    const { trackCellularConsentGiven } = useTelemetry()
    trackCellularConsentGiven()

  }

  /**
   * Deny cellular consent and pause downloads.
   */
  function denyConsent(): void {
    needsConsent.value = false
    assetDownloader.setCellularConsent(false)
    const { trackCellularConsentDenied } = useTelemetry()
    trackCellularConsentDenied()

  }

  /**
   * Start download processing.
   */
  function start(): void {
    assetDownloader.start()
  }

  /**
   * Pause download processing.
   */
  function pause(): void {
    assetDownloader.pause()
  }

  /**
   * Resume download processing.
   */
  function resume(): void {
    assetDownloader.resume()
  }

  // Initialize on mount, cleanup on unmount
  if (import.meta.client) {
    onMounted(init)
    onUnmounted(cleanup)
  }

  return {
    // State
    progress: readonly(progress),
    needsConsent: readonly(needsConsent),
    consentSizeBytes: readonly(consentSizeBytes),
    isDownloading: readonly(isDownloading),

    // Actions
    enqueue,
    grantConsent,
    denyConsent,
    start,
    pause,
    resume,
  }
}
