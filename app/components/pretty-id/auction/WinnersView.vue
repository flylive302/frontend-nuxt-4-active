<script setup lang="ts">
/**
 * Big Winners page (`/pretty-id/winners`): every Rare ID won in a month, newest first, with a
 * pager over the months that have data. Owns the gutter. A tap on a card opens the winner
 * sheet (mounted here, fed the selected winner).
 *
 * Intent only: `usePrettyIdAuctionHistoryActions` loads the month in the URL, moves it and holds
 * the winner selection.
 */
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import { prettyIdMonthLabel } from '~/utils/pretty-id-history'

// Config
const props = defineProps<{
  /** The `?month=` of the URL (`YYYY-MM`), or `null` for the current month. */
  month: string | null
}>()

// Constants
/** Placeholder cards while the first load is in flight. */
const SKELETON_CARD_COUNT = 2

// Composables
const auctionStore = usePrettyIdAuctionStore()
const { status, goToMonth, retry, selectedWinner, selectWinner } = usePrettyIdAuctionHistoryActions('winners', () => props.month)

// State
const board = computed(() => auctionStore.winners)

/** Loading flags flip on every refetch, so the skeleton is only for "loading AND nothing to show yet". */
const isSkeletonShown = computed(() => status.value === 'loading' && board.value === null)
const isFailed = computed(() => status.value === 'error' && board.value === null)

/** Names the month on screen; before the first board lands, the URL's month (none = the current one). */
const caption = computed(() => {
  const month = board.value?.month ?? props.month
  return month === null ? 'All Rare ID winners this month' : `All Rare ID winners in ${prettyIdMonthLabel(month)}`
})

// A selection must not outlive the page, or it would reopen the sheet on the next visit.
onBeforeUnmount(() => selectWinner(null))
</script>

<template>
  <div class="pid-sec pt-[26px]">
    <PrettyIdPanel title="Big Winners">
      <PrettyIdHistoryPager
        :month="board?.month ?? null"
        :months="board?.months ?? []"
        :loading="auctionStore.isWinnersLoading"
        @select="goToMonth"
      />
      <p class="pid-body pid-small pid-muted mb-2.5 text-center">{{ caption }}</p>

      <div v-if="isSkeletonShown" class="pid-pair-grid" aria-busy="true">
        <div
          v-for="n in SKELETON_CARD_COUNT"
          :key="n"
          class="pid-wcard min-h-56 animate-pulse motion-reduce:animate-none"
        />
      </div>
      <div v-else-if="isFailed" class="pid-empty">
        <p class="pid-body mb-3">Couldn't load the winners.</p>
        <PrettyIdButton size="sm" @click="retry">Try again</PrettyIdButton>
      </div>
      <div v-else-if="board && board.winners.length > 0" class="pid-pair-grid">
        <PrettyIdWinnerCard
          v-for="entry in board.winners"
          :key="entry.auction_id"
          :entry="entry"
          @view="selectWinner"
        />
      </div>
      <p v-else-if="board" class="pid-empty">No winners this month.</p>
    </PrettyIdPanel>

    <PrettyIdWinnerSheet :winner="selectedWinner" @close="selectWinner(null)" />
  </div>
</template>
