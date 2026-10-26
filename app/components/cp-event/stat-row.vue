<script setup lang="ts">
import { formatCurrency } from '~/utils/currency'
import {ASSETS} from "~/constants/assets";

// Days / CP Intimacy / All-time rank / Points. Points is partner-only: the column
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
  { label: 'All-time rank', value: props.rank === null ? '-' : String(props.rank) },
  ...(props.points === undefined ? [] : [{ label: 'Points', value: String(props.points) }]),
])
</script>

<template>
  <div
      class="flex justify-between top-0 h-auto bg-cover pt-[18%] px-[14%] pb-[8%]"
      :style="{
          gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`,
          backgroundImage: `url('${ASSETS.CP_USER_STATS_DECOR}')`
        }"
  >
    <div v-for="stat in stats" :key="stat.label">
      <p class="text-xl font-bold text-center">{{ stat.value }}</p>
      <p class="text-sm font-semibold text-center">{{ stat.label }}</p>
    </div>
  </div>
</template>
