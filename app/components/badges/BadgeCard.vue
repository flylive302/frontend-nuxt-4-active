<!-- ~/components/badges/BadgeCard.vue -->
<!-- Displays a single badge with optional toggle display functionality -->
<script setup lang="ts">
import { computed } from 'vue'
import type { Badge, UserBadge } from '~/types/progression/badge'
import { BADGE_CATEGORY_COLORS, BADGE_RARITY_COLORS } from '~/types/progression/badge'

// ========================================
// Props & Emits
// ========================================

defineOptions({ name: 'BadgeCard' })

const props = withDefaults(defineProps<{
  badge: Badge
  userBadge?: UserBadge | null
  showToggle?: boolean
  isToggling?: boolean
}>(), {
  userBadge: null,
  showToggle: false,
  isToggling: false,
})

const emit = defineEmits<{
  (e: 'toggle', userBadgeId: number): void
}>()

// ========================================
// Computed
// ========================================

const isEarned = computed(() => props.userBadge !== null)
const isDisplayed = computed(() => props.userBadge?.is_displayed ?? false)
const _categoryColor = computed(() => BADGE_CATEGORY_COLORS[props.badge.category])
const rarityColor = computed(() => 
  props.badge.rarity ? BADGE_RARITY_COLORS[props.badge.rarity] : 'text-gray-400'
)

/**
 * Format earned date.
 */
const earnedDate = computed(() => {
  if (!props.userBadge?.earned_at) return null
  const date = new Date(props.userBadge.earned_at)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
})

// ========================================
// Handlers
// ========================================

function handleToggle(): void {
  if (props.userBadge) {
    emit('toggle', props.userBadge.id)
  }
}
</script>

<template>
  <div 
    class="relative bg-secondary/5 rounded-lg p-3 text-center inset-shadow-sm inset-shadow-secondary-900"
    :class="{ 'opacity-80': !isEarned }"
  >
    <!-- Display indicator -->
    <div 
      v-if="isDisplayed"
      class="absolute top-2 right-2"
    >
      <icon name="i-lucide-eye" class="size-4 text-green-500" />
    </div>

    <!-- Lock icon for unearned -->
    <div 
      v-if="!isEarned"
      class="absolute inset-0 flex items-center justify-center bg-muted/30 rounded-lg"
    >
      <icon name="i-lucide-lock" class="size-8 text-muted" />
    </div>

    <!-- Badge Image -->
    <NuxtImg
      :src="badge.image_url"
      :alt="badge.name"
      class="size-16 mx-auto mb-2 object-contain"
      provider="imagekit"
    />

    <!-- Badge Name -->
    <p class="font-semibold text-sm truncate">{{ badge.name }}</p>

    <!-- Rarity -->
    <p v-if="badge.rarity" class="text-xs capitalize" :class="rarityColor">
      {{ badge.rarity }}
    </p>

    <!-- Earned Date -->
    <p v-if="earnedDate" class="text-xs text-muted mt-1">
      {{ earnedDate }}
    </p>

    <!-- Toggle Button -->
    <UButton
      v-if="showToggle && isEarned"
      size="xs"
      :color="isDisplayed ? 'error' : 'primary'"
      :variant="isDisplayed ? 'soft' : 'solid'"
      :loading="isToggling"
      class="mt-2 w-full justify-center"
      @click="handleToggle"
    >
      {{ isDisplayed ? 'Hide' : 'Display' }}
    </UButton>
  </div>
</template>
