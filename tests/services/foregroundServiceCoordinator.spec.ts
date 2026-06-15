import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as coordinator from '../../app/services/foregroundServiceCoordinator'

// Mock the native bridge so the coordinator's diff-execution logic is testable
// off-device. `isForegroundServiceAvailable` returns true so we exercise the
// real reconcile path (it early-returns on web otherwise). `vi.hoisted` so the
// mock fns exist when the hoisted `vi.mock` factory runs.
const { startForegroundService, stopForegroundService, ensureNotificationPermission } = vi.hoisted(() => ({
  startForegroundService: vi.fn(async () => {}),
  stopForegroundService: vi.fn(async () => {}),
  ensureNotificationPermission: vi.fn(async () => true),
}))

vi.mock('../../app/services/foregroundService', () => ({
  isForegroundServiceAvailable: () => true,
  startForegroundService,
  stopForegroundService,
  ensureNotificationPermission,
}))

// Logger pulls in Nuxt auto-imports; stub to a no-op.
vi.mock('../../app/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

describe('foregroundServiceCoordinator', () => {
  beforeEach(() => {
    coordinator.__resetForTest()
    startForegroundService.mockClear()
    stopForegroundService.mockClear()
    ensureNotificationPermission.mockClear()
  })

  it('starts mediaPlayback only when a Listener enters a room', async () => {
    await coordinator.apply({ producing: false, consuming: true })
    expect(startForegroundService).toHaveBeenCalledExactlyOnceWith('mediaPlayback')
    expect(stopForegroundService).not.toHaveBeenCalled()
  })

  it('starts BOTH services when a Speaker takes a seat from idle (union, D1)', async () => {
    await coordinator.apply({ producing: true, consuming: true })
    expect(startForegroundService).toHaveBeenCalledTimes(2)
    expect(startForegroundService).toHaveBeenCalledWith('microphone')
    expect(startForegroundService).toHaveBeenCalledWith('mediaPlayback')
    expect(stopForegroundService).not.toHaveBeenCalled()
  })

  it('Listener → Speaker adds microphone, leaving mediaPlayback running (D1, not a swap)', async () => {
    await coordinator.apply({ producing: false, consuming: true }) // Listener
    startForegroundService.mockClear()
    await coordinator.apply({ producing: true, consuming: true }) // takes a seat
    expect(startForegroundService).toHaveBeenCalledExactlyOnceWith('microphone')
    expect(stopForegroundService).not.toHaveBeenCalled() // mediaPlayback untouched
  })

  it('Speaker → Listener stops microphone only, mediaPlayback stays up', async () => {
    await coordinator.apply({ producing: true, consuming: true })
    startForegroundService.mockClear()
    await coordinator.apply({ producing: false, consuming: true })
    expect(stopForegroundService).toHaveBeenCalledExactlyOnceWith('microphone')
    expect(startForegroundService).not.toHaveBeenCalled()
  })

  it('leaving the room stops both services', async () => {
    await coordinator.apply({ producing: true, consuming: true })
    stopForegroundService.mockClear()
    await coordinator.apply({ producing: false, consuming: false })
    expect(stopForegroundService).toHaveBeenCalledTimes(2)
    expect(stopForegroundService).toHaveBeenCalledWith('microphone')
    expect(stopForegroundService).toHaveBeenCalledWith('mediaPlayback')
  })

  it('is idempotent — re-applying the same activity does nothing', async () => {
    await coordinator.apply({ producing: true, consuming: true })
    startForegroundService.mockClear()
    await coordinator.apply({ producing: true, consuming: true })
    expect(startForegroundService).not.toHaveBeenCalled()
    expect(stopForegroundService).not.toHaveBeenCalled()
  })

  it('requests the notification permission once, before the first start, but never gates on it', async () => {
    ensureNotificationPermission.mockResolvedValueOnce(false) // denied
    // A Listener entering a room is now the first FGS start (D5).
    await coordinator.apply({ producing: false, consuming: true })
    // Denied notification must NOT prevent the service from starting (D3).
    expect(startForegroundService).toHaveBeenCalledExactlyOnceWith('mediaPlayback')
    expect(ensureNotificationPermission).toHaveBeenCalledOnce()

    // Later starts do not re-request.
    await coordinator.apply({ producing: true, consuming: true })
    expect(ensureNotificationPermission).toHaveBeenCalledOnce()
  })
})
