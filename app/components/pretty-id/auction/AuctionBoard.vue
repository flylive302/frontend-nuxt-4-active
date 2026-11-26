<script setup lang="ts">
/**
 * The Rare Auction tab when the auction is on: Live auctions (ending soonest
 * first), then Upcoming (starting soonest first), then the recently ended, in
 * the order the server sends them. Mounted by <PrettyIdAuctionTab> only while
 * the auction switch is on; the refetching is `usePrettyIdAuctionsPolling`
 * (called there), and a tap on a card just navigates: live and upcoming cards to their
 * auction page, an ended one to the Weekly Record of the month it ended in. Two chips open
 * Big Winners and the Weekly Record.
 */
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import type { PrettyIdAuctionCard } from '~/types/pretty-id-auction'
import { groupPrettyIdAuctions, prettyIdAuctionCardRoute } from '~/utils/pretty-id-auction'
import { prettyIdHistoryRoute } from '~/utils/pretty-id-history'

// Config
const emit = defineEmits<{
  retry: []
}>()

// Constants
/** Placeholder cards while the first load is in flight. */
const SKELETON_COUNT = 2

// Composables
const store = usePrettyIdAuctionStore()

// State
const groups = computed(() => groupPrettyIdAuctions(store.auctions))
const sections = computed(() => [
  { key: 'live', title: 'Live', cards: groups.value.live },
  { key: 'upcoming', title: 'Upcoming', cards: groups.value.upcoming },
  { key: 'ended', title: 'Recently ended', cards: groups.value.ended },
].filter(section => section.cards.length > 0))

/** Loading flags flip on the first load only, so the skeleton is "loading AND nothing to show yet". */
const isSkeletonShown = computed(() => store.isAuctionsLoading && !store.isAuctionsLoaded)
const isFailed = computed(() => store.isAuctionsFailed && !store.isAuctionsLoading)

// Handlers
function openAuction(auction: PrettyIdAuctionCard): void {
  void navigateTo(prettyIdAuctionCardRoute(auction))
}

function openHistory(kind: 'winners' | 'weekly'): void {
  void navigateTo(prettyIdHistoryRoute(kind))
}
</script>

<template>
  <PrettyIdPanel title="Rare ID Auction">
    <PrettyIdAuctionAlertsToggle />

    <nav class="my-2 flex flex-wrap justify-center gap-2" aria-label="Auction history">
      <PrettyIdChip @click="openHistory('winners')">Big Winners</PrettyIdChip>
      <PrettyIdChip @click="openHistory('weekly')">Weekly Record</PrettyIdChip>
    </nav>

    <div v-if="isSkeletonShown" aria-busy="true">
      <div
        v-for="n in SKELETON_COUNT"
        :key="n"
        class="my-1.5 min-h-28 animate-pulse bg-white/5 motion-reduce:animate-none"
      />
    </div>

    <div v-else-if="isFailed" class="pid-empty">
      <p class="pid-body mb-3">Couldn't load the auctions.</p>
      <PrettyIdButton size="sm" @click="emit('retry')">Try again</PrettyIdButton>
    </div>

    <template v-else-if="sections.length > 0">
      <section v-for="section in sections" :key="section.key" :aria-label="section.title">
        <h3 class="pid-head pid-gold mt-2 text-center text-[12px]">{{ section.title }}</h3>
        <PrettyIdAuctionCard
          v-for="auction in section.cards"
          :key="auction.id"
          :auction="auction"
          @open="openAuction"
        />
      </section>
    </template>

    <p v-else class="pid-empty">No auctions right now.</p>
  </PrettyIdPanel>
</template>
