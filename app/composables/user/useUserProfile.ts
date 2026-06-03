// ========================================
// User Profile Composable
// ========================================

import type {
  UserProfile,
  ProfileGiftReceived,
  UserProfileResponse,
} from '~/types/user/user-profile'
import type { EquippedBadge } from '~/types/progression/badge'
import type { LevelInfo } from '~/composables/shared/useLevelLookup'
import { DEFAULT_WEALTH_BADGE, DEFAULT_CHARM_BADGE } from '~/composables/shared/useLevelLookup'
import { createLogger } from '~/utils/logger'

const log = createLogger('[useUserProfile]')

// ========================================
// Types
// ========================================

interface UseUserProfileOptions {
  /** Number of gifts per pagination page */
  perPage?: number
}

// ========================================
// Composable
// ========================================

/**
 * Self-contained composable for fetching and managing user profile data.
 * Uses local reactive state (no global store) for optimal memory management.
 *
 * @param signature - Reactive getter for the user's signature
 * @param options - Optional configuration
 * @returns Profile state and actions
 *
 * @example
 * ```vue
 * const signature = computed(() => route.params.UserSignature as string)
 * const { profile, loading, error, allGifts, fetchMoreGifts } = useUserProfile(signature)
 * ```
 */
export function useUserProfile(
  signature: MaybeRefOrGetter<string>,
  options: UseUserProfileOptions = {}
) {
  const { api, normalizeError } = useApi()
  const { getLevelFromXp } = useLevelLookup()

  // ========================================
  // Configuration
  // ========================================

  const { perPage = 20 } = options

  // ========================================
  // Local Reactive State
  // ========================================

  const profile = ref<UserProfile | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Level info (computed from XP after profile loads)
  const wealthLevelInfo = ref<LevelInfo | null>(null)
  const charmLevelInfo = ref<LevelInfo | null>(null)
  const levelInfoLoading = ref(false)

  // Gifts pagination state (for loading beyond initial page)
  const giftsCursor = ref<string | null>(null)
  const giftsLoading = ref(false)
  const giftsHasMore = ref(true)
  const additionalGifts = ref<ProfileGiftReceived[]>([])

  // ========================================
  // Computed
  // ========================================

  /**
   * All gifts: initial gifts from profile + paginated gifts.
   */
  const allGifts = computed<ProfileGiftReceived[]>(() => [
    ...(profile.value?.gifts_received ?? []),
    ...additionalGifts.value,
  ])

  /**
   * Whether the profile has been loaded successfully.
   */
  const hasProfile = computed(() => profile.value !== null)

  /**
   * Whether the user belongs to an agency.
   */
  const hasAgency = computed(() => profile.value?.agency !== null)

  /**
   * Whether the user has a room.
   */
  const hasRoom = computed(() => profile.value?.room_id !== null)

  /**
   * Wealth badge image URL from computed level info.
   */
  const wealthBadgeSrc = computed(() =>
    wealthLevelInfo.value?.badge?.image_url ?? DEFAULT_WEALTH_BADGE
  )

  /**
   * Charm badge image URL from computed level info.
   */
  const charmBadgeSrc = computed(() =>
    charmLevelInfo.value?.badge?.image_url ?? DEFAULT_CHARM_BADGE
  )

  /**
   * Wealth level number.
   */
  const wealthLevel = computed(() => wealthLevelInfo.value?.level ?? 0)

  /**
   * Charm level number.
   */
  const charmLevel = computed(() => charmLevelInfo.value?.level ?? 0)

  /**
   * Equipped badges from profile (other user's public profile data).
   */
  const equippedBadges = computed<EquippedBadge[]>(() => profile.value?.equipped_badges ?? [])

  // ========================================
  // Actions
  // ========================================

  /**
   * Compute level info from XP values (sync, uses bootstrap store config).
   */
  function computeLevelInfo(): void {
    if (!profile.value) return

    levelInfoLoading.value = true
    try {
      wealthLevelInfo.value = getLevelFromXp(profile.value.wealth_xp, 'wealth')
      charmLevelInfo.value = getLevelFromXp(profile.value.charm_xp, 'charm')
    } catch (err) {
      log.warn('Failed to compute level info', err)
    } finally {
      levelInfoLoading.value = false
    }
  }

  /**
   * Fetch user profile by signature.
   * Resets all state before fetching.
   */
  async function fetchProfile(): Promise<void> {
    const sig = toValue(signature)
    if (!sig) {
      error.value = 'No signature provided'
      return
    }

    // Reset state
    loading.value = true
    error.value = null
    profile.value = null
    additionalGifts.value = []
    giftsCursor.value = null
    giftsHasMore.value = true
    wealthLevelInfo.value = null
    charmLevelInfo.value = null

    try {
      const response = await api<UserProfileResponse>(
        `/users/profile/${sig}`,
        { params: { per_page: perPage } }
      )

      profile.value = response.data

      giftsCursor.value = response.data.gifts_next_cursor ?? null
      giftsHasMore.value = response.data.gifts_has_more ?? false

      // Compute level info (sync, uses bootstrap store)
      computeLevelInfo()
    } catch (err) {
      const normalized = normalizeError(err)
      error.value = normalized.message
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch more gifts with cursor pagination.
   */
  async function fetchMoreGifts(): Promise<void> {
    const sig = toValue(signature)
    if (!sig || giftsLoading.value || !giftsHasMore.value) return

    giftsLoading.value = true

    try {
      const params: Record<string, unknown> = { per_page: perPage }
      if (giftsCursor.value) {
        params.cursor = giftsCursor.value
      }

      const response = await api<{
        status: 'success'
        data: ProfileGiftReceived[]
        meta: { next_cursor: string | null; has_more: boolean }
      }>(`/users/profile/${sig}/gifts`, { params })

      additionalGifts.value.push(...response.data)
      giftsCursor.value = response.meta.next_cursor
      giftsHasMore.value = response.meta.has_more
    } catch (err) {
      log.warn('Failed to load more gifts', err)
    } finally {
      giftsLoading.value = false
    }
  }

  /**
   * Reset all state to initial values.
   */
  function resetProfile(): void {
    profile.value = null
    loading.value = false
    error.value = null
    additionalGifts.value = []
    giftsCursor.value = null
    giftsHasMore.value = true
    giftsLoading.value = false
  }

  // ========================================
  // Auto-fetch on signature change
  // ========================================

  watch(
    () => toValue(signature),
    async (newSig, oldSig) => {
      if (newSig && newSig !== oldSig) {
        await fetchProfile()
      }
    },
    { immediate: true }
  )

  // ========================================
  // Return
  // ========================================

  return {
    // State (readonly to prevent external mutation)
    profile: readonly(profile),
    loading: readonly(loading),
    error: readonly(error),

    // Computed
    hasProfile,
    hasAgency,
    hasRoom,
    allGifts,

    // Level info
    wealthLevel,
    charmLevel,
    wealthBadgeSrc,
    charmBadgeSrc,
    levelInfoLoading: readonly(levelInfoLoading),

    // Equipped badges
    equippedBadges,

    // Gifts pagination
    giftsLoading: readonly(giftsLoading),
    giftsHasMore: readonly(giftsHasMore),

    // Actions
    fetchProfile,
    fetchMoreGifts,
    resetProfile,
  }
}
