<script setup lang="ts">
/**
 * Month pager of the Big Winners and Weekly Record pages: previous / next month with data
 * around the shown month. Intent only: it emits the month to move to.
 */
import { prettyIdMonthLabel, prettyIdMonthNeighbours } from '~/utils/pretty-id-history'

// Config
const props = defineProps<{
  /** The month on screen (`YYYY-MM`), or `null` before the first load. */
  month: string | null
  /** Months with data, newest first. */
  months: readonly string[]
  /** A month request is in flight: the arrows rest. */
  loading: boolean
}>()

const emit = defineEmits<{
  select: [month: string]
}>()

// State
const neighbours = computed(() => (props.month === null
  ? { older: null, newer: null }
  : prettyIdMonthNeighbours(props.months, props.month)))
const olderMonth = computed(() => neighbours.value.older)
const newerMonth = computed(() => neighbours.value.newer)
const label = computed(() => (props.month === null ? '' : prettyIdMonthLabel(props.month)))

// Handlers
function go(month: string | null): void {
  if (month !== null) emit('select', month)
}
</script>

<template>
  <div class="mb-2 flex items-center justify-between gap-2">
    <button
      type="button"
      class="pid-history-nav"
      aria-label="Previous month"
      :disabled="olderMonth === null || loading"
      @click="go(olderMonth)"
    >
      <UIcon name="i-lucide-chevron-left" class="size-5" />
    </button>
    <span class="pid-head pid-gold text-[15px]" aria-live="polite">{{ label }}</span>
    <button
      type="button"
      class="pid-history-nav"
      aria-label="Next month"
      :disabled="newerMonth === null || loading"
      @click="go(newerMonth)"
    >
      <UIcon name="i-lucide-chevron-right" class="size-5" />
    </button>
  </div>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  /* The top bar's round gold-rimmed icon button. */
  .pid-history-nav {
    display: grid;
    flex: none;
    place-items: center;
    width: 38px;
    height: 38px;
    border: 1.5px solid var(--pid-gold-deep);
    border-radius: 50%;
    background: color-mix(in srgb, var(--pid-surface) 80%, transparent);
    color: var(--pid-gold);
    cursor: pointer;
  }

  .pid-history-nav:focus-visible {
    outline: 2px solid var(--pid-gold);
    outline-offset: 2px;
  }

  .pid-history-nav:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
</style>
