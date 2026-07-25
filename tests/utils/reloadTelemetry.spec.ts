import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  consumePendingReload,
  isRoomPath,
  markReloadCause,
  resolvePendingReload,
  routePatternOf,
  sessionAgeBucket,
  writeInRoomSnapshot,
  type InRoomSnapshot,
  type ReloadCauseMarker,
} from '../../app/utils/reload-telemetry'

// ============================================================
// client-session-stability 02 — recording every in-room reload with its cause
//
// The dominant reload path suppresses its own error reporting, so nobody could
// tell a deploy-driven chunk reload from a WebView renderer kill. The renderer
// kill cannot self-report by definition, so it is inferred by ELIMINATION: the
// app booted, persisted state says the user was in a room seconds ago, and no
// cause marker was left behind.
//
// That inference is the whole instrument. These tests pin its truth table.
// ============================================================

const session = new Map<string, string>()
const local = new Map<string, string>()

function stub(store: Map<string, string>) {
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
  }
}

vi.stubGlobal('sessionStorage', stub(session))
vi.stubGlobal('localStorage', stub(local))

const NOW = 1_700_000_000_000

function marker(overrides: Partial<ReloadCauseMarker> = {}): ReloadCauseMarker {
  return {
    cause: 'chunk-preload',
    detail: 'Failed to fetch dynamically imported module',
    route: '/room/482',
    sessionAgeMs: 90_000,
    at: NOW - 2_000,
    ...overrides,
  }
}

function snapshot(overrides: Partial<InRoomSnapshot> = {}): InRoomSnapshot {
  return {
    roomId: 482,
    seated: true,
    hidden: false,
    minimized: false,
    route: '/room/482',
    startedAt: NOW - 300_000,
    at: NOW - 3_000,
    ...overrides,
  }
}

beforeEach(() => {
  session.clear()
  local.clear()
})

describe('resolvePendingReload — cause attribution', () => {
  it('reports nothing on a genuine first launch', () => {
    expect(resolvePendingReload({ marker: null, snapshot: null, now: NOW })).toBeNull()
  })

  it('attributes a chunk-preload reload and pulls room context from the snapshot', () => {
    const pending = resolvePendingReload({ marker: marker(), snapshot: snapshot(), now: NOW })

    expect(pending).toMatchObject({
      cause: 'chunk-preload',
      inRoom: true,
      roomId: 482,
      seated: true,
    })
  })

  it('preserves the router-resolve cause distinctly from chunk-preload', () => {
    const pending = resolvePendingReload({
      marker: marker({ cause: 'router-resolve' }),
      snapshot: snapshot(),
      now: NOW,
    })

    expect(pending?.cause).toBe('router-resolve')
  })

  it('prefers the marker session age over the snapshot heartbeat estimate', () => {
    // The marker reads the clock at the moment of the reload; the snapshot is
    // only accurate to one 5s heartbeat. 90_000 is the marker's exact figure.
    const pending = resolvePendingReload({ marker: marker(), snapshot: snapshot(), now: NOW })

    expect(pending?.sessionAgeMs).toBe(90_000)
  })

  it('records a chunk reload that happened outside a room as not-in-room', () => {
    const pending = resolvePendingReload({ marker: marker(), snapshot: null, now: NOW })

    expect(pending).toMatchObject({ cause: 'chunk-preload', inRoom: false, roomId: null })
  })

  it('infers no-js-cause when the user was in a room but nothing recorded why', () => {
    // The renderer-kill signature: persisted evidence of being in a room, and
    // no marker, because nothing in the JS runtime survived to write one.
    const pending = resolvePendingReload({ marker: null, snapshot: snapshot(), now: NOW })

    expect(pending).toMatchObject({
      cause: 'no-js-cause',
      inRoom: true,
      roomId: 482,
      seated: true,
    })
  })

  it('derives session age from the snapshot when inferring no-js-cause', () => {
    const pending = resolvePendingReload({ marker: null, snapshot: snapshot(), now: NOW })

    expect(pending?.sessionAgeMs).toBe(297_000)
  })

  it('carries the minimized flag and the real route, not a synthesised room path', () => {
    // `minimizeRoom()` keeps `currentRoom` set, so a minimized user is "in a
    // room" while browsing elsewhere. Ticket 01's rehydration only covers cold
    // mounts on /room/:id, so this case cannot recover — it must stay separable
    // or it drags down the measured effect of 01's fix.
    const pending = resolvePendingReload({
      marker: null,
      snapshot: snapshot({ minimized: true, route: '/inbox' }),
      now: NOW,
    })

    expect(pending).toMatchObject({ minimized: true, route: '/inbox', inRoom: true })
  })

  it('carries the backgrounded flag, so an OS reclaim is separable from a kill during use', () => {
    const pending = resolvePendingReload({
      marker: null,
      snapshot: snapshot({ hidden: true }),
      now: NOW,
    })

    expect(pending?.wasBackgrounded).toBe(true)
  })
})

describe('resolvePendingReload — freshness bounds', () => {
  it('ignores a marker older than its TTL and falls through to inference', () => {
    // An hour-old marker describes a reload that already happened and was
    // already reported; attributing this boot to it would be a lie.
    const pending = resolvePendingReload({
      marker: marker({ at: NOW - 3_600_000 }),
      snapshot: snapshot(),
      now: NOW,
    })

    expect(pending?.cause).toBe('no-js-cause')
  })

  it('treats a stale snapshot as "not in a room", not as room context', () => {
    const pending = resolvePendingReload({
      marker: marker(),
      snapshot: snapshot({ at: NOW - 3_600_000 }),
      now: NOW,
    })

    expect(pending).toMatchObject({ inRoom: false, roomId: null })
  })

  it('reports nothing when both markers are stale', () => {
    const pending = resolvePendingReload({
      marker: marker({ at: NOW - 3_600_000 }),
      snapshot: snapshot({ at: NOW - 3_600_000 }),
      now: NOW,
    })

    expect(pending).toBeNull()
  })

  it('rejects a future-dated marker instead of trusting it forever', () => {
    // A backwards clock step yields a negative age, which sails through any
    // naive `age < ttl` check for as long as the skew lasts.
    const pending = resolvePendingReload({
      marker: marker({ at: NOW + 3_600_000 }),
      snapshot: null,
      now: NOW,
    })

    expect(pending).toBeNull()
  })

  it('never reports a negative session age from a skewed snapshot', () => {
    const pending = resolvePendingReload({
      marker: null,
      snapshot: snapshot({ startedAt: NOW, at: NOW - 3_000 }),
      now: NOW,
    })

    expect(pending?.sessionAgeMs).toBe(0)
  })
})

describe('consumePendingReload — consumption', () => {
  it('reads a recorded cause back out of storage', () => {
    markReloadCause('chunk-preload', 'Unable to preload CSS', '/room/482')

    expect(consumePendingReload()?.cause).toBe('chunk-preload')
  })

  it('reports a reload exactly once — a second boot finds nothing', () => {
    // Without clearing, one reload would be re-reported on every subsequent
    // boot and the measured rate would be meaningless.
    markReloadCause('chunk-preload', 'Unable to preload CSS', '/room/482')
    writeInRoomSnapshot({
      roomId: 482, seated: true, hidden: false, minimized: false, route: '/room/482',
    })

    expect(consumePendingReload()).not.toBeNull()
    expect(consumePendingReload()).toBeNull()
  })

  it('truncates a long error detail rather than carrying it whole', () => {
    markReloadCause('chunk-preload', 'x'.repeat(5_000), '/room/482')

    expect(consumePendingReload()!.detail.length).toBe(300)
  })

  it('survives storage being unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('quota') },
      setItem: () => { throw new Error('quota') },
      removeItem: () => { throw new Error('quota') },
    })

    expect(() => consumePendingReload()).not.toThrow()

    vi.stubGlobal('localStorage', stub(local))
  })
})

describe('tag shaping', () => {
  it.each([
    [null, 'unknown'],
    [-1, 'unknown'],
    [0, '<30s'],
    [29_999, '<30s'],
    [30_000, '30s-2m'],
    [119_999, '30s-2m'],
    [120_000, '2m-10m'],
    [3_599_999, '10m-1h'],
    [3_600_000, '>1h'],
  ])('buckets a session age of %s as %s', (ageMs, expected) => {
    expect(sessionAgeBucket(ageMs)).toBe(expected)
  })

  it.each([
    ['/', '/'],
    ['', '/'],
    ['/room/482', '/room/[id]'],
    ['/room/482?joined=1', '/room/[id]'],
    ['/profile/12', '/profile'],
  ])('collapses %s to the low-cardinality pattern %s', (path, expected) => {
    // A raw path would mint one tag value per room, which Sentry cannot group.
    expect(routePatternOf(path)).toBe(expected)
  })

  it.each([
    ['/room/5', 5, true],
    ['/room/5?a=1', 5, true],
    ['/room/55', 5, false],
    ['/room/5/settings', 5, true],
    ['/', 5, false],
    ['/rooms/5', 5, false],
  ])('isRoomPath(%s, %s) === %s', (path, roomId, expected) => {
    // Prefix matching would read /room/55 as room 5 and grade an ejection as a
    // recovery.
    expect(isRoomPath(path, roomId)).toBe(expected)
  })
})
