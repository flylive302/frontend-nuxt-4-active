<script setup lang="ts">
/**
 * The five shield filters of the Choose tab (Lucky, Sequence, Legend, Mirror,
 * Couple). The active one is drawn larger and glows, the rest are dimmed.
 * Emits `toggle` — re-tapping the active shield clears the filter, which is the
 * parent's call.
 */
import { PRETTY_ID_TIER_FILTERS, PRETTY_ID_TIER_LABEL } from '~/constants/pretty-id'
import { PRETTY_ID_TIER_SHIELD } from '~/constants/pretty-id-theme'
import type { PrettyIdTier } from '~/types/pretty-id'

// ========================================
// Config
// ========================================

defineProps<{
  /** The tier currently filtered on, or `null` for no filter. */
  active: PrettyIdTier | null
}>()

const emit = defineEmits<{
  toggle: [tier: PrettyIdTier]
}>()

// ========================================
// State
// ========================================

const shields = PRETTY_ID_TIER_FILTERS.map(tier => ({
  tier,
  src: PRETTY_ID_TIER_SHIELD[tier],
  label: PRETTY_ID_TIER_LABEL[tier],
}))
</script>

<template>
  <div class="flex justify-center gap-1 px-1.5 pt-1.5" role="group" aria-label="Filter by pattern">
    <button
      v-for="shield in shields"
      :key="shield.tier"
      type="button"
      class="pid-shield"
      :class="{ 'pid-shield--on': active === shield.tier }"
      :aria-label="shield.label"
      :aria-pressed="active === shield.tier"
      @click="emit('toggle', shield.tier)"
    >
      <img :src="shield.src" alt="" class="pid-shield__art">
      <b class="pid-shield__label">{{ shield.label.toUpperCase() }}</b>
    </button>
  </div>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  .pid-shield {
    position: relative;
    flex: 1;
    max-width: 76px;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
    transition: transform 200ms ease-out;
  }

  .pid-shield--on {
    z-index: 1;
    transform: scale(1.12);
  }

  .pid-shield:focus-visible {
    outline: 2px solid var(--pid-gold);
    outline-offset: 2px;
    border-radius: 8px;
  }

  .pid-shield__art {
    display: block;
    width: 100%;
    filter: brightness(0.75);
    transition: filter 200ms ease-out;
  }

  .pid-shield--on .pid-shield__art {
    filter: drop-shadow(0 0 8px var(--pid-gold)) brightness(1.15);
  }

  .pid-shield__label {
    position: absolute;
    right: 8%;
    bottom: 7%;
    left: 8%;
    overflow: hidden;
    color: var(--pid-gold-pale);
    font-family: var(--pid-font-num);
    font-size: clamp(7px, 2vw, 9.5px);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-shadow: 0 1px 1px #000;
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .pid-shield,
    .pid-shield__art {
      transition: none;
    }
  }
}
</style>
