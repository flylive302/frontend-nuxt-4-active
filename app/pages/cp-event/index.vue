<script setup lang="ts">
import { useInfiniteScroll } from '@vueuse/core'
import { CP_PODIUM_SIZE } from '~/constants/cp-event'

definePageMeta({ layout: 'cp', middleware: ['auth', 'cp-enabled'] })

const LOAD_MORE_DISTANCE_PX = 600

const { podium, rows, myPair, isLoading, isLoadingMore, error, loadMoreError, isEmpty, canLoadMore, loadMore, refetch } = useCpEventData()

if (import.meta.client) {
  useInfiniteScroll(() => window, loadMore, {
    distance: LOAD_MORE_DISTANCE_PX,
    canLoadMore: () => canLoadMore.value,
  })
}
</script>

<template>
  <section class="min-h-screen pb-34">
    <CpEventCardFrame priority>
      <p class="text-center my-3">Send CP gifts and you and your love may be on the list!</p>

      <CpEventPodium :pairs="podium" score-field="lifetime_intimacy" />

      <div class="flex flex-col gap-2 mt-4">
        <CpEventRankRow
          v-for="(pair, index) in rows"
          :key="pair.pair_id"
          :pair="pair"
          :rank="pair.lifetime_rank ?? index + CP_PODIUM_SIZE + 1"
          score-field="lifetime_intimacy"
        />
      </div>

      <p v-if="isEmpty" class="py-6 text-center font-semibold text-white/70">No couples on the list yet. Be the first!</p>
      <div v-else-if="error && !podium.length" class="py-6 text-center">
        <p class="font-semibold text-rose-300">Could not load the list.</p>
        <UButton class="mt-2" variant="soft" @click="refetch">Retry</UButton>
      </div>
      <p v-else-if="isLoading && !podium.length" class="py-6 text-center font-semibold">Loading…</p>
      <p v-else-if="isLoadingMore" class="py-3 text-center text-sm">Loading…</p>
      <div v-else-if="loadMoreError" class="py-3 text-center">
        <p class="text-sm font-semibold text-rose-300">Could not load more.</p>
        <UButton class="mt-2" variant="soft" size="sm" @click="loadMore">Retry</UButton>
      </div>
    </CpEventCardFrame>

    <div v-if="myPair" class="fixed inset-x-0 bottom-0 z-10 text-white">
      <CpEventRankRow :pair="myPair" :rank="myPair.weekly_rank" score-field="lifetime_intimacy" self />
    </div>
  </section>
</template>
