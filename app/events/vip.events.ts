// ========================================
// VIP Events
// ========================================

import type { Socket } from 'socket.io-client'
import type { VipGiftedPayload, VipUpdatedPayload } from '~/types/vip/vip-level'
import { createLogger } from '~/utils/logger'
import { vipCongratsEvent } from '~/utils/vip-congrats-event'

const log = createLogger('[VipEvents]')

/**
 * Register VIP-related socket event handlers.
 * Handles VIP level updates and gift notifications.
 */
export function registerVipEvents(socket: Socket): void {
  socket.on('vip.updated', (payload: VipUpdatedPayload) => {
    log.debug('vip.updated', payload)

    // Detect VIP level increase for congratulations modal
    const authStore = useAuthStore()
    const userStore = useUserStore()
    const previousLevel = authStore.user?.vip_level ?? 0

    userStore.patchVip({
      vip_level: payload.vip_level,
      vip_level_id: payload.vip_level_id,
      vip_expires_at: payload.vip_expires_at,
    })

    // Fire congrats event if level increased
    if (payload.vip_level > previousLevel) {
      vipCongratsEvent.emit(payload.vip_level)
    }
  })

  socket.on('vip.gifted', (payload: VipGiftedPayload) => {
    log.debug('vip.gifted', payload)

    useToast().add({
      title: 'VIP Gift Received! 🎁',
      description: `${payload.sender_name} gifted you VIP Level ${payload.vip_level}!`,
      color: 'warning',
    })
  })
}
