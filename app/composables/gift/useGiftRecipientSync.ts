/**
 * Keeps selected gift recipients aligned with current eligible recipients.
 * UI components can opt into this REACT behavior.
 */
export function useGiftRecipientSync() {
  const giftStore = useGiftStore()
  const { eligibleRecipients } = useGiftEligibility()

  watch(
    eligibleRecipients,
    (eligible) => {
      const eligibleIds = new Set(eligible.map((recipient) => recipient.id))
      giftStore.selectedRecipients = giftStore.selectedRecipients.filter((id) => eligibleIds.has(id))
    },
    { deep: true },
  )
}
