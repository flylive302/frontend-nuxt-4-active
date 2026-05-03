<script setup lang="ts">
// ========================================
// VIP Recharge Progress
// ========================================
// Displays user's recharge progress toward VIP threshold
// with progress bar, amounts, and window countdown timer.

import type { RechargeProgress } from '~/types/vip/vip-level'

// ========================================
// Props
// ========================================

defineOptions({ name: 'VipRechargeProgress' })

const props = defineProps<{
  progress: RechargeProgress
  levelColor: string
}>()

// ========================================
// Computed
// ========================================

/**
 * Progress percentage toward next target.
 */
const progressPercent = computed(() => {
  if (!props.progress.next_target) return 100
  const threshold = props.progress.next_target.threshold
  if (threshold <= 0) return 100
  return Math.min(100, Math.round((props.progress.total_recharged / threshold) * 100))
})

/**
 * Formatted total recharged in current window.
 */
const formattedRecharged = computed(() =>
  props.progress.total_recharged.toLocaleString(),
)

/**
 * Formatted next threshold.
 */
const formattedThreshold = computed(() =>
  props.progress.next_target?.threshold.toLocaleString() ?? '—',
)

/**
 * Formatted remaining amount.
 */
const formattedRemaining = computed(() =>
  props.progress.next_target?.remaining.toLocaleString() ?? '0',
)

/**
 * Countdown text for the current window expiry.
 * Shows time remaining in the rolling window, not the event end.
 */
const countdownText = computed(() => {
  const windowExpiry = props.progress.next_target?.window_expires_at
  if (!windowExpiry) return null

  const now = new Date()
  const end = new Date(windowExpiry)
  const diffMs = end.getTime() - now.getTime()

  if (diffMs <= 0) return 'Window expired'

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (days > 0) return `${days}d ${hours}h remaining`
  if (hours > 0) return `${hours}h ${minutes}m remaining`
  return `${minutes}m remaining`
})

/**
 * Whether all targets have been claimed.
 */
const allClaimed = computed(() =>
  props.progress.next_target === null,
)
</script>

<template>
  <div class="rounded-xl backdrop-blur-2xl bg-white/10 p-3 ">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-arrow-trending-up" class="size-4 text-amber-400" />
        <span class="text-sm font-bold text-white">{{ progress.event_name }}</span>
      </div>
      <span
        v-if="countdownText"
        class="text-xs text-white/60"
      >
        {{ countdownText }}
      </span>
    </div>

    <!-- Progress Bar -->
    <div class="space-y-1">
      <div class="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-amber-400 to-amber-500"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>

      <!-- Labels -->
      <div class="flex items-center justify-between text-xs">
        <span class="text-white/80">
          {{ formattedRecharged }} / {{ formattedThreshold }}
        </span>
        <span v-if="!allClaimed && progress.next_target" class="text-white/60">
          {{ formattedRemaining }} to {{ progress.next_target.vip_name }}
        </span>
        <span v-else class="text-amber-400 font-medium">
          All tiers claimed ✓
        </span>
      </div>
    </div>

    <!-- Target Steps -->
    <div class="flex gap-1">
      <div
        v-for="(target, idx) in progress.targets"
        :key="idx"
        class="flex-1 text-center rounded-md px-1 py-1.5 text-xs transition-colors"
        :class="target.claimed
          ? 'bg-amber-500/20 text-amber-400'
          : 'bg-white/5 text-white/40'"
      >
        <UIcon
          :name="target.claimed ? 'i-heroicons-check-circle-solid' : 'i-heroicons-lock-closed'"
          class="size-3 mb-0.5"
        />
        <div class="font-medium leading-tight">
          {{ target.vip_name }}
        </div>
      </div>
    </div>
  </div>
</template>
