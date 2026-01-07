<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { onMounted, computed } from 'vue'

// ========================================
// Page Configuration
// ========================================

definePageMeta({
  layout: 'alt',
  middleware: 'auth',
})

// ========================================
// Composables / Injected Dependencies
// ========================================

const incomeStore = useIncomeStore()
const agencyStore = useAgencyStore()

// ========================================
// Computed
// ========================================

/**
 * Check if user is an agency member.
 */
const isAgencyMember = computed(() => agencyStore.isAgencyMember)

/**
 * Loading state combining income and target loading.
 */
const isLoading = computed(() => 
  incomeStore.isLoading || incomeStore.isTargetLoading
)

// ========================================
// Lifecycle
// ========================================

onMounted(async () => {
  // Check if user is agency member
  if (!agencyStore.isAgencyMember) {
    await agencyStore.fetchUserAgency()
  }
  
  // Fetch income data
  await incomeStore.fetchAll()
})
</script>

<template>
  <main>
    <NavAlt color="tertiary" back-to="/agency/my-agency">My Income</NavAlt>
    
    <!-- Not Agency Member -->
    <div v-if="!isAgencyMember" class="px-3 py-14 text-center">
      <UIcon name="i-lucide-building-2" class="size-16 text-muted mb-4" />
      <h2 class="text-lg font-semibold mb-2">Agency Members Only</h2>
      <p class="text-sm text-muted mb-4">
        You need to be a member of an agency to view your income.
      </p>
      <UButton to="/agency/list" color="primary">
        Browse Agencies
      </UButton>
    </div>
    
    <!-- Income Dashboard -->
    <div v-else class="px-3 py-14 space-y-6">
      <!-- Active Income Target -->
      <section v-if="incomeStore.hasActiveTarget">
        <SectionTitle type="tertiary">Current Income Target</SectionTitle>
        <AgencyIncomeTargetProgress class="mt-2" />
      </section>
      
      <!-- No Active Target -->
      <div 
        v-else-if="!incomeStore.isTargetLoading" 
        class="text-center py-6 bg-elevated rounded-lg"
      >
        <UIcon name="i-lucide-target" class="size-10 text-muted mb-2" />
        <p class="text-sm text-muted">No active income target</p>
      </div>
      
      <!-- Recent Earnings -->
      <section v-if="incomeStore.recentEarnings.length > 0">
        <SectionTitle type="tertiary">Recent Earnings</SectionTitle>
        <AgencyRecentEarnings class="mt-2" />
      </section>
      
      <!-- Loading States -->
      <div v-if="isLoading" class="space-y-4">
        <div class="animate-pulse space-y-2">
          <div class="h-20 bg-muted rounded-lg" />
          <div class="h-4 bg-muted rounded w-3/4" />
          <div class="h-4 bg-muted rounded w-1/2" />
        </div>
      </div>
      
      <!-- Error State -->
      <UAlert
        v-if="incomeStore.error"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        :title="incomeStore.error"
      />
    </div>
  </main>
</template>
