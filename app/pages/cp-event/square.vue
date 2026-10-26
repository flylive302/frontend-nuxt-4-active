<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
import { formatCpWeekLabel } from '~/utils/cp'

definePageMeta({ layout: 'cp', middleware: ['auth', 'cp-enabled'] })

const { weekKey, pairs, allTime, hasLoaded, isLoading, error, isEmpty, isAllTimeEmpty, refetch } = useCpSquare()
</script>

<template>
  <section class="min-h-screen">
    <CpEventCardFrame priority>
      <p class="text-center my-3">Top Three Couples on the History List will be displayed here</p>
      <img alt="" :src="ASSETS.CP_DEVIDER">
      <p v-if="weekKey" class="text-center my-3">{{ formatCpWeekLabel(weekKey) }}</p>

      <div v-if="error && !hasLoaded" class="py-6 text-center">
        <p class="font-semibold text-rose-300">Could not load the winners.</p>
        <UButton class="mt-2" variant="soft" @click="refetch">Retry</UButton>
      </div>
      <p v-else-if="isLoading && !hasLoaded" class="text-center my-6">Loading...</p>
      <template v-else-if="hasLoaded">
        <p v-if="isEmpty" class="text-center my-6">No winners yet</p>
        <CpEventPodium v-else :pairs="pairs" score-field="weekly_score" />

        <img alt="" :src="ASSETS.CP_DEVIDER" class="mt-4">
        <p class="text-center my-3">All-time Top 50 Couples</p>
        <div class="flex flex-col gap-2">
          <CpEventRankRow
            v-for="pair in allTime"
            :key="pair.pair_id"
            :pair="pair"
            :rank="pair.lifetime_rank"
            score-field="lifetime_intimacy"
          />
        </div>
        <p v-if="isAllTimeEmpty" class="py-6 text-center font-semibold text-white/70">No couples yet. Be the first!</p>
      </template>
    </CpEventCardFrame>
  </section>
</template>
