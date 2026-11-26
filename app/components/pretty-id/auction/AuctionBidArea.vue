<script setup lang="ts">
/**
 * What an entered viewer sees on a live auction: the bid form (amount field,
 * quick-add chips, "Place bid") or, while they lead, "You are the highest
 * bidder". "Place bid" opens <PrettyIdAuctionBidModal> (mounted here, outside
 * the v-if so it can fade out after a successful bid).
 *
 * The field follows `min_next_bid` upwards (a rival bid) but never overwrites a
 * higher figure the viewer typed. Whether they lead is derived from the snapshot.
 */
import { usePrettyIdAuctionBidActions } from '~/composables/pretty-id/usePrettyIdAuctionBidActions'
import type { PrettyIdAuctionSnapshot } from '~/types/pretty-id-auction'
import { formatCoins } from '~/utils/currency'
import { formatPrettyIdShort } from '~/utils/pretty-id-format'

// Config
const props = defineProps<{
  auction: PrettyIdAuctionSnapshot
}>()

// Composables
const {
  isLeading,
  isDraftValid,
  bidChips,
  draftTextFor,
  isBidFormBusy,
  keepDraftAtMinimum,
  setDraftText,
  addToDraft,
  openBid,
} = usePrettyIdAuctionBidActions()

// State
const leading = computed(() => isLeading(props.auction.id))
const chips = bidChips()
const draftText = computed(() => draftTextFor(props.auction.id))
const isValid = computed(() => isDraftValid(props.auction.id))
const isBelowMinimum = computed(() => draftText.value !== '' && !isValid.value)
const isBusy = computed(() => isBidFormBusy())

keepDraftAtMinimum(() => props.auction)

// Handlers
function onInput(event: Event): void {
  setDraftText(props.auction.id, (event.target as HTMLInputElement).value)
}

function onSubmit(): void {
  if (isValid.value) openBid(props.auction.id)
}
</script>

<template>
  <div>
    <div v-if="leading" class="text-center">
      <p class="pid-body inline-flex items-center gap-1.5 text-(--pid-ok)" role="status">
        <UIcon name="i-lucide-check" class="size-4" />
        You are the highest bidder
      </p>
      <p class="pid-body pid-small pid-muted mt-1.5">Your bid is held until you're outbid.</p>
    </div>

    <!-- `novalidate`: the field is checked by `isValid`; the server has the last word. -->
    <form v-else novalidate @submit.prevent="onSubmit">
      <label for="pid-bid-amount" class="pid-body pid-small pid-muted mb-1.5 block text-left">Your bid (coins)</label>
      <input
        id="pid-bid-amount"
        :value="draftText"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        autocomplete="off"
        class="pid-bid-input"
        :class="{ 'pid-bid-input--bad': isBelowMinimum }"
        :aria-invalid="isBelowMinimum"
        aria-describedby="pid-bid-hint"
        :disabled="isBusy"
        @input="onInput"
      >
      <p
        id="pid-bid-hint"
        class="pid-body pid-small mt-1.5 text-left"
        :class="isBelowMinimum ? 'text-(--pid-bad)' : 'pid-muted'"
        :role="isBelowMinimum ? 'alert' : undefined"
      >
        <template v-if="isBelowMinimum">Too low. The minimum bid is {{ formatCoins(auction.min_next_bid) }}.</template>
        <template v-else>Minimum bid: {{ formatCoins(auction.min_next_bid) }}</template>
      </p>

      <div class="my-2.5 flex flex-wrap justify-center gap-2">
        <PrettyIdChip
          v-for="chip in chips"
          :key="chip.amount"
          class="min-h-11 min-w-16 px-4"
          :disabled="isBusy"
          :aria-label="`Add ${formatCoins(chip.amount)}`"
          @click="addToDraft(auction.id, chip.amount)"
        >
          +{{ formatPrettyIdShort(chip.amount) }}
        </PrettyIdChip>
      </div>

      <div class="text-center">
        <PrettyIdButton type="submit" :disabled="!isValid || isBusy">Place bid</PrettyIdButton>
      </div>
      <p class="pid-body pid-small pid-muted mt-1.5 text-center">Held until you're outbid. Refunded in full if you are.</p>
    </form>

    <PrettyIdAuctionBidModal />
  </div>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  .pid-bid-input {
    width: 100%;
    height: 48px;
    padding: 0 12px;
    border: 1.5px solid var(--pid-line);
    border-radius: 10px;
    background: var(--pid-well);
    color: #fff;
    /* 18px: anything under 16px makes iOS zoom into the field. */
    font: 700 18px var(--pid-font-num);
    text-align: center;
  }

  .pid-bid-input:focus-visible {
    border-color: var(--pid-gold);
    outline: none;
  }

  .pid-bid-input--bad {
    border-color: var(--pid-bad);
  }

  .pid-bid-input:disabled {
    opacity: 0.6;
  }
}
</style>
