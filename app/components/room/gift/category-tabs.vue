<script setup lang="ts">
/**
 * Gift Category Tabs
 *
 * Horizontal scrollable tabs for gift categories.
 */
import type { GiftCategoryGroup } from '~/types/gift';

defineProps<{
  categories: GiftCategoryGroup[];
}>();
</script>

<template>
  <UTabs
    color="primary"
    variant="link"
    size="sm"
    :items="categories"
    class="w-full"
    :ui="{
      list: 'max-w-full overflow-x-auto overflow-y-hidden scrollbar-thin',
      indicator: 'bottom-1',
      trigger: 'min-w-fit whitespace-nowrap',
    }"
  >
    <template #default="{ item }">
      <div class="flex items-center gap-1.5">
        <span>{{ item.label }}</span>
        <UBadge v-if="item.gifts.length > 0" size="xs" color="success" variant="subtle">
          {{ item.gifts.length }}
        </UBadge>
      </div>
    </template>

    <template #content="{ item }">
      <slot name="content" :item="item" />
    </template>
  </UTabs>
</template>
