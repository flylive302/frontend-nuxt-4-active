<script setup lang="ts">
// ========================================
// Imports
// ========================================

import { FILTER_TABS } from '~/constants/economy/transactionConstants'

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
const { fetchTransactions, loadMore, changeFilter } = useTransactionData()

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
// SSR Data Loading
// ========================================

await useAsyncData('transaction-history', async () => {
  if (transactionStore.transactions.transactionsByDate.length === 0) {
    await fetchTransactions({ type: 'all' }, true)
  }
  return true
})

// ========================================
// Event Handlers
// ========================================

/**
 * Handle filter tab change.
 */
async function handleTabChange(index: number): Promise<void> {
  activeTab.value = index
  const filter = FILTER_TABS[index]?.value ?? 'all'
  await changeFilter(filter)
}

/**
 * Retry fetching after error.
 */
async function handleRetry(): Promise<void> {
  await fetchTransactions({ type: currentFilter.value }, true)
}

// ========================================
// Infinite Scroll
// ========================================

if (import.meta.client) {
  const { useInfiniteScroll } = await import('@vueuse/core')
  useInfiniteScroll(
    () => window,
    async () => {
      if (!hasMore.value || isLoading.value) return
      await loadMore()
    },
    { distance: 400, interval: 200 }
  )
}
</script>

<template>
  <main>
    <NavAlt back-to="/wallet/purchase-coins">Transaction History</NavAlt>
    <div class="h-9" />

    <!-- Filter Tabs -->
    <div class="flex overflow-x-auto border-b-2 mb-1 border-black shadow-xl shadow-primary-950/50">
      <UButton
        v-for="(tab, index) in FILTER_TABS" :key="tab.value" :variant="activeTab === index ? 'subtle' : 'soft'"
        :color="activeTab === index ? 'primary' : 'neutral'" size="lg" class="rounded-none min-w-fit"
        @click="handleTabChange(index)"
      >
        {{ tab.label }}
      </UButton>
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
        <div class="mb-2 flex items-center justify-between px-3">
          <SectionTitle>{{ day.date_formatted }}</SectionTitle>
          <icon name="i-lucide-chevron-down" />
        </div>
        <template #content>
          <EconomyTransactionItem
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
