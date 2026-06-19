<!-- ~/components/agency/RecentEarnings.vue -->
<!-- Lightweight lifetime summary: diamonds earned + runs completed. -->
<script setup lang="ts">
import { computed } from 'vue'

// ========================================
// Options
// ========================================

defineOptions({ name: 'RecentEarnings' })

// ========================================
// Store
// ========================================

const incomeStore = useIncomeStore()

// ========================================
// Computed
// ========================================

const isLoading = computed(() => incomeStore.isStatsLoading)
const totalDiamonds = computed(() => incomeStore.totalDiamondsEarned)
const completedRuns = computed(() => incomeStore.completedRuns)
</script>

<template>
  <div>
    <!-- Loading State -->
    <div v-if="isLoading" class="grid grid-cols-2 gap-2">
      <USkeleton class="h-20 rounded-lg" />
      <USkeleton class="h-20 rounded-lg" />
    </div>

    <!-- Summary -->
    <div v-else class="grid grid-cols-2 gap-2">
      <div class="bg-linear-to-bl to-neutral-950 border border-neutral-700 rounded-lg p-3 text-center">
        <div class="flex items-center justify-center gap-1 text-secondary-400">
          <UIcon name="i-lucide-gem" class="size-5" />
          <p class="text-lg font-bold">{{ totalDiamonds.toLocaleString() }}</p>
        </div>
        <p class="text-xs text-muted mt-1">Diamonds Earned</p>
      </div>
      <div class="bg-linear-to-bl to-neutral-950 border border-neutral-700 rounded-lg p-3 text-center">
        <div class="flex items-center justify-center gap-1 text-tertiary">
          <UIcon name="i-lucide-flag" class="size-5" />
          <p class="text-lg font-bold">{{ completedRuns.toLocaleString() }}</p>
        </div>
        <p class="text-xs text-muted mt-1">Runs Completed</p>
      </div>
    </div>
  </div>
</template>
