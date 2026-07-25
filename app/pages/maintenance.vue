<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
import { MAINTENANCE_SUPPORT_EMAIL } from '~/constants/maintenance'
// ========================================
// Maintenance Wall Page
// ========================================
// Terminal state for a bundle built with NUXT_PUBLIC_MAINTENANCE_MODE=true.
// Every other route redirects here (middleware/maintenance.global.ts).
//
// Deliberately inert: no API calls, no socket, no store reads, no links out.
// It has to render correctly with Laravel and MSAB fully down, and identically
// inside the Capacitor shell (no Nitro server there — nothing here needs one).

definePageMeta({
  layout: false,
})

useHead({
  title: 'Down for Maintenance — FlyLive',
  meta: [
    { name: 'robots', content: 'noindex' },
  ],
})

// ========================================
// Handlers
// ========================================

/**
 * Full reload. On web this pulls the newly deployed bundle once the window is
 * over, which is the fastest way back in for a user sitting on this page.
 * In the native shell the bundle only changes on an OTA + restart, so this is
 * a harmless no-op there rather than a promise we can keep.
 */
function handleRetry() {
  if (import.meta.client) window.location.reload()
}
</script>

<template>
  <div class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-neutral-950 px-6 py-12">
    <!-- Ambient glow — purely decorative, sits behind everything -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-primary-500/20 blur-3xl"
    />

    <div class="relative flex w-full max-w-sm flex-col items-center">
      <!-- Logo -->
      <NuxtImg
        :src="ASSETS.LOGO_XL"
        alt="FlyLive"
        class="mb-10 size-32"
        width="128"
        height="128"
      />

      <!-- Pulsing icon -->
      <div class="relative mb-8 flex size-20 items-center justify-center">
        <span class="maintenance-ping absolute inset-0 rounded-full bg-primary-500/20" />
        <span class="relative flex size-20 items-center justify-center rounded-full bg-neutral-900 ring-1 ring-primary-500/30">
          <UIcon name="i-heroicons-wrench-screwdriver" class="size-9 text-primary-400" />
        </span>
      </div>

      <!-- Headline -->
      <h1 class="mb-3 text-center text-2xl font-semibold text-white">
        We'll be right back
      </h1>

      <p class="mb-8 text-center text-sm leading-relaxed text-neutral-400">
        FlyLive is down for scheduled maintenance while we ship some
        improvements. Rooms, chat and your balance are all safe — nothing is
        lost. Please check back shortly.
      </p>

      <!-- Retry -->
      <UButton
        size="lg"
        color="primary"
        icon="i-heroicons-arrow-path"
        class="mb-10 w-full justify-center"
        @click="handleRetry"
      >
        Try Again
      </UButton>

      <!-- Support -->
      <div class="text-center">
        <p class="text-xs text-neutral-500">
          Need help in the meantime?
        </p>
        <a
          :href="`mailto:${MAINTENANCE_SUPPORT_EMAIL}`"
          class="mt-1 inline-block text-sm font-medium text-primary-400 hover:text-primary-300"
        >
          {{ MAINTENANCE_SUPPORT_EMAIL }}
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Slower, softer than Tailwind's animate-ping — this sits on screen for minutes,
   not as a momentary attention cue. */
@keyframes maintenance-ping {
  0% {
    transform: scale(1);
    opacity: 0.6;
  }
  100% {
    transform: scale(1.9);
    opacity: 0;
  }
}

.maintenance-ping {
  animation: maintenance-ping 2.6s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@media (prefers-reduced-motion: reduce) {
  .maintenance-ping {
    animation: none;
  }
}
</style>
