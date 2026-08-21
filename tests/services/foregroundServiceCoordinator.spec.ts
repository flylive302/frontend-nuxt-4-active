import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as coordinator from '../../app/services/foregroundServiceCoordinator'

// Mock the native bridge so the coordinator's diff-execution logic is testable
// off-device. `isForegroundServiceAvailable` returns true so we exercise the
// real reconcile path (it early-returns on web otherwise). `vi.hoisted` so the
// mock fns exist when the hoisted `vi.mock` factory runs.
const {
  startForegroundService,
  stopForegroundService,
  ensureNotificationPermission,
  onForegroundServiceFailure,
} = vi.hoisted(() => ({
  startForegroundService: vi.fn(async () => {}),
  stopForegroundService: vi.fn(async () => {}),
  ensureNotificationPermission: vi.fn(async () => true),
  // Captures the handler the coordinator registers, so a test can fire a native
  // rejection without a device (mic-fgs-crash 04).
  onForegroundServiceFailure: vi.fn(async (_handler: unknown) => {}),
}))

vi.mock('../../app/services/foregroundService', () => ({
  isForegroundServiceAvailable: () => true,
  startForegroundService,
  stopForegroundService,
  ensureNotificationPermission,
  onForegroundServiceFailure,
}))

// Logger pulls in Nuxt auto-imports; stub to a no-op.
vi.mock('../../app/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

const { captureException } = vi.hoisted(() => ({
  captureException: vi.fn(),
}))
vi.mock('@sentry/nuxt', () => ({ captureException: (...args: unknown[]) => captureException(...args) }))

describe('foregroundServiceCoordinator', () => {
  beforeEach(() => {
    coordinator.__resetForTest()
    startForegroundService.mockClear()
    stopForegroundService.mockClear()
    ensureNotificationPermission.mockClear()
    onForegroundServiceFailure.mockClear()
    captureException.mockClear()
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

  describe('Sentry reporting (ticket 03)', () => {
    it('reports a failed start, identifying the service and the error, without throwing', async () => {
      const startError = new Error('native bridge unavailable')
      startForegroundService.mockRejectedValueOnce(startError)

      await expect(coordinator.apply({ producing: false, consuming: true })).resolves.toBeUndefined()

      expect(captureException).toHaveBeenCalledExactlyOnceWith(startError, expect.objectContaining({
        tags: expect.objectContaining({ 'fgs.op': 'start', 'fgs.service': 'mediaPlayback' }),
      }))
    })

    it('reports a failed stop, identifying the service and the error, without throwing', async () => {
      // Get to Speaker (both services running) first, cleanly.
      await coordinator.apply({ producing: true, consuming: true })
      captureException.mockClear()

      const stopError = new Error('service was not running')
      stopForegroundService.mockRejectedValueOnce(stopError)

      // Speaker -> Listener stops `microphone`.
      await expect(coordinator.apply({ producing: false, consuming: true })).resolves.toBeUndefined()

      expect(captureException).toHaveBeenCalledExactlyOnceWith(stopError, expect.objectContaining({
        tags: expect.objectContaining({ 'fgs.op': 'stop', 'fgs.service': 'microphone' }),
      }))
    })

    it('tags start and stop failures distinguishably (different fingerprint/tags)', async () => {
      startForegroundService.mockRejectedValueOnce(new Error('start boom'))
      await coordinator.apply({ producing: true, consuming: true })
      const [, startOpts] = captureException.mock.calls[0] as [unknown, { tags: Record<string, string>; fingerprint: string[] }]
      captureException.mockClear()

      // Reset and get to a clean running state before driving a stop failure.
      coordinator.__resetForTest()
      await coordinator.apply({ producing: true, consuming: true })
      captureException.mockClear()
      stopForegroundService.mockRejectedValueOnce(new Error('stop boom'))
      await coordinator.apply({ producing: false, consuming: false })
      const [, stopOpts] = captureException.mock.calls[0] as [unknown, { tags: Record<string, string>; fingerprint: string[] }]

      expect(startOpts.tags['fgs.op']).toBe('start')
      expect(stopOpts.tags['fgs.op']).toBe('stop')
      expect(startOpts.fingerprint).not.toEqual(stopOpts.fingerprint)
    })

    it('still reports a non-Error native rejection (plain object) without throwing', async () => {
      // Capacitor bridge calls can reject with a plain object, not an Error.
      const rejection = { code: 'NATIVE_FAIL', message: 'boom' }
      startForegroundService.mockRejectedValueOnce(rejection)

      await expect(coordinator.apply({ producing: false, consuming: true })).resolves.toBeUndefined()

      // The raw rejection is still the reported exception — Sentry serializes
      // its keys itself; `errorMessage` in `extra` is belt-and-braces, not the
      // only source of truth, so it stays untested here.
      expect(captureException.mock.calls[0]?.[0]).toEqual(rejection)
    })

    it('produces no Sentry event when both start and stop succeed', async () => {
      await coordinator.apply({ producing: true, consuming: true })
      await coordinator.apply({ producing: false, consuming: true })
      await coordinator.apply({ producing: false, consuming: false })

      expect(captureException).not.toHaveBeenCalled()
    })

    it('swallows a throw from Sentry itself — apply() still resolves normally', async () => {
      captureException.mockImplementationOnce(() => {
        throw new Error('Sentry SDK not initialized')
      })
      startForegroundService.mockRejectedValueOnce(new Error('native failure'))

      await expect(coordinator.apply({ producing: false, consuming: true })).resolves.toBeUndefined()
      // The service is still correctly NOT marked running after a failed start.
      captureException.mockClear()
      startForegroundService.mockClear()
      await coordinator.apply({ producing: false, consuming: true })
      expect(startForegroundService).toHaveBeenCalledExactlyOnceWith('mediaPlayback')
    })
  })
})

// ============================================================
// mic-fgs-crash 03 — a NEW failure mode must open a NEW Sentry issue.
//
// op + service alone caps this at four issues forever, so an unfamiliar reason
// for refusing the service would land silently inside an existing one. This
// epic exists because a failure class went unnoticed for a month.
// ============================================================
describe('reportFgsFailure fingerprinting', () => {
  beforeEach(() => {
    coordinator.__resetForTest()
    startForegroundService.mockClear()
    captureException.mockClear()
  })

  /** Fail one microphone start and return the fingerprint Sentry was given. */
  async function fingerprintForStartFailure(error: unknown): Promise<unknown> {
    coordinator.__resetForTest()
    startForegroundService.mockRejectedValueOnce(error)
    await coordinator.apply({ producing: true, consuming: false })
    const lastCall = captureException.mock.calls.at(-1)
    return (lastCall?.[1] as { fingerprint?: unknown } | undefined)?.fingerprint
  }

  it('splits two DIFFERENT refusals of the same service into different issues', async () => {
    const securityException = await fingerprintForStartFailure(
      new Error('SecurityException: Starting FGS with type microphone requires permissions'),
    )
    const backgroundStart = await fingerprintForStartFailure(
      new Error('ForegroundServiceStartNotAllowedException: app is in background'),
    )

    expect(securityException).not.toEqual(backgroundStart)
  })

  it('collapses the SAME refusal across devices into one issue (uids/pids masked)', async () => {
    const phoneA = await fingerprintForStartFailure(
      new Error('Not allowed to start service Intent { cmp=x }: app is in background uid 10234'),
    )
    const phoneB = await fingerprintForStartFailure(
      new Error('Not allowed to start service Intent { cmp=x }: app is in background uid 10987'),
    )

    expect(phoneA).toEqual(phoneB)
  })

  it('survives a non-Error rejection from the native bridge', async () => {
    coordinator.__resetForTest()
    startForegroundService.mockRejectedValueOnce('plain string failure')

    await expect(coordinator.apply({ producing: true, consuming: false })).resolves.toBeUndefined()
    expect(captureException).toHaveBeenCalled()
  })
})

// ============================================================
// mic-fgs-crash 04 — a rejection the native side SURVIVED still reaches Sentry.
//
// Type validation throws inside the service, on a later dispatch, outside
// `startForegroundService`'s promise — so `apply()`'s own catch never sees it.
// Now that the service catches it instead of dying, this listener is the only
// thing standing between that failure and total invisibility: no process death
// for Play Console, and no native crash reporter in this app.
// ============================================================
describe('native foreground-service rejections (ticket 04)', () => {
  /** Register the listener via apply(), then hand back the captured handler. */
  async function attachListener() {
    coordinator.__resetForTest()
    onForegroundServiceFailure.mockClear()
    captureException.mockClear()
    await coordinator.apply({ producing: true, consuming: false })
    return onForegroundServiceFailure.mock.calls[0]?.[0] as
      ((failure: { service: string, error: string }) => void) | undefined
  }

  it('registers exactly one listener however many times apply() runs', async () => {
    coordinator.__resetForTest()
    onForegroundServiceFailure.mockClear()

    await coordinator.apply({ producing: true, consuming: false })
    await coordinator.apply({ producing: true, consuming: true })
    await coordinator.apply({ producing: false, consuming: false })

    expect(onForegroundServiceFailure).toHaveBeenCalledTimes(1)
  })

  it('reports a rejection the service survived', async () => {
    const onFailure = await attachListener()
    expect(onFailure).toBeTypeOf('function')

    onFailure!({ service: 'microphone', error: 'java.lang.SecurityException: mic while-in-use' })

    expect(captureException).toHaveBeenCalledTimes(1)
    const [, options] = captureException.mock.calls[0] as [unknown, { tags: Record<string, string> }]
    expect(options.tags['fgs.service']).toBe('microphone')
  })

  it('forgets the rejected service, so the next apply() retries it', async () => {
    const onFailure = await attachListener()

    // apply() above believed the start succeeded and added it to `running`; the
    // OS refused. Left uncorrected, the diff would treat the service as already
    // up forever and never try again.
    onFailure!({ service: 'microphone', error: 'rejected' })
    startForegroundService.mockClear()

    await coordinator.apply({ producing: true, consuming: false })

    expect(startForegroundService).toHaveBeenCalledWith('microphone')
  })
})
