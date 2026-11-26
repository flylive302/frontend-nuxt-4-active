import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { EffectScope } from 'vue'
import { emitAppForeground } from '~/services/appForeground'

const visibilityState = vi.hoisted(() => ({ ref: null as null | { value: 'visible' | 'hidden' } }))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  const { ref } = await import('vue')
  visibilityState.ref = ref<'visible' | 'hidden'>('visible')
  return { ...actual, useDocumentVisibility: () => visibilityState.ref }
})

const { usePrettyIdPoll } = await import('~/composables/pretty-id/usePrettyIdPoll')

/** Lets watchers (pre-flush) and resolved promises run. */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
}

describe('usePrettyIdPoll', () => {
  let scope: EffectScope
  const load = vi.fn<(isFirst: boolean) => Promise<void>>()
  const nextDelayMs = vi.fn<() => number | null>()

  function start() {
    scope = effectScope()
    return scope.run(() => usePrettyIdPoll({ load, nextDelayMs }))!
  }

  beforeEach(() => {
    vi.useFakeTimers()
    load.mockReset()
    load.mockResolvedValue(undefined)
    nextDelayMs.mockReset()
    nextDelayMs.mockReturnValue(60_000)
    visibilityState.ref!.value = 'visible'
  })

  afterEach(() => {
    scope?.stop()
    vi.useRealTimers()
  })

  it('restart fetches at once (first), then follows nextDelayMs after each fetch', async () => {
    const poll = start()
    poll.restart()
    await settle()
    expect(load).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenLastCalledWith(true)

    await vi.advanceTimersByTimeAsync(59_999)
    expect(load).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(load).toHaveBeenCalledTimes(2)
    expect(load).toHaveBeenLastCalledWith(false)
  })

  it('re-reads the delay after every fetch, so the cadence can speed up', async () => {
    nextDelayMs.mockReturnValueOnce(60_000).mockReturnValue(3_000)
    start().restart()
    await settle()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(load).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(3_000)
    expect(load).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(3_000)
    expect(load).toHaveBeenCalledTimes(4)
  })

  it('waits for the fetch to finish before it starts the delay (no overlap, no fixed interval)', async () => {
    let finish!: () => void
    load.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve }))
    nextDelayMs.mockReturnValue(3_000)
    start().restart()
    await settle()

    await vi.advanceTimersByTimeAsync(10_000) // fetch still pending: nothing else starts
    expect(load).toHaveBeenCalledTimes(1)

    finish()
    await settle()
    await vi.advanceTimersByTimeAsync(2_999)
    expect(load).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('stops when nextDelayMs is null, and visible / foreground no longer refetch', async () => {
    nextDelayMs.mockReturnValue(null)
    start().restart()
    await settle()
    expect(load).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(load).toHaveBeenCalledTimes(1)

    visibilityState.ref!.value = 'hidden'
    await settle()
    visibilityState.ref!.value = 'visible'
    await settle()
    emitAppForeground()
    await settle()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('a hidden page stops polling; becoming visible fetches at once and resumes', async () => {
    start().restart()
    await settle()
    expect(load).toHaveBeenCalledTimes(1)

    visibilityState.ref!.value = 'hidden'
    await settle()
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(load).toHaveBeenCalledTimes(1)

    visibilityState.ref!.value = 'visible'
    await settle()
    expect(load).toHaveBeenCalledTimes(2)
    expect(load).toHaveBeenLastCalledWith(false)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('a fetch that was in flight when the page hid does not reschedule', async () => {
    let finish!: () => void
    load.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve }))
    start().restart()
    await settle()

    visibilityState.ref!.value = 'hidden'
    await settle()
    finish()
    await settle()
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('does not fetch when started on a hidden page, then fetches (as the first) once visible', async () => {
    visibilityState.ref!.value = 'hidden'
    start().restart()
    await settle()
    expect(load).not.toHaveBeenCalled()

    visibilityState.ref!.value = 'visible'
    await settle()
    expect(load).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenLastCalledWith(true)
  })

  it('an app foreground fetches at once, even inside the foreground-sync debounce window', async () => {
    start().restart()
    await settle()
    await vi.advanceTimersByTimeAsync(2_000)
    emitAppForeground()
    await settle()
    expect(load).toHaveBeenCalledTimes(2)
    // and the old timer is gone: exactly one chain
    await vi.advanceTimersByTimeAsync(60_000)
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('an app foreground still fetches when the visibility ref is stuck on hidden (missed visibilitychange), then the cadence continues', async () => {
    start().restart()
    await settle()
    visibilityState.ref!.value = 'hidden'
    await settle()
    expect(load).toHaveBeenCalledTimes(1)

    // The native WebView never delivered "visible": only the foreground signal arrives.
    emitAppForeground()
    await settle()
    expect(load).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('a foreground while a fetch is in flight is dropped (web fires visibility and foreground together)', async () => {
    let finish!: () => void
    load.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve }))
    start().restart()
    await settle()
    emitAppForeground()
    emitAppForeground()
    await settle()
    expect(load).toHaveBeenCalledTimes(1)
    finish()
    await settle()
  })

  it('restart drops the old chain: a stale in-flight fetch does not reschedule', async () => {
    let finishOld!: () => void
    load.mockImplementationOnce(() => new Promise<void>((resolve) => { finishOld = resolve }))
    const poll = start()
    poll.restart()
    await settle()

    poll.restart() // e.g. the auction id changed
    await settle()
    expect(load).toHaveBeenCalledTimes(2)
    expect(load).toHaveBeenLastCalledWith(true)

    finishOld()
    await settle()
    await vi.advanceTimersByTimeAsync(60_000)
    // one chain only: the restarted one fired once more, the stale one added nothing
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('enabled false makes no call and schedules nothing; turning it on starts the chain', async () => {
    const { ref } = await import('vue')
    const flag = ref(false)
    scope = effectScope()
    const poll = scope.run(() => usePrettyIdPoll({ load, nextDelayMs, enabled: () => flag.value }))!

    poll.restart()
    poll.refreshNow()
    emitAppForeground()
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(load).not.toHaveBeenCalled()

    flag.value = true
    await settle()
    expect(load).toHaveBeenCalledTimes(1)

    flag.value = false
    await settle()
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('disposing the scope stops the timer and the foreground subscription', async () => {
    start().restart()
    await settle()
    scope.stop()
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    emitAppForeground()
    await settle()
    expect(load).toHaveBeenCalledTimes(1)
  })
})
