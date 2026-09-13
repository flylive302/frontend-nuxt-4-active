// ========================================
// Room Rank Badge (Data composable)
// ========================================
//
// Role: Data/derived. The emoji shown before a user's name on seats and in
// the participant list: owner 🏠, admin 🛡️, member ⭐, visitor nothing.
//
// Zero-cost on the seat hot path: reads two in-memory fields, no requests.
//   owner → `currentRoom.owner_id` (always serialized; instant, no MSAB wait)
//   admin/member → `participant.room_role`, resolved by MSAB once per join and
//                  pushed via `room:userRole` on membership changes
// ========================================

import { ROOM_RANK_BADGE } from '~/constants/room'
import type { RoomParticipant } from '~/types/room/audio'

export function useRoomRankBadge() {
  const roomStore = useRoomStore()

  /** Badge emoji for a participant, or '' for a visitor / unresolved rank. */
  function rankBadgeFor(participant: RoomParticipant | null | undefined): string {
    if (!participant) return ''
    if (roomStore.currentRoom?.owner_id === participant.id) return ROOM_RANK_BADGE.owner

    const role = participant.room_role
    return role ? ROOM_RANK_BADGE[role] : ''
  }

  return { rankBadgeFor }
}
