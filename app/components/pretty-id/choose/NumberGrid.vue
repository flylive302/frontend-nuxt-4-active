<script setup lang="ts">
/**
 * The "Available Pretty IDs · N" heading and the 3-up grid under it: number
 * cards, a pulsing placeholder grid while the first load is in flight, a retry
 * after a failed load, or the empty text — plus "Load more" while the server
 * has another page. Emits `pick` / `load-more` / `retry`; the parent decides
 * what they mean.
 */
import type { PrettyIdItem } from '~/types/pretty-id'

// ========================================
// Config
// ========================================

const props = defineProps<{
  items: PrettyIdItem[]
  /** Count of every available number matching the filter, not just `items`. */
  total: number
  isLoading: boolean
  isLoadingMore: boolean
  isFailed: boolean
  hasMore: boolean
}>()

const emit = defineEmits<{
  pick: [item: PrettyIdItem]
  'load-more': []
  retry: []
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
      Available Pretty IDs<template v-if="!showSkeleton && !isFailed"> · {{ total }}</template>
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
        :key="item.signature"
        :signature="item.signature"
        :category="item.category"
        @pick="emit('pick', item)"
      />
    </div>

    <div v-else-if="isFailed" class="text-center">
      <p class="pid-empty">Could not load the numbers.</p>
      <PrettyIdButton size="sm" @click="emit('retry')">Try again</PrettyIdButton>
    </div>

    <p v-else-if="!isLoading" class="pid-empty">No Pretty IDs available here right now.</p>

    <div v-if="hasMore && items.length > 0" class="mt-3 text-center">
      <PrettyIdButton size="sm" :disabled="isLoadingMore" @click="emit('load-more')">
        {{ isLoadingMore ? 'Loading…' : 'Load more' }}
      </PrettyIdButton>
    </div>
  </div>
</template>
