<script setup lang="ts">
/**
 * One claimable number: the number on a framed card, with its category
 * underneath. Emits `pick` — the parent knows which item it is and decides
 * what a pick means.
 */
import { PRETTY_ID_CATEGORY_LABEL } from '~/constants/pretty-id'
import type { PrettyIdCategory } from '~/types/pretty-id'

const props = defineProps<{
  signature: string
  category: PrettyIdCategory
}>()

const emit = defineEmits<{
  pick: []
}>()

const categoryLabel = computed(() => PRETTY_ID_CATEGORY_LABEL[props.category])
</script>

<template>
  <button
    type="button"
    class="pid-idcard"
    :aria-label="`Pretty ID ${signature}, ${categoryLabel}`"
    @click="emit('pick')"
  >
    <span class="pid-num pid-gold pid-idcard__num">{{ signature }}</span>
    <span class="pid-idcard__tier">{{ categoryLabel }}</span>
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
