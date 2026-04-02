<script setup lang="ts">
// ========================================
// Offline Page
// ========================================

definePageMeta({
  layout: false,
})

// ========================================
// State
// ========================================

const isRetrying = ref(false)
const { probeHealth } = useConnectivityProbe()

// ========================================
// Actions
// ========================================

async function handleRetry(): Promise<void> {
  isRetrying.value = true

  const ok = await probeHealth()
  if (ok) {
    navigateTo('/')
  } else {
    isRetrying.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4">
    <!-- Logo -->
    <div class="mb-8">
      <NuxtImg
        src="/logos/flylive-logo-icon.webp"
        alt="FlyLive"
        class="h-24 w-24 animate-pulse"
        width="96"
        height="96"
      />
    </div>

    <!-- Icon -->
    <div class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-neutral-900">
      <UIcon name="i-heroicons-wifi" class="h-10 w-10 text-neutral-500" />
    </div>

    <!-- Title -->
    <h1 class="mb-2 text-xl font-semibold text-white">
      You're Offline
    </h1>

    <!-- Description -->
    <p class="mb-8 max-w-xs text-center text-sm text-neutral-400">
      Check your internet connection and try again. Your cached content is still available.
    </p>

    <!-- Retry Button -->
    <UButton
      size="lg"
      color="primary"
      :loading="isRetrying"
      @click="handleRetry"
    >
      <UIcon name="i-heroicons-arrow-path" class="mr-2 h-4 w-4" />
      Retry Connection
    </UButton>

    <!-- Future: Mini-game placeholder -->
    <p class="mt-12 text-xs text-neutral-600">
      <!-- TODO: Add space-shooter mini-game here -->
    </p>
  </div>
</template>
