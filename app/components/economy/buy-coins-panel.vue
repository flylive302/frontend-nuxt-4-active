<!-- ~/components/economy/buy-coins-panel.vue -->
<!-- Native "Buy Coins" panel — binding only. Pipeline lives in useCoinPurchase. -->
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { formatCurrency } from '~/utils/currency'
import { useCoinPurchase } from '~/composables/economy/useCoinPurchase'

const store = useCoinPacksStore()
const { load, buy, restorePending, start } = useCoinPurchase()

let stop: (() => void) | null = null

onMounted(async () => {
  stop = start()
  await load()
  await restorePending()
})

onUnmounted(() => {
  stop?.()
})
</script>

<template>
  <section v-if="store.status !== 'unavailable'">
    <h2 class="text-lg font-bold mb-3"><span class="text-success">Buy</span> Coins</h2>

    <div v-if="store.status === 'loading' || store.status === 'idle'" class="grid grid-cols-2 gap-3">
      <USkeleton v-for="n in 4" :key="n" class="h-24 rounded-xl" />
    </div>

    <template v-else>
      <UAlert
        v-if="store.status === 'pending-store'"
        color="info"
        variant="soft"
        icon="i-lucide-clock"
        title="Waiting for the App Store to confirm…"
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

      <div v-if="store.packsWithPrices.length > 0" class="grid grid-cols-2 gap-3">
        <button
          v-for="{ pack, product } in store.packsWithPrices"
          :key="pack.id"
          type="button"
          class="flex flex-col items-center gap-1 rounded-xl border border-tertiary/30 p-4 disabled:opacity-50"
          :disabled="store.status === 'purchasing'"
          @click="buy(pack.product_id)"
        >
          <UIcon
            v-if="store.status === 'purchasing' && store.activeProductId === pack.product_id"
            name="i-lucide-loader-2"
            class="size-6 animate-spin"
          />
          <template v-else>
            <UIcon name="i-streamline-ultimate-color-accounting-coins" class="size-6" />
            <span class="font-semibold">{{ formatCurrency(pack.coins) }}</span>
            <span class="text-sm text-muted">{{ pack.name }}</span>
            <span class="font-bold">{{ product.priceString }}</span>
          </template>
        </button>
      </div>

      <UButton
        variant="link"
        color="tertiary"
        size="sm"
        class="mt-2"
        :disabled="store.status === 'purchasing'"
        @click="restorePending()"
      >
        Restore purchases
      </UButton>
    </template>
  </section>
</template>
