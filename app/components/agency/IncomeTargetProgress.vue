<!-- ~/components/agency/IncomeTargetProgress.vue -->
<!-- Displays active income target with progress bar -->
<script setup lang="ts">
import { computed } from 'vue'
import { INCOME_STATUS_COLORS, INCOME_STATUS_LABELS } from '~/types/income/income'

// ========================================
// Props
// ========================================

defineOptions({ name: 'IncomeTargetProgress' })

// ========================================
// Store
// ========================================

const incomeStore = useIncomeStore()

// ========================================
// Computed
// ========================================

const target = computed(() => incomeStore.activeTarget)
const isLoading = computed(() => incomeStore.isTargetLoading)
const hasTarget = computed(() => incomeStore.hasActiveTarget)
const progress = computed(() => incomeStore.targetProgress)
const daysRemaining = computed(() => incomeStore.daysRemaining)
const coinsToComplete = computed(() => incomeStore.coinsToComplete)

/**
 * Format coins for display.
 */
const earnedDisplay = computed(() => {
  const earned = parseFloat(target.value?.earned_coins ?? '0')
  return formatCurrency(earned)
})

const requiredDisplay = computed(() => {
  const required = parseFloat(target.value?.required_coins ?? '0')
  return formatCurrency(required * 3.333333)
})

const coinsToCompleteDisplay = computed(() => {
  const coins = parseFloat(coinsToComplete.value)
  return formatCurrency(coins * 3.333333)
})

const rewardDisplay = computed(() => {
  return target.value?.member_diamond_reward ?? 0
})

/**
 * Format large numbers with K/M suffix.
 */
function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(1) + 'M'
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(1) + 'K'
  }
  return value.toFixed(0)
}

/**
 * Progress bar color based on completion.
 */
const progressColor = computed(() => {
  if (progress.value >= 100) return 'success'
  if (progress.value >= 75) return 'tertiary'
  if (progress.value >= 50) return 'info'
  return 'neutral'
})
</script>

<template>
  <div class="p-2 bg-linear-to-bl to-neutral-950 border border-neutral-700 relative overflow-hidden rounded-lg">
    <!-- Loading State -->
    <div v-if="isLoading" class="pt-14 px-3 space-y-2">
      <USkeleton class="h-48 rounded-lg" />
      <USkeleton class="h-6 rounded w-3/4 mx-auto" />
      <USkeleton class="h-4 rounded w-1/2 mx-auto" />
    </div>

    <!-- No Active Target -->
    <div v-else-if="!hasTarget" class="text-center py-4">
      <Icon name="i-lucide-target" class="size-10 mx-auto text-muted mb-2" />
      <p class="text-sm text-muted">No active income target</p>
      <p class="text-xs text-muted mt-1">Income targets are assigned by your agency.</p>
    </div>

    <!-- Active Target -->
    <template v-else>
      <!-- Header -->
      <div class="flex justify-between items-center mb-3">
        <div class="flex items-center gap-2">
          <Icon name="i-lucide-target" class="size-5 text-tertiary" />
          <UBadge variant="soft" :color="target ? INCOME_STATUS_COLORS[target.status] : 'neutral'" class="font-bold">{{ target ? INCOME_STATUS_LABELS[target.status] : '' }}</UBadge>
          <UBadge color="tertiary" variant="soft">{{ target?.tier }}</UBadge>
        </div>
        <UBadge variant="soft" :color="daysRemaining <= 3 ? 'error' : 'info'" class="flex items-center gap-1 text-sm">
          <Icon name="i-lucide-clock" class="size-4 text-info" />
          {{ daysRemaining }} days left
        </UBadge>
      </div>

      <!-- Stats Row -->
      <div class="grid grid-cols-2 gap-3 text-center">
        <div class="bg-tertiary/10 rounded-md p-2 inset-shadow-sm">
          <p class="text-xs text-muted">Remaining to Get</p>
          <p class="text-lg font-bold text-tertiary">{{ coinsToCompleteDisplay }}</p>
        </div>
        <div class="bg-secondary/10 rounded-md p-2 inset-shadow-sm">
          <p class="text-xs text-muted">Reward</p>
          <p class="text-lg font-bold text-secondary">
            <Icon name="i-lucide-gem" class="size-4 inline-block mr-1" />
            {{ rewardDisplay }}
          </p>
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="rounded-md bg-muted/40 p-2 mt-3 inset-shadow-sm">
        <UProgress 
          v-model="progress"
          :color="progressColor"
          status
          size="lg"
          class="mb-1"
          :ui="{ status: 'text-white -mb-1' }"
        />
        <div class="flex justify-between text-sm text-white font-semibold">
          <span><UIcon name="i-lucide-coins" /> {{ earnedDisplay }} earned</span>
          <span><UIcon name="i-lucide-coins" /> {{ requiredDisplay }} required</span>
        </div>
      </div>

    </template>
  </div>
</template>
