<script setup lang="ts">
// ========================================
// Download Progress Bar
// ========================================

import type { DownloadProgress } from '~/types/asset'

// ========================================
// Props
// ========================================

interface Props {
  /** Download progress data */
  progress: DownloadProgress | null
  /** Whether to show the progress bar */
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: true,
})

// ========================================
// Computed
// ========================================

const percentComplete = computed(() => {
  if (!props.progress || props.progress.total === 0) return 0
  return Math.round((props.progress.completed / props.progress.total) * 100)
})

const isComplete = computed(() => percentComplete.value >= 100)

const statusText = computed(() => {
  if (!props.progress) return ''
  if (isComplete.value) return 'Ready!'
  return `Preparing... ${props.progress.completed}/${props.progress.total}`
})
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0 -translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-2"
  >
    <div
      v-if="visible && progress && !isComplete"
      class="fixed left-0 right-0 top-0 z-50"
    >
      <!-- Progress Bar -->
      <div class="h-1 w-full bg-neutral-800">
        <div
          class="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300 ease-out"
          :style="{ width: `${percentComplete}%` }"
        />
      </div>

      <!-- Status Text (optional, for detailed view) -->
      <div
        v-if="progress.total > 5"
        class="absolute right-4 top-2 rounded-full bg-neutral-900/90 px-3 py-1 text-xs text-neutral-400 backdrop-blur"
      >
        {{ statusText }}
      </div>
    </div>
  </Transition>
</template>
