// ========================================
// Room Rehydration Composable
// ========================================
//
// Recovers a room session that a full page reload destroyed.
//
// The defect: `currentRoom` is in-memory only, so any reload nulls it, and the
// room page's route guard reads "no room in store" as "the user left" and
// silently navigates away. Both live reload causes (stale-chunk reload after a
// deploy, WebView renderer kill on low-end Android) converge on that one choke
// point, so recovering it fixes both.
//
// Marker-driven by design: rehydration requires a recent `activeRoom` marker
// naming *this* room. A cold `/room/:id` open with no marker is left exactly as
// it behaves today — auto-joining a live audio room from a link alone would
// broadcast the visitor's presence, which is a product decision, not a bug fix.
// ========================================

import type { BootstrapRoom as Room } from '~/types/user/bootstrap'
import { ACTIVE_ROOM_MARKER_TTL_MS } from '~/constants/room'
import { createLogger } from '~/utils/logger'

const log = createLogger('[RoomRehydration]')

interface RoomResponse {
  status: string
  data?: Room
}

export function useRoomRehydration() {
  const roomStore = useRoomStore()
  const roomSessionStore = useRoomSessionStore()
  const roomSession = useRoomSession()
  const { api } = useApi()

  /** True while a rehydrate is in flight, so the page can hold a loading state instead of redirecting. */
  const rehydrating = ref(false)

  /**
   * Rehydrate the room named by the route, if a recent marker authorises it.
   *
   * Returns whether the caller should stand down: `true` means rehydration is
   * handling this mount (in flight or succeeded), `false` means there is nothing
   * to recover and the normal redirect should proceed.
   */
  async function rehydrateFromRoute(roomId: number): Promise<boolean> {
    // GATE
    if (!isRehydratable(roomId)) return false

    // EXECUTE
    rehydrating.value = true
    try {
      // Fetched directly rather than via useRoom's fetchRoomById: that helper
      // returns void, swallows errors, and only writes when currentRoom is
      // already set — the opposite of this path, which runs precisely because
      // currentRoom is null and needs both the payload and the failure signal.
      const response = await api<RoomResponse>(`/rooms/${roomId}`, { method: 'GET' })
      const room = response.status === 'success' ? response.data : null
      if (!room) {
        onFailure('This room is no longer available.')
        return false
      }
      // Setting currentRoom is the whole job: the app-level lifecycle watcher in
      // useRoomLifecycle owns the socket join, seat reclaim, and the blocked-user
      // ejection from there. Reusing it is what keeps the block gate and the
      // password path identical to a normal entry — a second join path here is
      // exactly how those gates get bypassed by accident.
      roomSession.setCurrentRoom(room)
      return true
    } catch (error) {
      log.warn('Room rehydration failed', error)
      onFailure('Could not rejoin the room.')
      return false
    } finally {
      rehydrating.value = false
    }
  }

  // ========================================
  // GATE
  // ========================================

  /**
   * A rehydrate is authorised only by a marker that names this room and whose
   * heartbeat is inside the TTL. The freshness check is load-bearing: without
   * it, a marker left in localStorage would silently auto-join the user days
   * later from a shared link.
   */
  function isRehydratable(roomId: number): boolean {
    if (roomStore.currentRoom) return false

    const marker = roomSessionStore.activeRoom
    if (!marker || marker.id !== roomId) return false

    const age = Date.now() - marker.at
    if (age > ACTIVE_ROOM_MARKER_TTL_MS) {
      log.info('Active-room marker too stale to rehydrate', { roomId, age })
      roomSession.clearActiveRoom()
      return false
    }

    return true
  }

  // ========================================
  // REACT
  // ========================================

  /**
   * Failure must be legible. The silent disappearance is the defect being fixed,
   * so the failure branch tells the user before the page's guard redirects.
   */
  function onFailure(description: string): void {
    roomSession.clearActiveRoom()
    useToast().add({ title: 'Could not restore the room', description, color: 'warning' })
  }

  return {
    rehydrateFromRoute,
    rehydrating,
  }
}
