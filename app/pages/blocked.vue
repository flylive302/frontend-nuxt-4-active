<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
// ========================================
// Account Suspended Page
// ========================================
// Shown when a user is force-disconnected due to account suspension.
// Displays the suspension reason, remaining time (if timed), and
// customer support contact information.

definePageMeta({
  layout: false,
})

useHead({
  title: 'Account Suspended — FlyLive',
  meta: [
    { name: 'robots', content: 'noindex' },
  ],
})

// ========================================
// State
// ========================================

const authStore = useAuthStore()
const suspensionInfo = computed(() => authStore.suspensionInfo)

/** Remaining time label for timed suspensions */
const remainingLabel = computed(() => {
  if (!suspensionInfo.value?.until) return null

  const until = new Date(suspensionInfo.value.until)
  const now = new Date()
  const diffMs = until.getTime() - now.getTime()

  if (diffMs <= 0) return 'Your suspension has expired. Please try logging in.'

  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)

  if (days > 0) return `Approximately ${days} day${days > 1 ? 's' : ''} remaining`
  if (hours > 0) return `Approximately ${hours} hour${hours > 1 ? 's' : ''} remaining`

  const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)))
  return `Approximately ${minutes} minute${minutes > 1 ? 's' : ''} remaining`
})

const isPermanent = computed(
  () => !suspensionInfo.value?.until
)

// ========================================
// Actions
// ========================================

function handleLoginRedirect() {
  authStore.logout()
  navigateTo('/log-in')
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4">
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
      Account Suspended
    </h1>

    <!-- Reason -->
    <p class="mb-4 max-w-xs text-center text-sm text-neutral-400">
      {{ suspensionInfo?.reason || 'Your account has been suspended due to a policy violation.' }}
    </p>

    <!-- Duration (timed suspension) -->
    <div v-if="remainingLabel" class="mb-6 rounded-lg bg-neutral-900 px-4 py-3 text-center">
      <p class="text-xs text-neutral-500">
        {{ isPermanent ? 'Permanent suspension' : 'Suspension duration' }}
      </p>
      <p class="mt-1 text-sm font-medium text-neutral-300">
        {{ remainingLabel }}
      </p>
    </div>

    <!-- Permanent label -->
    <div v-else class="mb-6 rounded-lg bg-neutral-900 px-4 py-3 text-center">
      <p class="text-sm font-medium text-red-400">
        This suspension is permanent.
      </p>
    </div>

    <!-- Support -->
    <div class="mb-8 text-center">
      <p class="text-xs text-neutral-500">
        If you believe this is an error, please contact support:
      </p>
      <a
        href="mailto:support@flylive.app"
        class="mt-1 inline-block text-sm font-medium text-primary-400 hover:text-primary-300"
      >
        support@flylive.app
      </a>
    </div>

    <!-- Login button (for expired timed suspensions) -->
    <UButton
      v-if="remainingLabel?.includes('expired')"
      size="lg"
      color="primary"
      @click="handleLoginRedirect"
    >
      Try Logging In
    </UButton>
  </div>
</template>
