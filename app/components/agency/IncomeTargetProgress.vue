<!-- ~/components/agency/IncomeTargetProgress.vue -->
<!-- Displays active income target with progress bar -->
<script setup lang="ts">
import { computed } from 'vue'

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
  return formatCurrency(required)
})

const coinsToCompleteDisplay = computed(() => {
  const coins = parseFloat(coinsToComplete.value)
  return formatCurrency(coins)
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
  if (progress.value >= 75) return 'primary'
  if (progress.value >= 50) return 'info'
  return 'neutral'
})
</script>

<template>
  <div class="bg-elevated rounded-lg p-4 mb-4">
    <!-- Loading State -->
    <div v-if="isLoading" class="animate-pulse space-y-3">
      <div class="h-5 bg-muted rounded w-1/3" />
      <div class="h-4 bg-muted rounded w-full" />
      <div class="h-3 bg-muted rounded w-2/3" />
    </div>

    <!-- No Active Target -->
    <div v-else-if="!hasTarget" class="text-center py-4">
      <icon name="i-lucide-target" class="size-10 mx-auto text-muted mb-2" />
      <p class="text-sm text-muted">No active income target</p>
      <p class="text-xs text-muted mt-1">Income targets are assigned by your agency.</p>
    </div>

    <!-- Active Target -->
    <template v-else>
      <!-- Header -->
      <div class="flex justify-between items-center mb-3">
        <div class="flex items-center gap-2">
          <icon name="i-lucide-target" class="size-5 text-primary" />
          <span class="font-bold">{{ target?.name }}</span>
          <UBadge size="xs" color="primary" variant="soft">{{ target?.tier }}</UBadge>
        </div>
        <div class="flex items-center gap-1 text-sm">
          <icon name="i-lucide-clock" class="size-4 text-muted" />
          <span :class="daysRemaining <= 3 ? 'text-error font-bold' : 'text-muted'">
            {{ daysRemaining }} days left
          </span>
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="mb-3">
        <UProgress 
          :value="progress" 
          :color="progressColor"
          size="lg"
          class="mb-1"
        />
        <div class="flex justify-between text-xs text-muted">
          <span>{{ earnedDisplay }} earned</span>
          <span>{{ requiredDisplay }} required</span>
        </div>
      </div>

      <!-- Stats Row -->
      <div class="grid grid-cols-2 gap-3 text-center">
        <div class="bg-muted/20 rounded-lg p-2">
          <p class="text-xs text-muted">To Complete</p>
          <p class="text-lg font-bold text-primary">{{ coinsToCompleteDisplay }}</p>
        </div>
        <div class="bg-muted/20 rounded-lg p-2">
          <p class="text-xs text-muted">Reward</p>
          <p class="text-lg font-bold text-yellow-500">
            <icon name="i-lucide-gem" class="size-4 inline-block mr-1" />
            {{ rewardDisplay }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
