<script setup lang="ts">
import type { GiftRarity } from '~/types/user-profile'
import { GIFT_RARITY_CONFIG } from '~/types/user-profile'

// ========================================
// Props
// ========================================

const props = withDefaults(defineProps<{
  /** Image source URL for the item */
  badgeSrc?: string
  /** Display name of the item */
  itemName?: string
  /** Quantity badge (e.g., total received) */
  quantity?: number
  /** Rarity level for styling */
  rarity?: GiftRarity
}>(), {
  badgeSrc: '/siteAssets/badges/badge-profile-1.webp',
  itemName: 'Item Name',
  quantity: undefined,
  rarity: 'common',
})

// ========================================
// Computed
// ========================================

/**
 * Border class based on rarity.
 */
const rarityBorderClass = computed(() =>
  GIFT_RARITY_CONFIG[props.rarity]?.borderClass ?? 'border-primary'
)

/**
 * Whether to show the quantity badge.
 */
const showQuantity = computed(() =>
  props.quantity !== undefined && props.quantity > 0
)

/**
 * Formatted quantity for display (abbreviate large numbers).
 */
const formattedQuantity = computed(() => {
  if (!props.quantity) return ''
  if (props.quantity >= 1000) {
    return `${(props.quantity / 1000).toFixed(1)}K`
  }
  return String(props.quantity)
})
</script>

<template>
  <div
    class="bg-primary/30 p-2 border rounded-md flex flex-col justify-between items-center relative"
    :class="rarityBorderClass"
  >
    <!-- Quantity Badge -->
    <span
      v-if="showQuantity"
      class="absolute -top-2 -right-2 bg-primary text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.5rem] text-center z-10"
    >
      {{ formattedQuantity }}
    </span>

    <!-- Item Image -->
    <NuxtImg
      :src="badgeSrc"
      :alt="itemName"
      class="w-full aspect-square object-contain"
      loading="lazy"
    />

    <!-- Item Name -->
    <p class="text-xs truncate text-center w-full mt-1">{{ itemName }}</p>
  </div>
</template>

<style scoped>

</style>