<script setup lang="ts">
/**
 * "Auction alerts" bell toggle at the top of the auction tab. On by default; off mutes
 * the global auction pushes only (reminders, bid pushes). Pushes about the viewer's
 * own coins and Signature are never muted. The whole row is the switch (44 px tap target).
 */
import { usePrettyIdAuctionAlerts } from '~/composables/pretty-id/usePrettyIdAuctionAlerts'
import { usePrettyIdAuctionAlertsStore } from '~/stores/prettyIdAuctionAlerts'

// Composables
const store = usePrettyIdAuctionAlertsStore()
const { load, setEnabled } = usePrettyIdAuctionAlerts()

// Lifecycle
onMounted(() => {
  void load()
})

// Handlers
function toggle(): void {
  void setEnabled(!store.enabled)
}
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="store.enabled"
    :disabled="store.isSaving"
    class="pid-alerts flex min-h-11 w-full cursor-pointer items-center gap-3 px-2 text-left disabled:opacity-60"
    @click="toggle"
  >
    <UIcon
      :name="store.enabled ? 'i-lucide-bell' : 'i-lucide-bell-off'"
      class="size-5 shrink-0"
      :class="store.enabled ? 'pid-alerts__bell--on' : 'pid-muted'"
      aria-hidden="true"
    />
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="pid-body">Auction alerts</span>
      <span class="pid-body pid-small pid-muted">
        {{ store.enabled ? 'Reminders and bid pushes are on.' : 'Muted. Your own wins and refunds still reach you.' }}
      </span>
    </span>
    <span class="pid-alerts__track" :class="{ 'pid-alerts__track--on': store.enabled }" aria-hidden="true">
      <i class="pid-alerts__thumb" />
    </span>
  </button>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  .pid-alerts__bell--on {
    color: var(--pid-gold);
  }

  .pid-alerts__track {
    position: relative;
    flex: none;
    width: 44px;
    height: 24px;
    border: 1px solid var(--pid-line);
    border-radius: 9999px;
    background: var(--pid-well);
    transition: background-color 0.15s;
  }

  .pid-alerts__track--on {
    border-color: var(--pid-gold-deep);
    background: var(--pid-gold-deep);
  }

  .pid-alerts__thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 9999px;
    background: var(--pid-ink);
    transition: transform 0.15s;
  }

  .pid-alerts__track--on .pid-alerts__thumb {
    transform: translateX(20px);
  }

  @media (prefers-reduced-motion: reduce) {
    .pid-alerts__track,
    .pid-alerts__thumb {
      transition: none;
    }
  }
}
</style>
