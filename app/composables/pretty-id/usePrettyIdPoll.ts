/**
 * Self-rescheduling poller (Rare Auction pages).
 *
 * NOT a fixed interval: after every fetch it asks `nextDelayMs()` how long to
 * wait, so the cadence can follow server time (60 s -> 3 s in the final hour).
 * One timer chain only.
 *
 * - `restart()` begins a new chain (first load is NOT quiet) and drops the old
 *   one: a fetch still in flight from before no longer reschedules.
 * - Hidden page (`document.visibilityState`): the timer stops; becoming
 *   visible fetches at once and resumes.
 * - App foreground (`services/appForeground`): fetches at once. It also clears the
 *   hidden state: on native the `visibilitychange` event is unreliable after the OS
 *   suspends the WebView, so the foreground signal must not depend on it.
 * - `nextDelayMs()` returning `null` = terminal: nothing is scheduled and the
 *   visible / foreground refetches stop too, until the next `restart()`.
 * - A visible / foreground trigger while a fetch is in flight is dropped (the
 *   web fires both for one return to the page).
 * - `enabled` going false stops everything and makes no call; going true restarts.
 *
 * Call from a component or page `setup` (the scope disposal clears the timer).
 */

import { useDocumentVisibility } from '@vueuse/core'
import { onScopeDispose, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { onAppForeground } from '~/services/appForeground'

export interface PrettyIdPollOptions {
  /** One fetch; `isFirst` is true for the first fetch of a chain. Must not reject. */
  load: (isFirst: boolean) => Promise<void>
  /** Ms until the next fetch given the current state, or `null` when polling is over. Read after each fetch. */
  nextDelayMs: () => number | null
  /** Master switch (e.g. the auction flag). Default on. */
  enabled?: MaybeRefOrGetter<boolean>
}

export interface PrettyIdPoll {
  /** Starts a fresh chain: immediate non-quiet fetch, then the cadence. */
  restart: () => void
  /** Fetches now (unless terminal / hidden / disabled / already fetching) and resumes the cadence. */
  refreshNow: () => void
}

export function usePrettyIdPoll(options: PrettyIdPollOptions): PrettyIdPoll {
  const visibility = useDocumentVisibility()

  let timer: ReturnType<typeof setTimeout> | null = null
  /** Bumped by `restart()` / disposal: a fetch from an older generation must not reschedule. */
  let generation = 0
  let fetchingGeneration: number | null = null
  let isTerminal = false
  let isDisposed = false
  let needsFirst = true
  /** Our own copy of "page hidden": the foreground signal clears it even if `visibilitychange` never fired. */
  let isHidden = visibility.value === 'hidden'

  function clearTimer(): void {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  }

  function isActive(): boolean {
    return !isDisposed && (options.enabled === undefined || toValue(options.enabled)) && !isHidden
  }

  function schedule(): void {
    clearTimer()
    if (!isActive()) return
    const delay = options.nextDelayMs()
    isTerminal = delay === null
    if (delay === null) return
    timer = setTimeout(() => void tick(), delay)
  }

  async function tick(): Promise<void> {
    clearTimer()
    if (!isActive() || fetchingGeneration === generation) return

    const mine = generation
    const isFirst = needsFirst
    needsFirst = false
    fetchingGeneration = mine
    try {
      await options.load(isFirst)
    } finally {
      if (fetchingGeneration === mine) fetchingGeneration = null
    }
    if (mine === generation) schedule()
  }

  function restart(): void {
    generation += 1
    isTerminal = false
    needsFirst = true
    clearTimer()
    void tick()
  }

  function refreshNow(): void {
    if (isTerminal) return
    void tick()
  }

  watch(visibility, (state) => {
    isHidden = state === 'hidden'
    if (isHidden) clearTimer()
    else refreshNow()
  })

  if (options.enabled !== undefined) {
    watch(() => toValue(options.enabled), (isOn) => {
      if (isOn) restart()
      else {
        generation += 1
        clearTimer()
      }
    })
  }

  const offForeground = onAppForeground(() => {
    isHidden = false
    refreshNow()
  })

  onScopeDispose(() => {
    isDisposed = true
    generation += 1
    clearTimer()
    offForeground()
  })

  return { restart, refreshNow }
}
