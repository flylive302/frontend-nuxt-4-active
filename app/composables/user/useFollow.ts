// ========================================
// Follow Composable
// ========================================
// Manages follow/unfollow toggle with optimistic UI.
// Follows GATE → EXECUTE → REACT pipeline per ARCHITECTURE.md.

import type { UserProfile } from '~/types/user/user-profile'
import { createLogger } from '~/utils/logger'

const log = createLogger('[useFollow]')

// ========================================
// Types
// ========================================

interface FollowStatusResponse {
  status: 'success'
  data: {
    is_following: boolean
    is_followed_by: boolean
    followed_at: string | null
  }
}

// ========================================
// Composable
// ========================================

/**
 * Composable for follow/unfollow operations with optimistic UI.
 *
 * @param targetUserId - Reactive getter for the target user's ID
 * @param profileRef - Optional writable ref to the profile for optimistic count updates
 */
export function useFollow(
  targetUserId: MaybeRefOrGetter<number | null>,
  profileRef?: Ref<UserProfile | null>,
) {
  // ========================================
  // Dependencies
  // ========================================

  const { api, normalizeError } = useApi()
  const authStore = useAuthStore()
  const toast = useToast()

  // ========================================
  // State
  // ========================================

  const isFollowing = ref(false)
  const isFollowedBy = ref(false)
  const isToggling = ref(false)
  const statusLoaded = ref(false)

  // ========================================
  // Computed
  // ========================================

  /**
   * Whether the profile belongs to the authenticated user (self-follow guard).
   */
  const isSelf = computed(() => {
    const id = toValue(targetUserId)
    return id !== null && authStore.user?.id === id
  })

  /**
   * Button label based on current state.
   */
  const buttonLabel = computed(() => {
    if (isFollowing.value) return 'Following'
    if (isFollowedBy.value) return 'Follow Back'
    return 'Follow'
  })

  /**
   * Button icon based on current state.
   */
  const buttonIcon = computed(() => {
    return isFollowing.value ? 'i-lucide-user-check' : 'i-lucide-user-plus'
  })

  // ========================================
  // Actions
  // ========================================

  /**
   * Fetch current follow status from server.
   */
  async function fetchStatus(): Promise<void> {
    const id = toValue(targetUserId)
    if (!id || isSelf.value) return

    try {
      const response = await api<FollowStatusResponse>(`/users/${id}/follow-status`)
      isFollowing.value = response.data.is_following
      isFollowedBy.value = response.data.is_followed_by
      statusLoaded.value = true
    }
    catch (err) {
      log.warn('Failed to fetch follow status', err)
    }
  }

  /**
   * Toggle follow/unfollow with optimistic UI.
   *
   * GATE:    Prevent self-follow, prevent concurrent toggles
   * EXECUTE: Optimistic flip → API call → revert on failure
   * REACT:   Toast on error, update profile counts
   */
  async function toggleFollow(): Promise<void> {
    const id = toValue(targetUserId)

    // ── GATE ──
    if (!id || isSelf.value || isToggling.value) return

    isToggling.value = true
    const wasFollowing = isFollowing.value

    // ── EXECUTE (optimistic) ──
    isFollowing.value = !wasFollowing

    // Optimistically adjust profile count and authenticated user following count
    if (profileRef?.value) {
      profileRef.value = {
        ...profileRef.value,
        followers_count: profileRef.value.followers_count + (wasFollowing ? -1 : 1),
      }
    }
    if (wasFollowing) {
      authStore.decrementFollowing()
    }
    else {
      authStore.incrementFollowing()
    }

    try {
      if (wasFollowing) {
        // Unfollow
        await api(`/users/${id}/follow`, { method: 'DELETE' })
      }
      else {
        // Follow
        await api(`/users/${id}/follow`, { method: 'POST' })
      }
    }
    catch (err) {
      // ── REVERT on failure ──
      isFollowing.value = wasFollowing

      if (profileRef?.value) {
        profileRef.value = {
          ...profileRef.value,
          followers_count: profileRef.value.followers_count + (wasFollowing ? 1 : -1),
        }
      }

      if (wasFollowing) {
        authStore.incrementFollowing()
      }
      else {
        authStore.decrementFollowing()
      }

      // ── REACT (error) ──
      const normalized = normalizeError(err)
      toast.add({
        title: wasFollowing ? 'Unfollow failed' : 'Follow failed',
        description: normalized.message,
        color: 'error',
      })
    }
    finally {
      isToggling.value = false
    }
  }

  // ========================================
  // Auto-fetch on target change
  // ========================================

  watch(
    () => toValue(targetUserId),
    (newId, oldId) => {
      if (newId && newId !== oldId) {
        // Reset state
        isFollowing.value = false
        isFollowedBy.value = false
        statusLoaded.value = false
        void fetchStatus()
      }
    },
    { immediate: true },
  )

  // ========================================
  // Return
  // ========================================

  return {
    // State
    isFollowing: readonly(isFollowing),
    isFollowedBy: readonly(isFollowedBy),
    isToggling: readonly(isToggling),
    statusLoaded: readonly(statusLoaded),

    // Computed
    isSelf,
    buttonLabel,
    buttonIcon,

    // Actions
    toggleFollow,
    fetchStatus,
  }
}
