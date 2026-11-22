<script setup lang="ts">
/**
 * The "Available Pretty IDs · N" heading and the 3-up grid under it: ID cards,
 * a pulsing placeholder grid while the first load is in flight, or the empty
 * text. Emits `pick` — the parent decides what a pick means.
 */
import type { PrettyIdItem } from '~/types/pretty-id'

// ========================================
// Config
// ========================================

const props = defineProps<{
  items: PrettyIdItem[]
  /** Count of every available ID matching the filter, not just `items`. */
  total: number
  isLoading: boolean
}>()

const emit = defineEmits<{
  pick: [id: string]
}>()

// ========================================
// Constants
// ========================================

const SKELETON_COUNT = 6
const SKELETON_SLOTS = Array.from({ length: SKELETON_COUNT }, (_, index) => index)

// ========================================
// State
// ========================================

/** Loading flags flip on every refetch; only an empty first load gets the skeleton. */
const showSkeleton = computed(() => props.isLoading && props.items.length === 0)
</script>

<template>
  <div>
    <h3 class="pid-head pid-gold mt-3.5 mb-2 text-center text-[14px]">
      Available Pretty IDs<template v-if="!showSkeleton"> · {{ total }}</template>
    </h3>

    <div v-if="showSkeleton" class="pid-card-grid" role="status" aria-label="Loading IDs">
      <div
        v-for="slot in SKELETON_SLOTS"
        :key="slot"
        class="aspect-[200/327] animate-pulse rounded-lg border border-(--pid-line-dim) bg-(--pid-surface) motion-reduce:animate-none"
        aria-hidden="true"
      />
    </div>

    <div v-else-if="items.length > 0" class="pid-card-grid">
      <PrettyIdNumberCard
        v-for="item in items"
        :id="item.id"
        :key="item.id"
        :tier="item.tier"
        @pick="emit('pick', $event)"
      />
    </div>

    <p v-else-if="!isLoading" class="pid-empty">No IDs in this category right now.</p>
  </div>
</template>
