<script setup lang="ts">
/**
 * Top panel of a lot page: the rare number on the left, the time left and the
 * current highest bid on the right.
 */
import type { PrettyIdLot } from '~/types/pretty-id'
import { formatCoins } from '~/utils/currency'

// Config
const props = defineProps<{
  lot: PrettyIdLot
}>()

// State
const isEnded = computed(() => props.lot.status === 'ended')
const highestBid = computed(() => (props.lot.highest_bid === null ? '—' : formatCoins(props.lot.highest_bid)))
</script>

<template>
  <div class="flex items-center justify-between gap-2">
    <div class="w-[42%] text-center">
      <span class="pid-num pid-gold text-[84px]">{{ lot.number }}</span>
    </div>

    <div class="min-w-0 flex-1">
      <div class="pid-body pid-small pid-muted">Ends in</div>
      <div class="text-[20px]">
        <span v-if="isEnded" class="pid-num pid-gold">ENDED</span>
        <PrettyIdCountdown v-else :to="lot.ends_at" />
      </div>
      <div class="pid-body pid-small pid-muted mt-2">Highest bid</div>
      <div>
        <span class="pid-num pid-gold text-[22px]">{{ highestBid }}</span>
      </div>
    </div>
  </div>
</template>
