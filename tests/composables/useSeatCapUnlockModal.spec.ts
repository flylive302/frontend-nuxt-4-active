/**
 * level-up-celebrations 06: the app-wide celebration queue is gone.
 *
 * Where this used to assert `room.seat_cap_unlocked` fed a global modal queue,
 * it now proves the opposite — progression events register only the badge and
 * user.progression store-updating handlers. Seat-cap unlocks are delivered as
 * a durable official inbox message (backend), the `level.up` back-compat
 * listener is removed, and no celebration modal can fire mid-gift because the
 * queue (useAchievementModals) no longer exists.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, watch, readonly } from 'vue'
import type { Socket } from 'socket.io-client'

// ============================================
// Mock Nuxt Auto-imports
// ============================================

const onBadgeEarned = vi.fn()
const handleLevelUp = vi.fn()

vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('useBadgeActions', () => ({ onBadgeEarned }))
vi.stubGlobal('useLevelActions', () => ({ handleLevelUp }))

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

describe('progression events after the global celebration queue removal', () => {
  beforeEach(() => {
    onBadgeEarned.mockClear()
    handleLevelUp.mockClear()
  })

  it('registers only the badge and user.progression handlers', () => {
    const { socket, handlers } = createFakeSocket()
    useProgressionEvents()(socket)

    expect(handlers.has('badge.earned')).toBe(true)
    expect(handlers.has('user.progression')).toBe(true)
  })

  it('no longer registers the seat-cap modal or level.up back-compat handlers', () => {
    const { socket, handlers } = createFakeSocket()
    useProgressionEvents()(socket)

    expect(handlers.has('room.seat_cap_unlocked')).toBe(false)
    expect(handlers.has('level.up')).toBe(false)
  })

  it('badge.earned updates the badge store (which raises its own toast)', () => {
    const { socket, fire } = createFakeSocket()
    useProgressionEvents()(socket)

    fire('badge.earned', {
      badge_id: 5,
      badge_name: 'Trailblazer',
      badge_image: 'https://example.com/badge.webp',
      category: 'special',
      context: 'reward',
    })

    expect(onBadgeEarned).toHaveBeenCalledOnce()
    expect(onBadgeEarned.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ badge: expect.objectContaining({ id: 5, name: 'Trailblazer' }) }),
    )
  })

  it('user.progression forwards each level-up to the auth store (no modal)', () => {
    const { socket, fire } = createFakeSocket()
    useProgressionEvents()(socket)

    fire('user.progression', { level_ups: [{ type: 'wealth' }, { type: 'charm' }] })

    expect(handleLevelUp).toHaveBeenCalledTimes(2)
  })
})
