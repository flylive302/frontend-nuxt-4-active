/**
 * usePresenceEvents (app/events/presence.events.ts) — REACT-only handler
 * for the MSAB `presence.update` push (dm-realtime-platform/07). Verifies
 * it maps straight to the presence store setter, no business logic.
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

// ── Mock usePresenceStore (Pinia auto-import) ─────────────
const store = {
  setOnline: vi.fn(),
}
vi.stubGlobal('usePresenceStore', () => store)

describe('usePresenceEvents', () => {
  let socket: ReturnType<typeof createMockSocket>

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()

    const { usePresenceEvents } = await import('../../app/events/presence.events')
    socket = createMockSocket()
    usePresenceEvents()(socket as never)
  })

  it('registers a handler for presence.update', () => {
    expect(socket.handlers.has('presence.update')).toBe(true)
  })

  it('maps presence.update payload to store.setOnline', () => {
    socket.handlers.get('presence.update')!({ userId: 42, online: true })

    expect(store.setOnline).toHaveBeenCalledWith(42, true)
  })

  it('maps offline transitions too', () => {
    socket.handlers.get('presence.update')!({ userId: 42, online: false })

    expect(store.setOnline).toHaveBeenCalledWith(42, false)
  })
})
