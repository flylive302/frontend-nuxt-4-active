<script setup lang="ts">
// ========================================
// Imports
// ========================================

import BadgeCard from '~/components/badges/BadgeCard.vue'

// ========================================
// Page Configuration
// ========================================

definePageMeta({ 
  layout: 'alt',
  middleware: 'auth',
})

// ========================================
// Store
// ========================================

const badgesStore = useBadgesStore()

// ========================================
// State
// ========================================

const activeTab = ref(0)
const tabs = [
  { label: 'Displayed', value: 'displayed' },
  { label: 'Hidden', value: 'hidden' },
]

// ========================================
// Computed
// ========================================

const displayedBadges = computed(() => badgesStore.displayedBadges)
const hiddenBadges = computed(() => badgesStore.hiddenBadges)
const stats = computed(() => badgesStore.stats)
const isLoading = computed(() => badgesStore.userBadges.loading)
const isTogglingId = computed(() => badgesStore.isTogglingDisplay)

const currentBadges = computed(() => 
  activeTab.value === 0 ? displayedBadges.value : hiddenBadges.value
)

// ========================================
// Handlers
// ========================================

async function handleToggle(userBadgeId: number): Promise<void> {
  await badgesStore.toggleDisplay(userBadgeId)
}

function handleTabChange(index: number): void {
  activeTab.value = index
}

// ========================================
// Lifecycle
// ========================================

onMounted(async () => {
  // Fetch user badges and stats
  await Promise.all([
    badgesStore.fetchUserBadges({}, true),
    badgesStore.fetchStats(),
  ])
})
</script>

<template>
  <main>
    <NavAlt color="secondary" back-to="/profile" :linked="true" first-link="/badges/" second-link="/badges/my-badges">
      <template #first-link-text>Badges</template>
      <template #second-link-text>My Badges</template>
    </NavAlt>

    <div class="px-3 mt-16 mb-32 overflow-hidden">
      <!-- Stats Summary -->
      <div v-if="stats" class="grid grid-cols-2 gap-2 mb-4">
        <div class="bg-elevated rounded-lg p-3 text-center">
          <p class="text-xs text-muted">Total Earned</p>
          <p class="text-2xl font-bold text-primary">{{ stats.total_earned }}</p>
        </div>
        <div class="bg-elevated rounded-lg p-3 text-center">
          <p class="text-xs text-muted">Displayed</p>
          <p class="text-2xl font-bold text-green-500">{{ stats.total_displayed }}</p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-2 mb-4">
        <UButton
          v-for="(tab, index) in tabs"
          :key="tab.value"
          :variant="activeTab === index ? 'solid' : 'soft'"
          :color="activeTab === index ? 'secondary' : 'neutral'"
          size="sm"
          @click="handleTabChange(index)"
        >
          {{ tab.label }}
          <UBadge v-if="index === 0" size="xs" variant="soft" class="ml-1">
            {{ displayedBadges.length }}
          </UBadge>
          <UBadge v-else size="xs" variant="soft" class="ml-1">
            {{ hiddenBadges.length }}
          </UBadge>
        </UButton>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading && currentBadges.length === 0" class="grid grid-cols-3 gap-2">
        <div v-for="i in 6" :key="i" class="animate-pulse bg-elevated rounded-lg aspect-square" />
      </div>

      <!-- Empty State -->
      <div v-else-if="currentBadges.length === 0" class="py-16 text-center">
        <icon name="i-lucide-award" class="size-16 mx-auto text-muted mb-4" />
        <p class="text-lg font-semibold">
          {{ activeTab === 0 ? 'No Displayed Badges' : 'No Hidden Badges' }}
        </p>
        <p class="text-sm text-muted mt-1">
          {{ activeTab === 0 
            ? 'Toggle badges to display them on your profile.' 
            : 'All your badges are currently displayed!' 
          }}
        </p>
      </div>

      <!-- Badge Grid -->
      <div v-else class="grid grid-cols-3 gap-2">
        <BadgeCard
          v-for="userBadge in currentBadges"
          :key="userBadge.id"
          :badge="userBadge.badge"
          :user-badge="userBadge"
          :show-toggle="true"
          :is-toggling="isTogglingId === userBadge.id"
          @toggle="handleToggle"
        />
      </div>
    </div>
  </main>
</template>