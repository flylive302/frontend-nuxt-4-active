<!-- ~/components/transaction-item.vue -->
<!-- Displays a single transaction with expandable details -->
<script setup lang="ts">
import { computed } from 'vue'
import type { Transaction, BalanceChange } from '~/types/wallet'
import { TRANSACTION_TYPE_LABELS } from '~/types/wallet'
import { formatCurrency } from '~/utils/currency'

// ========================================
// Props
// ========================================

defineOptions({ name: 'TransactionItem' })

const props = defineProps<{
  transaction: Transaction
}>()

// ========================================
// Types
// ========================================

interface TimelineDetail {
  label: string
  value: string
}

interface TimelineEntry {
  title: string
  summary?: string | ComputedRef<string>
  details?: TimelineDetail[]
  icon: string
}

// ========================================
// Computed
// ========================================

/**
 * Get formatted time from timestamp.
 */
const formattedTime = computed(() => {
  const date = new Date(props.transaction.timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
})

/**
 * Get display title for transaction.
 */
const displayTitle = computed(() => 
  TRANSACTION_TYPE_LABELS[props.transaction.type] ?? props.transaction.title
)

/**
 * Get initiator display string.
 */
const initiatorDisplay = computed(() => {
  const initiator = props.transaction.initiator
  return initiator?.signature ?? initiator?.name ?? 'System'
})

/**
 * Get concerned party display string.
 */
const concernedDisplay = computed(() => {
  const party = props.transaction.concerned_party
  return party?.signature ?? party?.name ?? initiatorDisplay
})

/**
 * Get primary balance change for display.
 */
const primaryChange = computed(() => {
  const changes = props.transaction.balance_changes
  // Priority: coins > diamonds > wealth_xp > charm_xp
  return changes.coins ?? changes.diamonds ?? changes.wealth_xp ?? changes.charm_xp ?? null
})

/**
 * Get change color based on value.
 */
const changeColor = computed(() => {
  const change = primaryChange.value?.change
  if (!change) return undefined
  return change.startsWith('-') ? 'error' : 'success'
})

/**
 * Get thumbnail URL with fallback.
 */
const thumbnailUrl = computed(() => 
  props.transaction.thumbnail_url ?? '/siteAssets/badges/badge-charm-level-1.webp'
)

// ========================================
// Helpers
// ========================================

/**
 * Build timeline entry for balance change.
 */
function buildBalanceEntry(label: string, balance?: BalanceChange | null): TimelineEntry {
  if (!balance) {
    return {
      title: `${label} Balance Change`,
      summary: '[No Effect]',
      icon: 'i-lucide-minus',
    }
  }

  return {
    title: `${label} Balance Change`,
    details: [
      { label: 'Before', value: formatCurrency(balance.before) },
      { label: 'After', value: formatCurrency(balance.after) },
      { label: 'Change', value: formatCurrency(balance.change) },
    ],
    icon: 'i-lucide-check-check',
  }
}

/**
 * Build timeline items for transaction details.
 */
const timelineItems = computed<TimelineEntry[]>(() => {
  const items: TimelineEntry[] = [
    {
      title: 'Transaction Type',
      summary: displayTitle.value,
      icon: 'i-lucide-tag',
    },
    {
      title: 'Initiated By',
      summary: initiatorDisplay.value,
      icon: 'i-lucide-user',
    },
    {
      title: 'Concerned Party',
      summary: concernedDisplay.value,
      icon: 'i-lucide-users',
    },
  ]

  // Add all balance changes
  const changes = props.transaction.balance_changes
  
  // Specific handling for diamond exchange
  if (props.transaction.type === 'diamond_exchange' && props.transaction.metadata) {
    // Add Coins Received
    if (props.transaction.metadata.coins_received) {
      items.push({
        title: 'Coins Received',
        details: [
          { label: 'Amount', value: `+${formatCurrency(String(props.transaction.metadata.coins_received))}` },
        ],
        icon: 'i-lucide-plus',
      })
    }
    // Add Exchange Rate
    if (props.transaction.metadata.exchange_rate) {
      items.push({
        title: 'Exchange Rate',
        details: [
          { label: 'Rate', value: `1 Diamond = ${props.transaction.metadata.exchange_rate} Coins` },
        ],
        icon: 'i-lucide-arrow-right-left',
      })
    }
  }
  else {
    // Standard handling for other types
    items.push(buildBalanceEntry('Coins', changes.coins))
  }

  items.push(buildBalanceEntry('Diamonds', changes.diamonds))
  items.push(buildBalanceEntry('Wealth XP', changes.wealth_xp))
  items.push(buildBalanceEntry('Charm XP', changes.charm_xp))

  // Add completion indicator
  items.push({
    title: 'Transaction Completed Successfully',
    icon: 'i-lucide-thumbs-up',
  })

  return items
})

const activeTimelineIndex = computed<number | undefined>(() => {
  const { length } = timelineItems.value
  return length ? length - 1 : undefined
})
</script>

<template>
  <UCollapsible :ui="{content: 'bg-linear-to-br from-neutral-300/10 to-neutral-950 shadow-xl shadow-neutral-950'}">
    <div
        class="grid grid-cols-14 gap-2 p-2 bg-linear-to-br from-neutral-950 shadow-xl shadow-neutral-950 mb-1"
        :class="changeColor == 'error' ? 'to-error-950' : 'to-success-950'"
    >
      <div class="rounded-full bg-elevated border inset-shadow-sm col-span-2 overflow-hidden aspect-square">
        <NuxtImg
            class="h-full mx-auto rounded"
            :src="thumbnailUrl"
            :alt="displayTitle"
        />
      </div>
      <div class="col-span-9">
        <p class="text-sm font-bold leading-tight">{{ displayTitle }} <span class="text-primary text-xs font-semibold">ID: {{ transaction.id }}</span></p>
        <div class="flex gap-1 text-muted">
          <p class="w-full truncate text-xs font-bold leading-tight">
            Initiator:
            <br>
            {{ initiatorDisplay }}
          </p>
          <p class="w-full truncate text-xs font-bold leading-tight">
            Concerned:
            <br>
            {{ concernedDisplay }}
          </p>
        </div>
      </div>
      <div class="col-span-3 flex flex-col items-end justify-between">
        <p class="text-xs leading-tight">{{ formattedTime }}</p>
        <UButton
          class="shadow-lg text-white ml-2"
          size="xs"
          trailing-icon="i-lucide-arrow-down"
          variant="subtle"
          :color="changeColor"
        >
          {{ formatCurrency(primaryChange?.change) ?? '--' }}
        </UButton>
      </div>
    </div>
    <template #content>
      <UTimeline
        :default-value="activeTimelineIndex"
        :items="timelineItems"
        :ui="{ indicator: '!text-white p-0 text-xl' }"
        class="p-3"
      >
        <template #title="{ item }">
          <div class="space-y-1">
            <p class="flex justify-between">
              <span class="text-muted">{{ item.title }}</span>
              <span v-if="item.summary">{{ item.summary }}</span>
            </p>
            <p
              v-for="detail in item.details"
              :key="detail.label"
              class="flex justify-between"
            >
              <span class="text-muted">{{ detail.label }}</span>
              <span>{{ detail.value }}</span>
            </p>
          </div>
        </template>
      </UTimeline>
    </template>
  </UCollapsible>
</template>
