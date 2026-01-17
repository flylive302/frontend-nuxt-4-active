<script setup lang="ts">
// ========================================
// Full Screen Loader
// ========================================
// Displays during app bootstrap with progress indicator.
// Non-blocking and CPU-friendly with minimal animation.

const bootstrapStore = useBootstrapStore()
const isOnline = useOnline()

// ========================================
// Computed
// ========================================

/**
 * Show loader during initial bootstrap phases.
 */
const isVisible = computed(() => {
  return bootstrapStore.phase === 'loading'
})

/**
 * Human-readable phase description.
 */
const phaseLabel = computed(() => {
  switch (bootstrapStore.phase) {
    case 'loading':
      return 'Loading...'
    case 'complete':
      return 'Ready!'
    case 'error':
      return 'Error loading app'
    default:
      return 'Starting...'
  }
})

/**
 * Progress percentage (0-100).
 * During bootstrap, we estimate 50% for config, 100% on complete.
 */
const progress = computed(() => {
  if (bootstrapStore.phase === 'complete') return 100
  if (bootstrapStore.phase === 'loading') return 50
  return 0
})
</script>

<template>
  <Transition
    enter-active-class="duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="duration-300 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isVisible"
      class="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-neutral-950"
      role="status"
      aria-live="polite"
      aria-label="Loading application"
    >
      <!-- Logo -->
      <div class="mb-8">
        <LogoApp class="h-16 w-auto" />
      </div>

      <!-- Spinner -->
      <div class="relative mb-6">
        <div class="h-12 w-12 animate-spin rounded-full border-4 border-neutral-700 border-t-primary-500" />
      </div>

      <!-- Progress Bar -->
      <div class="mb-4 w-48 overflow-hidden rounded-full bg-neutral-800">
        <div 
          class="h-1.5 rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-500"
          :style="{ width: `${progress}%` }"
        />
      </div>

      <!-- Phase Label -->
      <p class="text-sm text-neutral-400">
        {{ phaseLabel }}
      </p>

      <!-- Offline Message -->
      <p
        v-if="!isOnline"
        class="mt-4 text-xs text-neutral-500"
      >
        Using cached data (offline)
      </p>
    </div>
  </Transition>
</template>
