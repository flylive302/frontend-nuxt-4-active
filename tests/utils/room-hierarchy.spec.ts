// ========================================
// Room Hierarchy Tests
// ========================================
//
// The rank rules every moderation surface shares. These mirror the backend
// (`RoomMemberService::blockMember` + `RoomPolicy`), which is the authority —
// a gap here means the UI offers a button the API rejects.
// ========================================

import { describe, it, expect } from 'vitest'
import { canManageRoomAdmins, canRemoveFromRoom, toRoomRank } from '~/utils/room-hierarchy'

describe('toRoomRank', () => {
  it('passes owner and admin through', () => {
    expect(toRoomRank('owner')).toBe('owner')
    expect(toRoomRank('admin')).toBe('admin')
  })

  it('narrows the legacy moderator value the backend never issues to member', () => {
    expect(toRoomRank('moderator')).toBe('member')
  })

  it('treats an absent role as member — participants hold no membership row', () => {
    expect(toRoomRank(null)).toBe('member')
    expect(toRoomRank(undefined)).toBe('member')
  })
})

describe('canRemoveFromRoom', () => {
  it('lets the owner remove admins and members', () => {
    expect(canRemoveFromRoom('owner', 'admin')).toBe(true)
    expect(canRemoveFromRoom('owner', 'member')).toBe(true)
  })

  it('never allows removing the owner — not by an admin, not by anyone', () => {
    expect(canRemoveFromRoom('admin', 'owner')).toBe(false)
    expect(canRemoveFromRoom('member', 'owner')).toBe(false)
    expect(canRemoveFromRoom('owner', 'owner')).toBe(false)
  })

  it('lets an admin remove plain members only', () => {
    expect(canRemoveFromRoom('admin', 'member')).toBe(true)
    expect(canRemoveFromRoom('admin', 'admin')).toBe(false)
  })

  it('lets a plain member remove nobody', () => {
    expect(canRemoveFromRoom('member', 'member')).toBe(false)
    expect(canRemoveFromRoom('member', 'admin')).toBe(false)
  })
})

describe('canManageRoomAdmins', () => {
  it('is owner-only', () => {
    expect(canManageRoomAdmins('owner')).toBe(true)
    expect(canManageRoomAdmins('admin')).toBe(false)
    expect(canManageRoomAdmins('member')).toBe(false)
  })
})
