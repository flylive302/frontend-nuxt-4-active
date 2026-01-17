<script setup lang="ts">
// ========================================
// Level Up Modal
// ========================================
// Celebratory modal shown when user levels up.
// Uses GPU-friendly animations (transform + opacity only).

const { levelUpModalOpen, levelUpModalData, closeLevelUpModal } = useAchievementModals()

// ========================================
// Computed
// ========================================

/**
 * Type-specific styling.
 */
const typeStyle = computed(() => {
  if (levelUpModalData.value?.type === 'wealth') {
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
 * Format XP with thousands separator.
 */
const formattedXp = computed(() => {
  if (!levelUpModalData.value?.currentXp) return '0'
  const xp = parseFloat(levelUpModalData.value.currentXp)
  return new Intl.NumberFormat().format(Math.floor(xp))
})
</script>

<template>
  <UModal
    v-model:open="levelUpModalOpen"
    :ui="{
      content: 'bg-transparent shadow-none',
      overlay: 'bg-black/70 backdrop-blur-sm',
    }"
    @close="closeLevelUpModal"
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
          v-if="levelUpModalData"
          class="relative mx-auto max-w-sm overflow-hidden rounded-2xl bg-gradient-to-b from-neutral-800 to-neutral-900 p-6 text-center shadow-2xl"
          role="dialog"
          aria-labelledby="levelup-modal-title"
          aria-describedby="levelup-modal-description"
        >
          <!-- Animated Background Glow -->
          <div class="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              class="absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 animate-pulse rounded-full opacity-40 blur-xl"
              :class="typeStyle.bgColor"
            />
          </div>

          <!-- Level Number Display -->
          <div class="relative mb-4">
            <div
              class="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br ring-4 ring-white/10"
              :class="[typeStyle.gradientFrom, typeStyle.gradientTo]"
            >
              <span class="text-5xl font-black text-white drop-shadow-lg">
                {{ levelUpModalData.newLevel }}
              </span>
            </div>

            <!-- Previous Level -->
            <div class="absolute -right-2 top-0 rounded-full bg-neutral-700/80 px-2 py-1 text-xs text-neutral-300">
              was {{ levelUpModalData.previousLevel }}
            </div>
          </div>

          <!-- Title -->
          <h2
            id="levelup-modal-title"
            class="mb-1 text-xl font-bold text-white"
          >
            Level Up! 🚀
          </h2>

          <!-- Type Label -->
          <p
            class="mb-2 flex items-center justify-center gap-1 text-lg font-semibold"
            :class="typeStyle.textColor"
          >
            <UIcon :name="typeStyle.icon" class="h-5 w-5" />
            {{ typeStyle.label }}
          </p>

          <!-- XP Display -->
          <p
            id="levelup-modal-description"
            class="mb-4 text-sm text-neutral-400"
          >
            Current XP: <span class="font-medium text-white">{{ formattedXp }}</span>
          </p>

          <!-- Progress Indicator -->
          <div
            class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
            :class="[typeStyle.bgColor, typeStyle.textColor]"
          >
            <UIcon name="i-heroicons-arrow-trending-up" class="h-4 w-4" />
            +{{ levelUpModalData.newLevel - levelUpModalData.previousLevel }} Level{{ levelUpModalData.newLevel - levelUpModalData.previousLevel > 1 ? 's' : '' }}
          </div>

          <!-- Close Button -->
          <button
            type="button"
            class="absolute right-3 top-3 rounded-full p-1 text-neutral-500 transition-colors hover:bg-neutral-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Close"
            @click="closeLevelUpModal"
          >
            <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
          </button>
        </div>
      </Transition>
    </template>
  </UModal>
</template>
