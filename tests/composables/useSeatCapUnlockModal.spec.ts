/**
 * room-seat-caps 04: seat-cap unlock event wiring → achievement-modal queue.
 *
 * Mocks Nuxt auto-imports (stores, sibling composables) and drives a fake
 * socket through useProgressionEvents to assert the `room.seat_cap_unlocked`
 * relay lands in the useAchievementModals queue with correct mapped data and
 * consistent wealth/charm queue behavior (defers while a gift is playing).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, watch, readonly } from 'vue'
import type { Socket } from 'socket.io-client'

// ============================================
// Mock Nuxt Auto-imports
// ============================================

const giftStore = { isPlaying: false }
const roomStore: { currentRoom: object | null } = { currentRoom: null }

vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('useGiftStore', () => giftStore)
vi.stubGlobal('useRoomStore', () => roomStore)
vi.stubGlobal('useBadgeActions', () => ({ onBadgeEarned: vi.fn() }))
vi.stubGlobal('useLevelActions', () => ({ handleLevelUp: vi.fn() }))

const { useAchievementModals } = await import('../../app/composables/progression/useAchievementModals')
vi.stubGlobal('useAchievementModals', useAchievementModals)

const { useProgressionEvents } = await import('../../app/events/progression.events')

// ============================================
// Fake socket
// ============================================

type Handler = (payload: unknown) => void

function createFakeSocket() {
  const handlers = new Map<string, Handler>()
  return {
    socket: { on: (event: string, cb: Handler) => handlers.set(event, cb) } as unknown as Socket,
    fire: (event: string, payload: unknown) => handlers.get(event)?.(payload),
    handlers,
  }
}

const payload = {
  room_id: 7,
  room_name: 'My Room',
  new_level: 3,
  seat_cap: 20,
}

describe('room.seat_cap_unlocked event wiring', () => {
  beforeEach(() => {
    giftStore.isPlaying = false
    roomStore.currentRoom = null
    // Drain any leftover modal state between tests
    useAchievementModals().closeSeatCapUnlockModal()
  })

  it('registers a handler for room.seat_cap_unlocked', () => {
    const { socket, handlers } = createFakeSocket()
    useProgressionEvents()(socket)

    expect(handlers.has('room.seat_cap_unlocked')).toBe(true)
  })

  it('opens the seat-cap modal with mapped data when the event fires', () => {
    const { socket, fire } = createFakeSocket()
    useProgressionEvents()(socket)

    fire('room.seat_cap_unlocked', payload)

    const modals = useAchievementModals()
    expect(modals.seatCapUnlockModalOpen.value).toBe(true)
    expect(modals.seatCapUnlockModalData.value).toEqual({
      roomId: 7,
      roomName: 'My Room',
      newLevel: 3,
      seatCap: 20,
    })
  })

  it('queues instead of opening while a gift is playing in a room (wealth/charm-consistent)', () => {
    roomStore.currentRoom = { id: 7 }
    giftStore.isPlaying = true

    const { socket, fire } = createFakeSocket()
    useProgressionEvents()(socket)

    fire('room.seat_cap_unlocked', payload)

    const modals = useAchievementModals()
    expect(modals.seatCapUnlockModalOpen.value).toBe(false)
    expect(modals.pendingModals.value).toHaveLength(1)
    expect(modals.pendingModals.value[0]?.type).toBe('seatCapUnlock')

    // Gift playback ends → queue processes
    giftStore.isPlaying = false
    modals.processQueue()
    expect(modals.seatCapUnlockModalOpen.value).toBe(true)
    expect(modals.pendingModals.value).toHaveLength(0)
  })
})
