<script setup lang="ts">
/**
 * Sticky bottom bar showing the authenticated user's rank in the
 * currently selected (category, period). Renders "Unranked" when the
 * user has no qualifying entry — the API returns null in that case
 * (no room, no agency, or simply outside the top-100 cut-off).
 */
import type { CurrentUserRank } from '~/types/ranking'
import type { RankingCategory } from '~/constants/ranking'
import { CATEGORY_LABELS } from '~/constants/ranking'
import { formatCurrency } from '~/utils/currency'

const props = defineProps<{
  rank: CurrentUserRank | null
  category: RankingCategory
}>()

const headline = computed<string>(() => {
  if (props.rank === null) {
    return `Unranked in ${CATEGORY_LABELS[props.category]}`
  }
  return `You: #${props.rank.rank}`
})

const subline = computed<string | null>(() => {
  if (props.rank === null) return null
  return formatCurrency(props.rank.score)
})
</script>

<template>
  <div
    class="
      fixed z-40 top-0 left-0 right-0 px-4 py-2 safe-area-top
      backdrop-blur
      flex items-center justify-between w-full
    "
  >
    <p class="text-md font-medium text-white">{{ headline }}</p>
    <p v-if="subline" class="text-lg font-bold text-primary">{{ subline }}</p>
  </div>
</template>
