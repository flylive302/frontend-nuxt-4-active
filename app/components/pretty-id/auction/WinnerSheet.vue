<script setup lang="ts">
/**
 * Bottom sheet with one winner's details, open while `winner` is set. Closing (button, outside
 * tap, Escape, Android back) emits `close`; the parent clears the selection. "View profile" is
 * drawn only for a winner who still has a profile (an account that was deleted has no id).
 */
import type { PrettyIdAuctionWinnerEntry } from '~/types/pretty-id-auction'
import { formatCoins } from '~/utils/currency'
import { prettyIdWinnerProfileRoute } from '~/utils/pretty-id-auction'
import { formatPrettyIdPktDateTime } from '~/utils/pretty-id-history'

// Config
const props = defineProps<{
  /** The selected winner; `null` keeps the sheet closed. */
  winner: PrettyIdAuctionWinnerEntry | null
}>()

const emit = defineEmits<{
  close: []
}>()

// Constants
const AVATAR_SIZE = 96

// State
const isOpen = computed(() => props.winner !== null)

/** The last selected winner, kept through the close animation so the content does not blank. */
const shownEntry = ref<PrettyIdAuctionWinnerEntry | null>(props.winner)

watch(() => props.winner, (entry) => {
  if (entry !== null) shownEntry.value = entry
})

/** `null` hides the button: no id (deleted account) or nothing to open the profile by. */
const profileRoute = computed(() => (shownEntry.value === null ? null : prettyIdWinnerProfileRoute(shownEntry.value.winner)))

// Handlers
function close(): void {
  emit('close')
}

function openProfile(): void {
  const route = profileRoute.value
  close()
  if (route !== null) void navigateTo(route)
}
</script>

<template>
  <PrettyIdSheet :open="isOpen" title="Winner details" @close="close">
    <div v-if="shownEntry" class="text-center">
      <div class="flex justify-center">
        <PrettyIdRing :src="shownEntry.winner.avatar" :size="AVATAR_SIZE" />
      </div>
      <div class="pid-body my-1.5 text-[17px]">{{ shownEntry.winner.name }}</div>
      <PrettyIdPlate>
        <span class="pid-num pid-gold text-[28px]">{{ shownEntry.rare_id }}</span>
      </PrettyIdPlate>
      <div class="mt-2.5">
        <span class="pid-num pid-gold text-[18px]">{{ formatCoins(shownEntry.winning_bid) }} coins</span>
      </div>
      <p class="pid-body pid-small pid-muted mt-1">Won {{ formatPrettyIdPktDateTime(shownEntry.ended_at) }}</p>
      <div class="mt-3.5 flex justify-center gap-2.5">
        <PrettyIdButton v-if="profileRoute" size="sm" @click="openProfile">View profile</PrettyIdButton>
        <PrettyIdButton size="sm" @click="close">Close</PrettyIdButton>
      </div>
    </div>
  </PrettyIdSheet>
</template>
