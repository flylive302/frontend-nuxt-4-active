/**
 * Gift selection eligibility — reads auth + seats; stays out of the gift store (ARCHITECTURE.md).
 */
import type { BootstrapUser } from '~/types/user/bootstrap'

export function useGiftEligibility() {
  const giftStore = useGiftStore()
  const authStore = useAuthStore()
  const seatsStore = useRoomSeatsStore()

  const eligibleRecipients = computed((): BootstrapUser[] => {
    const currentUserId = authStore.user?.id
    return seatsStore.seats
      .filter(seat => seat.user !== null && seat.user.id !== currentUserId)
      .map(seat => seat.user!)
  })

  const canAfford = computed(() => {
    const coins = Number(authStore.user?.coins ?? 0)
    return coins >= giftStore.totalCost
  })

  const canSend = computed(
    () =>
      giftStore.selectedGift !== null &&
      giftStore.selectedRecipients.length > 0 &&
      giftStore.selectedQuantity > 0 &&
      canAfford.value
  )

  function selectAllRecipients(): void {
    giftStore.setSelectedRecipientIds(eligibleRecipients.value.map(r => r.id))
  }

  return {
    eligibleRecipients,
    canAfford,
    canSend,
    selectAllRecipients,
  }
}
