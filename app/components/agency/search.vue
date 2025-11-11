<script setup lang="ts">
import { navigateTo } from 'nuxt/app'
import { ref, computed } from 'vue'
import { useDebounce } from '@vueuse/core'

/** -------- Props -------- */
type ThemeColor = 'primary' | 'secondary' | 'tertiary' | 'success' | 'info' | 'warning' | 'error'

const props = withDefaults(defineProps<{
  color?: ThemeColor
  endpoint?: string
}>(), {
  color: 'primary',
  endpoint: 'https://dummyjson.com/c/0f16-bb65-41ea-a7af'
})

/** -------- Types -------- */
type AgencyId = string

type AgencyApiResponse = {
  id: AgencyId
  name: string
  country: string
  countryCode: string
  avatar: string
  members: number
}

type AgencyListItem = {
  id: AgencyId
  label: string
  name: string
  country: string
  countryCode: string
  members: number
  avatar: { src: string }
  onSelect: () => void
}

type CommandPaletteGroup = {
  id: string
  label: string
  items: AgencyListItem[]
}

/** -------- State -------- */
const isDrawerOpen = ref(false)
const searchTerm = ref('')
const debouncedSearchTerm = useDebounce(searchTerm, 300)

/** -------- Static Theme Classes -------- */
const themeClasses: Record<ThemeColor, { border: string; focus: string }> = {
  primary:   { border: 'border-primary',   focus: 'focus:ring-primary' },
  secondary: { border: 'border-secondary', focus: 'focus:ring-secondary' },
  tertiary:  { border: 'border-tertiary',  focus: 'focus:ring-tertiary' },
  success:   { border: 'border-success',   focus: 'focus:ring-success' },
  info:      { border: 'border-info',      focus: 'focus:ring-info' },
  warning:   { border: 'border-warning',   focus: 'focus:ring-warning' },
  error:     { border: 'border-error',     focus: 'focus:ring-error' }
}

/** -------- Data Fetching -------- */
const {
  data: agenciesData,
  status: fetchStatus,
  error: fetchError
} = await useFetch<AgencyApiResponse[]>(
    () => props.endpoint,
    {
      query: computed(() => ({
        search: debouncedSearchTerm.value // API searches by name & country
      })),
      watch: [debouncedSearchTerm],
      lazy: true,
      default: () => []
    }
)

/** -------- Actions -------- */
function openDrawer(): void {
  isDrawerOpen.value = true
}

/** -------- Computed Data -------- */
const agencyItems = computed<AgencyListItem[]>(() => {
  const agencies = agenciesData.value ?? []

  // Filter out agencies without avatars
  const validAgencies = agencies.filter((agency: AgencyApiResponse) =>
      agency.avatar && agency.avatar.trim().length > 0
  )

  return validAgencies.map((agency: AgencyApiResponse): AgencyListItem => ({
    id: agency.id,
    label: agency.name, // What the palette searches/displays
    name: agency.name,
    country: agency.country,
    countryCode: agency.countryCode,
    members: agency.members,
    avatar: { src: agency.avatar },
    onSelect: () => navigateTo(`/agency/${agency.id}`)
  }))
})

const commandGroups = computed<CommandPaletteGroup[]>(() => {
  const groupLabel = searchTerm.value
      ? `Agencies matching "${searchTerm.value}"`
      : 'Agencies'

  return [{
    id: 'agencies',
    label: groupLabel,
    items: agencyItems.value
  }]
})

const errorMessage = computed<string | null>(() => {
  if (!fetchError.value) return null

  const statusCode = fetchError.value.statusCode

  if (statusCode === 404) return 'Agencies not found'
  if (statusCode === 401 || statusCode === 403) return 'Authentication required'
  if (statusCode >= 500) return 'Server error. Please try again later'

  return 'Unable to load agencies. Check your connection'
})
</script>

<template>
  <header>
    <!-- Search Input + Button Group -->
    <div class="flex justify-between items-baseline">
      <h3 class="text-lg font-semibold leading-none">Search Agencies</h3>

      <UButton
          label="Browse"
          :color="props.color"
          icon="i-lucide-building-2"
          size="md"
          aria-haspopup="dialog"
          aria-controls="agency-search-drawer"
          @click="openDrawer"
      />
    </div>

    <!-- Agency Search Drawer -->
    <UDrawer
        id="agency-search-drawer"
        v-model:open="isDrawerOpen"
        title="Search Agencies"
        description="Find and navigate to agency profiles"
    >
      <template #content>
        <UCommandPalette
            v-model:search-term="searchTerm"
            :loading="fetchStatus === 'pending'"
            :groups="commandGroups"
            placeholder="Search by name or country..."
            class="h-90"
            virtualize
            @select="(item) => item?.onSelect?.()"
        >
          <!-- Custom Agency Row -->
          <template #item="{ item }: { item: AgencyListItem }">
            <div class="flex items-center justify-between gap-3 w-full">
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <UAvatar
                    :src="item.avatar.src"
                    :alt="item.name"
                    :class="['border-2', themeClasses[props.color].border]"
                    size="lg"
                />

                <div class="text-left min-w-0 flex-1">
                  <p class="text-base font-semibold truncate">
                    {{ item.name }}
                  </p>
                  <div class="flex items-center gap-2 text-sm text-muted">
                    <span class="truncate"><icon :name="`i-flag-${item.countryCode.toLowerCase()}-4x3`" /> {{ item.country }}</span>
                    <span class="text-muted/50">•</span>
                    <span class="shrink-0">{{ item.members }} members</span>
                  </div>
                </div>
              </div>

              <UButton
                  icon="i-lucide-arrow-right"
                  variant="ghost"
                  color="neutral"
                  size="sm"
                  :aria-label="`View ${item.name} profile`"
                  @click.stop.prevent="item.onSelect"
              />
            </div>
          </template>

          <!-- Empty State -->
          <template #empty>
            <div class="py-8 text-center">
              <div class="text-4xl mb-2">🔍</div>
              <p class="text-sm font-medium text-muted">No agencies found</p>
              <p class="text-xs text-muted/70 mt-1">
                Try a different search term
              </p>
            </div>
          </template>
        </UCommandPalette>

        <!-- Error Alert -->
        <UAlert
            v-if="errorMessage"
            color="red"
            variant="subtle"
            icon="i-lucide-alert-circle"
            :title="errorMessage"
            class="mt-4"
        />
      </template>
    </UDrawer>
  </header>
</template>