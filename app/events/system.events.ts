// ========================================
// System Events
// ========================================

import type { Socket } from 'socket.io-client'
import type { ConfigInvalidatePayload } from '~/types/socket-events'
import type { AssetInvalidatePayload } from '~/types/asset'
import * as cacheStorage from '~/services/cacheStorage'
import * as assetIndex from '~/services/assetIndex'
import * as assetDownloader from '~/services/assetDownloader'
import { createLogger } from '~/utils/logger'

const log = createLogger('[SystemEvents]')

/**
 * Register system-level socket event handlers.
 * Handles config invalidation and asset cache management.
 */
export function registerSystemEvents(socket: Socket): void {
  const bootstrapStore = useBootstrapStore()

  socket.on('config:invalidate', (payload: ConfigInvalidatePayload) => {
    log.debug('config:invalidate', payload)
    bootstrapStore.invalidateConfig(payload.type)
  })

  socket.on('asset:invalidate', async (payload: AssetInvalidatePayload) => {
    log.debug('asset:invalidate', payload)

    // Remove from cache storage
    await cacheStorage.deleteAsset(payload.url)

    // Remove from IndexedDB metadata
    await assetIndex.remove(payload.url)

    // Re-download if critical
    if (payload.priority === 'critical') {
      assetDownloader.enqueueManual(payload.url, {
        priority: 'critical',
        assetType: 'video', // Default, will be determined by URL
      })
    }

    log.debug('Asset invalidated:', payload.url)
  })
}
