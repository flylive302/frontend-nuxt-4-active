<script setup lang="ts">
// ========================================
// Offline Banner (frontend-offline-resilience/01 — ADR 0026)
// ========================================
//
// INTENT layer: shows the connectivity state and offers a manual retry.
//
// ⛔ NON-BLOCKING BY DESIGN. This must never become a full-screen takeover, an
// overlay that swallows pointer events, or a redirect. FlyLive is a live audio
// app: a user in a room who loses signal for four seconds keeps their room, and
// the socket reconnect path in `useRoomLifecycle` heals it. The banner only
// tells them why things stalled.
//
// Pinned to the TOP: the bottom edge already carries the minimized room player,
// the download progress bar and the storage banner.

const route = useRoute()
const store = useConnectivityStore()
const { isOffline, isProbing } = storeToRefs(store)
const { retryNow } = useConnectivityMonitor()

// ========================================
// Computed
// ========================================

// `/offline` is already a full-screen statement of the same fact, with its own
// Retry — a banner on top of it would be the message twice.
const isVisible = computed(() => isOffline.value && route.path !== '/offline')

// ========================================
// Handlers
// ========================================

async function handleRetry(): Promise<void> {
  await retryNow()
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0 -translate-y-full"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-full"
  >
    <div
      v-if="isVisible"
      class="safe-area-top fixed inset-x-0 top-0 z-50 bg-neutral-900/95 backdrop-blur"
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        class="flex w-full items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-neutral-200"
        :disabled="isProbing"
        @click="handleRetry"
      >
        <UIcon
          :name="isProbing ? 'i-heroicons-arrow-path' : 'i-heroicons-wifi'"
          class="size-4 shrink-0 text-amber-400"
          :class="{ 'animate-spin': isProbing }"
        />
        <span>{{ isProbing ? 'Reconnecting…' : "You're offline" }}</span>
        <span v-if="!isProbing" class="text-neutral-500">— tap to retry</span>
      </button>
    </div>
  </Transition>
</template>
