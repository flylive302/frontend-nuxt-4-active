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
  const isDownloading = ref(false)

  // Subscriptions cleanup
  let unsubProgress: (() => void) | null = null
  let unsubComplete: (() => void) | null = null

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
    unsubProgress = null
    unsubComplete = null
  }

  /**
   * Enqueue a single asset for download.
   */
  function enqueue(url: string, options: EnqueueOptions): void {
    assetDownloader.enqueueManual(url, options)
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
    isDownloading: readonly(isDownloading),

    // Actions
    enqueue,
    start,
    pause,
    resume,
  }
}
