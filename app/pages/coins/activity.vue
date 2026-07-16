<script setup lang="ts">
// ========================================
// Imports
// ========================================

import type { Component } from 'vue'
import { defineAsyncComponent } from 'vue'
import { FILTER_TABS } from '~/constants/economy/transactionConstants'

// Async-load vue-virtual-scroller + its CSS so the feature-scroller chunk
// doesn't get linked as render-blocking CSS on routes that don't reach this
// page (mirrors app/components/room/chat-panel.vue).
const DynamicScroller = defineAsyncComponent(async () => {
  if (import.meta.client) await import('vue-virtual-scroller/dist/vue-virtual-scroller.css')
  return (await import('vue-virtual-scroller')).DynamicScroller as unknown as Component
})
const DynamicScrollerItem = defineAsyncComponent(async () =>
  (await import('vue-virtual-scroller')).DynamicScrollerItem as unknown as Component,
)

// ========================================
// Page Configuration
// ========================================

definePageMeta({
  layout: 'alt',
  middleware: 'auth',
})

// ========================================
// Constants
// ========================================

const ACTIVITY_ITEM_MIN_SIZE = 56

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

const { items: activityItems, toggleDate } = useTransactionActivityList(transactionsByDate)

// ========================================
// SSR Data Loading
// ========================================

await useAsyncData('coin-activity', async () => {
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
    <NavAlt back-to="/coins/request">Activity History</NavAlt>
    <div class="pt-9 safe-area-top" />

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
        title="Failed to load activity"
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
      <p class="text-lg font-semibold">No Activity Yet</p>
      <p class="text-sm text-muted mt-1">
        Your coin activity will appear here.
      </p>
    </div>

    <!-- Transaction List -->
    <template v-else>
      <DynamicScroller
        :items="activityItems"
        :min-item-size="ACTIVITY_ITEM_MIN_SIZE"
        key-field="key"
        page-mode
      >
        <template #default="{ item, index, active }">
          <DynamicScrollerItem
            :item="item"
            :active="active"
            :data-index="index"
            :size-dependencies="[item.type]"
          >
            <div v-if="item.type === 'header'" class="mb-2 flex items-center justify-between px-3 cursor-pointer" @click="toggleDate(item.date)">
              <SectionTitle>{{ item.dateFormatted }}</SectionTitle>
              <icon name="i-lucide-chevron-down" :class="{ 'rotate-180': item.collapsed }" class="transition-transform" />
            </div>
            <EconomyTransactionItem v-else :transaction="item.transaction" />
          </DynamicScrollerItem>
        </template>
      </DynamicScroller>

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
