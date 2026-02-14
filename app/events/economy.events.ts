// ========================================
// Economy Events
// ========================================

import type { Socket } from 'socket.io-client'
import type {
  BalanceUpdatedPayload,
  RewardEarnedPayload,
} from '~/types/room/socket-events'
import { createLogger } from '~/utils/logger'

const log = createLogger('[EconomyEvents]')

/**
 * Register economy-related socket event handlers.
 * Handles balance updates and reward notifications.
 */
export function registerEconomyEvents(socket: Socket): void {
  socket.on('balance.updated', (payload: BalanceUpdatedPayload) => {
    log.debug('balance.updated', payload)

    // Update auth store (coins, diamonds, XP values on user object)
    const authStore = useAuthStore()
    authStore.updateBalance({
      coins: payload.coins,
      diamonds: payload.diamonds,
      wealth_xp: payload.wealth_xp,
      charm_xp: payload.charm_xp,
    })

    // Update levelsStore XP and recalculate progress bars
    const levelsStore = useLevelsStore()
    levelsStore.updateWealthXp(parseFloat(payload.wealth_xp))
    levelsStore.updateCharmXp(parseFloat(payload.charm_xp))
  })

  socket.on('reward.earned', (payload: RewardEarnedPayload) => {
    log.debug('reward.earned', payload)
    useToast().add({
      title: 'Reward Earned!',
      description: `You earned ${payload.reward.amount} ${payload.reward.type}`,
      color: 'success',
    })
  })
}
