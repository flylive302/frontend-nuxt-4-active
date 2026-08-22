/**
 * In-room avatar taps must keep the user in the room.
 *
 * Tapping an avatar in the participants list / Room Activity leaderboard used
 * to minimize the room and navigate to /profile/{signature}. Live participants
 * now open the seat drawer's profile mode instead; only users who have left the
 * room (a leaderboard contributor, say) still navigate away.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, computed } from 'vue'
import type { RoomParticipant } from '../../app/types/room/audio'

// ============================================
// Mock Nuxt Auto-imports
// ============================================

const openProfile = vi.fn()
const minimizeRoom = vi.fn()
const navigateTo = vi.fn()
const useRoomSessionMock = vi.fn(() => ({ minimizeRoom }))

const participants = ref<Map<number, RoomParticipant>>(new Map())

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('navigateTo', navigateTo)
vi.stubGlobal('useRoomSeatsStore', () => ({ openProfile }))
// Pinia unwraps a store's refs on access, so the stub exposes the bare Map.
vi.stubGlobal('useRoomParticipantsStore', () => ({
  get participants() {
    return participants.value
  },
}))
vi.stubGlobal('useRoomSession', useRoomSessionMock)

const { useRoomUserDrawer } = await import('../../app/composables/room/useRoomUserDrawer')

const PRESENT_ID = 7
const ABSENT_ID = 99

function seatParticipant(id: number): void {
  participants.value.set(id, { id, name: `User${id}` } as RoomParticipant)
}

describe('useRoomUserDrawer.openUser', () => {
  beforeEach(() => {
    openProfile.mockClear()
    minimizeRoom.mockClear()
    navigateTo.mockClear()
    participants.value = new Map()
  })

  it('opens the drawer for a live participant instead of navigating', () => {
    seatParticipant(PRESENT_ID)
    const { openUser } = useRoomUserDrawer()

    openUser({ id: PRESENT_ID, signature: 'present-user' })

    expect(openProfile).toHaveBeenCalledWith(PRESENT_ID)
    expect(navigateTo).not.toHaveBeenCalled()
    expect(minimizeRoom).not.toHaveBeenCalled()
  })

  it('keeps the drawer path even when the participant has no signature', () => {
    seatParticipant(PRESENT_ID)
    const { openUser } = useRoomUserDrawer()

    openUser({ id: PRESENT_ID })

    expect(openProfile).toHaveBeenCalledWith(PRESENT_ID)
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('navigates to the profile page for a user who has left the room', () => {
    const { openUser } = useRoomUserDrawer()

    openUser({ id: ABSENT_ID, signature: 'gone-user' })

    expect(openProfile).not.toHaveBeenCalled()
    expect(minimizeRoom).toHaveBeenCalledOnce()
    expect(navigateTo).toHaveBeenCalledWith('/profile/gone-user')
  })

  it('does nothing for an absent user with no signature — no dead /profile/ route', () => {
    const { openUser } = useRoomUserDrawer()

    openUser({ id: ABSENT_ID, signature: null })

    expect(openProfile).not.toHaveBeenCalled()
    expect(navigateTo).not.toHaveBeenCalled()
    expect(minimizeRoom).not.toHaveBeenCalled()
  })
})
