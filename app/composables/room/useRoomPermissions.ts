/**
 * Room role helpers — cross-cutting auth + room store (not inside Pinia per ARCHITECTURE.md).
 */
export function useRoomPermissions() {
  const roomStore = useRoomStore()
  const authStore = useAuthStore()

  const isRoomOwner = computed(() => {
    if (!roomStore.currentRoom) return false
    return roomStore.currentRoom.owner?.id === authStore.user?.id
  })

  return { isRoomOwner }
}
