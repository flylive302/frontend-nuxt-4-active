<script setup lang="ts">
/**
 * "Confirm entry" dialog: the entry fee and that it is not refundable. After an
 * `insufficient_coins` refusal it offers "Top up" instead of "Confirm". Open
 * while the entry store holds a `confirmId`. Mounted by <PrettyIdAuctionEntry>.
 */
import { usePrettyIdAuctionEnterActions } from '~/composables/pretty-id/usePrettyIdAuctionEnterActions'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import { usePrettyIdAuctionEnterStore } from '~/stores/prettyIdAuctionEnter'
import { formatCoins } from '~/utils/currency'

// Composables
const auctionStore = usePrettyIdAuctionStore()
const enterStore = usePrettyIdAuctionEnterStore()
const { closeEntry, confirmEntry, openTopUp } = usePrettyIdAuctionEnterActions()

// State
/**
 * The last open auction. `confirmId` resets the moment entry succeeds, while the
 * dialog is still fading out: rendering from the live store would blank the fee mid-close.
 */
const view = computed<number | null>(previous => enterStore.confirmId ?? previous ?? null)
const auction = computed(() => (view.value === null ? undefined : auctionStore.snapshotById(view.value)))
</script>

<template>
  <PrettyIdModal :open="enterStore.confirmId !== null" title="Confirm entry" @close="closeEntry">
    <div v-if="auction" class="text-center">
      <span class="pid-num pid-gold whitespace-nowrap text-[50px]">{{ auction.rare_id }}</span>

      <PrettyIdRow>
        <span class="pid-row__grow pid-body pid-small text-left">Entry fee</span>
        <span class="pid-num pid-gold">{{ formatCoins(auction.entry_fee) }}</span>
      </PrettyIdRow>
      <p class="pid-body pid-small mt-2">Not refundable</p>

      <p v-if="enterStore.isShortOnCoins" class="pid-body mt-2" role="alert">
        You don't have enough coins for the entry fee.
      </p>

      <div class="mt-2.5 flex items-center justify-center gap-2.5">
        <PrettyIdButton size="sm" :disabled="enterStore.isEntering" @click="closeEntry">Cancel</PrettyIdButton>
        <PrettyIdButton v-if="enterStore.isShortOnCoins" size="sm" @click="openTopUp">Top up</PrettyIdButton>
        <PrettyIdButton v-else size="sm" :disabled="enterStore.isEntering" @click="confirmEntry">
          {{ enterStore.isEntering ? 'Paying…' : 'Pay entry' }}
        </PrettyIdButton>
      </div>
    </div>
  </PrettyIdModal>
</template>
