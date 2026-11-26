/**
 * Action orchestrator of Big Winners and Weekly Record. Call it once from the view's `setup`: it
 * is the only place that makes `usePrettyIdAuctionHistoryData`.
 *
 * Besides the month, it opens and closes the winner sheet (the selection lives in the store).
 *
 * The URL's `?month=` is the source of truth: the data loads on open and again whenever the
 * month changes, and the pager just moves the URL (`replace`, so the top-bar back button
 * leaves the page instead of walking back through months).
 */

import { computed, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { usePrettyIdAuctionHistoryData } from '~/composables/pretty-id/usePrettyIdAuctionHistoryData'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import type { PrettyIdAuctionWinnerEntry } from '~/types/pretty-id-auction'
import type { PrettyIdHistoryKind } from '~/utils/pretty-id-history'
import { prettyIdHistoryRoute } from '~/utils/pretty-id-history'

/** `loading` until the first load ends; then `ready`, `not_found` (the auction switch is off) or `error` (nothing to show). */
export type PrettyIdHistoryStatus = 'loading' | 'ready' | 'not_found' | 'error'

export interface PrettyIdAuctionHistoryActions {
  status: Readonly<Ref<PrettyIdHistoryStatus>>
  /** Moves the URL to `month` (`YYYY-MM`); the load follows from the change. */
  goToMonth: (month: string) => void
  /** Try again after an `error`. */
  retry: () => void
  /** The winner whose sheet is open, or `null`. */
  selectedWinner: Readonly<Ref<PrettyIdAuctionWinnerEntry | null>>
  /** Opens the winner sheet with `winner`, or closes it with `null`. */
  selectWinner: (winner: PrettyIdAuctionWinnerEntry | null) => void
}

export function usePrettyIdAuctionHistoryActions(
  kind: PrettyIdHistoryKind,
  month: MaybeRefOrGetter<string | null>,
): PrettyIdAuctionHistoryActions {
  const { loadWinners, loadWeekly } = usePrettyIdAuctionHistoryData()
  const store = usePrettyIdAuctionStore()
  const status = ref<PrettyIdHistoryStatus>('loading')

  async function load(): Promise<void> {
    const requested = toValue(month) ?? undefined
    const outcome = await (kind === 'winners' ? loadWinners(requested) : loadWeekly(requested))
    if (outcome === 'superseded') return
    if (outcome === 'ok') status.value = 'ready'
    else if (outcome === 'not_found') status.value = 'not_found'
    else status.value = (kind === 'winners' ? store.winners : store.weekly) === null ? 'error' : 'ready'
  }

  function goToMonth(next: string): void {
    void navigateTo(prettyIdHistoryRoute(kind, next), { replace: true })
  }

  function selectWinner(winner: PrettyIdAuctionWinnerEntry | null): void {
    store.setSelectedWinner(winner)
  }

  function retry(): void {
    status.value = 'loading'
    void load()
  }

  watch(() => toValue(month), () => void load(), { immediate: true })

  return { status, goToMonth, retry, selectedWinner: computed(() => store.selectedWinner), selectWinner }
}
