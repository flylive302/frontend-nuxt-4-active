<script setup lang="ts">
// ========================================
// Badge Earned Modal
// ========================================
// Celebratory modal shown when user earns a new badge.
// Uses GPU-friendly animations (transform + opacity only).

const { badgeModalOpen, badgeModalData, closeBadgeModal } = useAchievementModals()

// ========================================
// Computed
// ========================================

/**
 * Category-specific styling.
 */
const categoryStyle = computed(() => {
  switch (badgeModalData.value?.category) {
    case 'wealth':
      return { bgColor: 'bg-amber-500/20', textColor: 'text-amber-400', icon: 'i-heroicons-currency-dollar' }
    case 'charm':
      return { bgColor: 'bg-pink-500/20', textColor: 'text-pink-400', icon: 'i-heroicons-heart' }
    case 'room':
      return { bgColor: 'bg-blue-500/20', textColor: 'text-blue-400', icon: 'i-heroicons-home' }
    case 'special':
      return { bgColor: 'bg-purple-500/20', textColor: 'text-purple-400', icon: 'i-heroicons-star' }
    default:
      return { bgColor: 'bg-primary-500/20', textColor: 'text-primary-400', icon: 'i-heroicons-trophy' }
  }
})

/**
 * Human-readable context description.
 */
const contextDescription = computed(() => {
  switch (badgeModalData.value?.context) {
    case 'level_up':
      return 'Reached a new level'
    case 'gift_received':
      return 'Received gifts from fans'
    case 'gift_sent':
      return 'Sent gifts to creators'
    default:
      return 'Achievement unlocked'
  }
})
</script>

<template>
  <UModal
    v-model:open="badgeModalOpen"
    :ui="{
      content: 'bg-transparent shadow-none',
      overlay: 'bg-black/70 backdrop-blur-sm',
    }"
    @close="closeBadgeModal"
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
          v-if="badgeModalData"
          class="relative mx-auto max-w-sm overflow-hidden rounded-2xl bg-gradient-to-b from-neutral-800 to-neutral-900 p-6 text-center shadow-2xl"
          role="dialog"
          aria-labelledby="badge-modal-title"
          aria-describedby="badge-modal-description"
        >
          <!-- Confetti/Glow Effect -->
          <div class="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              class="absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 animate-pulse rounded-full opacity-30"
              :class="categoryStyle.bgColor"
            />
          </div>

          <!-- Badge Icon Container -->
          <div class="relative mb-4">
            <div
              class="mx-auto flex h-24 w-24 items-center justify-center rounded-full ring-4 ring-white/10"
              :class="categoryStyle.bgColor"
            >
              <NuxtImg
                v-if="badgeModalData.badgeImage"
                :src="badgeModalData.badgeImage"
                :alt="badgeModalData.badgeName"
                class="h-16 w-16 object-contain drop-shadow-lg"
                loading="eager"
              />
              <UIcon
                v-else
                :name="categoryStyle.icon"
                class="h-12 w-12"
                :class="categoryStyle.textColor"
              />
            </div>
          </div>

          <!-- Title -->
          <h2
            id="badge-modal-title"
            class="mb-1 text-xl font-bold text-white"
          >
            Badge Earned! 🎉
          </h2>

          <!-- Badge Name -->
          <p
            class="mb-2 text-lg font-semibold"
            :class="categoryStyle.textColor"
          >
            {{ badgeModalData.badgeName }}
          </p>

          <!-- Context -->
          <p
            id="badge-modal-description"
            class="mb-4 text-sm text-neutral-400"
          >
            {{ contextDescription }}
          </p>

          <!-- Category Tag -->
          <div
            class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium capitalize"
            :class="[categoryStyle.bgColor, categoryStyle.textColor]"
          >
            <UIcon :name="categoryStyle.icon" class="h-3 w-3" />
            {{ badgeModalData.category }}
          </div>

          <!-- Close Button -->
          <button
            type="button"
            class="absolute right-3 top-3 rounded-full p-1 text-neutral-500 transition-colors hover:bg-neutral-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Close"
            @click="closeBadgeModal"
          >
            <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
          </button>
        </div>
      </Transition>
    </template>
  </UModal>
</template>
