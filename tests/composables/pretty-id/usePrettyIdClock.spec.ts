import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, effectScope, onScopeDispose, readonly, ref } from 'vue'
import type { EffectScope } from 'vue'
import { usePrettyIdClock } from '~/composables/pretty-id/usePrettyIdClock'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import { prettyIdClockOffset } from '~/utils/pretty-id-auction'
import { formatPrettyIdDuration } from '~/utils/pretty-id-format'
import { HOUR, SERVER_NOW_MS } from '../../helpers/prettyIdAuctionFixtures'

// VueUse only starts `useIntervalFn` in a browser (`isClient`); the specs run in node, so give it a plain interval.
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return {
    ...actual,
    useIntervalFn: (callback: () => void, interval: number) => {
      const timer = setInterval(callback, interval)
      onScopeDispose(() => clearInterval(timer))
    },
  }
})

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)

describe('usePrettyIdClock (server-adjusted time)', () => {
  let scope: EffectScope

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    // The device clock is 2 hours BEHIND the server.
    vi.setSystemTime(SERVER_NOW_MS - 2 * HOUR)
  })

  afterEach(() => {
    scope?.stop()
    vi.useRealTimers()
  })

  function mountClock() {
    scope = effectScope()
    return scope.run(() => usePrettyIdClock())!
  }

  /** Time left on a countdown to `targetMs`, as a countdown would render it. */
  function label(clock: ReturnType<typeof usePrettyIdClock>, targetMs: number): string {
    return formatPrettyIdDuration(targetMs - clock.now.value)
  }

  it('starts on the device clock while no response has set an offset', () => {
    const clock = mountClock()
    expect(clock.now.value).toBe(SERVER_NOW_MS - 2 * HOUR)
  })

  it('follows server_now, not the device clock, once a response sets the offset', async () => {
    const store = usePrettyIdAuctionStore()
    const clock = mountClock()
    const endsAt = SERVER_NOW_MS + 90 * 60_000 // 1 h 30 min after server-now

    // Device-clock countdown would read 3 h 30 min.
    expect(label(clock, endsAt)).toBe('03:30:00')

    store.setClockOffsetMs(prettyIdClockOffset(new Date(SERVER_NOW_MS).toISOString(), Date.now())!)
    await vi.advanceTimersByTimeAsync(0)
    expect(clock.now.value).toBe(SERVER_NOW_MS)
    expect(label(clock, endsAt)).toBe('01:30:00')
  })

  it('keeps ticking on the server clock every second', async () => {
    const store = usePrettyIdAuctionStore()
    store.setClockOffsetMs(2 * HOUR)
    const clock = mountClock()
    const endsAt = SERVER_NOW_MS + 10_000

    expect(label(clock, endsAt)).toBe('00:00:10')
    await vi.advanceTimersByTimeAsync(3_000)
    expect(label(clock, endsAt)).toBe('00:00:07')
  })

  it('a countdown past zero clamps at 00:00:00', async () => {
    const store = usePrettyIdAuctionStore()
    store.setClockOffsetMs(2 * HOUR)
    const clock = mountClock()
    const endsAt = SERVER_NOW_MS + 2_000

    await vi.advanceTimersByTimeAsync(5_000)
    expect(label(clock, endsAt)).toBe('00:00:00')
  })

  it('repaints at once when the offset changes', async () => {
    const store = usePrettyIdAuctionStore()
    const clock = mountClock()
    store.setClockOffsetMs(10_000)
    await vi.advanceTimersByTimeAsync(0)
    expect(clock.now.value).toBe(Date.now() + 10_000)
  })
})
