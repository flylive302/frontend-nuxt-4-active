<script setup lang="ts">
// ========================================
// Imports
// ========================================

import TransactionItem from '~/components/transaction-item.vue'
import type { TransactionTypeFilter } from '~/types/wallet'

// ========================================
// Page Configuration
// ========================================

definePageMeta({
  layout: 'alt',
  middleware: 'auth',
})

// ========================================
// Store & Composables
// ========================================

const transactionStore = useTransactionStore()
const { useInfiniteScroll } = await import('@vueuse/core')

// ========================================
// Types
// ========================================

interface FilterTab {
  label: string
  value: TransactionTypeFilter
}

// ========================================
// Constants
// ========================================

const FILTER_TABS: FilterTab[] = [
  { label: 'All Transactions', value: 'all' },
  { label: 'Coins', value: 'coins' },
  { label: 'Diamonds', value: 'diamonds' },
  { label: 'Gifts', value: 'gifts' },
]

// ========================================
// State
// ========================================

const activeTab = ref(0)

// ========================================
// Computed
// ========================================

const transactionsByDate = computed(() => transactionStore.transactions.transactionsByDate)
const isLoading = computed(() => transactionStore.transactions.loading)
const hasMore = computed(() => transactionStore.transactions.hasMore)
const error = computed(() => transactionStore.transactions.error)
const isEmpty = computed(() => transactionStore.isEmpty)
const currentFilter = computed(() => transactionStore.currentFilter)

// ========================================
// Event Handlers
// ========================================

/**
 * Handle filter tab change.
 */
async function handleTabChange(index: number): Promise<void> {
  activeTab.value = index
  const filter = FILTER_TABS[index]?.value ?? 'all'
  await transactionStore.changeFilter(filter)
}

/**
 * Retry fetching after error.
 */
async function handleRetry(): Promise<void> {
  await transactionStore.fetch({ type: currentFilter.value }, true)
}

// ========================================
// Infinite Scroll
// ========================================

if (import.meta.client) {
  useInfiniteScroll(
    () => window,
    async () => {
      if (!hasMore.value || isLoading.value) return
      await transactionStore.loadMore()
    },
    { distance: 400, interval: 200 }
  )
}

// ========================================
// Lifecycle
// ========================================

onMounted(async () => {
  // Only fetch if we don't have data
  if (transactionStore.transactions.transactionsByDate.length === 0) {
    await transactionStore.fetch({ type: 'all' }, true)
  }
})
</script>

<template>
  <main>
    <NavAlt back-to="/wallet/purchase-coins">Transaction History</NavAlt>
    <div class="h-10" />

    <!-- Filter Tabs -->
    <div class="px-3 mb-4">
      <div class="flex gap-2 overflow-x-auto pb-2">
        <UButton
          v-for="(tab, index) in FILTER_TABS"
          :key="tab.value"
          :variant="activeTab === index ? 'solid' : 'soft'"
          :color="activeTab === index ? 'primary' : 'neutral'"
          size="sm"
          class="shrink-0"
          @click="handleTabChange(index)"
        >
          {{ tab.label }}
        </UButton>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="px-3 py-8 text-center">
      <UAlert
        color="error"
        variant="soft"
        icon="i-lucide-alert-circle"
        title="Failed to load transactions"
        :description="error"
      />
      <UButton
        class="mt-4"
        color="primary"
        variant="soft"
        @click="handleRetry"
      >
        Try Again
      </UButton>
    </div>

    <!-- Empty State -->
    <div v-else-if="isEmpty && !isLoading" class="px-3 py-16 text-center">
      <icon name="i-lucide-receipt" class="size-16 mx-auto text-muted mb-4" />
      <p class="text-lg font-semibold">No Transactions Yet</p>
      <p class="text-sm text-muted mt-1">
        Your transaction history will appear here.
      </p>
    </div>

    <!-- Transaction List -->
    <template v-else>
      <UCollapsible
        v-for="day in transactionsByDate"
        :key="day.date"
        :default-open="true"
      >
        <div class="mb-2 mt-4 flex items-center justify-between px-3">
          <SectionTitle>{{ day.date_formatted }}</SectionTitle>
          <icon name="i-lucide-chevron-down" />
        </div>
        <template #content>
          <TransactionItem
            v-for="transaction in day.transactions"
            :key="transaction.id"
            :transaction="transaction"
          />
        </template>
      </UCollapsible>

      <!-- Loading More -->
      <div v-if="isLoading" class="py-4 text-center">
        <UIcon name="i-lucide-loader-2" class="size-6 animate-spin" />
        <p class="text-sm text-muted mt-2">Loading...</p>
      </div>

      <!-- End of List -->
      <div v-else-if="!hasMore && !isEmpty" class="py-6 text-center text-sm text-muted">
        You're all caught up!
      </div>
    </template>
  </main>
</template>
