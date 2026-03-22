// ========================================
// System Events
// ========================================

import type { Socket } from 'socket.io-client'
import type { ConfigInvalidatePayload } from '~/types/room/socket-events'
import type { AssetInvalidatePayload } from '~/types/asset/asset'
import { createLogger } from '~/utils/logger'

const log = createLogger('[SystemEvents]')

/**
 * Register system-level socket event handlers.
 * Handles config invalidation and asset cache management.
 *
 * Events are REACT handlers — they map socket events to
 * store mutations and composable calls. No direct service calls.
 */
export function registerSystemEvents(socket: Socket): void {
  const bootstrapStore = useBootstrapStore()
  const { invalidateAsset } = useBootstrapAssets()

  socket.on('config:invalidate', (payload: ConfigInvalidatePayload) => {
    log.debug('config:invalidate', payload)
    bootstrapStore.invalidateConfig(payload.type)
  })

  socket.on('asset:invalidate', (payload: AssetInvalidatePayload) => {
    log.debug('asset:invalidate', payload)
    invalidateAsset(payload)
  })
}
