/**
 * Regression tests for useRoomMembershipEvents — `room.member_role_changed`
 * must update the viewer's OWN membership (myMembership) even when:
 *  - membershipStore.currentRoomId was never set (members panel never opened)
 *  - myMembership was never fetched (null at promote time)
 * Prod repro: promoted admin saw the toast but gained no admin UI until rejoin.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'
import type { RoomMember } from '../../app/types/room/room'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

function createMockSocket() {
  const handlers = new Map<string, (payload: unknown) => void>()
  return {
    handlers,
    on: vi.fn((event: string, cb: (payload: unknown) => void) => {
      handlers.set(event, cb)
    }),
    off: vi.fn(),
  }
}

describe('useRoomMembershipEvents — member_role_changed self-update', () => {
  let socket: ReturnType<typeof createMockSocket>
  let membershipStore: ReturnType<typeof import('../../app/stores/roomMembership')['useRoomMembershipStore']>
  let roomStore: ReturnType<typeof import('../../app/stores/room')['useRoomStore']>
  let toast: { add: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    setActivePinia(createPinia())
    toast = { add: vi.fn() }
    vi.stubGlobal('useToast', () => toast)

    const { useAuthStore } = await import('../../app/stores/auth')
    const { useRoomStore } = await import('../../app/stores/room')
    const { useRoomMembershipStore } = await import('../../app/stores/roomMembership')

    const authStore = useAuthStore()
    authStore.user = { id: 42, name: 'Me' } as never
    membershipStore = useRoomMembershipStore()
    roomStore = useRoomStore()
    roomStore.setCurrentRoom({ id: 7 } as never)

    vi.stubGlobal('useAuthStore', () => authStore)
    vi.stubGlobal('useRoomStore', () => roomStore)
    vi.stubGlobal('useRoomMembershipStore', () => membershipStore)

    const { useRoomMembershipEvents } = await import('../../app/events/room-membership.events')
    socket = createMockSocket()
    useRoomMembershipEvents()(socket as never)
  })

  function emitRoleChanged(userId: number, newRole: string, roomId = 7) {
    socket.handlers.get('room.member_role_changed')!({
      room_id: roomId,
      user_id: userId,
      previous_role: 'member',
      new_role: newRole,
    })
  }

  it('promotes self with no currentRoomId and null myMembership (prod repro)', () => {
    expect(membershipStore.currentRoomId).toBeNull()
    expect(membershipStore.myMembership).toBeNull()

    emitRoleChanged(42, 'admin')

    expect(membershipStore.myMembership).not.toBeNull()
    expect(membershipStore.myMembership!.role).toBe('admin')
    expect(membershipStore.myMembership!.room_id).toBe(7)
    expect(toast.add).toHaveBeenCalledOnce()
  })

  it('patches existing myMembership role in place (demote)', () => {
    membershipStore.setMyMembership({
      id: 1, room_id: 7, user_id: 42, role: 'admin', status: 'active', user: null,
    } as unknown as RoomMember)

    emitRoleChanged(42, 'member')

    expect(membershipStore.myMembership!.role).toBe('member')
    expect(membershipStore.myMembership!.id).toBe(1)
  })

  it('replaces stale other-room membership when the event targets the viewed room', () => {
    membershipStore.setMyMembership({
      id: 1, room_id: 99, user_id: 42, role: 'member', status: 'active', user: null,
    } as unknown as RoomMember)

    emitRoleChanged(42, 'admin', 7)

    expect(membershipStore.myMembership!.room_id).toBe(7)
    expect(membershipStore.myMembership!.role).toBe('admin')
  })

  it('never clobbers viewed-room membership on a role change in another room', () => {
    membershipStore.setMyMembership({
      id: 1, room_id: 7, user_id: 42, role: 'admin', status: 'active', user: null,
    } as unknown as RoomMember)

    // Promotion in room 55 while viewing room 7 — personal-channel fan-out.
    emitRoleChanged(42, 'admin', 55)

    expect(membershipStore.myMembership!.room_id).toBe(7)
    expect(membershipStore.myMembership!.role).toBe('admin')
    // Toast still fires (it is about the user, not the viewed room).
    expect(toast.add).toHaveBeenCalledOnce()
  })

  it('ignores role changes targeting other users', () => {
    emitRoleChanged(999, 'admin')

    expect(membershipStore.myMembership).toBeNull()
    expect(toast.add).not.toHaveBeenCalled()
  })

  it('still updates the members list when currentRoomId matches', () => {
    membershipStore.setRoom(7)
    membershipStore.members.items = [
      { user_id: 999, role: 'member' } as unknown as RoomMember,
    ]

    emitRoleChanged(999, 'admin')

    expect(membershipStore.members.items[0]!.role).toBe('admin')
  })
})
