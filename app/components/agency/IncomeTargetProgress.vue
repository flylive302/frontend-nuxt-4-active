<!-- ~/components/agency/IncomeTargetProgress.vue -->
<!-- Simple active-tier bar for the member's current agency-XP run (native XP). -->
<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@vueuse/core'
import { formatGiftCoinsExact, formatRunTimeLeft, isRunEndingSoon } from '~/utils/incomeFormat'

// ========================================
// Constants
// ========================================

/** Hours are shown, so re-render the countdown once a minute. */
const COUNTDOWN_TICK_MS = 60_000

// ========================================
// Options
// ========================================

defineOptions({ name: 'IncomeTargetProgress' })

// ========================================
// Store
// ========================================

const incomeStore = useIncomeStore()

// ========================================
// Computed
// ========================================

const run = computed(() => incomeStore.activeRun)
const isLoading = computed(() => incomeStore.isRunLoading)
const hasRun = computed(() => incomeStore.hasActiveRun)
const progress = computed(() => Math.round(run.value?.progress_percentage ?? 0))

/**
 * The next, not-yet-crossed tier on the ladder (target of the active band).
 */
const nextTier = computed(() => run.value?.ladder.find((rung) => rung.is_active) ?? null)

const xpToNextTier = computed(() => {
  if (!run.value || !nextTier.value) return 0
  return Math.max(0, nextTier.value.required_xp - run.value.accumulated_xp)
})

const isMaxed = computed(() => hasRun.value && nextTier.value === null)

/**
 * Ticking clock so the days/hours label stays current while the page is open.
 */
const now = useNow({ interval: COUNTDOWN_TICK_MS })

/**
 * "2d 5h left" style label until the run window closes.
 */
const timeLeftLabel = computed(() => (run.value ? formatRunTimeLeft(run.value.ends_at, now.value.getTime()) : ''))

const isEndingSoon = computed(() => (run.value ? isRunEndingSoon(run.value.ends_at, now.value.getTime()) : false))

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

    <!-- No Active Run -->
    <div v-else-if="!hasRun" class="text-center py-4">
      <Icon name="i-lucide-target" class="size-10 mx-auto text-muted mb-2" />
      <p class="text-sm text-muted">No active run</p>
      <p class="text-xs text-muted mt-1">Send or receive gifts as an agency member to start one.</p>
    </div>

    <!-- Active Run -->
    <template v-else>
      <!-- Header -->
      <div class="flex justify-between items-center mb-3">
        <div class="flex items-center gap-2">
          <Icon name="i-lucide-trending-up" class="size-5 text-tertiary" />
          <UBadge variant="soft" :color="(run?.status_color as 'success' | 'info' | 'warning' | 'error' | 'neutral') ?? 'info'" class="font-bold">
            {{ run?.status_label }}
          </UBadge>
          <UBadge color="tertiary" variant="soft">Tier {{ run?.current_tier }}</UBadge>
        </div>
        <UBadge variant="soft" :color="isEndingSoon ? 'error' : 'info'" class="flex items-center gap-1 text-sm">
          <Icon name="i-lucide-clock" class="size-4 text-info" />
          {{ timeLeftLabel }}
        </UBadge>
      </div>

      <!-- Stats Row -->
      <div class="grid grid-cols-2 gap-3 text-center">
        <div class="bg-tertiary/10 rounded-md p-2 inset-shadow-sm">
          <p class="text-xs text-muted">{{ isMaxed ? 'Status' : 'Gift coins to next tier' }}</p>
          <p class="text-lg font-bold text-tertiary">
            {{ isMaxed ? 'Maxed' : formatGiftCoinsExact(xpToNextTier) }}
          </p>
        </div>
        <div class="bg-secondary/10 rounded-md p-2 inset-shadow-sm">
          <p class="text-xs text-muted">Next Reward</p>
          <p class="text-lg font-bold text-secondary">
            <Icon name="i-lucide-gem" class="size-4 inline-block mr-1" />
            {{ nextTier?.member_diamond_reward ?? 0 }}
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
          <span><UIcon name="i-lucide-zap" /> {{ formatGiftCoinsExact(run?.accumulated_xp ?? 0) }} Gift coins</span>
          <span v-if="nextTier"><UIcon name="i-lucide-flag" /> {{ formatGiftCoinsExact(nextTier.required_xp) }} Gift coins</span>
        </div>
      </div>
    </template>
  </div>
</template>
