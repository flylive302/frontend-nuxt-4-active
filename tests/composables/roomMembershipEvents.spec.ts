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
  let audioStore: ReturnType<typeof import('../../app/stores/roomAudio')['useRoomAudioStore']>
  let participantsStore: ReturnType<typeof import('../../app/stores/roomParticipants')['useRoomParticipantsStore']>
  let toast: { add: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    setActivePinia(createPinia())
    toast = { add: vi.fn() }
    vi.stubGlobal('useToast', () => toast)

    const { useAuthStore } = await import('../../app/stores/auth')
    const { useRoomStore } = await import('../../app/stores/room')
    const { useRoomMembershipStore } = await import('../../app/stores/roomMembership')
    const { useRoomAudioStore } = await import('../../app/stores/roomAudio')
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')

    const authStore = useAuthStore()
    authStore.user = { id: 42, name: 'Me' } as never
    membershipStore = useRoomMembershipStore()
    roomStore = useRoomStore()
    audioStore = useRoomAudioStore()
    participantsStore = useRoomParticipantsStore()
    roomStore.setCurrentRoom({ id: 7 } as never)

    vi.stubGlobal('useAuthStore', () => authStore)
    vi.stubGlobal('useRoomStore', () => roomStore)
    vi.stubGlobal('useRoomMembershipStore', () => membershipStore)
    vi.stubGlobal('useRoomAudioStore', () => audioStore)
    vi.stubGlobal('useRoomParticipantsStore', () => participantsStore)

    const { useRoomMembershipEvents } = await import('../../app/events/room-membership.events')
    socket = createMockSocket()
    useRoomMembershipEvents()(socket as never)
  })

  function emitRoleChanged(userId: number, newRole: string, roomId = 7, previousRole = 'member') {
    socket.handlers.get('room.member_role_changed')!({
      room_id: roomId,
      user_id: userId,
      previous_role: previousRole,
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

describe('useRoomMembershipEvents — system chat bubble synthesis', () => {
  let socket: ReturnType<typeof createMockSocket>
  let membershipStore: ReturnType<typeof import('../../app/stores/roomMembership')['useRoomMembershipStore']>
  let roomStore: ReturnType<typeof import('../../app/stores/room')['useRoomStore']>
  let audioStore: ReturnType<typeof import('../../app/stores/roomAudio')['useRoomAudioStore']>
  let participantsStore: ReturnType<typeof import('../../app/stores/roomParticipants')['useRoomParticipantsStore']>

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

    const { useAuthStore } = await import('../../app/stores/auth')
    const { useRoomStore } = await import('../../app/stores/room')
    const { useRoomMembershipStore } = await import('../../app/stores/roomMembership')
    const { useRoomAudioStore } = await import('../../app/stores/roomAudio')
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')

    const authStore = useAuthStore()
    authStore.user = { id: 1, name: 'Me' } as never
    membershipStore = useRoomMembershipStore()
    roomStore = useRoomStore()
    audioStore = useRoomAudioStore()
    participantsStore = useRoomParticipantsStore()
    roomStore.setCurrentRoom({ id: 7 } as never)
    membershipStore.setRoom(7)

    vi.stubGlobal('useAuthStore', () => authStore)
    vi.stubGlobal('useRoomStore', () => roomStore)
    vi.stubGlobal('useRoomMembershipStore', () => membershipStore)
    vi.stubGlobal('useRoomAudioStore', () => audioStore)
    vi.stubGlobal('useRoomParticipantsStore', () => participantsStore)

    const { useRoomMembershipEvents } = await import('../../app/events/room-membership.events')
    socket = createMockSocket()
    useRoomMembershipEvents()(socket as never)
  })

  function emitMemberJoined(userId: number, name: string, roomId = 7) {
    socket.handlers.get('room.member_joined')!({
      room_id: roomId,
      user_id: userId,
      user: { id: userId, name, avatar: null },
      role: 'member',
    })
  }

  function emitRoleChanged(userId: number, newRole: string, previousRole: string, roomId = 7) {
    socket.handlers.get('room.member_role_changed')!({
      room_id: roomId,
      user_id: userId,
      previous_role: previousRole,
      new_role: newRole,
    })
  }

  it('appends a system bubble when a member joins', () => {
    emitMemberJoined(50, 'Alice')

    expect(audioStore.messages).toHaveLength(1)
    expect(audioStore.messages[0]!.type).toBe('system')
    expect(audioStore.messages[0]!.content).toBe('Alice joined the members')
  })

  it('does not append a bubble for a member joined in a room the viewer is not looking at', () => {
    emitMemberJoined(50, 'Alice', 999)

    expect(audioStore.messages).toHaveLength(0)
  })

  it('appends a system bubble on promotion to admin', () => {
    participantsStore.addParticipant({ id: 50, name: 'Bob' } as never)

    emitRoleChanged(50, 'admin', 'member')

    expect(audioStore.messages).toHaveLength(1)
    expect(audioStore.messages[0]!.content).toBe('Bob is now an admin')
  })

  it('does not append a bubble on demote', () => {
    participantsStore.addParticipant({ id: 50, name: 'Bob' } as never)

    emitRoleChanged(50, 'member', 'admin')

    expect(audioStore.messages).toHaveLength(0)
  })

  it('does not append a duplicate bubble when already admin (no-op role change)', () => {
    participantsStore.addParticipant({ id: 50, name: 'Bob' } as never)

    emitRoleChanged(50, 'admin', 'admin')

    expect(audioStore.messages).toHaveLength(0)
  })
})
