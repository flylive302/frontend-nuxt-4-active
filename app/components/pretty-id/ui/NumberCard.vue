<script setup lang="ts">
/**
 * One claimable ID in a grid: the number on a framed card, with its pattern
 * tier underneath. Emits `pick` — the parent decides what a pick means.
 */
import { PRETTY_ID_TIER_LABEL } from '~/constants/pretty-id'
import type { PrettyIdTier } from '~/types/pretty-id'

const props = defineProps<{
  id: string
  /** Omit to show the number alone (e.g. suggestions in the "ID taken" modal). */
  tier?: PrettyIdTier | null
}>()

const emit = defineEmits<{
  pick: [id: string]
}>()

const tierLabel = computed(() => (props.tier ? PRETTY_ID_TIER_LABEL[props.tier] : null))
</script>

<template>
  <button
    type="button"
    class="pid-idcard"
    :aria-label="tierLabel ? `Pretty ID ${id}, ${tierLabel}` : `Pretty ID ${id}`"
    @click="emit('pick', id)"
  >
    <span class="pid-num pid-gold pid-idcard__num">{{ id }}</span>
    <span v-if="tierLabel" class="pid-idcard__tier">{{ tierLabel }}</span>
  </button>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  .pid-idcard {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    aspect-ratio: 200 / 327;
    padding: 18% 10%;
    border: 0;
    background: var(--pid-img-card) center / 100% 100%;
    cursor: pointer;
    transition: transform 120ms ease-out;
  }

  .pid-idcard:active {
    transform: scale(0.96);
  }

  .pid-idcard:focus-visible {
    outline: 2px solid var(--pid-gold);
    outline-offset: 2px;
  }

  .pid-idcard__num {
    font-size: clamp(13px, 4.2vw, 18px);
  }

  .pid-idcard__tier {
    color: var(--pid-tier);
    font: 700 9px var(--pid-font-num);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  @media (prefers-reduced-motion: reduce) {
    .pid-idcard {
      transition: none;
    }
  }
}
</style>
