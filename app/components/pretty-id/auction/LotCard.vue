<script setup lang="ts">
/**
 * One auction lot in the two-up grid of the Rare Auction tab: the rare number,
 * the time left (or "Ended") and where the bidding stands. A single tap target;
 * it emits `open` and the parent decides where that goes.
 */
import type { PrettyIdLot } from '~/types/pretty-id'
import { formatPrettyIdShort } from '~/utils/pretty-id-format'

// Config
const props = defineProps<{
  lot: PrettyIdLot
}>()

const emit = defineEmits<{
  open: [lotId: number]
}>()

// State
const isEnded = computed(() => props.lot.status === 'ended')

/** "You lead · 3.4M" / "3.4M" / "No bids yet" — an ended lot says "won" instead of "lead". */
const bidLine = computed(() => {
  const { highest_bid: highest, you_are_highest: isMine } = props.lot
  if (highest === null) return 'No bids yet'
  const amount = formatPrettyIdShort(highest)
  if (!isMine) return amount
  return `${isEnded.value ? 'You won' : 'You lead'} · ${amount}`
})

/** No countdown in the label: a ticking value is noise for a screen reader. */
const label = computed(() => `Rare ID ${props.lot.number}, ${isEnded.value ? 'auction ended' : 'live auction'}, ${bidLine.value}`)
</script>

<template>
  <button
    type="button"
    class="pid-wcard cursor-pointer transition-transform duration-100 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pid-gold) active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
    :aria-label="label"
    @click="emit('open', lot.id)"
  >
    <span class="pid-num pid-gold text-[40px]">{{ lot.number }}</span>
    <span class="pid-body pid-small">
      <template v-if="isEnded">Ended</template>
      <PrettyIdCountdown v-else :to="lot.ends_at" />
    </span>
    <span class="pid-body pid-small pid-muted">{{ bidLine }}</span>
  </button>
</template>
