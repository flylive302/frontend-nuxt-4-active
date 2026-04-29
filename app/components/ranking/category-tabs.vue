<script setup lang="ts">
/**
 * Outer tabs on the /rank page. Selects the ranking category
 * (Wealth / Charm / Rooms / Agencies).
 */
import {
  RANKING_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  type RankingCategory,
} from '~/constants/ranking'

const modelValue = defineModel<RankingCategory>({ required: true })

const items = RANKING_CATEGORIES.map((value) => ({
  label: CATEGORY_LABELS[value],
  icon: CATEGORY_ICONS[value],
  value,
}))

function handleUpdate(value: string | number): void {
  modelValue.value = value as RankingCategory
}


</script>

<template>
  <UTabs
    :items="items"
    :model-value="modelValue"
    color="primary"
    variant="link"
    size="md"
    class="pr-14"
    :ui="{
      list: 'overflow-x-auto overflow-y-hidden scrollbar-thin',
      trigger: 'min-w-fit whitespace-nowrap bg-linear-to-b from-transparent via-transparent data-[state=active]:to-primary rounded-none',
      label: 'text-white',
    }"
    @update:model-value="handleUpdate"
  />
</template>
