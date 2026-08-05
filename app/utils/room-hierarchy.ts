// ========================================
// Room Hierarchy
// ========================================
//
// Pure rank rules for `owner > admin > member`, shared by every surface that
// offers a moderation action (seat drawer, participant profile, members tab).
//
// The backend is the authority — `RoomMemberService::blockMember` and
// `RoomPolicy` enforce the same rules and reject anything that slips past.
// These functions exist so the UI never *offers* an action the server will
// refuse.
// ========================================

import type { RoomMemberRole } from '~/types/room/room'

/** The three ranks the backend actually stores (`RoomMemberRole` PHP enum). */
export type RoomRank = 'owner' | 'admin' | 'member'

/**
 * Narrow the frontend's wider `RoomMemberRole` union (it still carries a
 * legacy `moderator` value the backend never issues) to a real rank.
 */
export function toRoomRank(role: RoomMemberRole | null | undefined): RoomRank {
  if (role === 'owner') return 'owner'
  if (role === 'admin') return 'admin'
  return 'member'
}

/**
 * Whether `actor` may remove `target` from the room (kick = block, ADR 0017).
 *
 * - Owner removes anyone but themselves.
 * - Admin removes plain members only — never the owner, never another admin.
 * - Member removes nobody.
 */
export function canRemoveFromRoom(actor: RoomRank, target: RoomRank): boolean {
  if (actor === 'owner') return target !== 'owner'
  if (actor === 'admin') return target === 'member'
  return false
}

/**
 * Whether `actor` may promote or demote admins. Owner only — an admin who
 * could promote would be able to out-number the owner in their own room.
 */
export function canManageRoomAdmins(actor: RoomRank): boolean {
  return actor === 'owner'
}
