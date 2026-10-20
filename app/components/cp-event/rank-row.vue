<script setup lang="ts">
import type { CpPairCard } from '~/types/cp'
import { ASSETS } from '~/constants/assets'

// One leaderboard row. `self` swaps in the viewer's sticky-bar background; the
// caller passes the rank to show (list: position; self bar: weekly rank) and
// which score field to print.

const props = withDefaults(defineProps<{
  pair: CpPairCard
  rank: number | null
  scoreField: 'lifetime_intimacy' | 'weekly_score'
  self?: boolean
}>(), {
  self: false,
})

const background = computed(() => (props.self ? ASSETS.CP_RANK_SELF_BACKGROUND : ASSETS.CP_RANK_LIST_BACKGROUND))
</script>

<template>
  <div class="relative">
    <img alt="" :src="background">
    <div class="absolute inset-0 grid grid-cols-12">
      <p class="text-white font-bold text-md flex flex-col justify-center items-center">{{ rank ?? '-' }}</p>
      <div class="col-span-6">
        <CpEventCouplePair :pair="pair" variant="row" class="h-full" />
      </div>
      <div class="col-span-3 col-start-10 pr-2 flex flex-col justify-center items-end">
        <CpEventScorePill :value="pair[scoreField]" />
      </div>
    </div>
  </div>
</template>
