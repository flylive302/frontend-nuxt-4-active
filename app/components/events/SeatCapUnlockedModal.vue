<script setup lang="ts">
// ========================================
// Seat Cap Unlocked Modal (room-seat-caps)
// ========================================
// Celebratory modal shown to the room owner when a room level-up crosses a
// Seat Unlock Ladder entry. Uses GPU-friendly animations (transform + opacity).

const { seatCapUnlockModalOpen, seatCapUnlockModalData, closeSeatCapUnlockModal } = useAchievementModals()
</script>

<template>
  <UModal
    :open="seatCapUnlockModalOpen"
    :ui="{
      content: 'bg-transparent shadow-none ring-0',
      overlay: 'bg-black/70 backdrop-blur-sm',
    }"
    class="z-90"
    @close="closeSeatCapUnlockModal"
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
          v-if="seatCapUnlockModalData"
          class="relative mx-auto max-w-sm overflow-hidden rounded-2xl bg-gradient-to-b from-neutral-800 to-neutral-950 p-6 text-center shadow-2xl min-w-60"
          role="dialog"
          aria-labelledby="seatcap-modal-title"
          aria-describedby="seatcap-modal-description"
        >
          <!-- Animated Background Glow -->
          <div class="pointer-events-none absolute inset-0 overflow-hidden">
            <div class="absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 animate-pulse rounded-full bg-emerald-500/20 blur-xl" />
          </div>

          <!-- Seat Cap Display -->
          <div class="relative mb-4">
            <div class="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-300 ring-4 ring-white/10">
              <span class="text-5xl font-black text-white drop-shadow-lg">
                {{ seatCapUnlockModalData.seatCap }}
              </span>
            </div>
          </div>

          <!-- Title -->
          <h2
            id="seatcap-modal-title"
            class="mb-1 text-xl font-bold text-white"
          >
            Congratulations! 🎉
          </h2>

          <!-- Room Level Label -->
          <p class="mb-2 flex items-center justify-center gap-1 text-lg font-semibold text-emerald-400">
            <UIcon name="i-heroicons-home-modern" class="h-5 w-5" />
            Room Level {{ seatCapUnlockModalData.newLevel }}
          </p>

          <!-- Description -->
          <p
            id="seatcap-modal-description"
            class="mb-4 text-sm text-neutral-400"
          >
            {{ seatCapUnlockModalData.roomName }} — seat capacity is now
            <span class="font-medium text-white">{{ seatCapUnlockModalData.seatCap }}</span>
          </p>

          <!-- Progress Indicator -->
          <div class="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400">
            <UIcon name="i-heroicons-user-group" class="h-4 w-4" />
            More seats unlocked
          </div>

          <!-- Close Button -->
          <UButton
            variant="soft"
            color="error"
            class="absolute right-0 top-0"
            aria-label="Close"
            icon="i-heroicons-x-mark"
            @click="closeSeatCapUnlockModal"
          />
        </div>
      </Transition>
    </template>
  </UModal>
</template>
