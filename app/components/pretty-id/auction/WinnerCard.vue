<script setup lang="ts">
/**
 * One winner on the Big Winners board: avatar, name, the rare ID they won, the
 * winning bid and when. Emits `view` — the parent opens the details sheet.
 */
import type { PrettyIdWinner } from '~/types/pretty-id'
import { formatCoins } from '~/utils/currency'
import { formatPrettyIdDateTime } from '~/utils/pretty-id-format'

// Config
defineProps<{
  winner: PrettyIdWinner
}>()

const emit = defineEmits<{
  view: [winner: PrettyIdWinner]
}>()

// Constants
const AVATAR_SIZE = 70
</script>

<template>
  <div class="pid-wcard">
    <PrettyIdRing :src="winner.user.avatar_url" :size="AVATAR_SIZE" />
    <div class="pid-body pid-small max-w-full truncate">{{ winner.user.name }}</div>
    <PrettyIdPlate>
      <span class="pid-num pid-gold text-[22px]">{{ winner.id_number }}</span>
    </PrettyIdPlate>
    <span class="pid-num pid-gold text-[13px]">{{ formatCoins(winner.winning_bid) }} coins</span>
    <span class="pid-body pid-muted text-[11px]">{{ formatPrettyIdDateTime(winner.won_at) }}</span>
    <PrettyIdButton size="sm" :aria-label="`View winner ${winner.user.name}, ID ${winner.id_number}`" @click="emit('view', winner)">
      View
    </PrettyIdButton>
  </div>
</template>
