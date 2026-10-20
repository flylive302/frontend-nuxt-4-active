<script setup lang="ts">
import type { CpPairCard } from '~/types/cp'
import { ASSETS } from '~/constants/assets'

// Ranks 1-3. `pairs` arrives in rank order; missing ranks simply don't render.
// `scoreField` picks the figure printed under each pair (event: lifetime
// intimacy, square: the closed week's score).

const props = defineProps<{
  pairs: readonly CpPairCard[]
  scoreField: 'lifetime_intimacy' | 'weekly_score'
}>()

const first = computed(() => props.pairs[0] ?? null)
const runnersUp = computed(() => {
  const slots: { pair: CpPairCard; decoration: string }[] = []
  const second = props.pairs[1]
  const third = props.pairs[2]
  if (second) slots.push({ pair: second, decoration: ASSETS.CP_DECORATION_TOP_2 })
  if (third) slots.push({ pair: third, decoration: ASSETS.CP_DECORATION_TOP_3 })
  return slots
})
</script>

<template>
  <div v-if="first">
    <div class="relative">
      <img alt="" :src="ASSETS.CP_DECORATION_TOP_1">
      <div class="w-full px-22 absolute top-8">
        <CpEventCouplePair :pair="first" variant="podium" />
        <div class="flex justify-center mt-1">
          <CpEventScorePill :value="first[scoreField]" />
        </div>
      </div>
    </div>

    <div class="flex mt-2 justify-center">
      <div v-for="slot in runnersUp" :key="slot.pair.pair_id" class="relative">
        <img alt="" :src="slot.decoration">
        <div class="w-full px-4 absolute top-8">
          <CpEventCouplePair :pair="slot.pair" variant="podium" />
          <div class="flex justify-center mt-1">
            <CpEventScorePill :value="slot.pair[scoreField]" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
