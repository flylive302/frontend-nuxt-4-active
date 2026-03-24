<script setup lang="ts">
// ========================================
// Imports
// ========================================

import BadgeCard from '~/components/badges/BadgeCard.vue'
import type { BadgeCategory } from '~/types/progression/badge'
import { BADGE_CATEGORY_LABELS, BADGE_CATEGORY_ICONS } from '~/constants/badges'

// ========================================
// Page Configuration
// ========================================

definePageMeta({ 
  layout: 'alt',
  middleware: 'auth',
})

// ========================================
// Store + Composables
// ========================================

const badgesStore = useBadgesStore()
const { fetchCatalog, fetchUserBadges, setCategory } = useBadgeData()

// ========================================
// Constants
// ========================================

const categoryTabs: { label: string; value: BadgeCategory | null; icon: string }[] = [
  { label: 'All', value: null, icon: 'i-lucide-grid' },
  { label: 'Wealth', value: 'wealth', icon: BADGE_CATEGORY_ICONS.wealth },
  { label: 'Charm', value: 'charm', icon: BADGE_CATEGORY_ICONS.charm },
  { label: 'Room', value: 'room', icon: BADGE_CATEGORY_ICONS.room },
  { label: 'Agency', value: 'agency', icon: BADGE_CATEGORY_ICONS.agency },
  { label: 'Special', value: 'special', icon: BADGE_CATEGORY_ICONS.special },
]

// ========================================
// State
// ========================================

const activeTabIndex = ref(0)

// ========================================
// Computed
// ========================================

const badges = computed(() => badgesStore.catalog.items)
const userBadges = computed(() => badgesStore.userBadges.items)
const isLoading = computed(() => badgesStore.catalog.loading)
const currentCategory = computed(() => badgesStore.currentCategory)

/**
 * Get user badge for a catalog badge if earned.
 */
function getUserBadge(badgeId: number) {
  return userBadges.value.find(ub => ub.badge_id === badgeId) ?? null
}

/**
 * Filter badges by current category.
 */
const filteredBadges = computed(() => {
  if (!currentCategory.value) return badges.value
  return badges.value.filter(b => b.category === currentCategory.value)
})

// ========================================
// Handlers
// ========================================

async function handleTabChange(index: number): Promise<void> {
  activeTabIndex.value = index
  const category = categoryTabs[index]?.value ?? null
  await setCategory(category)
}

// ========================================
// Lifecycle
// ========================================

onMounted(async () => {
  // Fetch catalog and user badges in parallel
  await Promise.all([
    fetchCatalog({}, true),
    fetchUserBadges(true),
  ])
})
</script>

<template>
  <main>
    <NavAlt color="secondary" back-to="/profile" :linked="true" first-link="/badges/" second-link="/badges/my-badges">
      <template #first-link-text>Badges</template>
      <template #second-link-text>My Badges</template>
    </NavAlt>

    <div class="px-3 mt-14 mb-32 overflow-hidden">
      <!-- Category Tabs -->
      <div class="flex gap-2 overflow-x-auto pb-2 mb-4">
        <UButton
          v-for="(tab, index) in categoryTabs"
          :key="tab.value ?? 'all'"
          :variant="activeTabIndex === index ? 'solid' : 'soft'"
          :color="activeTabIndex === index ? 'secondary' : 'neutral'"
          size="sm"
          :icon="tab.icon"
          class="shrink-0"
          @click="handleTabChange(index)"
        >
          {{ tab.label }}
        </UButton>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading && badges.length === 0" class="grid grid-cols-3 gap-2">
        <div v-for="i in 9" :key="i" class="animate-pulse bg-elevated rounded-lg aspect-square" />
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredBadges.length === 0" class="py-16 text-center">
        <icon name="i-lucide-award" class="size-16 mx-auto text-muted mb-4" />
        <p class="text-lg font-semibold">No Badges Found</p>
        <p class="text-sm text-muted mt-1">
          {{ currentCategory ? `No ${BADGE_CATEGORY_LABELS[currentCategory]} badges available.` : 'Check back later for new badges!' }}
        </p>
      </div>

      <!-- Badge Grid -->
      <div v-else class="grid grid-cols-3 gap-2">
        <BadgeCard
          v-for="badge in filteredBadges"
          :key="badge.id"
          :badge="badge"
          :user-badge="getUserBadge(badge.id)"
        />
      </div>

      <!-- Loading More -->
      <div v-if="isLoading && badges.length > 0" class="py-4 text-center">
        <UIcon name="i-lucide-loader-2" class="size-6 animate-spin" />
      </div>
    </div>
  </main>
</template>