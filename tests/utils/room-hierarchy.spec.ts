// ========================================
// Room Hierarchy Tests
// ========================================
//
// The rank rules every moderation surface shares. These mirror the backend
// (`RoomMemberService::blockMember` + `RoomPolicy`), which is the authority —
// a gap here means the UI offers a button the API rejects.
// ========================================

import { describe, it, expect } from 'vitest'
import { canManageRoomAdmins, canModerateRoomMember, toRoomRank } from '~/utils/room-hierarchy'

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

describe('canModerateRoomMember', () => {
  it('lets the owner remove admins and members', () => {
    expect(canModerateRoomMember('owner', 'admin')).toBe(true)
    expect(canModerateRoomMember('owner', 'member')).toBe(true)
  })

  it('never allows removing the owner — not by an admin, not by anyone', () => {
    expect(canModerateRoomMember('admin', 'owner')).toBe(false)
    expect(canModerateRoomMember('member', 'owner')).toBe(false)
    expect(canModerateRoomMember('owner', 'owner')).toBe(false)
  })

  it('lets an admin remove plain members only', () => {
    expect(canModerateRoomMember('admin', 'member')).toBe(true)
    expect(canModerateRoomMember('admin', 'admin')).toBe(false)
  })

  it('lets a plain member remove nobody', () => {
    expect(canModerateRoomMember('member', 'member')).toBe(false)
    expect(canModerateRoomMember('member', 'admin')).toBe(false)
  })
})

describe('canManageRoomAdmins', () => {
  it('is owner-only', () => {
    expect(canManageRoomAdmins('owner')).toBe(true)
    expect(canManageRoomAdmins('admin')).toBe(false)
    expect(canManageRoomAdmins('member')).toBe(false)
  })
})
