<script setup lang="ts">
/**
 * Weekly Record page (`/pretty-id/weekly`): a full-bleed hero band, this month's
 * total of coins bid on Pretty IDs, and the record of who held the weekly ID.
 * Owns its gutter (the band runs edge to edge, like the main hero).
 *
 * Intent only: `loadWeekly` runs on mount; the data is read from the store.
 */
import { PRETTY_ID_WEEKLY_ROWS_SHOWN } from '~/constants/pretty-id'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import { formatCoins } from '~/utils/currency'

// Constants
/** Weekly allotments are held for a fixed week — static copy, not a server rule. */
const HOLD_DAYS = 7
/** Placeholder rows while the first load is in flight. */
const SKELETON_ROW_COUNT = 3

// Composables
const auctionStore = usePrettyIdAuctionStore()
const { loadWeekly } = usePrettyIdAuctionData()

// State
const weekly = computed(() => auctionStore.weekly)
const rows = computed(() => weekly.value?.allotments.slice(0, PRETTY_ID_WEEKLY_ROWS_SHOWN) ?? [])
const total = computed(() => (weekly.value === null ? '—' : formatCoins(weekly.value.total_bid_coins)))
/** Loading flags flip on every refetch, so the skeleton is only for "loading AND nothing to show yet". */
const isSkeletonShown = computed(() => auctionStore.isWeeklyLoading && weekly.value === null)

// Handlers
onMounted(() => {
  void loadWeekly()
})
</script>

<template>
  <div>
    <div class="pid-weekly__hero" aria-hidden="true">
      <div class="pid-weekly__art" />
    </div>

    <div class="relative -mt-[30px] text-center">
      <div class="pid-num pid-gold text-[36px]">{{ total }}</div>
      <p class="pid-body pid-small mt-1">Total coins bid on Pretty IDs this month</p>
    </div>

    <div class="pid-sec">
      <PrettyIdPanel title="Weekly Record">
        <PrettyIdRow class="min-h-[84px]!">
          <div class="w-[52px] flex-none text-center">
            <div class="pid-weekly__card mx-auto w-11" />
            <div class="pid-head text-[9px] text-(--pid-gold)">{{ HOLD_DAYS }} Days</div>
          </div>
          <p class="pid-body pid-small min-w-0 flex-1">
            Each week's allotted Pretty ID holder is recorded here. The ID stays with them for {{ HOLD_DAYS }} days,
            sealed by signature.
          </p>
        </PrettyIdRow>

        <div class="pid-head flex items-center justify-between px-[30px] pt-1.5 text-[10px] text-(--pid-gold)">
          <span>Week</span>
          <span>ID &amp; Player</span>
          <span>Signature</span>
        </div>

        <template v-if="isSkeletonShown">
          <PrettyIdRow
            v-for="n in SKELETON_ROW_COUNT"
            :key="n"
            class="animate-pulse motion-reduce:animate-none"
            aria-hidden="true"
          />
        </template>
        <template v-else-if="rows.length > 0">
          <PrettyIdWeeklyRow v-for="allotment in rows" :key="allotment.id" :allotment="allotment" />
        </template>
        <p v-else class="pid-empty">No records yet.</p>
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

  .pid-weekly__card {
    aspect-ratio: 200 / 327;
    background: var(--pid-img-card) center / 100% 100%;
  }
}
</style>
