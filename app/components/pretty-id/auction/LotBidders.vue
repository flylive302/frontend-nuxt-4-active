<script setup lang="ts">
/**
 * Bidders panel body of a lot page: the top bids, highest first, one framed row
 * each (rank, avatar, name, amount). Rival users are plain data, never linked.
 */
import { PRETTY_ID_LOT_BIDDERS_SHOWN } from '~/constants/pretty-id'
import type { PrettyIdBid } from '~/types/pretty-id'
import { formatCoins } from '~/utils/currency'

// Config
const props = defineProps<{
  /** Highest first, as the lot delivers them. */
  bids: PrettyIdBid[]
}>()

// Constants
const AVATAR_SIZE = 34

// State
const shown = computed(() => props.bids.slice(0, PRETTY_ID_LOT_BIDDERS_SHOWN))
</script>

<template>
  <p v-if="shown.length === 0" class="pid-empty">Be the first bidder.</p>

  <template v-else>
    <!-- Amounts only ever rise within a lot, so an amount identifies its bid. -->
    <PrettyIdRow v-for="(bid, index) in shown" :key="bid.amount">
      <span class="pid-head pid-gold w-7 flex-none text-[12px]">{{ index + 1 }}</span>
      <PrettyIdRing :src="bid.user.avatar_url" :size="AVATAR_SIZE" />
      <span class="pid-body pid-small pid-row__grow">{{ bid.user.name }}{{ bid.is_me ? ' (you)' : '' }}</span>
      <span class="pid-num pid-gold flex-none text-[14px]">{{ formatCoins(bid.amount) }}</span>
    </PrettyIdRow>
  </template>
</template>
