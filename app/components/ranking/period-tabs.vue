<script setup lang="ts">
/**
 * Inner tabs on the /rank page. Selects the time window
 * (Daily / Weekly / Monthly).
 */
import {
  RANKING_PERIODS,
  PERIOD_LABELS,
  type RankingPeriod,
} from '~/constants/ranking'

const modelValue = defineModel<RankingPeriod>({ required: true })

const items = RANKING_PERIODS.map((value) => ({
  label: PERIOD_LABELS[value],
  value,
}))

function handleUpdate(value: string | number): void {
  modelValue.value = value as RankingPeriod
}
</script>

<template>
  <UTabs
    :items="items"
    :model-value="modelValue"
    color="primary"
    variant="pill"
    size="sm"
    class="w-full"
    :ui="{
      list: 'mx-auto',
      trigger: 'min-w-fit',
    }"
    @update:model-value="handleUpdate"
  />
</template>
