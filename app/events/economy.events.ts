// ========================================
// Economy Events
// ========================================

import { ref } from 'vue'
import type { Socket } from 'socket.io-client'
import type {
  BalanceUpdatedPayload,
  RewardEarnedPayload,
  CoinRequestStatusChangedPayload,
} from '~/types/room/socket-events'


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
  const authStore = useAuthStore()
  const { updateWealthXp, updateCharmXp, syncXpFromBalance } = useLevelActions()
  const toast = useToast()

  return function registerEconomyEvents(socket: Socket): void {
    socket.on('balance.updated', (payload: BalanceUpdatedPayload) => {
      // Update balance on auth user (coins, diamonds, XP values)
      authStore.updateBalance({
        coins: payload.coins,
        diamonds: payload.diamonds,
        wealth_xp: payload.wealth_xp,
        charm_xp: payload.charm_xp,
      })

      // Update auth user XP — reactive consumers recompute automatically
      updateWealthXp(parseFloat(payload.wealth_xp))
      updateCharmXp(parseFloat(payload.charm_xp))

      // Sync fresh XP to participants store and MSAB (composable handles both)
      syncXpFromBalance(payload.wealth_xp, payload.charm_xp)
    })

    socket.on('reward.earned', (payload: RewardEarnedPayload) => {
      toast.add({
        title: 'Reward Earned!',
        description: `You earned ${payload.reward.amount} ${payload.reward.type}`,
        color: 'success',
      })
    })

    socket.on('coin_request.status_changed', (payload: CoinRequestStatusChangedPayload) => {

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
