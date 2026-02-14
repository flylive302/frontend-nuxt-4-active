<!-- ~/components/coin-request-item.vue -->
<!-- Single coin request item display with status, amount, and actions -->
<script setup lang="ts">
import type { CoinRequest, CoinRequestStatus } from '~/types/economy/coin-request'
import { STATUS_COLORS } from '~/types/economy/coin-request'
import type { Colors } from '~/types/colors'

defineOptions({ name: 'CoinRequestItem' })

// ========================================
// Props & Emits
// ========================================
defineProps<{
  request: CoinRequest
  color: Colors
  borderClass: string
  isCancelling: number | null
}>()

const emit = defineEmits<{
  (e: 'cancel', id: number): void
}>()

// ========================================
// Helpers
// ========================================
function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dateString))
}

function getStatusIcon(status: CoinRequestStatus): string {
  const icons: Record<CoinRequestStatus, string> = {
    pending: 'i-lucide-clock',
    approved: 'i-lucide-check-circle',
    rejected: 'i-lucide-x-circle',
    cancelled: 'i-lucide-ban',
    expired: 'i-lucide-timer-off'
  }
  return icons[status]
}
</script>

<template>
  <div
    :class="[borderClass]"
    class="rounded-xl border p-3 bg-linear-to-br to-tertiary/10 shadow-sm hover:shadow-md transition-all duration-200"
  >
    <!-- Header -->
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <UAvatar
          :src="request.reseller.avatar || undefined"
          :alt="request.reseller.name"
          size="md"
          :class="[borderClass, 'ring-2 shrink-0']"
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold truncate">{{ request.reseller.name }}</p>
          <p class="text-xs text-muted flex items-center gap-1">
            <UIcon name="i-lucide-calendar" class="w-3 h-3" />
            {{ formatDate(request.created_at) }}
          </p>
        </div>
      </div>
      <UBadge :color="STATUS_COLORS[request.status.value]" variant="subtle" size="sm">
        <UIcon :name="getStatusIcon(request.status.value)" class="w-3 h-3 mr-1" />
        {{ request.status.label }}
      </UBadge>
    </div>

    <!-- Amount -->
    <div :class="`bg-${color}/10`" class="flex items-center justify-between rounded-lg px-3 py-2 mt-2">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-coins" :class="`w-5 h-5 text-${color}`" />
        <span :class="`text-lg font-bold text-${color}`">{{ request.final_amount }}</span>
        <span class="text-sm text-muted">coins</span>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="request.was_adjusted" class="text-xs text-muted line-through">{{ request.amount }}</span>
        <UBadge
          v-if="request.status.value === 'approved' && request.type"
          :color="request.type.value === 'credit' ? 'info' : 'success'"
          variant="soft"
          size="xs"
        >
          {{ request.type.label }}
        </UBadge>
      </div>
    </div>

    <!-- Message -->
    <p v-if="request.message" class="mt-3 text-xs text-muted bg-muted/5 rounded-lg p-2 border border-muted/10">
      <UIcon name="i-lucide-message-square" class="w-3 h-3 inline mr-1" />
      {{ request.message }}
    </p>

    <!-- Cancel Action -->
    <div v-if="request.status.value === 'pending'" class="mt-3 flex justify-end">
      <UButton
        size="xs"
        color="error"
        variant="soft"
        icon="i-lucide-x"
        :loading="isCancelling === request.id"
        :disabled="isCancelling !== null"
        @click="emit('cancel', request.id)"
      >
        Cancel Request
      </UButton>
    </div>

    <!-- Credit Info -->
    <div
      v-if="request.status.value === 'approved' && request.type?.value === 'credit' && request.credit_days"
      class="mt-3 flex items-center gap-2 text-xs p-2 rounded-lg"
      :class="request.is_repayment_due ? 'bg-error/10 text-error' : 'bg-info/10 text-info'"
    >
      <UIcon :name="request.is_repayment_due ? 'i-lucide-alert-triangle' : 'i-lucide-info'" class="w-4 h-4" />
      <span v-if="request.is_repayment_due">Credit overdue - please repay!</span>
      <span v-else>Credit: {{ request.credit_days }} days {{ request.is_repaid ? '(Repaid)' : '' }}</span>
    </div>
  </div>
</template>
