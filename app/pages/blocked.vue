<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
import {
  BLOCKED_FALLBACK_PATH,
  BLOCKED_NOW_TICK_MS,
  BLOCKED_SUPPORT_EMAIL,
} from '~/constants/blocked'
import { blockedScreenCopy } from '~/utils/blocked/blocked-screen-copy'
// ========================================
// Blocked Page (account-bans 03)
// ========================================
// Shown when the backend answers "you are blocked" (account / IP / device).
// Binding only: all state and actions come from useBlockedState(), all wording
// from blockedScreenCopy(). The clock ticks so "Try again" appears the moment a
// timed block ends, without the user reloading.

definePageMeta({
  layout: false,
})

// ========================================
// State
// ========================================

const now = ref(new Date())
let tickTimer: ReturnType<typeof setInterval> | null = null

// ========================================
// Composables
// ========================================

const { blockInfo, isSignedIn, isRetrying, tryAgain, signOut, backToLogin } = useBlockedState()

const copy = computed(() =>
  blockInfo.value ? blockedScreenCopy(blockInfo.value, now.value, isSignedIn.value) : null,
)

useHead({
  title: computed(() => `${copy.value?.title ?? 'Blocked'} — FlyLive`),
  meta: [
    { name: 'robots', content: 'noindex' },
  ],
})

// ========================================
// Handlers
// ========================================

function handleTryAgain() {
  void tryAgain()
}

function handleSignOut() {
  void signOut()
}

function handleBackToLogin() {
  void backToLogin()
}

onMounted(() => {
  // Nothing to show (direct visit, stale bookmark) → leave.
  if (!blockInfo.value) {
    void navigateTo(BLOCKED_FALLBACK_PATH, { replace: true })
    return
  }

  now.value = new Date()
  tickTimer = setInterval(() => {
    now.value = new Date()
  }, BLOCKED_NOW_TICK_MS)
})

onUnmounted(() => {
  if (tickTimer !== null) {
    clearInterval(tickTimer)
    tickTimer = null
  }
})
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4">
    <template v-if="copy">
      <!-- Logo -->
      <div class="mb-8">
        <NuxtImg
          :src="ASSETS.LOGO_XL"
          alt="FlyLive"
          class="size-48"
          width="96"
          height="96"
        />
      </div>

      <!-- Icon -->
      <div class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-900/30">
        <UIcon name="i-heroicons-no-symbol" class="h-10 w-10 text-red-400" />
      </div>

      <!-- Title -->
      <h1 class="mb-2 text-xl font-semibold text-white">
        {{ copy.title }}
      </h1>

      <!-- Body -->
      <p class="mb-4 max-w-xs text-center text-sm text-neutral-400">
        {{ copy.body }}
      </p>

      <!-- Reason (account blocks only) -->
      <div v-if="copy.reason" class="mb-4 max-w-xs rounded-lg bg-neutral-900 px-4 py-3 text-center">
        <p class="text-xs text-neutral-500">
          Reason
        </p>
        <p class="mt-1 text-sm font-medium text-neutral-300">
          {{ copy.reason }}
        </p>
      </div>

      <!-- Time left (timed block, not ended yet) -->
      <div v-if="copy.timeLeft" class="mb-6 rounded-lg bg-neutral-900 px-4 py-3 text-center">
        <p class="text-sm font-medium text-neutral-300">
          {{ copy.timeLeft }}
        </p>
      </div>

      <!-- Permanent label -->
      <div v-else-if="copy.isPermanent" class="mb-6 rounded-lg bg-neutral-900 px-4 py-3 text-center">
        <p class="text-sm font-medium text-red-400">
          This block is permanent.
        </p>
      </div>

      <!-- Support -->
      <div class="mb-8 text-center">
        <p class="text-xs text-neutral-500">
          If you believe this is an error, please contact support:
        </p>
        <a
          :href="`mailto:${BLOCKED_SUPPORT_EMAIL}`"
          class="mt-1 inline-block text-sm font-medium text-primary-400 hover:text-primary-300"
        >
          {{ BLOCKED_SUPPORT_EMAIL }}
        </a>
      </div>

      <!-- Actions -->
      <div class="flex w-full max-w-xs flex-col gap-3">
        <UButton
          v-if="copy.showTryAgain"
          size="lg"
          color="primary"
          class="w-full justify-center"
          :loading="isRetrying"
          @click="handleTryAgain"
        >
          Try again
        </UButton>

        <UButton
          v-if="copy.action === 'sign-out'"
          size="lg"
          color="neutral"
          variant="outline"
          class="w-full justify-center"
          :disabled="isRetrying"
          @click="handleSignOut"
        >
          Sign out
        </UButton>
        <UButton
          v-else
          size="lg"
          color="neutral"
          variant="outline"
          class="w-full justify-center"
          :disabled="isRetrying"
          @click="handleBackToLogin"
        >
          Back to login
        </UButton>
      </div>
    </template>
  </div>
</template>
