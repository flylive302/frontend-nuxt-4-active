<script setup lang="ts">
/**
 * Big Winners page (`/pretty-id/winners`): every rare ID won in a month, newest
 * first, with a pager over the months that have data. Owns the gutter. A tap on
 * a card opens the winner sheet (mounted here).
 *
 * Intent only: loading goes through `loadWinners` (one instance serves the
 * mount and the pager, so a newer month request supersedes an older one).
 */
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import { prettyIdMonthName } from '~/utils/pretty-id-format'

// Constants
/** Placeholder cards while the first load is in flight. */
const SKELETON_CARD_COUNT = 2

// Composables
const auctionStore = usePrettyIdAuctionStore()
const { loadWinners, selectWinner } = usePrettyIdAuctionData()

// State
const board = computed(() => auctionStore.winners)

/** `months` is newest first: the next month in time sits before the current one. */
const monthIndex = computed(() => board.value?.months.indexOf(board.value.month) ?? -1)
const olderMonth = computed(() => (monthIndex.value < 0 ? null : (board.value?.months[monthIndex.value + 1] ?? null)))
const newerMonth = computed(() => (monthIndex.value < 1 ? null : (board.value?.months[monthIndex.value - 1] ?? null)))

/** Loading flags flip on every refetch, so the skeleton is only for "loading AND nothing to show yet". */
const isSkeletonShown = computed(() => auctionStore.isWinnersLoading && board.value === null)

// Handlers
onMounted(() => {
  void loadWinners()
})

function goToMonth(month: string | null): void {
  if (month !== null) void loadWinners(month)
}
</script>

<template>
  <div class="pid-sec pt-[26px]">
    <PrettyIdPanel title="Big Winners">
      <div class="mb-1 flex items-center justify-between gap-2">
        <button
          type="button"
          class="pid-winners__nav"
          aria-label="Previous month"
          :disabled="olderMonth === null || auctionStore.isWinnersLoading"
          @click="goToMonth(olderMonth)"
        >
          <UIcon name="i-lucide-chevron-left" class="size-5" />
        </button>
        <span class="pid-head pid-gold text-[15px]">{{ board ? prettyIdMonthName(board.month) : '' }}</span>
        <button
          type="button"
          class="pid-winners__nav"
          aria-label="Next month"
          :disabled="newerMonth === null || auctionStore.isWinnersLoading"
          @click="goToMonth(newerMonth)"
        >
          <UIcon name="i-lucide-chevron-right" class="size-5" />
        </button>
      </div>
      <p class="pid-body pid-small pid-muted mb-2.5 text-center">All rare ID winners this month</p>

      <div v-if="isSkeletonShown" class="pid-pair-grid" aria-busy="true">
        <div
          v-for="n in SKELETON_CARD_COUNT"
          :key="n"
          class="pid-wcard min-h-56 animate-pulse motion-reduce:animate-none"
        />
      </div>
      <div v-else-if="board && board.winners.length > 0" class="pid-pair-grid">
        <!-- Auction ids repeat across months, so the id alone is not unique. -->
        <PrettyIdWinnerCard
          v-for="winner in board.winners"
          :key="`${winner.auction_id}-${winner.won_at}`"
          :winner="winner"
          @view="selectWinner"
        />
      </div>
      <p v-else-if="board" class="pid-empty">No winners yet this month.</p>
    </PrettyIdPanel>

    <PrettyIdWinnerSheet />
  </div>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  /* The top bar's round gold-rimmed icon button (the prototype's `.iconbtn`). */
  .pid-winners__nav {
    display: grid;
    flex: none;
    place-items: center;
    width: 38px;
    height: 38px;
    border: 1.5px solid var(--pid-gold-deep);
    border-radius: 50%;
    background: color-mix(in srgb, var(--pid-surface) 80%, transparent);
    color: var(--pid-gold);
    cursor: pointer;
  }

  .pid-winners__nav:focus-visible {
    outline: 2px solid var(--pid-gold);
    outline-offset: 2px;
  }

  .pid-winners__nav:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
</style>
