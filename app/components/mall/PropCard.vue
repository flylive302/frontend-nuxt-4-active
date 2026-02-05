<!-- ~/components/mall/PropCard.vue -->
<!-- Displays a catalog prop with purchase option -->
<script setup lang="ts">
import { computed } from 'vue'
import type { Prop } from '~/types/prop'
import { PROP_TYPE_ICONS, PROP_TYPE_COLORS } from '~/types/prop'

// ========================================
// Props & Emits
// ========================================

defineOptions({ name: 'PropCard' })

const props = defineProps<{
  prop: Prop
}>()

const emit = defineEmits<{
  (e: 'select', prop: Prop): void
}>()

// ========================================
// Computed
// ========================================

const icon = computed(() => PROP_TYPE_ICONS[props.prop.type])
const iconColor = computed(() => PROP_TYPE_COLORS[props.prop.type])

const isAvailable = computed(() => props.prop.is_available && props.prop.is_purchasable)

const isSoldOut = computed(() => 
  props.prop.inventory_count !== null && props.prop.inventory_count <= 0
)

/**
 * Format price for display.
 */
const priceDisplay = computed(() => {
  const price = props.prop.price
  if (price >= 1_000_000) return (price / 1_000_000).toFixed(1) + 'M'
  if (price >= 1_000) return (price / 1_000).toFixed(1) + 'K'
  return price.toLocaleString()
})

/**
 * Duration display.
 */
const durationDisplay = computed(() => {
  if (!props.prop.duration_days) return 'Permanent'
  return `${props.prop.duration_days} days`
})

// ========================================
// Handlers
// ========================================

function handleClick(): void {
  if (isAvailable.value) {
    emit('select', props.prop)
  }
}
</script>

<template>
  <div 
    class="bg-elevated rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:ring-2 hover:ring-primary/50"
    :class="{ 'opacity-50 cursor-not-allowed': !isAvailable || isSoldOut }"
    @click="handleClick"
  >
    <!-- Thumbnail -->
    <div class="aspect-square relative bg-muted/20">
      <img 
        v-if="prop.thumbnail_url"
        :src="prop.thumbnail_url"
        :alt="prop.name"
        class="w-full h-full object-cover"
        loading="lazy"
      >
      <div v-else class="w-full h-full flex items-center justify-center">
        <icon :name="icon" class="size-12" :class="iconColor" />
      </div>

      <!-- Sold Out Badge -->
      <div 
        v-if="isSoldOut" 
        class="absolute inset-0 bg-black/60 flex items-center justify-center"
      >
        <span class="text-white font-bold text-sm">SOLD OUT</span>
      </div>

      <!-- VIP Badge -->
      <div 
        v-if="prop.vip_level_required > 0"
        class="absolute top-2 right-2"
      >
        <UBadge color="warning" size="xs" variant="soft">
          VIP {{ prop.vip_level_required }}
        </UBadge>
      </div>
    </div>

    <!-- Info -->
    <div class="p-3 space-y-1">
      <!-- Name -->
      <p class="font-semibold text-sm truncate">{{ prop.name }}</p>

      <!-- Price & Duration -->
      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-1 text-amber-500">
          <icon name="i-lucide-coins" class="size-3.5" />
          <span class="font-bold">{{ priceDisplay }}</span>
        </div>
        <span class="text-muted">{{ durationDisplay }}</span>
      </div>
    </div>
  </div>
</template>
