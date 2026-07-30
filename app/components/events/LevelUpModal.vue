<script setup lang="ts">
// ========================================
// Level Up Modal
// ========================================
// Celebratory modal for a level-up crossed since the device's last visit
// to /levels/wealth or /levels/charm (level-up-celebrations, ticket 04).
// Page-gated: props/emits driven, hosted by LevelsLevelPage.vue via
// useLevelUpDrain — no global queue coupling.
// Uses GPU-friendly animations (transform + opacity only).

import type { LevelUpModalItem } from '~/composables/progression/useLevelUpDrain'
import { DEFAULT_WEALTH_BADGE, DEFAULT_CHARM_BADGE } from '~/composables/shared/useLevelLookup'
import { withImageKitTransform } from '~/utils/imagekit'

// ========================================
// Props / Emits
// ========================================

const props = defineProps<{
  open: boolean
  modal: LevelUpModalItem | null
}>()

const emit = defineEmits<{
  close: []
}>()

// ========================================
// Computed
// ========================================

/**
 * The crossed level's own badge image from bootstrap level config.
 * Falls back to the category's default badge.
 */
const badgeImage = computed(() => {
  if (!props.modal) return null
  const url = props.modal.imageUrl
    ?? (props.modal.category === 'wealth' ? DEFAULT_WEALTH_BADGE : DEFAULT_CHARM_BADGE)
  // Painted at `h-20 w-20` (80 CSS px) below. The default-badge constants are base URLs, so
  // without this the modal would pull the full 512px source (~106 KB) for an 80px render.
  return withImageKitTransform(url, { w: 200, q: 75 })
})

/**
 * Category-specific styling.
 */
const typeStyle = computed(() => {
  if (props.modal?.category === 'wealth') {
    return {
      bgColor: 'bg-amber-500/20',
      textColor: 'text-amber-400',
      gradientFrom: 'from-amber-500',
      gradientTo: 'to-yellow-300',
      icon: 'i-heroicons-currency-dollar',
      label: 'Wealth Level',
    }
  }
  return {
    bgColor: 'bg-pink-500/20',
    textColor: 'text-pink-400',
    gradientFrom: 'from-pink-500',
    gradientTo: 'to-rose-300',
    icon: 'i-heroicons-heart',
    label: 'Charm Level',
  }
})

/**
 * Number of levels this modal represents. For a 'summary' modal this is the
 * total crossed since the last visit (`crossedCount`), not just the gap to
 * the last individually-shown level — keeps this number consistent with the
 * "You crossed N levels" summary copy below.
 */
const levelDelta = computed(() => {
  if (!props.modal) return 0
  return props.modal.kind === 'summary'
    ? (props.modal.crossedCount ?? props.modal.level - props.modal.previousLevel)
    : props.modal.level - props.modal.previousLevel
})

function handleClose(): void {
  emit('close')
}
</script>

<template>
  <UModal
    :open="open"
    :ui="{
      content: 'bg-transparent shadow-none ring-0',
      overlay: 'bg-black/70 backdrop-blur-sm',
    }"
    class="z-90"
    @close="handleClose"
  >
    <template #content>
      <Transition
        enter-active-class="duration-300 ease-out"
        enter-from-class="opacity-0 scale-90"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-90"
        appear
      >
        <div
          v-if="modal"
          class="relative mx-auto max-w-sm overflow-hidden rounded-2xl bg-gradient-to-b from-neutral-800 to-neutral-950 p-6 text-center shadow-2xl min-w-60"
          role="dialog"
          aria-labelledby="levelup-modal-title"
          aria-describedby="levelup-modal-description"
        >
          <!-- Animated Background Glow -->
          <div class="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              class="absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 animate-pulse rounded-full blur-xl"
              :class="typeStyle.bgColor"
            />
          </div>

          <!-- New Level Badge Image -->
          <img
            v-if="badgeImage"
            :src="badgeImage"
            :alt="`${typeStyle.label} ${modal.level} badge`"
            class="relative mx-auto mb-3 h-20 w-20 object-contain drop-shadow-lg"
          >

          <!-- Level Number Display -->
          <div class="relative mb-4">
            <div
              class="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br ring-4 ring-white/10"
              :class="[typeStyle.gradientFrom, typeStyle.gradientTo]"
            >
              <span class="text-5xl font-black text-white drop-shadow-lg">
                {{ modal.level }}
              </span>
            </div>
          </div>
          <!-- Previous Level -->
          <UBadge color="info" variant="soft" class="absolute left-2 top-2">
            was {{ modal.previousLevel }}
          </UBadge>

          <!-- Title -->
          <h2
            id="levelup-modal-title"
            class="mb-1 text-xl font-bold text-white"
          >
            {{ modal.kind === 'summary' ? 'Great Progress! 🚀' : 'Level Up! 🚀' }}
          </h2>

          <!-- Type Label -->
          <p
            class="mb-2 flex items-center justify-center gap-1 text-lg font-semibold"
            :class="typeStyle.textColor"
          >
            <UIcon :name="typeStyle.icon" class="h-5 w-5" />
            {{ typeStyle.label }}
          </p>

          <!-- Summary Description -->
          <p
            v-if="modal.kind === 'summary'"
            id="levelup-modal-description"
            class="mb-4 text-sm text-neutral-400"
          >
            You crossed <span class="font-medium text-white">{{ modal.crossedCount }}</span> levels
            and reached <span class="font-medium text-white">{{ modal.levelName }}</span>
          </p>
          <p
            v-else
            id="levelup-modal-description"
            class="mb-4 text-sm text-neutral-400"
          >
            You reached <span class="font-medium text-white">{{ modal.levelName }}</span>
          </p>

          <!-- Progress Indicator -->
          <div
            class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
            :class="[typeStyle.bgColor, typeStyle.textColor]"
          >
            <UIcon name="i-heroicons-arrow-trending-up" class="h-4 w-4" />
            +{{ levelDelta }} Level{{ levelDelta > 1 ? 's' : '' }}
          </div>

          <!-- Close Button -->
          <UButton
            variant="soft"
            color="error"
            class="absolute right-0 top-0"
            aria-label="Close"
            icon="i-heroicons-x-mark"
            @click="handleClose"
          />
        </div>
      </Transition>
    </template>
  </UModal>
</template>
