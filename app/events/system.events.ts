// ========================================
// System Events
// ========================================

import type { Socket } from 'socket.io-client'
import type { ConfigInvalidatePayload } from '~/types/room/socket-events'
import type { AssetInvalidatePayload } from '~/types/asset/asset'


/**
 * Composable to register system-level socket event handlers.
 * Captures store and asset management dependencies during setup() phase.
 */
export function useSystemEvents() {
  const bootstrapStore = useBootstrapStore()
  const { invalidateAsset } = useBootstrapAssets()

  return function registerSystemEvents(socket: Socket): void {
    socket.on('config:invalidate', (payload: ConfigInvalidatePayload) => {
      bootstrapStore.invalidateConfig(payload.type)
    })

    socket.on('asset:invalidate', (payload: AssetInvalidatePayload) => {
      invalidateAsset(payload)
    })
  }
}
