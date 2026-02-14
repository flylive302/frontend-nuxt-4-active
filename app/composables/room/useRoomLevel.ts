// ========================================
// Room Level Composable
// ========================================

import type { RoomLevelProgress } from '~/types/room/room'

/**
 * Composable for managing room level progress.
 * Handles fetching and real-time level up events.
 */
export function useRoomLevel() {
  const store = useRoomMembershipStore()
  const { api, normalizeError } = useApi()
  const toast = useToast()

  // ========================================
  // State (from store)
  // ========================================

  const levelProgress = computed(() => store.levelProgress)
  const loading = computed(() => store.levelLoading)
  const error = computed(() => store.levelError)

  // ========================================
  // Actions
  // ========================================

  /**
   * Fetch room level progress.
   */
  async function fetchLevelProgress(roomId: number): Promise<void> {
    store.levelLoading = true
    store.levelError = null

    try {
      const response = await api<{
        success: true
        data: RoomLevelProgress
      }>(`/rooms/${roomId}/level`)

      store.levelProgress = response.data
    } catch (err) {
      const normalized = normalizeError(err)
      store.levelError = normalized.message
      console.error('[useRoomLevel] fetchLevelProgress failed:', err)
    } finally {
      store.levelLoading = false
    }
  }

  /**
   * Handle room level up event (real-time).
   */
  function onRoomLevelUp(newProgress: RoomLevelProgress): void {
    store.levelProgress = newProgress
    
    toast.add({
      title: 'Room Level Up!',
      description: `Room reached level ${newProgress.current_level}!`,
      color: 'success',
      icon: 'i-lucide-trophy',
    })
  }

  // ========================================
  // Return
  // ========================================

  return {
    // State
    levelProgress,
    loading,
    error,

    // Actions
    fetchLevelProgress,
    onRoomLevelUp,
  }
}
