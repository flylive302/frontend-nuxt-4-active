<script setup lang="ts">
/**
 * One winner on the Big Winners board: avatar, name, the Rare ID they won, the winning bid and
 * when. Emits `view`; the parent opens the details sheet.
 */
import type { PrettyIdAuctionWinnerEntry } from '~/types/pretty-id-auction'
import { formatCoins } from '~/utils/currency'
import { prettyIdRareFontPx } from '~/utils/pretty-id-auction'
import { formatPrettyIdPktDateTime } from '~/utils/pretty-id-history'

// Config
const props = defineProps<{
  entry: PrettyIdAuctionWinnerEntry
}>()

const emit = defineEmits<{
  view: [entry: PrettyIdAuctionWinnerEntry]
}>()

// Constants
const AVATAR_SIZE = 70
/** A two-up card is about 128px wide on a phone: an 8-character Rare ID has to shrink to fit its plate. */
const RARE_ID_FONT = { max: 22, min: 14 }

// State
const rareIdFontSize = computed(() => `${prettyIdRareFontPx(props.entry.rare_id, RARE_ID_FONT)}px`)
</script>

<template>
  <div class="pid-wcard">
    <PrettyIdRing :src="entry.winner.avatar" :size="AVATAR_SIZE" />
    <div class="pid-body pid-small max-w-full truncate">{{ entry.winner.name }}</div>
    <PrettyIdPlate class="max-w-full min-w-0! px-3!">
      <span class="pid-num pid-gold" :style="{ fontSize: rareIdFontSize }">{{ entry.rare_id }}</span>
    </PrettyIdPlate>
    <span class="pid-num pid-gold text-[13px]">{{ formatCoins(entry.winning_bid) }} coins</span>
    <span class="pid-body pid-muted text-[11px]">{{ formatPrettyIdPktDateTime(entry.ended_at) }}</span>
    <PrettyIdButton size="sm" :aria-label="`View winner ${entry.winner.name}, Rare ID ${entry.rare_id}`" @click="emit('view', entry)">
      View
    </PrettyIdButton>
  </div>
</template>
