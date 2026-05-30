// ========================================
// VIP Events
// ========================================

import type { Socket } from 'socket.io-client'
import type { VipGiftedPayload, VipUpdatedPayload } from '~/types/vip/vip-level'
import { createLogger } from '~/utils/logger'
import { vipCongratsEvent } from '~/utils/vip-congrats-event'

const log = createLogger('[VipEvents]')

/**
 * Composable to register VIP-related socket event handlers.
 * Captures store and toast dependencies during setup() phase.
 */
export function useVipEvents() {
  const authStore = useAuthStore()
  const toast = useToast()

  return function registerVipEvents(socket: Socket): void {
    socket.on('vip.updated', (payload: VipUpdatedPayload) => {

      // Detect VIP level increase for congratulations modal
      const previousLevel = authStore.user?.vip_level ?? 0

      authStore.patchVip({
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

      toast.add({
        title: 'VIP Gift Received! 🎁',
        description: `${payload.sender_name} gifted you VIP Level ${payload.vip_level}!`,
        color: 'warning',
      })
    })
  }
}
