<!-- ~/components/badges/BadgeCard.vue -->
<!-- Displays a single badge entry from the unified catalog grid -->
<script setup lang="ts">
import type { Badge } from '~/types/progression/badge'
import { withImageKitTransform } from '~/utils/imagekit'

// ========================================
// Props + Emits
// ========================================

defineOptions({ name: 'BadgeCard' })

const props = defineProps<{
  badge: Badge
  count: number
  isLocked: boolean
  selectable?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{
  select: [badgeId: number]
}>()

// ========================================
// Computed
// ========================================

const displayImageUrl = computed(() =>
  withImageKitTransform(props.badge.image_url, { w: 128, q: 75 }),
)

function handleClick() {
  if (props.selectable && !props.isLocked) {
    emit('select', props.badge.id)
  }
}
</script>

<template>
  <UTooltip :text="badge.description" :delay-duration="300">
    <div
      class="relative bg-secondary/5 rounded-lg p-3 text-center inset-shadow-sm inset-shadow-secondary-900 transition-all"
      :class="{
        'opacity-80 pointer-events-none': isLocked,
        'cursor-pointer ring-2 ring-primary-500': selectable && !isLocked,
        'ring-primary-500 bg-primary-500/10': selected,
      }"
      :aria-disabled="isLocked ? 'true' : undefined"
      @click="handleClick"
    >
      <!-- Lock overlay -->
      <div
        v-if="isLocked"
        class="absolute inset-0 flex items-center justify-center bg-muted/30 rounded-lg"
      >
        <UIcon name="i-lucide-lock" class="size-8 text-muted" />
      </div>

      <!-- Selected indicator -->
      <div
        v-if="selected"
        class="absolute top-1.5 left-1.5 size-4 bg-primary-500 rounded-full flex items-center justify-center"
      >
        <UIcon name="i-lucide-check" class="size-3 text-white" />
      </div>

      <!-- Badge Image -->
      <NuxtImg
        :src="displayImageUrl"
        :alt="badge.name"
        class="size-16 mx-auto mb-2 object-contain"
      />

      <!-- Badge Name -->
      <p class="font-semibold text-sm truncate">{{ badge.name }}</p>

      <!-- ×N pill for multiple ownership -->
      <span
        v-if="count > 1"
        class="absolute top-1.5 right-1.5 bg-secondary text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none"
      >
        ×{{ count }}
      </span>
    </div>
  </UTooltip>
</template>
