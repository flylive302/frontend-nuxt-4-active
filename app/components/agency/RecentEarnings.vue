<!-- ~/components/agency/RecentEarnings.vue -->
<!-- Displays recent income earnings in a collapsible list -->
<script setup lang="ts">
import { computed } from 'vue'
import type { RecentEarning } from '~/types/income'

// ========================================
// Props
// ========================================

defineOptions({ name: 'RecentEarnings' })

// ========================================
// Store
// ========================================

const incomeStore = useIncomeStore()

// ========================================
// Computed
// ========================================

const earnings = computed(() => incomeStore.recentEarnings)
const isLoading = computed(() => incomeStore.isLoading)
const hasEarnings = computed(() => earnings.value.length > 0)

const todayTotal = computed(() => incomeStore.summary?.total_today ?? '0')
const weekTotal = computed(() => incomeStore.summary?.total_this_week ?? '0')

/**
 * Format amount for display.
 */
function formatAmount(amount: string): string {
  const value = parseFloat(amount)
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(2) + 'M'
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(2) + 'K'
  }
  return value.toFixed(2)
}

/**
 * Get icon for earning source.
 */
function getSourceIcon(source: RecentEarning['source']): string {
  switch (source) {
    case 'gift':
      return 'i-lucide-gift'
    case 'room_commission':
      return 'i-lucide-mic'
    default:
      return 'i-lucide-coins'
  }
}

/**
 * Get color for earning source.
 */
function getSourceColor(source: RecentEarning['source']): string {
  switch (source) {
    case 'gift':
      return 'text-pink-500'
    case 'room_commission':
      return 'text-blue-500'
    default:
      return 'text-yellow-500'
  }
}
</script>

<template>
  <UCollapsible :default-open="true">
    <div class="flex items-center justify-between px-1 mb-2">
      <SectionTitle>Recent Earnings</SectionTitle>
      <icon name="i-lucide-chevron-down" class="size-5 text-muted" />
    </div>

    <template #content>
      <!-- Loading State -->
      <div v-if="isLoading" class="space-y-2">
        <div v-for="i in 3" :key="i" class="animate-pulse bg-muted rounded-lg h-12" />
      </div>

      <!-- Empty State -->
      <div v-else-if="!hasEarnings" class="bg-elevated rounded-lg p-4 text-center">
        <icon name="i-lucide-wallet" class="size-10 mx-auto text-muted mb-2" />
        <p class="text-sm text-muted">No recent earnings</p>
      </div>

      <!-- Earnings List -->
      <template v-else>
        <!-- Summary Row -->
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div class="bg-elevated rounded-lg p-3 text-center">
            <p class="text-xs text-muted">Today</p>
            <p class="text-lg font-bold text-green-500">+{{ formatAmount(todayTotal) }}</p>
          </div>
          <div class="bg-elevated rounded-lg p-3 text-center">
            <p class="text-xs text-muted">This Week</p>
            <p class="text-lg font-bold text-primary">+{{ formatAmount(weekTotal) }}</p>
          </div>
        </div>

        <!-- Earnings Items -->
        <div class="space-y-2">
          <div
            v-for="earning in earnings"
            :key="earning.date"
            class="flex items-center gap-3 bg-elevated rounded-lg p-3"
          >
            <!-- Source Icon -->
            <div 
              class="size-10 rounded-full bg-muted/30 flex items-center justify-center"
              :class="getSourceColor(earning.source)"
            >
              <icon :name="getSourceIcon(earning.source)" class="size-5" />
            </div>

            <!-- Details -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold truncate">{{ earning.date_formatted }}</p>
              <p class="text-xs text-muted">
                {{ earning.count }} transaction{{ earning.count !== 1 ? 's' : '' }}
              </p>
            </div>

            <!-- Amount -->
            <div class="text-right">
              <p class="text-sm font-bold text-green-500">+{{ formatAmount(earning.amount) }}</p>
            </div>
          </div>
        </div>
      </template>
    </template>
  </UCollapsible>
</template>
