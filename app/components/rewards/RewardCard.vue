<!-- ~/components/rewards/RewardCard.vue -->
<!-- Displays a single reward with claim functionality -->
<script setup lang="ts">
import { computed } from 'vue'
import type { UserReward } from '~/types/progression/reward'
import { REWARD_TYPE_ICONS, REWARD_TYPE_COLORS } from '~/types/progression/reward'

// ========================================
// Props & Emits
// ========================================

defineOptions({ name: 'RewardCard' })

const props = defineProps<{
  reward: UserReward
  isClaiming?: boolean
}>()

const emit = defineEmits<{
  (e: 'claim', rewardId: number): void
}>()

// ========================================
// Computed
// ========================================

const icon = computed(() => REWARD_TYPE_ICONS[props.reward.reward_type])
const iconColor = computed(() => REWARD_TYPE_COLORS[props.reward.reward_type])
const isPending = computed(() => props.reward.status === 'pending')
const isClaimed = computed(() => props.reward.status === 'claimed')
const isExpired = computed(() => props.reward.status === 'expired')

/**
 * Format reward value for display.
 */
const valueDisplay = computed(() => {
  if (props.reward.reward_value === null) return null
  const value = props.reward.reward_value
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M'
  if (value >= 1_000) return (value / 1_000).toFixed(1) + 'K'
  return value.toString()
})

/**
 * Get status badge color.
 */
const statusColor = computed(() => {
  if (isPending.value) return 'success'
  if (isClaimed.value) return 'neutral'
  return 'error'
})

/**
 * Get status label.
 */
const statusLabel = computed(() => {
  if (isPending.value) return 'Available'
  if (isClaimed.value) return 'Claimed'
  return 'Expired'
})

/**
 * Format date for display.
 */
function formatDate(dateString?: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ========================================
// Handlers
// ========================================

function handleClaim(): void {
  emit('claim', props.reward.id)
}
</script>

<template>
  <div 
    class="bg-elevated rounded-lg p-4 flex gap-4 items-center"
    :class="{ 'opacity-60': isClaimed || isExpired }"
  >
    <!-- Icon -->
    <div 
      class="size-12 rounded-full bg-muted/30 flex items-center justify-center shrink-0"
      :class="iconColor"
    >
      <icon :name="icon" class="size-6" />
    </div>

    <!-- Details -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 mb-1">
        <p class="font-semibold truncate">{{ reward.source_name }}</p>
        <UBadge :color="statusColor" size="xs" variant="soft">
          {{ statusLabel }}
        </UBadge>
      </div>

      <!-- Value -->
      <div v-if="valueDisplay" class="flex items-center gap-1 text-sm">
        <icon :name="icon" class="size-4" :class="iconColor" />
        <span class="font-bold" :class="iconColor">{{ valueDisplay }}</span>
        <span class="text-muted">{{ reward.reward_type }}</span>
      </div>

      <!-- Badge reward -->
      <div v-else-if="reward.reward_data?.badge_name" class="text-sm text-muted">
        Badge: {{ reward.reward_data.badge_name }}
      </div>

      <!-- Date -->
      <p v-if="isClaimed && reward.claimed_at" class="text-xs text-muted mt-1">
        Claimed {{ formatDate(reward.claimed_at) }}
      </p>
      <p v-else-if="reward.expires_at" class="text-xs text-muted mt-1">
        Expires {{ formatDate(reward.expires_at) }}
      </p>
    </div>

    <!-- Claim Button -->
    <UButton
      v-if="isPending"
      color="primary"
      size="sm"
      :loading="isClaiming"
      @click="handleClaim"
    >
      Claim
    </UButton>
  </div>
</template>
