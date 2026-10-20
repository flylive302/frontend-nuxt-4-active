/**
 * useCpEvents (app/events/cp.events.ts) — REACT-only handlers for the CP
 * event pushes. Payloads are hints: each handler only bumps a CP store signal.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

function createMockSocket() {
  const handlers = new Map<string, (payload: unknown) => void>()
  return {
    handlers,
    on: vi.fn((event: string, cb: (payload: unknown) => void) => {
      handlers.set(event, cb)
    }),
  }
}

const store = {
  bumpPairSignal: vi.fn(),
  bumpWeekClosedSignal: vi.fn(),
}
vi.stubGlobal('useCpStore', () => store)

describe('useCpEvents', () => {
  let socket: ReturnType<typeof createMockSocket>

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    const { useCpEvents } = await import('../../app/events/cp.events')
    socket = createMockSocket()
    useCpEvents()(socket as never)
  })

  it('registers all four cp handlers', () => {
    for (const event of ['cp.pair.bound', 'cp.pair.updated', 'cp.pair.broken', 'cp.week.closed']) {
      expect(socket.handlers.has(event)).toBe(true)
    }
  })

  it('cp.pair.bound bumps the pair signal with membershipChanged = true', () => {
    socket.handlers.get('cp.pair.bound')!({ pair_id: 1, partner_id: 2 })
    expect(store.bumpPairSignal).toHaveBeenCalledWith(true)
  })

  it('cp.pair.updated bumps the pair signal with membershipChanged = false', () => {
    socket.handlers.get('cp.pair.updated')!({ pair_id: 1, points: 5, lifetime_intimacy: 9, weekly_score: 3 })
    expect(store.bumpPairSignal).toHaveBeenCalledWith(false)
  })

  it('cp.pair.broken bumps the pair signal with membershipChanged = true', () => {
    socket.handlers.get('cp.pair.broken')!({ pair_id: 1, reason: 'user' })
    expect(store.bumpPairSignal).toHaveBeenCalledWith(true)
  })

  it('cp.week.closed bumps the week-closed signal', () => {
    socket.handlers.get('cp.week.closed')!({ week_key: '2026-W43' })
    expect(store.bumpWeekClosedSignal).toHaveBeenCalledTimes(1)
    expect(store.bumpPairSignal).not.toHaveBeenCalled()
  })
})
