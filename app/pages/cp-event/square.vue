<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
import { formatCpWeekLabel } from '~/utils/cp'

definePageMeta({ layout: 'cp', middleware: ['auth', 'cp-enabled'] })

const { weekKey, pairs, isLoading, error, isEmpty, refetch } = useCpSquare()
</script>

<template>
  <section class="min-h-screen">
    <CpEventCardFrame priority>
      <p class="text-center my-3">Top Three Couples on the History List will be displayed here</p>
      <img alt="" :src="ASSETS.CP_DEVIDER">
      <p v-if="weekKey" class="text-center my-3">{{ formatCpWeekLabel(weekKey) }}</p>
      <p v-if="isEmpty" class="text-center my-6">No winners yet</p>
      <div v-else-if="error && !pairs.length" class="py-6 text-center">
        <p class="font-semibold text-rose-300">Could not load the winners.</p>
        <UButton class="mt-2" variant="soft" @click="refetch">Retry</UButton>
      </div>
      <p v-else-if="isLoading && !pairs.length" class="text-center my-6">Loading...</p>
      <CpEventPodium v-else :pairs="pairs" score-field="weekly_score" />
    </CpEventCardFrame>
  </section>
</template>
