import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { attachTransportRecovery, type RecoverableTransport } from '~/composables/mediasoup/useTransportRecovery'
import type { types as mediasoupTypes } from 'mediasoup-client'

/**
 * msab-load-stability 10 — recovery state machine at its module seam, with a
 * fake mediasoup transport. Asserts observable behavior: restart calls,
 * onRecovered/onExhausted firing, toast-never-before-exhaustion.
 */

type StateCb = (state: mediasoupTypes.ConnectionState) => void

function fakeTransport() {
  let cb: StateCb = () => {}
  const transport: RecoverableTransport & { fire: StateCb } = {
    closed: false,
    connectionState: 'new',
    restartIce: vi.fn(async () => {}),
    on: (_event, listener) => {
      cb = listener
    },
    fire: (state) => {
      transport.connectionState = state
      cb(state)
    },
  }
  return transport
}

const ICE = { usernameFragment: 'u', password: 'p' } as unknown as mediasoupTypes.IceParameters

function harness(transport = fakeTransport(), opts: { serverIce?: (typeof ICE) | null | 'transport-gone' } = {}) {
  const requestIceRestart = vi.fn(async () => opts.serverIce === undefined ? ICE : opts.serverIce)
  const onRecovered = vi.fn()
  const onExhausted = vi.fn()
  const handle = attachTransportRecovery(transport, {
    requestIceRestart,
    onRecovered,
    onExhausted,
    log: () => {},
    disconnectedGraceMs: 2_000,
    maxAttempts: 3,
    backoffMs: [1_000, 2_000, 4_000],
  })
  return { transport, requestIceRestart, onRecovered, onExhausted, handle }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('transport recovery', () => {
  it('disconnected that self-heals within the grace window never restarts ICE', async () => {
    const { transport, requestIceRestart, onExhausted } = harness()
    transport.fire('disconnected')
    await vi.advanceTimersByTimeAsync(1_000)
    transport.fire('connected')
    await vi.advanceTimersByTimeAsync(10_000)

    expect(requestIceRestart).not.toHaveBeenCalled()
    expect(onExhausted).not.toHaveBeenCalled()
  })

  it('sustained disconnected → ICE restart → connected recovers silently', async () => {
    const { transport, requestIceRestart, onRecovered, onExhausted } = harness()
    transport.fire('disconnected')
    await vi.advanceTimersByTimeAsync(2_000) // grace expires
    await vi.advanceTimersByTimeAsync(1_000) // attempt-1 backoff

    expect(requestIceRestart).toHaveBeenCalledTimes(1)
    expect(transport.restartIce).toHaveBeenCalledWith({ iceParameters: ICE })

    transport.fire('connected')
    expect(onRecovered).toHaveBeenCalledExactlyOnceWith({ attempts: 1 })
    expect(onExhausted).not.toHaveBeenCalled()
  })

  it('failed ×N exhausts bounded retries, then onExhausted fires exactly once', async () => {
    const transport = fakeTransport()
    // Server accepts each restart but the network is truly dead: every
    // restart lands back in `failed`.
    const { onExhausted, onRecovered, requestIceRestart } = harness(transport)

    transport.fire('failed')
    // attempt 1 (1s backoff) → still failed → attempt 2 (2s) → attempt 3 (4s) → exhausted
    await vi.advanceTimersByTimeAsync(1_000)
    transport.fire('failed')
    await vi.advanceTimersByTimeAsync(2_000)
    transport.fire('failed')
    await vi.advanceTimersByTimeAsync(4_000)
    transport.fire('failed')
    await vi.advanceTimersByTimeAsync(20_000)

    expect(requestIceRestart).toHaveBeenCalledTimes(3)
    expect(onExhausted).toHaveBeenCalledExactlyOnceWith({ attempts: 3, reason: 'attempts-exhausted' })
    expect(onRecovered).not.toHaveBeenCalled()

    // Further failures never re-fire the terminal branch (no toast spam).
    transport.fire('failed')
    await vi.advanceTimersByTimeAsync(20_000)
    expect(onExhausted).toHaveBeenCalledTimes(1)
  })

  it('server declining the ICE restart counts as a failed attempt', async () => {
    const transport = fakeTransport()
    const { onExhausted } = harness(transport, { serverIce: null })

    transport.fire('failed')
    await vi.advanceTimersByTimeAsync(60_000) // all backoffs elapse, every attempt declined

    expect(onExhausted).toHaveBeenCalledExactlyOnceWith({ attempts: 3, reason: 'attempts-exhausted' })
    expect(transport.restartIce).not.toHaveBeenCalled()
  })

  it('server reporting transport-gone goes terminal immediately without burning attempts', async () => {
    const transport = fakeTransport()
    const { onExhausted, requestIceRestart } = harness(transport, { serverIce: 'transport-gone' })

    transport.fire('failed')
    await vi.advanceTimersByTimeAsync(60_000)

    // One round trip is enough — no further futile restarts against a
    // transport MSAB has already torn down (prod-bugs 03).
    expect(requestIceRestart).toHaveBeenCalledTimes(1)
    expect(onExhausted).toHaveBeenCalledExactlyOnceWith({ attempts: 1, reason: 'transport-gone' })
    expect(transport.restartIce).not.toHaveBeenCalled()
  })

  it('a recovered outage resets the budget — a later outage gets fresh attempts', async () => {
    const transport = fakeTransport()
    const { onRecovered, onExhausted, requestIceRestart } = harness(transport)

    transport.fire('failed')
    await vi.advanceTimersByTimeAsync(1_000)
    transport.fire('connected')
    expect(onRecovered).toHaveBeenCalledTimes(1)

    transport.fire('failed')
    await vi.advanceTimersByTimeAsync(1_000)
    transport.fire('connected')
    expect(onRecovered).toHaveBeenCalledTimes(2)
    expect(requestIceRestart).toHaveBeenCalledTimes(2)
    expect(onExhausted).not.toHaveBeenCalled()
  })

  it('self-heal during the restart backoff aborts the stale restart', async () => {
    const transport = fakeTransport()
    const { requestIceRestart, onExhausted } = harness(transport)

    transport.fire('failed') // schedules attempt 1 with 1s backoff
    await vi.advanceTimersByTimeAsync(500)
    transport.fire('connected') // browser recovered on its own mid-backoff
    await vi.advanceTimersByTimeAsync(10_000)

    // The stale attempt must not fire against the healthy transport.
    expect(requestIceRestart).not.toHaveBeenCalled()
    expect(transport.restartIce).not.toHaveBeenCalled()
    expect(onExhausted).not.toHaveBeenCalled()
  })

  it('dispose() (intentional teardown) suppresses pending recovery and callbacks', async () => {
    const transport = fakeTransport()
    const { handle, requestIceRestart, onExhausted } = harness(transport)

    transport.fire('disconnected')
    handle.dispose()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(requestIceRestart).not.toHaveBeenCalled()
    expect(onExhausted).not.toHaveBeenCalled()
  })
})
