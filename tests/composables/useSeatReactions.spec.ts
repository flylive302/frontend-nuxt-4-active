/**
 * Unit tests for useSeatReactions (ADR 0015 / seat-reactions slice 04 —
 * lifecycle hardening).
 *
 * GATE-only composable: seated + own reaction not already active → emit.
 * Real Pinia stores are used (auth/room/roomSeats) since they are plain
 * refs/computeds with no external side effects; only the socket is mocked.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
// authStore's persist config calls this at store-definition time
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

// ============================================
// Mock useAudioSocket — the only non-store dependency
// ============================================
const mockSocket = { emit: vi.fn() }
vi.mock('../../app/composables/room/useAudioSocket', () => ({
  useAudioSocket: () => ({ socket: ref(mockSocket) }),
}))

describe('useSeatReactions', () => {
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

    // useSeatReactions.ts calls these as Nuxt auto-import globals — stub them
    // to return the same real Pinia store instances so state is observable.
    vi.stubGlobal('useAuthStore', () => authStore)
    vi.stubGlobal('useRoomStore', () => roomStore)
    vi.stubGlobal('useRoomSeatsStore', () => seatsStore)

    return { authStore, roomStore, seatsStore, ...useSeatReactions() }
  }

  it('emits seat:reaction when the sender is seated and has no active reaction', async () => {
    const { seatsStore, sendReaction } = await setup()
    seatsStore.updateSeat(0, 7, false)

    sendReaction('1f602')

    expect(mockSocket.emit).toHaveBeenCalledWith('seat:reaction', { roomId: '42', code: '1f602' })
  })

  it('GATE: blocks sending when the sender is not seated', async () => {
    const { sendReaction } = await setup()
    // no updateSeat call — sender is not on any seat

    sendReaction('1f602')

    expect(mockSocket.emit).not.toHaveBeenCalled()
  })

  it('GATE: blocks sending while the sender\'s own reaction is already active', async () => {
    const { seatsStore, sendReaction } = await setup()
    seatsStore.updateSeat(0, 7, false)
    seatsStore.setReaction(7, '1f602') // own reaction already playing

    sendReaction('1f923')

    expect(mockSocket.emit).not.toHaveBeenCalled()
  })

  it('allows sending again once the store entry is cleared', async () => {
    const { seatsStore, sendReaction } = await setup()
    seatsStore.updateSeat(0, 7, false)
    seatsStore.setReaction(7, '1f602')

    sendReaction('1f923') // blocked
    expect(mockSocket.emit).not.toHaveBeenCalled()

    seatsStore.clearReaction(7) // playback finished

    sendReaction('1f923')
    expect(mockSocket.emit).toHaveBeenCalledWith('seat:reaction', { roomId: '42', code: '1f923' })
  })

  it('GATE: blocks sending when there is no current room', async () => {
    const { roomStore, seatsStore, sendReaction } = await setup()
    seatsStore.updateSeat(0, 7, false)
    roomStore.currentRoom = null

    sendReaction('1f602')

    expect(mockSocket.emit).not.toHaveBeenCalled()
  })
})
