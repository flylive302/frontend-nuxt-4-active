<!-- ~/components/economy/coin-claim-section.vue -->
<!-- Reseller "claim coins" flow (form + pending notice + request list). ANDROID FALLBACK ONLY — the caller gates it with `useCoinRequestVisibility().showCoinRequests` and mounts it lazily so web/iOS bundles never load it. -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import type { CoinRequest } from '~/types/economy/coin-request'
import { lastCoinRequestUpdate } from '~/events/economy.events'

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
// Handlers
// ========================================
function handleHasPending(value: boolean): void {
  hasPendingRequest.value = value
  isLoadingRequests.value = false
}

function handleRequestCreated(request: CoinRequest): void {
  coinRequestsListRef.value?.addRequest(request)
  hasPendingRequest.value = true
}

// When `coin_request.status_changed` fires via socket, refresh the list
// to reflect the updated status (approved/rejected).
watch(lastCoinRequestUpdate, () => {
  coinRequestsListRef.value?.loadRequests()
})
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="rounded-3xl bg-neutral-900/85 p-5 ring-1 ring-tertiary/25">
      <h2 class="text-xl font-bold text-white"><span class="text-success">Claim your</span> Coins for using the app</h2>
      <p class="mt-1 mb-4 text-sm text-neutral-300">Click the Claim button to request your coins. We'll review your eligibility and automatically add coins to your balance if approved. If rejected, contact support for eligibility details.</p>
      <EconomyChooseDefaultReseller color="tertiary" />

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
    </div>

    <UAlert
      v-if="hasPendingRequest && !isLoadingRequests"
      icon="i-lucide-clock"
      color="warning"
      variant="subtle"
      title="Pending Request"
      description="You already have a pending request. Wait for it to be processed before creating a new one."
    />

    <EconomyCoinRequestsList ref="coinRequestsListRef" color="tertiary" @has-pending="handleHasPending" />
  </section>
</template>
