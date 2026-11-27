<!-- ~/components/economy/buy-coins-panel.vue -->
<!-- Native "Buy Coins" panel — binding only. Pipeline lives in useCoinPurchase. -->
<script setup lang="ts">
import { onMounted } from 'vue'
import { ASSETS } from '~/constants/assets'
import { useCoinPurchase } from '~/composables/economy/useCoinPurchase'

const store = useCoinPacksStore()
// The store's `transactionUpdated` listener is app-wide (plugins/iap-restore.client.ts), not per panel.
const { load, buy, restorePending } = useCoinPurchase()

// Sole owner of the catalog load on /coins/request — the page no longer calls
// `load()` too (that double-fetched and flashed the skeleton twice). The page
// mounts this panel unconditionally on native, so `catalogDisabled` (which
// gates the Android claim flow) still resolves. Balance sync is the page's job.
onMounted(async () => {
  await load()
  // Silent safety net — the app-level plugin already restores on boot/login/
  // foreground; this just catches the panel being opened without one of
  // those triggers having fired yet. Never nags with "nothing to restore".
  await restorePending('auto')
})
</script>

<template>
  <section v-if="store.status !== 'unavailable'">
    <h2 class="mb-3 text-xl font-bold text-white">Buy coins</h2>

    <div v-if="store.status === 'loading' || store.status === 'idle'" class="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-busy="true">
      <USkeleton v-for="n in 6" :key="n" class="h-36 rounded-2xl" />
    </div>

    <template v-else>
      <UAlert
        v-if="store.status === 'pending-store'"
        color="info"
        variant="soft"
        icon="i-lucide-clock"
        title="Waiting for approval…"
        class="mb-3"
      />
      <UAlert
        v-else-if="store.status === 'success'"
        color="success"
        variant="soft"
        icon="i-lucide-check-circle"
        title="Purchase complete"
        class="mb-3"
      />
      <UAlert
        v-else-if="store.status === 'failed' && store.lastError"
        color="error"
        variant="soft"
        icon="i-lucide-alert-circle"
        :title="store.lastError"
        class="mb-3"
      />

      <ul v-if="store.packsWithPrices.length > 0" class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <li
          v-for="({ pack, product }, index) in store.packsWithPrices"
          :key="pack.id"
          class="pack-enter"
          :style="{ '--i': index }"
        >
          <button
            type="button"
            class="pack group flex h-full w-full flex-col items-center gap-2 rounded-2xl bg-neutral-900/85 px-3 pt-4 pb-3 ring-1 ring-tertiary/20 transition-[transform,box-shadow] duration-200 ease-out hover:ring-tertiary/50 hover:shadow-[0_10px_24px_-12px_var(--ui-color-tertiary-500)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tertiary"
            :disabled="store.status === 'purchasing'"
            :aria-label="`Buy ${pack.coins.toLocaleString('en-US')} coins for ${product.priceString}`"
            @click="buy(pack.product_id)"
          >
            <img :src="ASSETS.COIN_ICON" width="40" height="40" alt="" decoding="async" class="size-10">
            <span class="text-2xl font-extrabold tabular-nums leading-none text-white">
              {{ pack.coins.toLocaleString('en-US') }}
            </span>
            <span class="text-xs text-neutral-400 line-clamp-1">{{ pack.name }}</span>
            <span class="mt-1 flex h-9 w-full items-center justify-center rounded-full bg-tertiary text-sm font-bold text-inverted">
              <UIcon
                v-if="store.status === 'purchasing' && store.activeProductId === pack.product_id"
                name="i-lucide-loader-2"
                class="size-5 animate-spin"
              />
              <template v-else>{{ product.priceString }}</template>
            </span>
          </button>
        </li>
      </ul>

      <p v-else-if="store.status !== 'failed'" class="rounded-2xl bg-neutral-900/85 p-4 text-sm text-neutral-300 ring-1 ring-white/10">
        No coin packs are available right now. Please try again later.
      </p>

      <UButton
        variant="link"
        color="tertiary"
        size="sm"
        class="mt-2 min-h-11"
        :loading="store.isRestoring"
        :disabled="store.status === 'purchasing' || store.isRestoring"
        @click="restorePending('manual')"
      >
        Restore purchases
      </UButton>
    </template>
  </section>
</template>

<style scoped>
/* Packs rise in one after another — a short cascade, from an already-visible state. */
.pack-enter {
  animation: pack-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--i, 0) * 45ms);
}

@keyframes pack-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pack-enter {
    animation: none;
  }
  .pack {
    transition: none;
  }
}
</style>
