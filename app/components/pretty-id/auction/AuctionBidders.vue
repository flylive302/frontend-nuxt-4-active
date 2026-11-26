<script setup lang="ts">
/**
 * Bidders panel body of an auction page: the top bids, highest first, one framed
 * row each (rank, avatar, name + Signature, amount). A row opens the bidder's
 * profile when their Signature is known.
 */
import { PRETTY_ID_AUCTION_BIDDERS_SHOWN } from '~/constants/pretty-id-auction'
import type { PrettyIdAuctionBid } from '~/types/pretty-id-auction'
import { formatCoins } from '~/utils/currency'
import { prettyIdProfileRoute } from '~/utils/pretty-id-auction'

// Config
const props = defineProps<{
  /** Highest first, as the auction delivers them. */
  bids: PrettyIdAuctionBid[]
}>()

// Constants
const AVATAR_SIZE = 34

// State
const shown = computed(() => props.bids.slice(0, PRETTY_ID_AUCTION_BIDDERS_SHOWN))

// Handlers
function openProfile(bid: PrettyIdAuctionBid): void {
  const route = prettyIdProfileRoute(bid.user.signature)
  if (route) void navigateTo(route)
}
</script>

<template>
  <p v-if="shown.length === 0" class="pid-empty">No bids yet</p>

  <template v-else>
    <PrettyIdRow
      v-for="(bid, index) in shown"
      :key="`${bid.user.id}-${bid.amount}`"
      :class="{ 'cursor-pointer': bid.user.signature }"
      :role="bid.user.signature ? 'button' : undefined"
      :tabindex="bid.user.signature ? 0 : undefined"
      @click="openProfile(bid)"
      @keydown.enter="openProfile(bid)"
    >
      <span class="pid-head pid-gold w-5 flex-none text-[12px]">{{ index + 1 }}</span>
      <PrettyIdRing :src="bid.user.avatar" :size="AVATAR_SIZE" />
      <span class="pid-row__grow">
        <span class="pid-body pid-small block truncate">{{ bid.user.name }}</span>
        <span v-if="bid.user.signature" class="pid-body pid-muted block truncate text-[11px]">{{ bid.user.signature }}</span>
      </span>
      <span class="pid-num pid-gold flex-none text-[14px]">{{ formatCoins(bid.amount) }}</span>
    </PrettyIdRow>
  </template>
</template>
