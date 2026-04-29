// ========================================
// Room Entry Composable
// ========================================
//
// Centralizes room entry logic with password verification.
// All room entry points (card, profile, footer) use this
// composable to ensure consistent password gating.
// ========================================

import type { BootstrapRoom as Room } from '~/types/user/bootstrap'

/**
 * Composable for unified room entry with password protection.
 *
 * Handles:
 * - Owner bypass (owners always enter directly)
 * - Password-protected room verification (tries passwordless first,
 *   falls back to password prompt on 403)
 * - Room switching (leaves current room before entering new one)
 */
export function useRoomEntry() {
  const roomStore = useRoomStore()
  const authStore = useAuthStore()
  const { api } = useApi()
  const route = useRoute()

  const showPasswordPrompt = ref(false)
  const pendingRoom = ref<Room | null>(null)
  const entering = ref(false)

  // ========================================
  // Core Entry Logic
  // ========================================

  /**
   * Enter a room with password verification if needed.
   *
   * Flow:
   * 1. Owners → enter directly (always trusted)
   * 2. All other users → verify via backend join endpoint
   *    - Backend grants access if room is public / no password
   *    - Backend returns 403 if password required → show prompt
   *
   * We always hit the backend for non-owners because the room listing
   * data may be stale (e.g., owner just added a password but the card
   * still shows is_password_protected=false).
   */
  async function enterRoom(room: Room): Promise<void> {
    if (entering.value) return

    // Same-room shortcut — if already in this room, just navigate back
    // without any leave/rejoin cycle. Preserves seat, owner status, and audio.
    if (roomStore.currentRoom?.id === room.id) {
      roomStore.maximizeRoom()
      navigateTo(`/room/${room.id}`)
      return
    }

    // Owner bypass — owners always enter their own room
    if (authStore.user?.id === room.owner_id) {
      doEnterRoom(room)
      return
    }

    // Always verify with backend — stale listing data can't be trusted
    entering.value = true
    try {
      await api(`/rooms/${room.id}/join`, { method: 'POST', body: {} })
      // Access granted (room is public or has no password)
      doEnterRoom(room)
    } catch (error: unknown) {
      const err = error as Record<string, unknown>
      const response = err?.response as Record<string, unknown> | undefined
      const status = (response?.status as number | undefined) ?? err?.statusCode ?? err?.status
      if (status === 403) {
        // Password required → show prompt
        pendingRoom.value = room
        showPasswordPrompt.value = true
      } else {
        const toast = useToast()
        toast.add({ title: 'Failed to join room', color: 'error' })
      }
    } finally {
      entering.value = false
    }
  }

  /**
   * Navigate to the room page after all checks pass.
   * Handles room switching (leaves current room first).
   */
  function doEnterRoom(room: Room): void {
    // Capture the current route before navigating — used for back-navigation on leave/minimize
    const fromRoute = route.fullPath

    // Leave current room if switching (lifecycle watcher handles audio cleanup)
    if (roomStore.currentRoom) {
      roomStore.leaveRoom()
    }

    roomStore.setCurrentRoom(room, fromRoute)
    navigateTo(`/room/${room.id}`)
  }

  /**
   * Called when password is successfully verified via the modal.
   * Enters the pending room and clears modal state.
   */
  function onPasswordSuccess(): void {
    if (pendingRoom.value) {
      doEnterRoom(pendingRoom.value)
      pendingRoom.value = null
    }
  }

  return {
    /** Main entry point — use this from all room entry surfaces */
    enterRoom,
    /** Whether a password prompt modal should be shown */
    showPasswordPrompt,
    /** The room waiting for password, used as prop for the modal */
    pendingRoom,
    /** Whether an entry attempt is in progress */
    entering,
    /** Callback for password prompt modal success */
    onPasswordSuccess,
  }
}
