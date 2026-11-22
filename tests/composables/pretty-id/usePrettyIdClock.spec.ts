import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, nextTick, readonly, ref, watch } from 'vue'
import { makeMe, SERVER_NOW } from '../../helpers/prettyIdFixtures'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('watch', watch)
// VueUse only starts timers where a browser exists (`isClient`). Stubbed before
// VueUse is first imported, which happens lazily inside `setup()`.
vi.stubGlobal('window', globalThis)
vi.stubGlobal('document', {})

const TICK_MS = 1_000
const HOUR_MS = 3_600_000

describe('usePrettyIdClock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(SERVER_NOW))
    setActivePinia(createPinia())
    // The shared clock is module-level state: every test gets a fresh module and store.
    vi.resetModules()
  })

  afterEach(() => vi.useRealTimers())

  async function setup() {
    const { usePrettyIdStore } = await import('~/stores/prettyId')
    const { usePrettyIdClock } = await import('~/composables/pretty-id/usePrettyIdClock')
    return { store: usePrettyIdStore(), clock: usePrettyIdClock() }
  }

  it('starts on the server clock and advances every tick', async () => {
    const { store, clock } = await setup()
    store.setMe(makeMe({ server_now: new Date(Date.parse(SERVER_NOW) + HOUR_MS).toISOString() }))
    await nextTick()
    expect(clock.now.value).toBe(Date.parse(SERVER_NOW) + HOUR_MS)

    vi.advanceTimersByTime(TICK_MS)
    expect(clock.now.value).toBe(Date.parse(SERVER_NOW) + HOUR_MS + TICK_MS)
  })

  it('repaints at once when the offset changes, without waiting for a tick', async () => {
    const { store, clock } = await setup()
    expect(clock.now.value).toBe(Date.parse(SERVER_NOW))

    store.setMe(makeMe({ server_now: new Date(Date.parse(SERVER_NOW) + 5 * HOUR_MS).toISOString() }))
    await nextTick()

    expect(clock.now.value).toBe(Date.parse(SERVER_NOW) + 5 * HOUR_MS)
  })

  it('shares one clock between consumers', async () => {
    const { clock } = await setup()
    const { usePrettyIdClock } = await import('~/composables/pretty-id/usePrettyIdClock')
    expect(usePrettyIdClock().now).toBe(clock.now)
  })
})
