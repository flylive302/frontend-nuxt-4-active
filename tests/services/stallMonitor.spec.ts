/**
 * Unit tests for the main-thread stall monitor (client-session-stability 03).
 *
 * Exercises the `PerformanceObserver('long-animation-frame' | 'longtask')`
 * wiring by driving the registered callback directly (there is no real
 * longtask support under Vitest), and asserts instrument preference,
 * phase/route/attribution tagging, the per-phase throttle, and the regression
 * this ticket exists to prevent: the predecessor (giftStallMonitor) tagged
 * every report `source: 'gift-stall-monitor'` unconditionally — this monitor
 * must never do that.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  STALL_HYDRATION_SETTLE_MS,
  STALL_REPORT_THROTTLE_MS,
  STALL_THRESHOLD_HIGH_MS,
} from '~/constants/telemetry'
// Safe above the `vi.mock` calls below: Vitest hoists `vi.hoisted`/`vi.mock`
// above every import, so the mocks are registered before this module loads.
import { init, stop } from '~/services/stallMonitor'

const { mockSentry } = vi.hoisted(() => ({
  mockSentry: {
    captureMessage: vi.fn(),
  },
}))

vi.mock('@sentry/nuxt', () => mockSentry)
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

interface FakeEntry {
  duration: number
  startTime: number
  scripts?: unknown[]
  attribution?: unknown[]
  blockingDuration?: number
}

type FakeEntryList = { getEntries: () => FakeEntry[] }

/** Captures the callback passed to `new PerformanceObserver(cb)` so tests can drive it. */
let observeSpy: ReturnType<typeof vi.fn>
let disconnectSpy: ReturnType<typeof vi.fn>
let constructedCount: number
let registeredCallback: ((list: FakeEntryList) => void) | null

function installFakePerformanceObserver(supported: string[] = ['long-animation-frame', 'longtask']) {
  observeSpy = vi.fn()
  disconnectSpy = vi.fn()
  constructedCount = 0
  registeredCallback = null

  class FakePerformanceObserver {
    static supportedEntryTypes = supported
    constructor(cb: (list: FakeEntryList) => void) {
      constructedCount++
      registeredCallback = cb
    }
    observe = observeSpy
    disconnect = disconnectSpy
  }

  vi.stubGlobal('PerformanceObserver', FakePerformanceObserver)
}

function fireEntries(entries: FakeEntry[]) {
  registeredCallback!({ getEntries: () => entries })
}

function entry(overrides: Partial<FakeEntry> = {}): FakeEntry {
  return { duration: 1000, startTime: 0, ...overrides }
}

function reportedTags(callIndex = 0): Record<string, string> {
  return mockSentry.captureMessage.mock.calls[callIndex]![1].tags
}

beforeEach(() => {
  mockSentry.captureMessage.mockClear()
})

afterEach(() => {
  stop()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('stallMonitor', () => {
  it('is a no-op and does not throw when PerformanceObserver is undefined entirely', () => {
    vi.stubGlobal('PerformanceObserver', undefined)

    expect(() => init()).not.toThrow()
  })

  it('constructs no observer when supportedEntryTypes has neither instrument', () => {
    installFakePerformanceObserver([])

    init({ deviceClass: 'high' })

    expect(constructedCount).toBe(0)
    expect(observeSpy).not.toHaveBeenCalled()
  })

  it('prefers long-animation-frame when both instruments are supported', () => {
    installFakePerformanceObserver(['long-animation-frame', 'longtask'])

    init({ deviceClass: 'high' })

    expect(observeSpy).toHaveBeenCalledWith({ type: 'long-animation-frame', buffered: true })
  })

  it('falls back to longtask when only that is supported', () => {
    installFakePerformanceObserver(['longtask'])

    init({ deviceClass: 'high' })

    expect(observeSpy).toHaveBeenCalledWith({ type: 'longtask', buffered: true })
  })

  it('reports a qualifying entry with the full tag set', () => {
    installFakePerformanceObserver(['long-animation-frame'])
    init({ deviceClass: 'high', appMountedAt: () => null })

    fireEntries([entry({ duration: 1000 })])

    expect(mockSentry.captureMessage).toHaveBeenCalledTimes(1)
    const [message, context] = mockSentry.captureMessage.mock.calls[0]!
    expect(message).toBe('Main-thread stall')
    expect(context.level).toBe('warning')
    expect(context.tags).toEqual(
      expect.objectContaining({
        'stall.phase': expect.any(String),
        'stall.route': expect.any(String),
        'stall.attribution': expect.any(String),
        'stall.active_work': expect.any(String),
        'stall.instrument': expect.any(String),
        'stall.device_class': expect.any(String),
        'stall.threshold_ms': expect.any(String),
        'stall.duration_bucket': expect.any(String),
      }),
    )
  })

  // REGRESSION GUARD — the point of the ticket. The predecessor
  // (giftStallMonitor) tagged every report `source: 'gift-stall-monitor'` and
  // attached gift-queue context unconditionally, so a stall with no gift work
  // active still pointed triage at gift code. With no gift work active here,
  // neither a `source` tag nor any gift-mentioning tag value may appear.
  it('REGRESSION GUARD: with no gift work active, tags carry no "source" key and no gift-mentioning value', () => {
    installFakePerformanceObserver(['long-animation-frame'])
    init({ deviceClass: 'high', appMountedAt: () => null })

    fireEntries([entry({ duration: 1000 })])

    const tags = reportedTags()
    expect(tags).not.toHaveProperty('source')
    for (const value of Object.values(tags)) {
      expect(String(value).toLowerCase()).not.toContain('gift')
    }
  })

  it('does not report entries below the device threshold', () => {
    installFakePerformanceObserver(['long-animation-frame'])
    init({ deviceClass: 'high' })

    fireEntries([entry({ duration: STALL_THRESHOLD_HIGH_MS - 1 })])

    expect(mockSentry.captureMessage).not.toHaveBeenCalled()
  })

  it("derives phase from the entry's own start time, not report time", () => {
    installFakePerformanceObserver(['long-animation-frame'])
    const MOUNTED_AT = 10_000
    init({ deviceClass: 'high', appMountedAt: () => MOUNTED_AT })

    fireEntries([
      entry({ duration: 1000, startTime: MOUNTED_AT - 5000 }), // before mount -> cold-boot
      entry({ duration: 1000, startTime: MOUNTED_AT + STALL_HYDRATION_SETTLE_MS + 5000 }), // well past -> in-session
    ])

    expect(mockSentry.captureMessage).toHaveBeenCalledTimes(2)
    const phases = mockSentry.captureMessage.mock.calls.map((call) => call[1].tags['stall.phase'])
    expect(phases).toContain('cold-boot')
    expect(phases).toContain('in-session')
  })

  it('throttles per phase: repeats within a batch and an immediate follow-up report nothing new; past the window reports again', () => {
    vi.useFakeTimers()
    installFakePerformanceObserver(['long-animation-frame'])
    init({ deviceClass: 'high', appMountedAt: () => null }) // both entries land in cold-boot

    fireEntries([entry({ duration: 1000 }), entry({ duration: 1200 })])
    expect(mockSentry.captureMessage).toHaveBeenCalledTimes(1)

    fireEntries([entry({ duration: 1000 })])
    expect(mockSentry.captureMessage).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(STALL_REPORT_THROTTLE_MS)
    fireEntries([entry({ duration: 1000 })])
    expect(mockSentry.captureMessage).toHaveBeenCalledTimes(2)
  })

  it('resolves the route from the timeline at the entry start time', () => {
    installFakePerformanceObserver(['long-animation-frame'])
    init({
      deviceClass: 'high',
      appMountedAt: () => null,
      routeTimeline: () => [
        { at: 0, pattern: '/' },
        { at: 5000, pattern: '/room/:id()' },
      ],
    })

    fireEntries([entry({ duration: 1000, startTime: 1000 })])

    expect(reportedTags()['stall.route']).toBe('/')
  })

  it('still reports when the activeWork provider throws', () => {
    installFakePerformanceObserver(['long-animation-frame'])
    init({
      deviceClass: 'high',
      appMountedAt: () => null,
      activeWork: () => {
        throw new Error('boom')
      },
    })

    fireEntries([entry({ duration: 1000 })])

    expect(mockSentry.captureMessage).toHaveBeenCalledTimes(1)
  })

  // A Long Animation Frame's `duration` spans several tasks plus the idle gaps
  // between them, so it is not blocking time. Gating on it would admit far more
  // LoAF events than longtask events for the same felt stall — and since LoAF
  // availability tracks device tier, that error would compound with the tiered
  // threshold rather than cancel it.
  it('gates on blockingDuration, not duration, when the instrument supplies it', () => {
    installFakePerformanceObserver(['long-animation-frame'])
    init({ deviceClass: 'high', appMountedAt: () => null })

    // A slow but politely-yielding frame: long overall, barely blocking.
    fireEntries([entry({ duration: 5000, blockingDuration: STALL_THRESHOLD_HIGH_MS - 1 })])

    expect(mockSentry.captureMessage).not.toHaveBeenCalled()
  })

  it('reports when blockingDuration clears the threshold even though duration is modest', () => {
    installFakePerformanceObserver(['long-animation-frame'])
    init({ deviceClass: 'high', appMountedAt: () => null })

    fireEntries([entry({ duration: 300, blockingDuration: 290 })])

    expect(mockSentry.captureMessage).toHaveBeenCalledTimes(1)
  })

  it('falls back to duration when the entry carries no blockingDuration (longtask)', () => {
    installFakePerformanceObserver(['longtask'])
    init({ deviceClass: 'high', appMountedAt: () => null })

    fireEntries([entry({ duration: STALL_THRESHOLD_HIGH_MS + 1 })])

    expect(mockSentry.captureMessage).toHaveBeenCalledTimes(1)
  })

  it('buckets and records blocking time, keeping both raw durations in extra', () => {
    installFakePerformanceObserver(['long-animation-frame'])
    init({ deviceClass: 'high', appMountedAt: () => null })

    fireEntries([entry({ duration: 9000, blockingDuration: 700 })])

    const [, context] = mockSentry.captureMessage.mock.calls[0]!
    // 700ms of blocking, not the 9s frame — otherwise a volume comparison
    // between LoAF and longtask devices would be meaningless.
    expect(context.tags['stall.duration_bucket']).toBe('500ms-1s')
    expect(context.extra.blockingMs).toBe(700)
    expect(context.extra.durationMs).toBe(9000)
    expect(context.extra.blockingDurationMs).toBe(700)
  })

  it('picks the worst entry per phase by blocking time, not by duration', () => {
    installFakePerformanceObserver(['long-animation-frame'])
    init({ deviceClass: 'high', appMountedAt: () => null })

    fireEntries([
      entry({ duration: 8000, blockingDuration: 300 }),
      entry({ duration: 900, blockingDuration: 800 }),
    ])

    expect(mockSentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(mockSentry.captureMessage.mock.calls[0]![1].extra.blockingMs).toBe(800)
  })

  it('merges sampledExtra into extra and never promotes it to a tag', () => {
    installFakePerformanceObserver(['long-animation-frame'])
    init({
      deviceClass: 'high',
      appMountedAt: () => null,
      sampledExtra: () => ({ giftQueueDepth: 7 }),
    })

    fireEntries([entry({ duration: 1000 })])

    const [, context] = mockSentry.captureMessage.mock.calls[0]!
    expect(context.extra.giftQueueDepth).toBe(7)
    expect(Object.keys(context.tags)).not.toContain('giftQueueDepth')
  })

  it('still reports when the sampledExtra provider throws', () => {
    installFakePerformanceObserver(['long-animation-frame'])
    init({
      deviceClass: 'high',
      appMountedAt: () => null,
      sampledExtra: () => {
        throw new Error('boom')
      },
    })

    fireEntries([entry({ duration: 1000 })])

    expect(mockSentry.captureMessage).toHaveBeenCalledTimes(1)
  })

  it('stop() disconnects and clears the per-phase throttle so a fresh init reports immediately', () => {
    installFakePerformanceObserver(['long-animation-frame'])
    init({ deviceClass: 'high', appMountedAt: () => null })
    fireEntries([entry({ duration: 1000 })])
    expect(mockSentry.captureMessage).toHaveBeenCalledTimes(1)

    stop()
    expect(disconnectSpy).toHaveBeenCalledTimes(1)

    installFakePerformanceObserver(['long-animation-frame'])
    init({ deviceClass: 'high', appMountedAt: () => null })
    fireEntries([entry({ duration: 1000 })])

    expect(mockSentry.captureMessage).toHaveBeenCalledTimes(2)
  })
})
