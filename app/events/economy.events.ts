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
import { createFrameCoalescer } from '~/utils/frame-batcher'


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
    // A gift combo pushes one balance.updated per tap (hundreds per second).
    // Every payload is absolute, so only the LATEST matters: apply it once
    // per frame instead of re-rendering every balance consumer per tap.
    let latestBalance: BalanceUpdatedPayload | null = null
    const applyBalance = createFrameCoalescer(() => {
      const payload = latestBalance
      latestBalance = null
      if (!payload) return

      // gift-authority-tick-fanout ticket 13: a push carrying `seq` (i.e. the
      // connection advertised `ackBalance`) goes through the sequence-guarded
      // setter so an out-of-order push can never move the balance backwards.
      // No `seq` ⇒ legacy path, unchanged.
      if (payload.seq !== undefined) {
        authStore.applyBalance({
          coins: payload.coins,
          diamonds: payload.diamonds,
          wealth_xp: payload.wealth_xp,
          charm_xp: payload.charm_xp,
          seq: payload.seq,
        })
      } else {
        authStore.updateBalance({
          coins: payload.coins,
          diamonds: payload.diamonds,
          wealth_xp: payload.wealth_xp,
          charm_xp: payload.charm_xp,
        })
      }

      // Update auth user XP — reactive consumers recompute automatically
      updateWealthXp(parseFloat(payload.wealth_xp))
      updateCharmXp(parseFloat(payload.charm_xp))

      // Sync fresh XP to participants store and MSAB (composable handles both)
      syncXpFromBalance(payload.wealth_xp, payload.charm_xp)
    })

    socket.on('balance.updated', (payload: BalanceUpdatedPayload) => {
      // "Latest wins within a frame, but only if newer" (ticket 13): if a
      // lower-`seq` payload lands after a higher-`seq` one inside the SAME
      // frame, keep the higher one — otherwise the frame coalescer would
      // hand the stale one to `applyBalance`, which drops it, losing the
      // fresher value entirely instead of merely being a no-op.
      if (
        latestBalance?.seq !== undefined
        && payload.seq !== undefined
        && payload.seq <= latestBalance.seq
      ) {
        return
      }
      latestBalance = payload
      applyBalance.schedule()
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
