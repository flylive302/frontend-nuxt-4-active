<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useDocumentVisibility } from '@vueuse/core'
import { storeFor } from '~/utils/native-platform'
import { useCoinRequestVisibility } from '~/composables/economy/useCoinRequestVisibility'

definePageMeta({
  layout: 'alt',
  middleware: 'auth'
})

// ========================================
// Constants
// ========================================
// Platform never changes at runtime — read the bridge once.
const hasNativeStore = storeFor() !== null

// ========================================
// Composables
// ========================================
const balanceStore = useBalanceStore()
const authStore = useAuthStore()
// Web: recharge-portal link, no coin-request UI. iOS: in-store packs only
// (App Store 3.1.1). Android: in-store packs; the reseller claim flow appears
// only once in-store purchase is confirmed impossible — fails closed.
const { showCoinRequests, showRechargePortal } = useCoinRequestVisibility()
const { syncUser } = useUserSync()

// ========================================
// Data Load
// ========================================
// The native catalog load is owned by `EconomyBuyCoinsPanel` (mounted
// unconditionally on native below), which also resolves `catalogDisabled`.
onMounted(() => {
  // balance is in-memory (lucky-tap-balance-store); refresh from server on open so a money page never shows a stale number.
  void syncUser()
})

// Web: the recharge site opens in a new tab. When the user comes back, re-sync
// so coins they just bought show — the `balance.updated` socket push is
// at-most-once and may have been missed.
if (showRechargePortal) {
  const visibility = useDocumentVisibility()
  watch(visibility, (state) => {
    if (state === 'visible') void syncUser()
  })
}
</script>

<template>
  <main class="coins-page min-h-dvh safe-area-bottom">
    <NavAlt spacer color="tertiary" back-to="/profile" :linked="true" first-link="/coins/request" second-link="/coins/exchange">
      <template #first-link-text>Coins</template>
      <template #second-link-text>Diamonds</template>
    </NavAlt>

    <div class="mx-auto flex max-w-xl flex-col gap-6 px-4 pt-14 pb-14">
      <EconomyCoinBalanceCard :coins="balanceStore.coinsNumber" />

      <EconomyRechargePortalCard
        v-if="showRechargePortal"
        :signature="authStore.user?.signature || null"
      />

      <EconomyBuyCoinsPanel v-if="hasNativeStore" />

      <LazyEconomyCoinClaimSection v-if="showCoinRequests" />
    </div>
  </main>
</template>

<style scoped>
/* Replaces the old hero photo: a static amber wash behind the header, no image download. */
.coins-page {
  background: radial-gradient(
    110% 55% at 50% 0%,
    color-mix(in srgb, var(--ui-color-tertiary-500) 16%, transparent),
    transparent 70%
  );
}
</style>
