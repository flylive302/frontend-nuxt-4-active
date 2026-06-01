<script setup lang="ts">
// ========================================
// Storage Permission Banner
// ========================================

import { createLogger } from '~/utils/logger'

const log = createLogger('[StorageBanner]')

// ========================================
// Constants
// ========================================

const STORAGE_BANNER_KEY = 'flylive_storage_permission_asked'

// ========================================
// State
// ========================================

const isVisible = ref(false)
const isRequesting = ref(false)

// ========================================
// Lifecycle
// ========================================

onMounted(async () => {
  // Check if we already asked the user
  const alreadyAsked = localStorage.getItem(STORAGE_BANNER_KEY)
  if (alreadyAsked) {
    return
  }

  // Only show if storage API is available and not already persisted
  if (!navigator.storage?.persist || !navigator.storage?.persisted) {
    return
  }

  const isPersisted = await navigator.storage.persisted()
  if (!isPersisted) {
    isVisible.value = true
  }
})

// ========================================
// Actions
// ========================================

async function handleAllow(): Promise<void> {
  isRequesting.value = true

  try {
    const granted = await navigator.storage.persist()
    // Store the result regardless of outcome
    localStorage.setItem(STORAGE_BANNER_KEY, granted ? 'granted' : 'denied')
  } catch (e) {
    log.warn('Failed to request storage persistence', e)
    localStorage.setItem(STORAGE_BANNER_KEY, 'error')
  } finally {
    isRequesting.value = false
    isVisible.value = false
  }
}

function handleDismiss(): void {
  isVisible.value = false
  // Remember that user dismissed the banner
  localStorage.setItem(STORAGE_BANNER_KEY, 'dismissed')
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
      <div class="flex items-start gap-3">
        <!-- Icon -->
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <UIcon name="i-heroicons-cloud-arrow-down" class="h-5 w-5 text-primary" />
        </div>

        <!-- Content -->
        <div class="flex-1">
          <h4 class="text-sm font-medium text-white">
            Keep data for offline use?
          </h4>
          <p class="mt-1 text-xs text-neutral-400">
            Allow FlyLive to store data permanently for faster loading and offline access.
          </p>

          <!-- Actions -->
          <div class="mt-3 flex gap-2">
            <UButton
              size="xs"
              color="primary"
              :loading="isRequesting"
              @click="handleAllow"
            >
              Allow
            </UButton>
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              @click="handleDismiss"
            >
              Not Now
            </UButton>
          </div>
        </div>

        <!-- Close -->
        <button
          class="text-neutral-500 hover:text-neutral-300"
          aria-label="Dismiss"
          @click="handleDismiss"
        >
          <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
        </button>
      </div>
    </div>
  </Transition>
</template>
