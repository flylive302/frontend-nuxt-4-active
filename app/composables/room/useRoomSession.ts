import type { BootstrapRoom as Room } from '~/types/user/bootstrap'

/**
 * Cross-store coordinator for room state (EXECUTE). `roomStore` holds the hot,
 * in-memory half (`currentRoom`, `isMinimized`, `status`); `roomSessionStore`
 * holds the persisted half (`userRoom`, `previousRoute`, `minimizedRoom`,
 * `activeRoom`). Architecture forbids stores calling each other, so every
 * transition that must touch both goes through here.
 */
export function useRoomSession() {
  const roomStore = useRoomStore()
  const session = useRoomSessionStore()

  /** Enter a room. `fromRoute` is kept for back-navigation. */
  function setCurrentRoom(room: Room | null, fromRoute?: string) {
    if (fromRoute) session.setPreviousRoute(fromRoute)
    roomStore.setCurrentRoom(room)
    session.setMinimizedRoom(null)
    session.setActiveRoom(room ? room.id : null)
  }

  /** Minimize — flag + persisted snapshot. Caller handles navigateTo(). */
  function minimizeRoom() {
    if (!roomStore.currentRoom) return
    roomStore.setMinimized(true)
    session.setMinimizedRoom(roomStore.currentRoom)
  }

  function maximizeRoom() {
    if (!roomStore.currentRoom) return
    roomStore.setMinimized(false)
    session.setMinimizedRoom(null)
  }

  /**
   * Clear local room session state. Audio/mediasoup teardown is handled by
   * useRoomLifecycle watching currentRoom or by useRoomAudio.leaveRoom().
   * A genuine leave must invalidate the marker immediately — otherwise a
   * reload moments later would rehydrate a room the user deliberately left.
   */
  function leaveRoom() {
    roomStore.setCurrentRoom(null)
    session.setMinimizedRoom(null)
    session.setActiveRoom(null)
  }

  /** Heartbeat — keeps the active-room marker inside its TTL. */
  function touchActiveRoom() {
    if (roomStore.currentRoom) session.setActiveRoom(roomStore.currentRoom.id)
  }

  function clearActiveRoom() {
    session.setActiveRoom(null)
  }

  return { setCurrentRoom, minimizeRoom, maximizeRoom, leaveRoom, touchActiveRoom, clearActiveRoom }
}
