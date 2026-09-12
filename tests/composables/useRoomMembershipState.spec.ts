/**
 * useRoomMembershipState — mount-time fetch is trimmed to the viewer's own
 * role (room-page-runtime-audit 05). `refreshOwnRole` is the ONLY thing that
 * loads `myMembership` at join, and useRoomHierarchy's `myRank` reads it, so
 * it must still fire for non-owners; the full 3-request `refresh` is reserved
 * for the Settings hub opening.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, computed, toValue } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('toValue', toValue)

const isRoomOwner = ref(false)
const fetchMyMembership = vi.fn(async () => null)
const fetchMyJoinRequests = vi.fn(async () => undefined)
const fetchReceivedInvitations = vi.fn(async () => undefined)

vi.stubGlobal('useRoomPermissions', () => ({ isRoomOwner }))
vi.stubGlobal('useRoomJoinRequests', () => ({
  fetchMyJoinRequests,
  myJoinRequests: ref({ items: [] }),
}))
vi.stubGlobal('useRoomInvitations', () => ({
  fetchReceivedInvitations,
  receivedInvitations: ref({ items: [] }),
}))
vi.stubGlobal('useRoomMembers', () => ({
  fetchMyMembership,
  myMembership: ref(null),
}))

describe('useRoomMembershipState', () => {
  beforeEach(() => {
    isRoomOwner.value = false
    fetchMyMembership.mockClear()
    fetchMyJoinRequests.mockClear()
    fetchReceivedInvitations.mockClear()
  })

  it('refreshOwnRole fetches only the own membership row', async () => {
    const { useRoomMembershipState } = await import('../../app/composables/room/useRoomMembershipState')
    const { refreshOwnRole } = useRoomMembershipState(() => 7)

    await refreshOwnRole()

    expect(fetchMyMembership).toHaveBeenCalledTimes(1)
    expect(fetchMyJoinRequests).not.toHaveBeenCalled()
    expect(fetchReceivedInvitations).not.toHaveBeenCalled()
  })

  it('refreshOwnRole is skipped for the room owner (no room_members row)', async () => {
    isRoomOwner.value = true
    const { useRoomMembershipState } = await import('../../app/composables/room/useRoomMembershipState')
    const { refreshOwnRole } = useRoomMembershipState(() => 7)

    await refreshOwnRole()

    expect(fetchMyMembership).not.toHaveBeenCalled()
  })

  it('refresh still fetches all three (Settings hub open path)', async () => {
    const { useRoomMembershipState } = await import('../../app/composables/room/useRoomMembershipState')
    const { refresh } = useRoomMembershipState(() => 7)

    await refresh()

    expect(fetchMyMembership).toHaveBeenCalledTimes(1)
    expect(fetchMyJoinRequests).toHaveBeenCalledTimes(1)
    expect(fetchReceivedInvitations).toHaveBeenCalledTimes(1)
  })
})
