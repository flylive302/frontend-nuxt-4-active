<!-- ~/components/room/error-boundary.vue -->
<!-- Error boundary wrapper for room operations with retry functionality -->
<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'

defineOptions({ name: 'RoomErrorBoundary' })

// ========================================
// Props
// ========================================
const props = withDefaults(defineProps<{
  fallbackMessage?: string
  showRetry?: boolean
}>(), {
  fallbackMessage: 'Something went wrong. Please try again.',
  showRetry: true,
})

// ========================================
// Emits
// ========================================
const emit = defineEmits<{
  (e: 'error', error: Error): void
  (e: 'retry'): void
}>()

// ========================================
// State
// ========================================
const hasError = ref(false)
const errorMessage = ref('')

// ========================================
// Error Handling
// ========================================
onErrorCaptured((error: Error, instance, info) => {
  hasError.value = true
  errorMessage.value = error.message || props.fallbackMessage
  
  // Emit error event for parent handling/logging
  emit('error', error)
  
  // Log for debugging in development
  if (import.meta.env?.DEV) {
    console.error('[RoomErrorBoundary] Caught error:', error)
    console.error('Component:', instance)
    console.error('Error info:', info)
  }
  
  // Prevent error from propagating
  return false
})

// ========================================
// Recovery
// ========================================
function handleRetry() {
  hasError.value = false
  errorMessage.value = ''
  emit('retry')
}
</script>

<template>
  <div>
    <!-- Error State -->
    <div v-if="hasError" class="flex flex-col items-center justify-center p-6 gap-4 text-center">
      <div class="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center">
        <UIcon name="i-lucide-alert-triangle" class="w-8 h-8 text-error" />
      </div>
      <div>
        <p class="text-lg font-semibold text-error">Error</p>
        <p class="text-sm text-muted mt-1">{{ errorMessage || fallbackMessage }}</p>
      </div>
      <UButton
        v-if="showRetry"
        color="primary"
        variant="soft"
        icon="i-lucide-refresh-cw"
        @click="handleRetry"
      >
        Try Again
      </UButton>
    </div>
    
    <!-- Normal Content -->
    <slot v-else />
  </div>
</template>
