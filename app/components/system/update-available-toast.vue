<script setup lang="ts">
// ========================================
// Update Available Toast
// ========================================

import { createLogger } from '~/utils/logger'

const log = createLogger('[UpdateToast]')

// ========================================
// State
// ========================================

const isVisible = ref(false)
const registration = ref<ServiceWorkerRegistration | null>(null)

// ========================================
// Lifecycle
// ========================================

onMounted(() => {
  // Listen for SW update events
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      registration.value = reg

      // Check for updates periodically
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            isVisible.value = true
          }
        })
      })
    })
  }
})

// ========================================
// Actions
// ========================================

function handleRefresh(): void {
  // Tell SW to skip waiting and activate
  if (registration.value?.waiting) {
    registration.value.waiting.postMessage({ type: 'SKIP_WAITING' })
  }

  // Reload the page
  window.location.reload()
}

function handleDismiss(): void {
  isVisible.value = false
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-2"
  >
    <div
      v-if="isVisible"
      class="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-xl bg-neutral-900 p-4 shadow-xl ring-1 ring-neutral-800"
    >
      <div class="flex items-center gap-3">
        <!-- Icon -->
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10">
          <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 text-success" />
        </div>

        <!-- Content -->
        <div class="flex-1">
          <h4 class="text-sm font-medium text-white">
            Update Available
          </h4>
          <p class="text-xs text-neutral-400">
            A new version of FlyLive is ready
          </p>
        </div>

        <!-- Actions -->
        <div class="flex gap-2">
          <UButton
            size="sm"
            color="success"
            @click="handleRefresh"
          >
            Refresh
          </UButton>
          <UButton
            size="sm"
            variant="ghost"
            color="neutral"
            icon="i-heroicons-x-mark"
            @click="handleDismiss"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>
