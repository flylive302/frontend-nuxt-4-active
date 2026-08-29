<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
import { ref, watch } from 'vue'
import type { CoinRequest } from '~/types/economy/coin-request'
import { formatCurrency } from '~/utils/currency'
import { lastCoinRequestUpdate } from '~/events/economy.events'
import { isIosNative } from '~/utils/native-platform'

definePageMeta({
  layout: 'alt',
  middleware: 'auth'
})

// ========================================
// Composables
// ========================================
const authStore = useAuthStore()
// App Store 3.1.1: no coin-request UI on iOS; balance/activity stay visible.
const showCoinRequests = !isIosNative()

// ========================================
// State
// ========================================
const hasPendingRequest = ref(false)
const isLoadingRequests = ref(true)
const coinRequestsListRef = ref<{
  addRequest: (r: CoinRequest) => void
  loadRequests: () => Promise<void>
} | null>(null)

// ========================================
// Event Handlers
// ========================================
function handleHasPending(value: boolean): void {
  hasPendingRequest.value = value
  isLoadingRequests.value = false
}

function handleRequestCreated(request: CoinRequest): void {
  coinRequestsListRef.value?.addRequest(request)
  hasPendingRequest.value = true
}

// ========================================
// Coin Request Status → Refresh List
// ========================================
// When `coin_request.status_changed` fires via socket, refresh the list
// to reflect the updated status (approved/rejected).
watch(lastCoinRequestUpdate, () => {
  coinRequestsListRef.value?.loadRequests()
})
</script>

<template>
  <main>
    <NavAlt color="tertiary" back-to="/profile" :linked="true" first-link="/coins/request" second-link="/coins/exchange">
      <template #first-link-text>Coins</template>
      <template #second-link-text>Diamonds</template>
    </NavAlt>

    <img
      :src="ASSETS.HERO_TERTIARY" width="412" alt=""
      class="min-w-full object-cover rounded-b-4xl shadow-2xl shadow-tertiary/70 animate-[zoom_60s_ease-in-out_infinite]"
    >

    <section class="mx-4 px-3 py-6 backdrop-blur-lg rounded-4xl -mt-34 relative">

      <div class="glowing-border rounded-lg">
        <div class="flex justify-between items-baseline mx-3">
          <h1 class="text-lg font-bold">
            Available Coins:
          </h1>
          <p class="text-2xl font-bold flex justify-center items-center gap-1">
            <UIcon name="i-streamline-ultimate-color-accounting-coins" class="size-6" />
            {{ formatCurrency(authStore.user?.coins) }}
          </p>
        </div>
      </div>

      <NuxtLink to="/coins/activity" class="flex justify-between items-center mt-2">
        <h2 class="text-md font-semibold">Activity History:</h2>
        <UButton icon="i-lucide-history" color="tertiary" variant="soft" class="shadow-xl">Visit</UButton>
      </NuxtLink>

      <template v-if="showCoinRequests">
      <h2 class="text-lg font-bold mt-8"><span class="text-success">Claim your</span> Coins for using the app</h2>
      <p class="text-sm text-muted mb-4">Click the Claim button to request your coins. We'll review your eligibility and automatically add coins to your balance if approved. If rejected, contact support for eligibility details.</p>
      <EconomyChooseDefaultReseller color="tertiary" />

      <!-- Form - Hidden when pending request exists -->
      <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
      >
        <EconomyFromConversionRequest v-if="!hasPendingRequest && !isLoadingRequests" class="mt-4" @success="handleRequestCreated" />
      </Transition>
      </template>
    </section>

    <section v-if="showCoinRequests" class="mx-3">

      <!-- Pending Notice -->
      <UAlert
          v-if="hasPendingRequest && !isLoadingRequests"
          icon="i-lucide-clock"
          color="warning"
          variant="subtle"
          title="Pending Request"
          description="You already have a pending request. Wait for it to be processed before creating a new one."
          class="mt-4"
      />

      <USeparator color="tertiary" class="my-6" />

      <!-- Coin Requests List Component -->
      <EconomyCoinRequestsList ref="coinRequestsListRef" color="tertiary" @has-pending="handleHasPending" />

    </section>
    <div class="h-14" />
  </main>
</template>
