<!-- ~/components/economy/recharge-portal-card.vue -->
<!-- WEB ONLY: how to buy coins on the official recharge site. The caller gates it (`useCoinRequestVisibility().showRechargePortal`) — never render it in a native shell. -->
<script setup lang="ts">
import { computed } from 'vue'
import { useClipboard } from '@vueuse/core'
import { COPY_CONFIRM_MS, RECHARGE_PORTAL_HOST, RECHARGE_PORTAL_URL } from '~/constants/economy/coins-page'

// ========================================
// Props
// ========================================
const props = defineProps<{
  /** The user's FlyLive ID — what the recharge site searches by. Null hides the copy step. */
  signature: string | null
}>()

// ========================================
// Composables
// ========================================
const source = computed(() => props.signature ?? '')
const { copy, copied, isSupported } = useClipboard({ source, copiedDuring: COPY_CONFIRM_MS })
</script>

<template>
  <section class="portal-card rounded-3xl p-5 ring-1 ring-tertiary/25">
    <h2 class="text-xl font-bold text-white">Buy coins</h2>
    <p class="mt-1 text-sm text-tertiary-100/80">
      Top up on our official recharge site. Your coins are sent to your FlyLive account.
    </p>

    <ol class="mt-5 space-y-4">
      <li v-if="props.signature" class="flex gap-3">
        <span class="step-dot" aria-hidden="true">1</span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-white">Copy your FlyLive ID</p>
          <div class="mt-2 flex items-center gap-2">
            <span class="min-w-0 truncate rounded-full bg-tertiary/15 px-3 py-2 text-sm font-semibold tabular-nums text-tertiary-100 ring-1 ring-tertiary/30">
              {{ props.signature }}
            </span>
            <UButton
              v-if="isSupported"
              :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copied ? 'success' : 'tertiary'"
              variant="soft"
              size="lg"
              class="min-h-11 shrink-0"
              :aria-label="copied ? 'FlyLive ID copied' : 'Copy your FlyLive ID'"
              @click="copy()"
            >
              {{ copied ? 'Copied' : 'Copy' }}
            </UButton>
          </div>
        </div>
      </li>

      <li class="flex gap-3">
        <span class="step-dot" aria-hidden="true">{{ props.signature ? 2 : 1 }}</span>
        <p class="pt-0.5 text-sm text-neutral-200">
          <span class="font-semibold text-white">Open {{ RECHARGE_PORTAL_HOST }}</span>
          and search for your ID.
        </p>
      </li>

      <li class="flex gap-3">
        <span class="step-dot" aria-hidden="true">{{ props.signature ? 3 : 2 }}</span>
        <p class="pt-0.5 text-sm text-neutral-200">
          <span class="font-semibold text-white">Pick an amount and pay.</span>
          Coins show up in your balance here.
        </p>
      </li>
    </ol>

    <UButton
      :to="RECHARGE_PORTAL_URL"
      target="_blank"
      rel="noopener"
      external
      color="tertiary"
      variant="solid"
      size="xl"
      trailing-icon="i-lucide-arrow-up-right"
      class="portal-cta mt-6 w-full justify-center font-bold"
    >
      Open recharge site
    </UButton>
  </section>
</template>

<style scoped>
.portal-card {
  background: color-mix(in srgb, var(--ui-color-neutral-900) 85%, transparent);
}

.step-dot {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--ui-color-tertiary-200);
  background: color-mix(in srgb, var(--ui-color-tertiary-500) 18%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ui-color-tertiary-500) 40%, transparent);
}

/* The arrow leans toward where the link goes. */
.portal-cta :deep(.iconify) {
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.portal-cta:hover :deep(.iconify),
.portal-cta:focus-visible :deep(.iconify) {
  transform: translate(2px, -2px);
}

@media (prefers-reduced-motion: reduce) {
  .portal-cta :deep(.iconify) {
    transition: none;
  }
}
</style>
