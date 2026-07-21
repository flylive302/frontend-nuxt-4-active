<script setup lang="ts">
/**
 * Plain list of ranking entries (typically ranks 4-30 on /rank).
 * Shows skeletons during the initial load.
 */
import type { RankingEntry } from '~/types/ranking'
import type { RankingCategory } from '~/constants/ranking'

defineProps<{
  entries: RankingEntry[]
  category: RankingCategory
  /** When true and there are no cached entries yet, render skeletons. */
  loading: boolean
}>()
</script>

<template>
  <div class="flex flex-col gap-1 mx-3 border border-white/20 rounded-xl squircle backdrop-blur shadow-md pb-48">
    <template v-if="loading && entries.length === 0">
      <div
        v-for="i in 8"
        :key="`skeleton-${i}`"
        class="flex items-center gap-3 rounded-lg px-3 py-2"
      >
        <USkeleton class="w-8 h-8 rounded-full" />
        <USkeleton class="w-10 h-10 rounded-full" />
        <USkeleton class="h-4 flex-1" />
        <USkeleton class="h-4 w-16" />
      </div>
    </template>

    <template v-else>
      <RankingEntryRow
        v-for="entry in entries"
        :key="`${entry.subject_type}-${entry.rank}`"
        :entry="entry"
        :category="category"
      />
    </template>
  </div>
</template>
