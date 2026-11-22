<script setup lang="ts">
/**
 * Bid entry of a lot page: amount field, quick-add chips and "Place bid". Swaps
 * to a calm "you are the highest bidder" note while this user leads (the server
 * refuses a self-outbid anyway).
 *
 * The amount is local UI state and survives lot refreshes: it follows `minBid`
 * upwards (a rival bid, or this user's own bid) but never overwrites a higher
 * figure the user typed. The parent runs the bid and owns `submitting`.
 */
import { PRETTY_ID_BID_INCREMENTS } from '~/constants/pretty-id'
import { formatCoins } from '~/utils/currency'
import { formatPrettyIdShort } from '~/utils/pretty-id-format'

// Config
const props = defineProps<{
  /** Smallest amount the next bid must reach. */
  minBid: number
  /** Raise step the number field's arrows move by. */
  step: number
  submitting: boolean
  youAreHighest: boolean
}>()

const emit = defineEmits<{
  bid: [amount: number]
}>()

// State
/** `''` while the field is empty (what a number input reports for no text). */
const amount = ref<number | ''>(props.minBid)

watch(() => props.minBid, (minimum) => {
  if (typeof amount.value === 'number' && amount.value < minimum) amount.value = minimum
})

// Handlers
function addIncrement(increment: number): void {
  amount.value = (typeof amount.value === 'number' ? amount.value : 0) + increment
}

/** An empty or unreadable field becomes 0 / NaN, which the bid action turns into its own toast. */
function submitBid(): void {
  emit('bid', Number(amount.value))
}
</script>

<template>
  <div v-if="youAreHighest" class="text-center">
    <p class="inline-flex items-center gap-1.5 text-(--pid-ok)">
      <UIcon name="i-lucide-check" class="size-4" />
      You are the highest bidder
    </p>
    <p class="pid-body pid-small pid-muted mt-1.5">Your bid is held in escrow and refunded if outbid</p>
  </div>

  <!-- `novalidate`: min/step on the field are hints for the arrows; refusing a bid is the server's job. -->
  <form v-else novalidate @submit.prevent="submitBid">
    <input
      v-model.number="amount"
      type="number"
      inputmode="numeric"
      class="pid-input"
      aria-label="Bid amount"
      autocomplete="off"
      :min="minBid"
      :step="step"
    >

    <div class="my-2 flex flex-wrap justify-center gap-1.5">
      <PrettyIdChip
        v-for="increment in PRETTY_ID_BID_INCREMENTS"
        :key="increment"
        :aria-label="`Add ${formatCoins(increment)}`"
        @click="addIncrement(increment)"
      >
        +{{ formatPrettyIdShort(increment) }}
      </PrettyIdChip>
    </div>

    <div class="text-center">
      <PrettyIdButton type="submit" :disabled="submitting">Place bid</PrettyIdButton>
    </div>
    <p class="pid-body pid-small pid-muted mt-1.5 text-center">
      Min {{ formatCoins(minBid) }} · your bid is held in escrow and refunded if outbid
    </p>
  </form>
</template>
