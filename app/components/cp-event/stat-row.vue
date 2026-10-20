<script setup lang="ts">
import { formatCurrency } from '~/utils/currency'

// Days / CP Intimacy / Ranking / Points. Points is partner-only: the column
// is absent (not zero) when the API omits it.

const props = defineProps<{
  days: number
  intimacy: number
  rank: number | null
  points?: number
}>()

const stats = computed(() => [
  { label: 'Days', value: String(props.days) },
  { label: 'CP Intimacy', value: formatCurrency(props.intimacy) },
  { label: 'Ranking', value: props.rank === null ? '-' : String(props.rank) },
  ...(props.points === undefined ? [] : [{ label: 'Points', value: String(props.points) }]),
])
</script>

<template>
  <div class="rounded-xl glowing-border">
    <div class="grid h-full items-center pb-1" :style="{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }">
      <div v-for="stat in stats" :key="stat.label">
        <p class="text-xl font-bold text-center">{{ stat.value }}</p>
        <p class="text-sm font-semibold text-center">{{ stat.label }}</p>
      </div>
    </div>
  </div>
</template>
