<script setup lang="ts">
// ========================================
// PWA Install Prompt
// ========================================

import { createLogger } from '~/utils/logger'

const log = createLogger('[PWAInstall]')

// ========================================
// State
// ========================================

const isVisible = ref(false)
const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)

// ========================================
// Types
// ========================================

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// ========================================
// Lifecycle
// ========================================

onMounted(() => {
  // Listen for beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

  // Check if already installed
  if (window.matchMedia('(display-mode: standalone)').matches) {
    log.debug('App is already installed')
    return
  }
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
})

// ========================================
// Handlers
// ========================================

function handleBeforeInstallPrompt(e: Event): void {
  // Prevent default browser prompt
  e.preventDefault()

  // Store the event for later
  deferredPrompt.value = e as BeforeInstallPromptEvent

  // Show our custom prompt
  isVisible.value = true

  log.debug('Install prompt captured')
}

async function handleInstall(): Promise<void> {
  if (!deferredPrompt.value) return

  // Show the browser install prompt
  await deferredPrompt.value.prompt()

  // Wait for user choice
  const { outcome } = await deferredPrompt.value.userChoice

  log.debug('Install outcome:', outcome)

  // Clear the prompt
  deferredPrompt.value = null
  isVisible.value = false
}

function handleDismiss(): void {
  isVisible.value = false
  // Don't clear deferredPrompt so user can install later
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
      class="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-xl bg-gradient-to-r from-primary/20 to-secondary/20 p-4 shadow-xl ring-1 ring-primary/30"
    >
      <div class="flex items-center gap-3">
        <!-- Icon -->
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/20">
          <NuxtImg
            src="/logos/flylive-logo-icon.webp"
            alt="FlyLive"
            class="h-8 w-8"
            width="32"
            height="32"
          />
        </div>

        <!-- Content -->
        <div class="flex-1">
          <h4 class="text-sm font-medium text-white">
            Install FlyLive
          </h4>
          <p class="text-xs text-neutral-400">
            Get the best experience with our app
          </p>
        </div>

        <!-- Actions -->
        <div class="flex gap-2">
          <UButton
            size="sm"
            color="primary"
            @click="handleInstall"
          >
            Install
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
