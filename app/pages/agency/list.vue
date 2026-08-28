<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { onMounted, watch } from 'vue'
import { useAgencyBrowsing } from '~/composables/agency/useAgencyBrowsing'
import { useCountries } from '~/composables/shared/useCountries'
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
const { fetchAgencies } = useAgencyBrowsing()
const { countries, loading: countriesLoading, ensureLoaded: ensureCountriesLoaded } = useCountries()

// ========================================
// Constants
// ========================================

/**
 * Sentinel for the "no country filter" entry.
 *
 * Not `''`: an empty string is not a safe item value for the underlying Reka
 * select primitive, and it is not a valid ISO-3166 alpha-2 code either, so it
 * can never collide with a real country. Mapped back to `''` before it reaches
 * the store, which is what the composable treats as "don't send the param".
 */
const ALL_COUNTRIES = 'ALL'

// ========================================
// Types
// ========================================

interface CountryFilterItem {
  name: string
  code: string
}

// ========================================
// Component State
// ========================================

const searchQuery = ref('')
const selectedCountry = ref(ALL_COUNTRIES)
const searchDebounced = refDebounced(searchQuery, 300)

// ========================================
// Event Handlers
// ========================================

async function handleSearch(): Promise<void> {
  agencyStore.agencies.filters.search = searchDebounced.value
  agencyStore.agencies.filters.country = selectedCountry.value === ALL_COUNTRIES ? '' : selectedCountry.value
  await fetchAgencies(agencyStore.agencies.filters, true)
}

async function handleLoadMore(): Promise<void> {
  await fetchAgencies()
}

function handleResetFilters(): void {
  searchQuery.value = ''
  selectedCountry.value = ALL_COUNTRIES
  handleSearch()
}

// ========================================
// Lifecycle & Watchers
// ========================================

onMounted(() => {
  void ensureCountriesLoaded()

  if (agencyStore.agencies.items.length === 0) {
    fetchAgencies({}, true)
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
  return searchQuery.value.length > 0 || selectedCountry.value !== ALL_COUNTRIES
})

/**
 * Country filter options, sourced from the same `countries.json` the create and
 * profile forms use — so every ISO-2 an agency can actually be registered under
 * is selectable here, not just a hard-coded handful.
 *
 * Re-mapped rather than spread: `useCountries` exposes a `readonly` list, and a
 * plain spread would make the item type a readonly/mutable union that
 * `value-key` can no longer narrow.
 */
const countryItems = computed<CountryFilterItem[]>(() => [
  { name: 'All Countries', code: ALL_COUNTRIES },
  ...countries.value.map(country => ({ name: country.name, code: country.code })),
])
</script>

<template>
  <main>
    <NavAlt spacer back-to="/profile">All Agencies</NavAlt>
    
    <div class="px-3 pt-14 pb-24">
      <!-- Search & Filter Section -->
      <div class="space-y-3 mb-4">
        <!-- Search Input — agencies are looked up by their public number (the
             `#1024` shown on each card), not by name. -->
        <UInput
          v-model="searchQuery"
          placeholder="Search by agency ID, e.g. 1024"
          icon="i-lucide-search"
          inputmode="numeric"
          size="lg"
          class="w-full"
          :loading="agencyStore.agencies.loading && searchQuery.length > 0"
        />

        <!-- Country Filter -->
        <div class="flex gap-2">
          <USelectMenu
            v-model="selectedCountry"
            :items="countryItems"
            :loading="countriesLoading"
            value-key="code"
            label-key="name"
            placeholder="Filter by country"
            :search-input="{ icon: 'i-lucide-search', placeholder: 'Search countries...', autocomplete: 'off' }"
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