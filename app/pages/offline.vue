<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
// ========================================
// Offline Page
// ========================================

// ⚠️ Reached on ONE path only (ADR 0026): a NATIVE cold boot with no network,
// routed here by `plugins/connectivity.client.ts`. A mid-session drop shows the
// non-blocking banner instead — a takeover would eject a user from a live audio
// room over a four-second blip.
//
// On web this page is effectively unreachable and that is correct: ADR 0020
// removed the service worker, so a web cold boot with no network never runs our
// code at all. ⛔ Do not "fix" that by redirecting here on the `offline` event.

definePageMeta({
  layout: false,
})

// ========================================
// State
// ========================================

const isRetrying = ref(false)
const { retryNow } = useConnectivityMonitor()
const { probeHealth } = useConnectivityProbe()
const connectivity = useConnectivityStore()

// ========================================
// Actions
// ========================================

async function handleRetry(): Promise<void> {
  isRetrying.value = true

  // Route through the monitor when it already owns the offline state, so
  // recovery clears the banner and bumps `restoredAt` (which the home feed
  // watches) instead of leaving stale state behind. `probeHealth` alone covers
  // the case where this page was reached without the store ever flipping.
  const ok = connectivity.isOffline ? await retryNow() : await probeHealth()

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
        :src="ASSETS.LOGO_XL"
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
  </div>
</template>
