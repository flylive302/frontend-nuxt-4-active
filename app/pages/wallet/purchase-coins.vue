<script setup lang="ts">
import { ref } from 'vue'
import type { CoinRequest } from '~/types/coin-request'
import {formatCurrency} from "~/utils/currency";

definePageMeta({
  layout: 'alt',
  middleware: 'auth'
})

// ========================================
// State
// ========================================
const hasPendingRequest = ref(false)
const isLoadingRequests = ref(true)
const coinRequestsListRef = ref<{ addRequest: (r: CoinRequest) => void } | null>(null)

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

const authStore = useAuthStore();
onMounted(() => {
  authStore.fetchUser();
})
</script>

<template>
  <main>
    <NavAlt color="tertiary" back-to="/profile" :linked="true" first-link="/wallet/purchase-coins" second-link="/wallet/exchange-diamonds">
      <template #first-link-text>Coins</template>
      <template #second-link-text>Diamonds</template>
    </NavAlt>
    <AltHero image-src="/siteAssets/alt-hero/tertiary.webp">
      <div class="flex p-2 bg-linear-to-br to-tertiary/30">
        <div class="flex flex-col justify-end">
          <NuxtImg
              provider="imagekit"
              src="/siteAssets/props/prop-recharge.webp"
              :modifiers="{ effectSharpen: 1 }"
              class="transform -scale-x-100 w-20"
          />
        </div>
        <div class="flex-auto flex flex-col justify-between items-center">
          <NuxtImg
              provider="imagekit"
              src="/siteAssets/props/flylive_coin.webp"
              density="3x"
              class="mb-2 w-44"
              :modifiers="{ effectSharpen: 1 }"
          />
          <UButton to="/wallet/transaction-history" color="tertiary" icon="i-lucide-coins" trailing-icon="i-lucide-history">
            {{ formatCurrency(authStore.user?.coins) }}
          </UButton>
        </div>
        <div class="flex flex-col justify-end">
          <NuxtImg
              provider="imagekit"
              src="/siteAssets/props/prop-recharge.webp"
              class="w-20"
              :modifiers="{ effectSharpen: 1 }"
          />
        </div>
      </div>
    </AltHero>
    <div class="h-[12vw]" />

    <section class="px-3">
      <h2 class="text-lg font-bold"><span class="text-success">Buy</span> Coins From the Resellers</h2>
      <p class="text-sm text-muted mb-4">Keep your default reseller or select a Different One</p>
      <ChooseDefaultReseller color="tertiary" />

      <!-- Form - Hidden when pending request exists -->
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <FromConversionRequest v-if="!hasPendingRequest && !isLoadingRequests" class="mt-4" @success="handleRequestCreated" />
      </Transition>

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
      <CoinRequestsList ref="coinRequestsListRef" color="tertiary" @has-pending="handleHasPending" />

      <USeparator color="tertiary" class="my-6" label="OR" />
      <h2 class="text-lg font-bold mb-2">Purchase Coins By Card:</h2>
      <div class="flex flex-col gap-3">
        <ListItemPurchaseCoins />
        <ListItemPurchaseCoins :coins="3200" :price="1.55" />
        <ListItemPurchaseCoins :coins="6400" :price="3.25" />
      </div>
    </section>
    <div class="h-14" />
  </main>
</template>