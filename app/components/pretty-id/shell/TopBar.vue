<script setup lang="ts">
/**
 * Sticky top chrome of every Pretty ID page: back button and the user's real
 * coin balance (the app's balance store, not the event payload). It floats over
 * the hero on a fading violet scrim, so the hero pulls itself up underneath it.
 */
import { formatCoins } from '~/utils/currency'
import { useBalanceStore } from '~/stores/balance'

const props = defineProps<{
  /**
   * Fixed destination for the back button (tab pages leave the event).
   * Omit on sub-pages: back then pops history.
   */
  backTo?: string
}>()

const balanceStore = useBalanceStore()
const { goBack } = usePrettyIdBack()

const coinsLabel = computed(() => formatCoins(balanceStore.coinsNumber))

function onBack(): void {
  if (props.backTo) {
    void navigateTo(props.backTo)
    return
  }
  goBack()
}
</script>

<template>
  <header class="pid-topbar safe-area-top">
    <div class="flex items-center gap-2 px-2.5 py-2">
      <button type="button" class="pid-topbar__icon" aria-label="Back" @click="onBack">
        <UIcon name="i-lucide-chevron-left" class="size-5" />
      </button>

      <div class="pid-topbar__coins" aria-label="Coin balance">
        <i class="pid-topbar__coin" aria-hidden="true" />
        <span class="pid-num pid-gold">{{ coinsLabel }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  .pid-topbar {
    position: sticky;
    top: 0;
    z-index: 20;
    background: linear-gradient(#1a0828ee, #1a082800);
  }

  .pid-topbar__icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 38px;
    height: 38px;
    border: 1.5px solid var(--pid-gold-deep);
    border-radius: 50%;
    background: #2a1240cc;
    color: var(--pid-gold);
    cursor: pointer;
  }

  .pid-topbar__icon:focus-visible {
    outline: 2px solid var(--pid-gold);
    outline-offset: 2px;
  }

  .pid-topbar__coins {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    padding: 6px 12px;
    border: 1.5px solid var(--pid-gold-deep);
    border-radius: 20px;
    background: #2a1240cc;
    font-size: 13px;
    white-space: nowrap;
  }

  .pid-topbar__coin {
    display: inline-block;
    flex: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #fff3c0, #e0a83a 60%, #8a5a12);
  }
}
</style>
