<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { onMounted, watch } from 'vue'
// Note: Agency type only needed for component prop inference, not direct use

// ========================================
// Page Configuration
// ========================================

definePageMeta({ layout: 'alt', middleware: 'auth' })

// ========================================
// Composables / Injected Dependencies
// ========================================

const agencyStore = useAgencyStore()
const authStore = useAuthStore()

// ========================================
// Component State
// ========================================

const searchQuery = ref('')
const selectedCountry = ref('')
const searchDebounced = refDebounced(searchQuery, 300)

// ========================================
// Event Handlers
// ========================================

async function handleSearch(): Promise<void> {
  agencyStore.agencies.filters.search = searchDebounced.value
  agencyStore.agencies.filters.country = selectedCountry.value
  await agencyStore.fetchAgencies(agencyStore.agencies.filters, true)
}

async function handleLoadMore(): Promise<void> {
  await agencyStore.fetchAgencies()
}

function handleResetFilters(): void {
  searchQuery.value = ''
  selectedCountry.value = ''
  handleSearch()
}

// ========================================
// Lifecycle & Watchers
// ========================================

onMounted(() => {
  if (agencyStore.agencies.items.length === 0) {
    agencyStore.fetchAgencies({}, true)
  }
})

// Watch for filter changes
watch([searchDebounced, selectedCountry], () => {
  handleSearch()
})

// ========================================
// Computed
// ========================================

const canCreateAgency = computed(() => {
  return !agencyStore.isAgencyMember && !authStore.user?.is_blocked
})

const hasActiveFilters = computed(() => {
  return searchQuery.value.length > 0 || selectedCountry.value.length > 0
})
</script>

<template>
  <main>
    <NavAlt back-to="/profile">All Agencies</NavAlt>
    
    <div class="px-3 pt-14 pb-24">
      <!-- Search & Filter Section -->
      <div class="space-y-3 mb-4">
        <!-- Search Input -->
        <UInput
          v-model="searchQuery"
          placeholder="Search agencies by name..."
          icon="i-lucide-search"
          size="lg"
          class="w-full"
          :loading="agencyStore.agencies.loading && searchQuery.length > 0"
        />

        <!-- Country Filter -->
        <div class="flex gap-2">
          <USelect
            v-model="selectedCountry"
            placeholder="Filter by country"
            :options="[
              { label: 'All Countries', value: '' },
              { label: 'Pakistan', value: 'PK' },
              { label: 'United States', value: 'US' },
              { label: 'United Kingdom', value: 'GB' },
              { label: 'India', value: 'IN' },
              { label: 'Saudi Arabia', value: 'SA' },
              { label: 'UAE', value: 'AE' },
            ]"
            class="flex-1"
            size="md"
          />
          
          <UButton
            v-if="hasActiveFilters"
            variant="ghost"
            color="neutral"
            icon="i-lucide-x"
            size="md"
            @click="handleResetFilters"
          />
        </div>
      </div>

      <!-- Loading Skeleton -->
      <div
        v-if="agencyStore.agencies.loading && agencyStore.agencies.items.length === 0"
        class="grid grid-cols-2 gap-3"
      >
        <div v-for="i in 6" :key="i" class="animate-pulse">
          <div class="aspect-square bg-muted rounded-lg" />
          <div class="p-2 space-y-2">
            <div class="h-4 bg-muted rounded w-3/4" />
            <div class="h-3 bg-muted rounded w-1/2" />
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="!agencyStore.agencies.loading && agencyStore.agencies.items.length === 0"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <div class="size-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <icon name="i-lucide-building-2" class="size-10 text-primary" />
        </div>
        <h3 class="text-lg font-semibold mb-1">
          {{ hasActiveFilters ? 'No Results' : 'No Agencies Yet' }}
        </h3>
        <p class="text-sm text-muted max-w-xs">
          {{ hasActiveFilters 
            ? 'Try adjusting your search or filters.' 
            : 'Be the first to create an agency!' 
          }}
        </p>
        <UButton
          v-if="hasActiveFilters"
          variant="soft"
          color="primary"
          class="mt-4"
          @click="handleResetFilters"
        >
          Clear Filters
        </UButton>
      </div>

      <!-- Agencies Grid -->
      <div v-else class="grid grid-cols-2 gap-3">
        <AgencyCard
          v-for="agency in agencyStore.agencies.items"
          :id="String(agency.id)"
          :key="agency.id"
          :name="agency.name"
          :members="agency.member_count || 0"
          :country-code="agency.country.toLowerCase()"
          :avatar="agency.logo || undefined"
          :status="agency.status"
        />
      </div>

      <!-- Load More -->
      <div
        v-if="agencyStore.agencies.hasMore && agencyStore.agencies.items.length > 0"
        class="flex justify-center pt-6"
      >
        <UButton
          variant="soft"
          color="primary"
          :loading="agencyStore.agencies.loading"
          @click="handleLoadMore"
        >
          Load More Agencies
        </UButton>
      </div>

      <!-- Error State -->
      <UAlert
        v-if="agencyStore.agencies.error"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        :title="agencyStore.agencies.error"
        class="mt-4"
      />
    </div>

    <!-- Create Agency Footer (conditional) -->
    <footer
      v-if="canCreateAgency"
      aria-label="Primary"
      class="fixed inset-x-2 z-50 bottom-4"
    >
      <BgGlass
        class="border border-white/40 px-3 py-2"
        frost-blur-radius="blur(4px)"
        :noise-frequency="0.009"
        :noise-strength="200"
        rounded="rounded-lg"
      >
        <UButton 
          size="lg" 
          class="w-full justify-center" 
          to="/agency/create"
          icon="i-lucide-plus"
        >
          Create New Agency
        </UButton>
      </BgGlass>
    </footer>
  </main>
</template>