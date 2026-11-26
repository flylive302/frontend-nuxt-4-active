<script setup lang="ts">
/**
 * One finished auction on the Weekly Record: the Rare ID on a small plate, the winner (or "No
 * winner") with the bidder count and keep-period under the name, and the winning bid in the
 * third column ("—" when nobody won). The bid is exact, like the month total: the name column
 * gives way (it truncates), the digits never do.
 */
import type { PrettyIdAuctionWeeklyRow } from '~/types/pretty-id-auction'
import { formatCoins } from '~/utils/currency'
import { formatPrettyIdDays } from '~/utils/pretty-id-format'
import { prettyIdRareFontPx } from '~/utils/pretty-id-auction'

// Config
const props = defineProps<{
  row: PrettyIdAuctionWeeklyRow
}>()

// Constants
const AVATAR_SIZE = 26
/** The plate shares a ~200px row with the winner and the bid: an 8-character Rare ID shrinks. */
const RARE_ID_FONT = { max: 13, min: 9 }

// State
const rareIdFontSize = computed(() => `${prettyIdRareFontPx(props.row.rare_id, RARE_ID_FONT)}px`)
const winnerName = computed(() => props.row.winner?.name ?? 'No winner')
const bidLine = computed(() => (props.row.winning_bid === null ? '—' : formatCoins(props.row.winning_bid)))
const bidderLine = computed(() => (props.row.bidder_count === 1 ? '1 bidder' : `${props.row.bidder_count} bidders`))
const label = computed(() => (props.row.winner === null
  ? `Rare ID ${props.row.rare_id}, no winner`
  : `Rare ID ${props.row.rare_id}, won by ${props.row.winner.name}`))
</script>

<template>
  <PrettyIdRow class="gap-1.5! px-[22px]!" role="group" :aria-label="label">
    <PrettyIdPlate class="min-w-12! flex-none px-2.5! py-[3px]!">
      <span class="pid-num pid-gold" :style="{ fontSize: rareIdFontSize }">{{ row.rare_id }}</span>
    </PrettyIdPlate>
    <PrettyIdRing v-if="row.winner" :src="row.winner.avatar" :size="AVATAR_SIZE" />
    <span class="pid-row__grow flex flex-col leading-tight">
      <span class="pid-body truncate text-[11px]" :class="{ 'pid-muted': row.winner === null }">{{ winnerName }}</span>
      <span class="pid-body pid-muted truncate text-[9px]">{{ bidderLine }} · {{ formatPrettyIdDays(row.keep_days) }}</span>
    </span>
    <span class="pid-num pid-gold flex-none whitespace-nowrap text-right text-[12px]">{{ bidLine }}</span>
  </PrettyIdRow>
</template>
