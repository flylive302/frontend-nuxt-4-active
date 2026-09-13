import { describe, expect, it, vi } from 'vitest'
import { ROOM_RANK_BADGE } from '../../app/constants/room'
import type { RoomParticipant } from '../../app/types/room/audio'

// ============================================================
// room-role-badge — seat / participant-list rank emoji
//
// Owner comes from the room's owner_id (instant); admin/member from the
// participant's MSAB-resolved room_role; visitors get nothing.
// ============================================================

const roomStore = { currentRoom: { owner_id: 1 } as { owner_id: number } | null }
vi.stubGlobal('useRoomStore', () => roomStore)

const { useRoomRankBadge } = await import('../../app/composables/room/useRoomRankBadge')

function participant(id: number, room_role?: RoomParticipant['room_role']): RoomParticipant {
  return { id, name: `u${id}`, room_role } as RoomParticipant
}

describe('useRoomRankBadge', () => {
  const { rankBadgeFor } = useRoomRankBadge()

  it('shows the owner badge from owner_id even before MSAB resolves a role', () => {
    expect(rankBadgeFor(participant(1))).toBe(ROOM_RANK_BADGE.owner)
  })

  it('shows admin and member badges from room_role', () => {
    expect(rankBadgeFor(participant(2, 'admin'))).toBe(ROOM_RANK_BADGE.admin)
    expect(rankBadgeFor(participant(3, 'member'))).toBe(ROOM_RANK_BADGE.member)
  })

  it('shows nothing for a visitor, an unresolved rank, or an empty seat', () => {
    expect(rankBadgeFor(participant(4, null))).toBe('')
    expect(rankBadgeFor(participant(5))).toBe('')
    expect(rankBadgeFor(null)).toBe('')
  })

  it('does not treat anyone as owner when no room is loaded', () => {
    roomStore.currentRoom = null
    expect(rankBadgeFor(participant(1))).toBe('')
    expect(rankBadgeFor(participant(2, 'admin'))).toBe(ROOM_RANK_BADGE.admin)
  })
})
