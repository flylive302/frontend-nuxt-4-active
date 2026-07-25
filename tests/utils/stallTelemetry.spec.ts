import { describe, expect, it } from 'vitest'
import {
  activeWorkTag,
  attributeFromContainers,
  attributeFromScripts,
  NO_ACTIVE_WORK_LABEL,
  PRE_ROUTE_LABEL,
  resolveRouteAt,
  resolveStallAttribution,
  resolveStallPhase,
  stallBlockingMs,
  stallDurationBucket,
  stallThresholdFor,
  UNATTRIBUTED_LABEL,
  type RouteMark,
  type StallContainerLike,
  type StallScriptLike,
} from '../../app/utils/stall-telemetry'
import type { DeviceClass } from '../../app/utils/device-class'
import {
  STALL_ACTIVE_WORK_MAX,
  STALL_ATTRIBUTION_MAX_CHARS,
  STALL_DURATION_BUCKETS,
  STALL_DURATION_OVERFLOW_LABEL,
  STALL_HYDRATION_SETTLE_MS,
  STALL_THRESHOLD_HIGH_MS,
  STALL_THRESHOLD_LOW_MS,
  STALL_THRESHOLD_MID_MS,
  STALL_THRESHOLD_UNKNOWN_MS,
} from '../../app/constants/telemetry'

// ============================================================
// client-session-stability 03 — main-thread stall telemetry
//
// The previous instrument (giftStallMonitor) tagged every stall with a fixed
// `source: 'gift-stall-monitor'` regardless of cause. These helpers exist so
// attribution is either real (the browser told us) or explicitly
// `unattributed` — never a guessed default. These tests pin that contract.
// ============================================================

describe('stallThresholdFor', () => {
  it.each<[DeviceClass, number]>([
    ['low', STALL_THRESHOLD_LOW_MS],
    ['mid', STALL_THRESHOLD_MID_MS],
    ['high', STALL_THRESHOLD_HIGH_MS],
    ['unknown', STALL_THRESHOLD_UNKNOWN_MS],
  ])('maps %s to its configured threshold', (deviceClass, expected) => {
    expect(stallThresholdFor(deviceClass)).toBe(expected)
  })
})

describe('resolveStallPhase', () => {
  const MOUNTED_AT = 10_000

  it('is cold-boot regardless of start time when appMountedAt is null', () => {
    expect(resolveStallPhase(0, null)).toBe('cold-boot')
    expect(resolveStallPhase(999_999, null)).toBe('cold-boot')
    expect(resolveStallPhase(-500, null)).toBe('cold-boot')
  })

  it('is cold-boot when the entry starts strictly before appMountedAt', () => {
    expect(resolveStallPhase(MOUNTED_AT - 1, MOUNTED_AT)).toBe('cold-boot')
  })

  it('is hydration when the entry starts exactly at appMountedAt', () => {
    expect(resolveStallPhase(MOUNTED_AT, MOUNTED_AT)).toBe('hydration')
  })

  it('is hydration inside the settle window', () => {
    expect(resolveStallPhase(MOUNTED_AT + STALL_HYDRATION_SETTLE_MS - 1, MOUNTED_AT)).toBe('hydration')
  })

  it('is in-session exactly at the settle-window boundary (exclusive)', () => {
    expect(resolveStallPhase(MOUNTED_AT + STALL_HYDRATION_SETTLE_MS, MOUNTED_AT)).toBe('in-session')
  })

  it('is in-session well past the settle window', () => {
    expect(resolveStallPhase(MOUNTED_AT + STALL_HYDRATION_SETTLE_MS + 60_000, MOUNTED_AT)).toBe('in-session')
  })
})

describe('resolveRouteAt', () => {
  it('returns PRE_ROUTE_LABEL for an empty timeline', () => {
    expect(resolveRouteAt(1000, [])).toBe(PRE_ROUTE_LABEL)
  })

  it('returns PRE_ROUTE_LABEL when the entry starts before the first mark', () => {
    const timeline: RouteMark[] = [{ at: 1000, pattern: '/room/:id()' }]
    expect(resolveRouteAt(500, timeline)).toBe(PRE_ROUTE_LABEL)
  })

  it('picks the last mark whose `at` is <= start time, out of three', () => {
    const timeline: RouteMark[] = [
      { at: 0, pattern: '/' },
      { at: 1000, pattern: '/room/:id()' },
      { at: 5000, pattern: '/profile' },
    ]
    // 2000 is past the middle mark (1000) but before the last (5000) — the
    // middle mark must win, not the first or the last.
    expect(resolveRouteAt(2000, timeline)).toBe('/room/:id()')
  })

  it('treats a mark exactly at the start time as active', () => {
    const timeline: RouteMark[] = [
      { at: 0, pattern: '/' },
      { at: 1000, pattern: '/room/:id()' },
    ]
    expect(resolveRouteAt(1000, timeline)).toBe('/room/:id()')
  })
})

describe('attributeFromScripts', () => {
  it('returns null for undefined', () => {
    expect(attributeFromScripts(undefined)).toBeNull()
  })

  it('returns null for an empty list', () => {
    expect(attributeFromScripts([])).toBeNull()
  })

  it('picks the longest script by duration, not the first', () => {
    const scripts: StallScriptLike[] = [
      { sourceFunctionName: 'small', duration: 50 },
      { sourceFunctionName: 'big', duration: 300 },
    ]
    expect(attributeFromScripts(scripts)).toBe('big')
  })

  it('prefers sourceFunctionName over the sourceURL file name', () => {
    const scripts: StallScriptLike[] = [
      { sourceFunctionName: 'renderGift', sourceURL: 'https://cdn.example.com/assets/app.js', duration: 100 },
    ]
    expect(attributeFromScripts(scripts)).toBe('renderGift')
  })

  it("falls back to the URL's file name, stripped of query/hash and directories", () => {
    const scripts: StallScriptLike[] = [
      { sourceURL: 'https://cdn.example.com/assets/app.js?v=123#chunk', duration: 100 },
    ]
    expect(attributeFromScripts(scripts)).toBe('app.js')
  })

  it('appends the invokerType in parentheses when present', () => {
    const scripts: StallScriptLike[] = [
      { sourceFunctionName: 'renderGift', invokerType: 'classic-script', duration: 100 },
    ]
    expect(attributeFromScripts(scripts)).toBe('renderGift (classic-script)')
  })

  it('returns null when a script has neither a function name nor a sourceURL', () => {
    const scripts: StallScriptLike[] = [{ duration: 100 }]
    expect(attributeFromScripts(scripts)).toBeNull()
  })

  it('truncates to STALL_ATTRIBUTION_MAX_CHARS', () => {
    const longName = 'x'.repeat(STALL_ATTRIBUTION_MAX_CHARS + 40)
    const scripts: StallScriptLike[] = [{ sourceFunctionName: longName, duration: 100 }]

    const result = attributeFromScripts(scripts)

    expect(result).not.toBeNull()
    expect(result!.length).toBe(STALL_ATTRIBUTION_MAX_CHARS)
    expect(result).toBe(longName.slice(0, STALL_ATTRIBUTION_MAX_CHARS))
  })
})

describe('attributeFromContainers', () => {
  it('returns null for undefined', () => {
    expect(attributeFromContainers(undefined)).toBeNull()
  })

  it('returns null for an empty list', () => {
    expect(attributeFromContainers([])).toBeNull()
  })

  it('returns null for a bare window container with no name/id/src — the common real case', () => {
    const containers: StallContainerLike[] = [{ containerType: 'window' }]
    expect(attributeFromContainers(containers)).toBeNull()
  })

  it('uses containerName in a "type:name" shape', () => {
    const containers: StallContainerLike[] = [{ containerType: 'iframe', containerName: 'ad-frame' }]
    expect(attributeFromContainers(containers)).toBe('iframe:ad-frame')
  })

  it('falls back to containerId when there is no containerName', () => {
    const containers: StallContainerLike[] = [{ containerType: 'iframe', containerId: 'frame-1' }]
    expect(attributeFromContainers(containers)).toBe('iframe:frame-1')
  })

  it('falls back to the containerSrc file name when there is no name or id', () => {
    const containers: StallContainerLike[] = [
      { containerType: 'iframe', containerSrc: 'https://ads.example.com/embed/frame.html?x=1' },
    ]
    expect(attributeFromContainers(containers)).toBe('iframe:frame.html')
  })

  it('skips a contentless first container and uses a later informative one', () => {
    const containers: StallContainerLike[] = [
      { containerType: 'window' },
      { containerType: 'iframe', containerName: 'ads' },
    ]
    expect(attributeFromContainers(containers)).toBe('iframe:ads')
  })
})

describe('resolveStallAttribution', () => {
  it('lets scripts win over containers', () => {
    const result = resolveStallAttribution({
      scripts: [{ sourceFunctionName: 'renderGift', duration: 100 }],
      containers: [{ containerType: 'iframe', containerName: 'ads' }],
    })
    expect(result).toBe('renderGift')
  })

  it('falls back to containers when scripts yield nothing', () => {
    const result = resolveStallAttribution({
      scripts: [{ duration: 100 }], // neither function name nor sourceURL
      containers: [{ containerType: 'iframe', containerName: 'ads' }],
    })
    expect(result).toBe('iframe:ads')
  })

  it('returns UNATTRIBUTED_LABEL when both are empty', () => {
    expect(resolveStallAttribution({ scripts: [], containers: [] })).toBe(UNATTRIBUTED_LABEL)
  })

  it('returns exactly UNATTRIBUTED_LABEL with no inputs at all — never a gift-ish default', () => {
    expect(resolveStallAttribution({})).toBe(UNATTRIBUTED_LABEL)
    expect(resolveStallAttribution({})).not.toMatch(/gift/i)
  })
})

describe('activeWorkTag', () => {
  it('returns NO_ACTIVE_WORK_LABEL for an empty list', () => {
    expect(activeWorkTag([])).toBe(NO_ACTIVE_WORK_LABEL)
  })

  it('dedupes and sorts', () => {
    expect(activeWorkTag(['b', 'a', 'b'])).toBe('a+b')
  })

  it('drops falsy entries', () => {
    expect(activeWorkTag(['', 'a', '', 'b'])).toBe('a+b')
  })

  it('caps at STALL_ACTIVE_WORK_MAX and appends the overflow count', () => {
    const labels = ['f', 'e', 'd', 'c', 'b', 'a']
    const sorted = [...labels].sort()
    const shown = sorted.slice(0, STALL_ACTIVE_WORK_MAX)
    const overflow = sorted.length - shown.length
    const expected = `${shown.join('+')}+${overflow}more`

    expect(activeWorkTag(labels)).toBe(expected)
  })
})

describe('stallDurationBucket', () => {
  it.each([...STALL_DURATION_BUCKETS])('returns $label for a duration just below $maxMs ms', (bucket) => {
    expect(stallDurationBucket(bucket.maxMs - 1)).toBe(bucket.label)
  })

  it('has exclusive upper bounds — exactly a boundary lands in the next bucket', () => {
    for (let i = 0; i < STALL_DURATION_BUCKETS.length - 1; i++) {
      const boundary = STALL_DURATION_BUCKETS[i]!
      const next = STALL_DURATION_BUCKETS[i + 1]!
      expect(stallDurationBucket(boundary.maxMs)).toBe(next.label)
    }
  })

  it('overflows past the last bucket boundary', () => {
    const last = STALL_DURATION_BUCKETS[STALL_DURATION_BUCKETS.length - 1]!
    expect(stallDurationBucket(last.maxMs)).toBe(STALL_DURATION_OVERFLOW_LABEL)
    expect(stallDurationBucket(last.maxMs + 100_000)).toBe(STALL_DURATION_OVERFLOW_LABEL)
  })
})

describe('stallBlockingMs', () => {
  it('uses blockingDuration when the instrument supplies it (Long Animation Frame)', () => {
    expect(stallBlockingMs({ duration: 5000, blockingDuration: 120 })).toBe(120)
  })

  it('falls back to duration when there is no blockingDuration (longtask)', () => {
    expect(stallBlockingMs({ duration: 340 })).toBe(340)
  })

  it('honours a zero blockingDuration rather than treating it as absent', () => {
    // A frame that was slow but never blocked. Falling back to `duration` here
    // would report a stall the user never felt.
    expect(stallBlockingMs({ duration: 800, blockingDuration: 0 })).toBe(0)
  })
})
