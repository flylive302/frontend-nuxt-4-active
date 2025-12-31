<!-- ~/components/transaction-item.vue -->
<!-- Displays a single transaction with expandable details -->
<script setup lang="ts">
import { computed } from 'vue'
import type { Transaction, BalanceChange } from '~/types/wallet'
import { TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS } from '~/types/wallet'

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
  summary?: string
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
  return party?.signature ?? party?.name ?? '-'
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
  if (!change) return ''
  return change.startsWith('-') ? 'text-red-500' : 'text-green-500'
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
      { label: 'Before', value: balance.before },
      { label: 'After', value: balance.after },
      { label: 'Change', value: balance.change },
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
  items.push(buildBalanceEntry('Coins', changes.coins))
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
  <UCollapsible>
    <div class="grid grid-cols-14 gap-1 bg-primary/20 p-1">
      <NuxtImg
        class="col-span-2 w-full rounded"
        provider="imagekit"
        :src="thumbnailUrl"
        :alt="displayTitle"
      />
      <div class="col-span-8">
        <p class="text-sm font-bold leading-tight">{{ displayTitle }}</p>
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
      <div class="col-span-4 flex flex-col justify-between">
        <p class="text-xs leading-tight">{{ formattedTime }}</p>
        <UButton
          block
          class="px-1 shadow-lg"
          icon="i-lucide-coins"
          size="xs"
          trailing-icon="i-lucide-arrow-down"
          variant="subtle"
          :class="changeColor"
        >
          {{ primaryChange?.change ?? '--' }}
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
