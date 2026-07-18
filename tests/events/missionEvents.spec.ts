/**
 * useMissionEvents (app/events/mission.events.ts) — REACT-only socket handlers
 * for the mission domain, migrated off Laravel Reverb/Echo onto the MSAB
 * fan-out. Verifies both `mission.progress.updated` and `mission.finale.ready`
 * write into their reactive signals with no business logic in the handler.
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

describe('useMissionEvents', () => {
  let socket: ReturnType<typeof createMockSocket>

  beforeEach(async () => {
    vi.resetModules()
    const { useMissionEvents } = await import('../../app/events/mission.events')
    socket = createMockSocket()
    useMissionEvents()(socket as never)
  })

  it('registers handlers for mission.progress.updated and mission.finale.ready', () => {
    expect(socket.handlers.has('mission.progress.updated')).toBe(true)
    expect(socket.handlers.has('mission.finale.ready')).toBe(true)
  })

  it('writes the mission.progress.updated payload into lastMissionProgressUpdate', async () => {
    const { lastMissionProgressUpdate } = await import('../../app/events/mission.events')
    const payload = { milestone_id: 7, timeframe: 'daily', instance_key: 'daily:2026-06-15' }

    socket.handlers.get('mission.progress.updated')!(payload)

    expect(lastMissionProgressUpdate.value).toEqual(payload)
  })

  it('writes the mission.finale.ready payload into lastMissionFinaleReady', async () => {
    const { lastMissionFinaleReady } = await import('../../app/events/mission.events')
    const payload = { timeframe: 'weekly', instance_key: 'w-2026-23' }

    socket.handlers.get('mission.finale.ready')!(payload)

    expect(lastMissionFinaleReady.value).toEqual(payload)
  })
})
