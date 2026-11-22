<script setup lang="ts">
/**
 * Bottom sheet with one winner's details, open while the auction store holds a
 * selected winner. Closing (button, outside tap, Escape, Android back) clears
 * the selection.
 */
import { usePrettyIdStore } from '~/stores/prettyId'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import type { PrettyIdWinner } from '~/types/pretty-id'
import { formatCoins } from '~/utils/currency'
import { formatPrettyIdDateTime } from '~/utils/pretty-id-format'

// Constants
const AVATAR_SIZE = 96

// Composables
const store = usePrettyIdStore()
const auctionStore = usePrettyIdAuctionStore()
const { selectWinner } = usePrettyIdAuctionData()

// State
const isOpen = computed(() => auctionStore.selectedWinner !== null)

/** The last selected winner, kept through the close animation so the content does not blank. */
const shownWinner = ref<PrettyIdWinner | null>(auctionStore.selectedWinner)

watch(() => auctionStore.selectedWinner, (winner) => {
  if (winner !== null) shownWinner.value = winner
})

const holdLine = computed(() => {
  const days = store.me?.rules.ownership_days
  return days === undefined ? '' : ` · holds the ID for ${days} days`
})

// Handlers
function close(): void {
  selectWinner(null)
}

// A selection must not outlive the page, or it would reopen the sheet on the next visit.
onBeforeUnmount(close)
</script>

<template>
  <PrettyIdSheet :open="isOpen" title="Winner details" @close="close">
    <div v-if="shownWinner" class="text-center">
      <div class="flex justify-center">
        <PrettyIdRing :src="shownWinner.user.avatar_url" :size="AVATAR_SIZE" />
      </div>
      <div class="pid-body my-1.5 text-[17px]">{{ shownWinner.user.name }}</div>
      <PrettyIdPlate>
        <span class="pid-num pid-gold text-[28px]">{{ shownWinner.id_number }}</span>
      </PrettyIdPlate>
      <div class="mt-2.5">
        <span class="pid-num pid-gold text-[18px]">{{ formatCoins(shownWinner.winning_bid) }} coins</span>
      </div>
      <p class="pid-body pid-small pid-muted mt-1">Won {{ formatPrettyIdDateTime(shownWinner.won_at) }}{{ holdLine }}</p>
      <div class="mt-3.5">
        <PrettyIdButton size="sm" @click="close">Close</PrettyIdButton>
      </div>
    </div>
  </PrettyIdSheet>
</template>
