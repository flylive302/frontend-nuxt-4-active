<!-- ~/components/economy/coin-balance-card.vue -->
<!-- Coins page header: the user's coin balance (counts up on open and on change) + a link to the activity history. Presentational. -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { TransitionPresets, usePreferredReducedMotion, useTransition } from '@vueuse/core'
import { ASSETS } from '~/constants/assets'
import { BALANCE_COUNT_UP_MS } from '~/constants/economy/coins-page'

// ========================================
// Props
// ========================================
const props = defineProps<{
  coins: number
}>()

// ========================================
// State
// ========================================
// Starts at 0 so the first paint counts up to the real balance; later changes
// (server sync, a purchase landing) animate from the old value — the motion is
// the "your balance just changed" feedback.
const target = ref(0)
const reducedMotion = usePreferredReducedMotion()
const shown = useTransition(target, {
  duration: BALANCE_COUNT_UP_MS,
  transition: TransitionPresets.easeOutExpo,
  disabled: computed(() => reducedMotion.value === 'reduce'),
})

const display = computed(() => Math.round(shown.value).toLocaleString('en-US'))

// ========================================
// Handlers
// ========================================
onMounted(() => {
  target.value = props.coins
})

watch(() => props.coins, (value) => {
  target.value = value
})
</script>

<template>
  <section class="balance-card relative overflow-hidden rounded-3xl p-5 ring-1 ring-tertiary/25">
    <div class="flex items-center gap-4">
      <img
        :src="ASSETS.COIN_ICON_LARGE"
        width="72"
        height="72"
        alt=""
        fetchpriority="high"
        decoding="async"
        class="coin-pop size-18 shrink-0 drop-shadow-[0_6px_14px_rgb(0_0_0/0.45)]"
      >
      <div class="min-w-0 flex-1">
        <h1 class="text-sm font-medium text-tertiary-200">My coins</h1>
        <p
          class="mt-0.5 text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight text-white truncate"
          :aria-label="`${props.coins.toLocaleString('en-US')} coins`"
        >
          {{ display }}
        </p>
      </div>
    </div>

    <UButton
      to="/coins/activity"
      icon="i-lucide-history"
      color="tertiary"
      variant="soft"
      size="md"
      class="mt-4 min-h-11 w-full justify-center"
    >
      Activity history
    </UButton>
  </section>
</template>

<style scoped>
.balance-card {
  background:
    radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--ui-color-tertiary-500) 22%, transparent), transparent 60%),
    color-mix(in srgb, var(--ui-color-neutral-900) 85%, transparent);
}

/* One authored moment: the coin settles in as the number counts up. */
.coin-pop {
  animation: coin-pop 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes coin-pop {
  from {
    opacity: 0;
    transform: scale(0.6) rotate(-18deg);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .coin-pop {
    animation: none;
  }
}
</style>
