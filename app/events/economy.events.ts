// ========================================
// Economy Events
// ========================================

import type { Socket } from 'socket.io-client'
import type {
  BalanceUpdatedPayload,
  RewardEarnedPayload,
  CoinRequestStatusChangedPayload,
} from '~/types/room/socket-events'
import { createLogger } from '~/utils/logger'

const log = createLogger('[EconomyEvents]')

/**
 * Reactive signal for coin request status changes.
 * Components watching this ref will react when a request's status
 * is updated in real-time (approved/rejected).
 */
export const lastCoinRequestUpdate = ref<CoinRequestStatusChangedPayload | null>(null)

/**
 * Composable to register economy-related socket event handlers.
 * Captures store, action, and toast dependencies during setup() phase.
 */
export function useEconomyEvents() {
  const userStore = useUserStore()
  const { updateWealthXp, updateCharmXp } = useLevelActions()
  const toast = useToast()

  return function registerEconomyEvents(socket: Socket): void {
    socket.on('balance.updated', (payload: BalanceUpdatedPayload) => {
      // Update user store (coins, diamonds, XP values on user object)
      userStore.updateBalance({
        coins: payload.coins,
        diamonds: payload.diamonds,
        wealth_xp: payload.wealth_xp,
        charm_xp: payload.charm_xp,
      })

      // Update levelsStore XP and recalculate progress bars
      updateWealthXp(parseFloat(payload.wealth_xp))
      updateCharmXp(parseFloat(payload.charm_xp))
    })

    socket.on('reward.earned', (payload: RewardEarnedPayload) => {
      log.debug('reward.earned', payload)
      toast.add({
        title: 'Reward Earned!',
        description: `You earned ${payload.reward.amount} ${payload.reward.type}`,
        color: 'success',
      })
    })

    socket.on('coin_request.status_changed', (payload: CoinRequestStatusChangedPayload) => {
      log.debug('coin_request.status_changed', payload)

      const title = payload.status === 'approved' ? 'Request Approved!' : 'Request Declined'
      const description = payload.status === 'approved' && payload.approved_amount
        ? `${payload.approved_amount.toLocaleString()} ${payload.asset_type || 'coins'} approved`
        : `Your coin request was ${payload.status}`
      const color = payload.status === 'approved' ? 'success' : 'warning'

      toast.add({ title, description, color })

      // Update shared signal so purchase-coins page can react
      lastCoinRequestUpdate.value = payload
    })
  }
}
