<script setup lang="ts">
/**
 * Weekly Record page (`/pretty-id/weekly`): a full-bleed hero band, the month's total of winning
 * bids, and every finished auction of the month by week (Rare ID, winner or "No winner", winning
 * bid, bidders, keep-period). Owns its gutter (the band runs edge to edge, like the main hero).
 *
 * Intent only: `usePrettyIdAuctionHistoryActions` loads the month in the URL and moves it.
 */
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import { formatCoins } from '~/utils/currency'
import { formatPrettyIdWeekRange, prettyIdMonthLabel } from '~/utils/pretty-id-history'

// Config
const props = defineProps<{
  /** The `?month=` of the URL (`YYYY-MM`), or `null` for the current month. */
  month: string | null
}>()

// Constants
/** Placeholder rows while the first load is in flight. */
const SKELETON_ROW_COUNT = 3

// Composables
const auctionStore = usePrettyIdAuctionStore()
const { status, goToMonth, retry } = usePrettyIdAuctionHistoryActions('weekly', () => props.month)

// State
const record = computed(() => auctionStore.weekly)
const total = computed(() => (record.value === null ? '—' : formatCoins(record.value.total_winning_bids)))
const totalCaption = computed(() => (record.value === null
  ? 'Total winning bids'
  : `Total winning bids · ${prettyIdMonthLabel(record.value.month)}`))

/** Loading flags flip on every refetch, so the skeleton is only for "loading AND nothing to show yet". */
const isSkeletonShown = computed(() => status.value === 'loading' && record.value === null)
const isFailed = computed(() => status.value === 'error' && record.value === null)
</script>

<template>
  <div>
    <div class="pid-weekly__hero" aria-hidden="true">
      <div class="pid-weekly__art" />
    </div>

    <div class="relative -mt-[30px] text-center">
      <div class="pid-num pid-gold text-[36px]">{{ total }}</div>
      <p class="pid-body pid-small mt-1">{{ totalCaption }}</p>
    </div>

    <div class="pid-sec">
      <PrettyIdPanel title="Weekly Record">
        <PrettyIdHistoryPager
          :month="record?.month ?? null"
          :months="record?.months ?? []"
          :loading="auctionStore.isWeeklyLoading"
          @select="goToMonth"
        />

        <div v-if="isSkeletonShown" aria-busy="true">
          <PrettyIdRow
            v-for="n in SKELETON_ROW_COUNT"
            :key="n"
            class="animate-pulse motion-reduce:animate-none"
            aria-hidden="true"
          />
        </div>
        <div v-else-if="isFailed" class="pid-empty">
          <p class="pid-body mb-3">Couldn't load the weekly record.</p>
          <PrettyIdButton size="sm" @click="retry">Try again</PrettyIdButton>
        </div>
        <template v-else-if="record && record.weeks.length > 0">
          <div class="pid-head flex items-center justify-between px-[30px] text-[10px] text-(--pid-gold)">
            <span>Rare ID</span>
            <span>Winner</span>
            <span>Winning bid</span>
          </div>
          <section
            v-for="week in record.weeks"
            :key="week.starts_on"
            :aria-label="`Week of ${formatPrettyIdWeekRange(week.starts_on, week.ends_on)}`"
          >
            <h3 class="pid-head pid-gold mt-2 text-center text-[12px]">{{ formatPrettyIdWeekRange(week.starts_on, week.ends_on) }}</h3>
            <PrettyIdWeeklyRow v-for="row in week.auctions" :key="row.auction_id" :row="row" />
          </section>
        </template>
        <p v-else-if="record" class="pid-empty">No finished auctions this month.</p>
      </PrettyIdPanel>
    </div>
  </div>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  /* Same pull-up under the sticky top bar as the main hero (Hero.vue): 54px of bar
     plus the status-bar inset the bar pads itself down by on native. */
  .pid-weekly__hero {
    position: relative;
    width: 100%;
    margin-top: calc(-54px - env(safe-area-inset-top, 0px));
    overflow: hidden;
    aspect-ratio: 750 / 420;
    background: var(--pid-bg);
  }

  /* The plain 750x1000 hero, slid up 8% so the lion's upper body fills the band. */
  .pid-weekly__art {
    position: absolute;
    top: -8%;
    right: 0;
    left: 0;
    aspect-ratio: 750 / 1000;
    background: var(--pid-img-hero-plain) center / cover;
  }

  /* Melt the cropped edge into the marble below. */
  .pid-weekly__hero::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 22%;
    background: linear-gradient(transparent, var(--pid-bg));
  }
}
</style>
