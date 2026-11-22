<script setup lang="ts">
/**
 * The unlocked Rare Auction tab: the Big Winners / Weekly Record shortcuts, then
 * the grid of auction lots. Mounted by <PrettyIdAuctionTab> only once the user
 * is past the auction level — so the lot polling never runs for a locked user.
 *
 * Intent only: the refetching is `usePrettyIdLotsPolling`, and a tap on a lot
 * just navigates to its page.
 */
import { PRETTY_ID_ROUTES } from '~/constants/pretty-id'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import type { PrettyIdRules } from '~/types/pretty-id'
import { formatCoins } from '~/utils/currency'
import { formatPrettyIdShort } from '~/utils/pretty-id-format'

// Config
defineProps<{
  rules: PrettyIdRules
}>()

// Constants
/** Placeholder cards while the first load is in flight. */
const SKELETON_LOT_COUNT = 2

// Composables
const auctionStore = usePrettyIdAuctionStore()
usePrettyIdLotsPolling()

// State
/** Loading flags flip on every refetch, so the skeleton is only for "loading AND nothing to show yet". */
const isSkeletonShown = computed(() => auctionStore.isLotsLoading && auctionStore.lots.length === 0)

// Handlers
function openPage(route: string): void {
  void navigateTo(route)
}

function openLot(lotId: number): void {
  void navigateTo(`${PRETTY_ID_ROUTES.auction}/${lotId}`)
}
</script>

<template>
  <div>
    <div class="mt-1 mb-1.5 flex flex-wrap justify-center gap-1.5">
      <PrettyIdChip @click="openPage(PRETTY_ID_ROUTES.winners)">
        <span class="inline-flex items-center gap-1.5">
          <UIcon name="i-lucide-trophy" class="size-3.5" />
          Big Winners
        </span>
      </PrettyIdChip>
      <PrettyIdChip @click="openPage(PRETTY_ID_ROUTES.weekly)">
        <span class="inline-flex items-center gap-1.5">
          <UIcon name="i-lucide-scroll-text" class="size-3.5" />
          Weekly Record
        </span>
      </PrettyIdChip>
    </div>

    <PrettyIdPanel title="Rare ID Auction">
      <p class="pid-body pid-small pid-muted mb-2 text-center">
        Auction-only IDs 1–99 · entry {{ formatCoins(rules.entry_fee) }} · opening bid
        {{ formatPrettyIdShort(rules.opening_bid) }} · own for {{ rules.ownership_days }} days
      </p>

      <div v-if="isSkeletonShown" class="pid-pair-grid" aria-busy="true">
        <div
          v-for="n in SKELETON_LOT_COUNT"
          :key="n"
          class="pid-wcard min-h-28 animate-pulse motion-reduce:animate-none"
        />
      </div>
      <div v-else-if="auctionStore.lots.length > 0" class="pid-pair-grid">
        <PrettyIdLotCard v-for="lot in auctionStore.lots" :key="lot.id" :lot="lot" @open="openLot" />
      </div>
      <p v-else class="pid-empty">No auctions right now.</p>
    </PrettyIdPanel>
  </div>
</template>
