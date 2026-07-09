/**
 * Unit tests for useSeatReactions' trigger-gate accessors (ADR 0015 /
 * seat-reactions slice 03 — Reaction Drawer).
 *
 * `isSelfSeated` / `isSelfReactionPlaying` let the Reaction Drawer trigger
 * button read GATE state without duplicating the seated/already-playing
 * logic that already lives in useSeatReactions' `validate()`.
 *
 * Kept in its own file (separate from tests/composables/useSeatReactions.spec.ts,
 * which another agent owns for slice 04 lifecycle-hardening tests) to avoid
 * clobbering a parallel edit.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

const mockSocket = { emit: vi.fn() }
vi.mock('../../app/composables/room/useAudioSocket', () => ({
  useAudioSocket: () => ({ socket: ref(mockSocket) }),
}))

describe('useSeatReactions — trigger-gate accessors', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  async function setup() {
    const { useAuthStore } = await import('../../app/stores/auth')
    const { useRoomStore } = await import('../../app/stores/room')
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useSeatReactions } = await import('../../app/composables/room/useSeatReactions')

    const authStore = useAuthStore()
    const roomStore = useRoomStore()
    const seatsStore = useRoomSeatsStore()

    authStore.setUser({ id: 7, name: 'Sender' } as never)
    roomStore.currentRoom = { id: 42 } as never

    vi.stubGlobal('useAuthStore', () => authStore)
    vi.stubGlobal('useRoomStore', () => roomStore)
    vi.stubGlobal('useRoomSeatsStore', () => seatsStore)

    return { authStore, roomStore, seatsStore, ...useSeatReactions() }
  }

  it('isSelfSeated reflects whether the current user holds a Seat', async () => {
    const { seatsStore, isSelfSeated } = await setup()
    expect(isSelfSeated.value).toBe(false)

    seatsStore.updateSeat(0, 7, false)
    expect(isSelfSeated.value).toBe(true)
  })

  it('isSelfReactionPlaying reflects whether the current user has an active reaction', async () => {
    const { seatsStore, isSelfReactionPlaying } = await setup()
    seatsStore.updateSeat(0, 7, false)
    expect(isSelfReactionPlaying.value).toBe(false)

    seatsStore.setReaction(7, '1f602')
    expect(isSelfReactionPlaying.value).toBe(true)

    seatsStore.clearReaction(7)
    expect(isSelfReactionPlaying.value).toBe(false)
  })
})
