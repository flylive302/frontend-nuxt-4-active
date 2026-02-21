// ========================================
// Imports & Types
// ========================================
import type { MinimalUser } from '~/types/user/bootstrap'
import { useApi } from '../shared/useApi'

// ========================================
// Types
// ========================================

interface FollowListResponse {
  success: boolean
  data: MinimalUser[]
}

// ========================================
// Composable
// ========================================

/**
 * Composable for VIP gift flow.
 * Manages follower/following list fetching and recipient selection.
 */
export function useVipGift() {
  // ========================================
  // Composables / Dependencies
  // ========================================
  const { api, normalizeError } = useApi()

  // ========================================
  // State
  // ========================================
  const isModalOpen = ref(false)
  const recipients = ref<MinimalUser[]>([])
  const selectedRecipient = ref<MinimalUser | null>(null)
  const isLoading = ref(false)
  const searchQuery = ref('')

  // ========================================
  // Computed
  // ========================================

  /**
   * Filtered recipients based on search query.
   */
  const filteredRecipients = computed(() => {
    const query = searchQuery.value.toLowerCase().trim()
    if (!query) return recipients.value

    return recipients.value.filter(
      user =>
        user.name.toLowerCase().includes(query)
        || user.signature.toLowerCase().includes(query),
    )
  })

  // ========================================
  // API Methods
  // ========================================

  /**
   * Fetch followers and followings for VIP gifting.
   */
  async function fetchRecipients(): Promise<void> {
    isLoading.value = true

    try {
      const [followers, followings] = await Promise.all([
        api<FollowListResponse>('/user/followers'),
        api<FollowListResponse>('/user/followings'),
      ])

      // Merge and deduplicate by user ID
      const userMap = new Map<number, MinimalUser>()
      for (const user of [...followers.data, ...followings.data]) {
        userMap.set(user.id, user)
      }
      recipients.value = Array.from(userMap.values())
    }
    finally {
      isLoading.value = false
    }
  }

  // ========================================
  // Actions
  // ========================================

  /**
   * Open the gift modal and load recipients.
   */
  async function openModal(): Promise<void> {
    isModalOpen.value = true
    selectedRecipient.value = null
    searchQuery.value = ''

    if (recipients.value.length === 0) {
      await fetchRecipients()
    }
  }

  /**
   * Close the gift modal.
   */
  function closeModal(): void {
    isModalOpen.value = false
    selectedRecipient.value = null
    searchQuery.value = ''
  }

  /**
   * Select a recipient for VIP gifting.
   */
  function selectRecipient(user: MinimalUser): void {
    selectedRecipient.value = user
  }

  // ========================================
  // Return
  // ========================================
  return {
    isModalOpen,
    recipients,
    selectedRecipient,
    filteredRecipients,
    isLoading,
    searchQuery,
    openModal,
    closeModal,
    selectRecipient,
    fetchRecipients,
    normalizeError,
  }
}
