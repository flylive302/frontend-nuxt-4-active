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

  it('starts the microphone service when a Speaker takes a seat', async () => {
    await coordinator.apply({ producing: true, consuming: true })
    expect(startForegroundService).toHaveBeenCalledExactlyOnceWith('microphone')
    expect(stopForegroundService).not.toHaveBeenCalled()
  })

  it('stops the microphone service when producing ends', async () => {
    await coordinator.apply({ producing: true, consuming: true })
    startForegroundService.mockClear()
    await coordinator.apply({ producing: false, consuming: true })
    expect(stopForegroundService).toHaveBeenCalledExactlyOnceWith('microphone')
    expect(startForegroundService).not.toHaveBeenCalled()
  })

  it('is idempotent — re-applying the same activity does nothing', async () => {
    await coordinator.apply({ producing: true, consuming: true })
    startForegroundService.mockClear()
    await coordinator.apply({ producing: true, consuming: true })
    expect(startForegroundService).not.toHaveBeenCalled()
    expect(stopForegroundService).not.toHaveBeenCalled()
  })

  it('never starts mediaPlayback natively this slice (no handler yet)', async () => {
    // consuming-only desires mediaPlayback, which has no native handler.
    await coordinator.apply({ producing: false, consuming: true })
    expect(startForegroundService).not.toHaveBeenCalled()
    // Becoming a Speaker still only starts microphone, not mediaPlayback.
    await coordinator.apply({ producing: true, consuming: true })
    expect(startForegroundService).toHaveBeenCalledExactlyOnceWith('microphone')
  })

  it('requests the notification permission once, before the first start, but never gates on it', async () => {
    ensureNotificationPermission.mockResolvedValueOnce(false) // denied
    await coordinator.apply({ producing: true, consuming: true })
    // Denied notification must NOT prevent the service from starting (D3).
    expect(startForegroundService).toHaveBeenCalledExactlyOnceWith('microphone')
    expect(ensureNotificationPermission).toHaveBeenCalledOnce()

    // A later start does not re-request.
    await coordinator.apply({ producing: false, consuming: true })
    await coordinator.apply({ producing: true, consuming: true })
    expect(ensureNotificationPermission).toHaveBeenCalledOnce()
  })
})
