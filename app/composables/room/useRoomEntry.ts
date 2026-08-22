// ========================================
// Room Entry Composable
// ========================================
//
// Centralizes room entry logic with password verification.
// All room entry points (card, profile, footer) use this
// composable to ensure consistent password gating.
// ========================================

import type { BootstrapRoom as Room } from '~/types/user/bootstrap'
import { resolveHttpBlockedMessage } from '~/utils/socket/socketErrorMessages'

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
  const roomSession = useRoomSession()
  const authStore = useAuthStore()
  const { api } = useApi()
  const { fetchRoomById } = useRoom()
  const { beginRoomExpand, clearRoomExpand } = useRoomExpandTransition()
  const route = useRoute()

  const showPasswordPrompt = ref(false)
  const pendingRoom = ref<Room | null>(null)
  /** Card background URL held across the password prompt so the morph still has its seed. */
  const pendingSeedSrc = ref('')
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
  async function enterRoom(room: Room, cardSeedSrc = ''): Promise<void> {
    if (entering.value) return

    // Same-room shortcut — if already in this room, just navigate back
    // without any leave/rejoin cycle. Preserves seat, owner status, and audio.
    if (roomStore.currentRoom?.id === room.id) {
      roomSession.maximizeRoom()
      await doEnterRoom(room, cardSeedSrc, { rejoin: false })
      return
    }

    // Owner bypass — owners always enter their own room
    if (authStore.user?.id === room.owner_id) {
      await doEnterRoom(room, cardSeedSrc)
      return
    }

    // Always verify with backend — stale listing data can't be trusted
    entering.value = true
    try {
      await api(`/rooms/${room.id}/join`, { method: 'POST', body: {} })
      // Access granted (room is public or has no password)
      await doEnterRoom(room, cardSeedSrc)
    } catch (error: unknown) {
      const err = error as Record<string, unknown>
      const response = err?.response as Record<string, unknown> | undefined
      const status = (response?.status as number | undefined) ?? err?.statusCode ?? err?.status
      const data = response?._data as { meta?: { error_code?: string; remaining_seconds?: number | 'permanent' } } | undefined
      const errorCode = data?.meta?.error_code
      // No navigation follows, so the card must not keep the shared element name.
      clearRoomExpand()
      if (status === 403 && errorCode === 'user_blocked') {
        // Blocked (ADR 0017) — distinct from password-required, so it must
        // not open the password prompt.
        const toast = useToast()
        toast.add({ title: 'Cannot Enter the Room', description: resolveHttpBlockedMessage(data?.meta?.remaining_seconds), color: 'error' })
      } else if (status === 403) {
        // Password required → show prompt
        pendingRoom.value = room
        pendingSeedSrc.value = cardSeedSrc
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
   *
   * The shared element name must be granted before `navigateTo`, since the
   * router starts capturing snapshots as soon as navigation resolves.
   */
  async function doEnterRoom(room: Room, cardSeedSrc = '', { rejoin = true } = {}): Promise<void> {
    // Capture the current route before navigating — used for back-navigation on leave/minimize
    const fromRoute = route.fullPath

    await beginRoomExpand(room.id, cardSeedSrc)

    // Await navigation so the caller's `entering=false` (which drops the loading
    // shrink) only runs AFTER the view transition has captured the card snapshot.
    // Otherwise the card un-shrinks to scale(1) a frame before capture and the
    // morph starts from full size — the grow-back jitter. Awaiting keeps the card
    // held at its shrunk state, so it grows straight from shrunk → fullscreen.
    if (!rejoin) {
      await navigateTo(`/room/${room.id}`)
      return
    }

    // Leave current room if switching (lifecycle watcher handles audio cleanup)
    if (roomStore.currentRoom) {
      roomSession.leaveRoom()
    }

    roomSession.setCurrentRoom(room, fromRoute)
    await navigateTo(`/room/${room.id}`)
    void fetchRoomById(room.id)
  }

  /**
   * Return to a room from the mini-player (live session or cold-start snapshot).
   *
   * - Live session (already in this room): enterRoom's same-room shortcut just
   *   maximizes + navigates — seat/audio preserved.
   * - Cold start (currentRoom was wiped, restoring from the persisted snapshot):
   *   enterRoom runs a fresh verify + join.
   *
   * Caveat: a cold-start restore of a PASSWORD-protected room would hit a 403 and
   * try to show the password prompt — but that modal isn't mounted at the app
   * shell, so it'd be a silent no-op. Guide the user to re-enter from the listing
   * instead. Owners bypass the password check, so they restore normally.
   */
  function returnToRoom(room: Room): void {
    const isColdStart = roomStore.currentRoom?.id !== room.id
    const isOwner = authStore.user?.id === room.owner_id
    if (isColdStart && room.is_password_protected && !isOwner) {
      useToast().add({
        title: 'Re-enter this room',
        description: 'Open it again from the room list to enter the password.',
        color: 'info',
      })
      return
    }
    enterRoom(room)
  }

  /**
   * Called when password is successfully verified via the modal.
   * Enters the pending room and clears modal state.
   */
  function onPasswordSuccess(): void {
    if (pendingRoom.value) {
      void doEnterRoom(pendingRoom.value, pendingSeedSrc.value)
      pendingRoom.value = null
      pendingSeedSrc.value = ''
    }
  }

  return {
    /** Main entry point — use this from all room entry surfaces */
    enterRoom,
    /** Return to a minimized room from the mini-player (live or cold-start) */
    returnToRoom,
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
