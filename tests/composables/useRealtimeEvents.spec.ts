/**
 * useRealtimeEvents — global handler registration is keyed to the socket
 * INSTANCE, not a boolean (room-page-runtime-audit 09). Same instance twice
 * → one registration (a transport reconnect keeps its listeners); a rebuilt
 * socket registers fresh even if `resetRealtimeHandlers` was never called.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const registerAll = vi.fn()
vi.mock('~/events', () => ({
  useAllEventHandlers: () => registerAll,
}))

describe('useRealtimeEvents', () => {
  beforeEach(async () => {
    registerAll.mockClear()
    const { resetRealtimeHandlers } = await import('../../app/composables/room/useRealtimeEvents')
    resetRealtimeHandlers()
  })

  it('registers once per socket instance (reconnect on the same socket does not duplicate)', async () => {
    const { useRealtimeEvents } = await import('../../app/composables/room/useRealtimeEvents')
    const { registerRealtimeEventHandlers } = useRealtimeEvents()
    const socket = { id: 'a' } as never

    registerRealtimeEventHandlers(socket)
    registerRealtimeEventHandlers(socket)

    expect(registerAll).toHaveBeenCalledTimes(1)
    expect(registerAll).toHaveBeenCalledWith(socket)
  })

  it('a NEW socket instance registers even without resetRealtimeHandlers()', async () => {
    const { useRealtimeEvents } = await import('../../app/composables/room/useRealtimeEvents')
    const { registerRealtimeEventHandlers } = useRealtimeEvents()
    const first = { id: 'a' } as never
    const second = { id: 'b' } as never

    registerRealtimeEventHandlers(first)
    registerRealtimeEventHandlers(second)

    expect(registerAll).toHaveBeenCalledTimes(2)
    expect(registerAll).toHaveBeenLastCalledWith(second)
  })

  it('resetRealtimeHandlers() allows the same instance to register again', async () => {
    const { useRealtimeEvents, resetRealtimeHandlers } = await import('../../app/composables/room/useRealtimeEvents')
    const { registerRealtimeEventHandlers } = useRealtimeEvents()
    const socket = { id: 'a' } as never

    registerRealtimeEventHandlers(socket)
    resetRealtimeHandlers()
    registerRealtimeEventHandlers(socket)

    expect(registerAll).toHaveBeenCalledTimes(2)
  })
})
