<script setup lang="ts">
/**
 * Outcome of the inline exact search, shown under the search box:
 * searching, a found available number as a tappable card, "isn't available —
 * pick one below" for anything else (never says why, never names an owner), or
 * a failed lookup. Presentational: emits `pick`; the list stays underneath.
 */
import type { PrettyIdItem, PrettyIdSearchStatus } from '~/types/pretty-id'

// ========================================
// Config
// ========================================

defineProps<{
  /** The searched number. */
  query: string
  status: PrettyIdSearchStatus
  /** The number when `status` is `available`. */
  result: PrettyIdItem | null
}>()

const emit = defineEmits<{
  pick: [item: PrettyIdItem]
}>()
</script>

<template>
  <div v-if="status !== 'idle'" class="mt-2.5" aria-live="polite">
    <p v-if="status === 'searching'" class="pid-body pid-small pid-muted text-center" role="status">Searching…</p>

    <div v-else-if="status === 'available' && result" class="text-center">
      <p class="pid-head mb-1.5 text-[13px] text-(--pid-ok)">Available — tap to claim</p>
      <div class="mx-auto w-[34%] min-w-[96px]">
        <PrettyIdNumberCard :signature="result.signature" :category="result.category" @pick="emit('pick', result)" />
      </div>
    </div>

    <p v-else-if="status === 'failed'" class="pid-body pid-small text-center">
      Could not check this number. Try searching again.
    </p>

    <p v-else class="pid-body pid-small text-center">
      <b class="pid-num pid-gold">{{ query }}</b> isn't available — pick one below
    </p>
  </div>
</template>
