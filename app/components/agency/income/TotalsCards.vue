<!-- ~/components/agency/income/TotalsCards.vue -->
<!-- Earned / Exchanged / Deducted breakdown. When `collapsible` (default),
     Exchanged and Deducted expand to a list of their contributing
     transactions. When not collapsible, every row is a plain static figure
     (used by the owner/member cycle heroes, which have no transaction list).
     `earnedSplit` adds an Own hosting / Owner cut line under Earned, shown only
     when the owner cut is non-zero. -->
<script setup lang="ts">
// ========================================
// Imports
// ========================================

import { ref } from 'vue'
import type { EarnedSplit, IncomeTotals, RunDeduction, RunExchange } from '~/types/income/income'
import { formatDiamondsExact, formatRunDate } from '~/utils/incomeFormat'

// ========================================
// Props
// ========================================

withDefaults(defineProps<{
  totals: IncomeTotals
  earnedSplit?: EarnedSplit | null
  exchanges?: RunExchange[]
  deductions?: RunDeduction[]
  collapsible?: boolean
}>(), {
  earnedSplit: null,
  exchanges: () => [],
  deductions: () => [],
  collapsible: true,
})

// ========================================
// State
// ========================================

const exchangedOpen = ref(false)
const deductedOpen = ref(false)
</script>

<template>
  <div class="space-y-2">
    <!-- Earned -->
    <div class="bg-linear-to-bl to-neutral-950 border border-neutral-700 rounded-lg p-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold text-muted">Earned</span>
        <span class="flex items-center gap-1 font-bold text-success">
          <UIcon name="i-lucide-gem" class="size-4" />
          {{ formatDiamondsExact(totals.earned) }}
        </span>
      </div>

      <div v-if="earnedSplit && earnedSplit.owner_cut > 0" class="mt-3 space-y-2">
        <div class="flex items-center justify-between text-sm bg-elevated/60 rounded-md p-2">
          <span class="text-muted">Own hosting</span>
          <span class="flex items-center gap-1">
            <UIcon name="i-lucide-gem" class="size-3.5" />
            {{ formatDiamondsExact(earnedSplit.own_hosting) }}
          </span>
        </div>
        <div class="flex items-center justify-between text-sm bg-elevated/60 rounded-md p-2">
          <span class="text-muted">Owner cut</span>
          <span class="flex items-center gap-1">
            <UIcon name="i-lucide-gem" class="size-3.5" />
            {{ formatDiamondsExact(earnedSplit.owner_cut) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Exchanged -->
    <div v-if="collapsible" class="bg-linear-to-bl to-neutral-950 border border-neutral-700 rounded-lg p-3">
      <button
        type="button"
        class="w-full flex items-center justify-between"
        :aria-expanded="exchangedOpen"
        @click="exchangedOpen = !exchangedOpen"
      >
        <span class="text-sm font-semibold text-muted">Exchanged</span>
        <span class="flex items-center gap-2">
          <span class="flex items-center gap-1 font-bold text-warning">
            <UIcon name="i-lucide-gem" class="size-4" />
            {{ formatDiamondsExact(totals.exchanged) }}
          </span>
          <UIcon :name="exchangedOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-4 text-muted" />
        </span>
      </button>

      <div v-if="exchangedOpen" class="mt-3 space-y-2">
        <div
          v-for="exchange in exchanges"
          :key="exchange.id"
          class="flex items-center justify-between text-sm bg-elevated/60 rounded-md p-2"
        >
          <span class="text-muted">{{ formatRunDate(exchange.at) }}</span>
          <span class="flex items-center gap-1">
            <UIcon name="i-lucide-gem" class="size-3.5" />
            {{ formatDiamondsExact(exchange.diamonds) }}
          </span>
          <span class="flex items-center gap-1 text-secondary">
            <UIcon name="i-lucide-coins" class="size-3.5" />
            {{ exchange.coins_received.toLocaleString('en-US') }}
          </span>
        </div>

        <p v-if="exchanges.length === 0" class="text-xs text-muted text-center py-2">
          No exchanges in this run
        </p>
      </div>
    </div>
    <div v-else class="bg-linear-to-bl to-neutral-950 border border-neutral-700 rounded-lg p-3 flex items-center justify-between">
      <span class="text-sm font-semibold text-muted">Exchanged</span>
      <span class="flex items-center gap-1 font-bold text-warning">
        <UIcon name="i-lucide-gem" class="size-4" />
        {{ formatDiamondsExact(totals.exchanged) }}
      </span>
    </div>

    <!-- Deducted -->
    <div v-if="collapsible" class="bg-linear-to-bl to-neutral-950 border border-neutral-700 rounded-lg p-3">
      <button
        type="button"
        class="w-full flex items-center justify-between"
        :aria-expanded="deductedOpen"
        @click="deductedOpen = !deductedOpen"
      >
        <span class="text-sm font-semibold text-muted">Deducted</span>
        <span class="flex items-center gap-2">
          <span class="flex items-center gap-1 font-bold text-error">
            <UIcon name="i-lucide-gem" class="size-4" />
            {{ formatDiamondsExact(totals.deducted) }}
          </span>
          <UIcon :name="deductedOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-4 text-muted" />
        </span>
      </button>

      <div v-if="deductedOpen" class="mt-3 space-y-2">
        <div
          v-for="deduction in deductions"
          :key="deduction.id"
          class="flex items-center justify-between text-sm bg-elevated/60 rounded-md p-2"
        >
          <span class="text-muted">{{ formatRunDate(deduction.at) }}</span>
          <span class="flex items-center gap-1">
            <UIcon name="i-lucide-gem" class="size-3.5" />
            {{ formatDiamondsExact(deduction.diamonds) }}
          </span>
          <span class="text-secondary">
            {{ deduction.cash_paid.toLocaleString('en-US') }} {{ deduction.cash_currency }}
          </span>
        </div>

        <p v-if="deductions.length === 0" class="text-xs text-muted text-center py-2">
          No deductions in this run
        </p>
      </div>
    </div>
    <div v-else class="bg-linear-to-bl to-neutral-950 border border-neutral-700 rounded-lg p-3 flex items-center justify-between">
      <span class="text-sm font-semibold text-muted">Deducted</span>
      <span class="flex items-center gap-1 font-bold text-error">
        <UIcon name="i-lucide-gem" class="size-4" />
        {{ formatDiamondsExact(totals.deducted) }}
      </span>
    </div>
  </div>
</template>
