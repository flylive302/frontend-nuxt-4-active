<script setup lang="ts">
// ========================================
// Imports
// ========================================

import RewardCard from '~/components/rewards/RewardCard.vue'

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

const rewardsStore = useRewardsStore()
const { useInfiniteScroll } = await import('@vueuse/core')

// ========================================
// Computed
// ========================================

const pendingRewards = computed(() => rewardsStore.pending.items)
const historyRewards = computed(() => rewardsStore.history.items)
const stats = computed(() => rewardsStore.stats)
const isLoading = computed(() => rewardsStore.pending.loading)
const isHistoryLoading = computed(() => rewardsStore.history.loading)
const claimingId = computed(() => rewardsStore.claimingId)
const hasClaimable = computed(() => rewardsStore.hasClaimableRewards)
const pendingCount = computed(() => rewardsStore.pendingCount)

// ========================================
// State
// ========================================

const activeTab = ref(0)
const tabs = [
  { label: 'Available', value: 'pending' },
  { label: 'History', value: 'history' },
]

// ========================================
// Handlers
// ========================================

async function handleClaim(rewardId: number): Promise<void> {
  await rewardsStore.claim(rewardId)
}

async function handleClaimAll(): Promise<void> {
  await rewardsStore.claimAll()
}

async function handleTabChange(index: number): Promise<void> {
  activeTab.value = index
  if (index === 1 && rewardsStore.history.items.length === 0) {
    await rewardsStore.fetchHistory({}, true)
  }
}

// ========================================
// Infinite Scroll
// ========================================

if (import.meta.client) {
  useInfiniteScroll(
    () => window,
    async () => {
      if (activeTab.value === 0) {
        if (!rewardsStore.pending.hasMore || rewardsStore.pending.loading) return
        await rewardsStore.fetchPending()
      } else {
        if (!rewardsStore.history.hasMore || rewardsStore.history.loading) return
        await rewardsStore.fetchHistory()
      }
    },
    { distance: 400, interval: 200 }
  )
}

// ========================================
// Lifecycle
// ========================================

onMounted(async () => {
  await rewardsStore.fetchAll()
})
</script>

<template>
  <main>
    <NavAlt back-to="/profile">Rewards</NavAlt>
    <div class="h-10" />

    <!-- Stats Summary -->
    <div v-if="stats" class="px-3 mb-4">
      <div class="grid grid-cols-3 gap-2">
        <div class="bg-elevated rounded-lg p-3 text-center">
          <p class="text-xs text-muted">Available</p>
          <p class="text-xl font-bold text-green-500">{{ stats.total_pending }}</p>
        </div>
        <div class="bg-elevated rounded-lg p-3 text-center">
          <p class="text-xs text-muted">Diamonds</p>
          <p class="text-xl font-bold text-cyan-500">
            <icon name="i-lucide-gem" class="size-4 inline-block" />
            {{ stats.pending_diamonds }}
          </p>
        </div>
        <div class="bg-elevated rounded-lg p-3 text-center">
          <p class="text-xs text-muted">Coins</p>
          <p class="text-xl font-bold text-yellow-500">
            <icon name="i-lucide-coins" class="size-4 inline-block" />
            {{ stats.pending_coins }}
          </p>
        </div>
      </div>

      <!-- Claim All Button -->
      <UButton
        v-if="hasClaimable"
        color="primary"
        class="w-full mt-3"
        :loading="rewardsStore.isClaiming"
        @click="handleClaimAll"
      >
        Claim All ({{ pendingCount }})
      </UButton>
    </div>

    <!-- Tabs -->
    <div class="px-3 mb-4">
      <div class="flex gap-2">
        <UButton
          v-for="(tab, index) in tabs"
          :key="tab.value"
          :variant="activeTab === index ? 'solid' : 'soft'"
          :color="activeTab === index ? 'primary' : 'neutral'"
          size="sm"
          @click="handleTabChange(index)"
        >
          {{ tab.label }}
        </UButton>
      </div>
    </div>

    <!-- Pending Rewards -->
    <template v-if="activeTab === 0">
      <!-- Loading -->
      <div v-if="isLoading && pendingRewards.length === 0" class="px-3 space-y-2">
        <div v-for="i in 3" :key="i" class="animate-pulse bg-elevated rounded-lg h-20" />
      </div>

      <!-- Empty -->
      <div v-else-if="pendingRewards.length === 0" class="px-3 py-16 text-center">
        <icon name="i-lucide-gift" class="size-16 mx-auto text-muted mb-4" />
        <p class="text-lg font-semibold">No Rewards Available</p>
        <p class="text-sm text-muted mt-1">
          Complete targets and activities to earn rewards!
        </p>
      </div>

      <!-- List -->
      <div v-else class="px-3 space-y-2">
        <RewardCard
          v-for="reward in pendingRewards"
          :key="reward.id"
          :reward="reward"
          :is-claiming="claimingId === reward.id"
          @claim="handleClaim"
        />
      </div>
    </template>

    <!-- History -->
    <template v-else>
      <!-- Loading -->
      <div v-if="isHistoryLoading && historyRewards.length === 0" class="px-3 space-y-2">
        <div v-for="i in 3" :key="i" class="animate-pulse bg-elevated rounded-lg h-20" />
      </div>

      <!-- Empty -->
      <div v-else-if="historyRewards.length === 0" class="px-3 py-16 text-center">
        <icon name="i-lucide-history" class="size-16 mx-auto text-muted mb-4" />
        <p class="text-lg font-semibold">No Reward History</p>
        <p class="text-sm text-muted mt-1">
          Claimed rewards will appear here.
        </p>
      </div>

      <!-- List -->
      <div v-else class="px-3 space-y-2">
        <RewardCard
          v-for="reward in historyRewards"
          :key="reward.id"
          :reward="reward"
        />
      </div>

      <!-- Loading More -->
      <div v-if="isHistoryLoading && historyRewards.length > 0" class="py-4 text-center">
        <UIcon name="i-lucide-loader-2" class="size-6 animate-spin" />
      </div>
    </template>

    <!-- Loading More (pending) -->
    <div v-if="activeTab === 0 && isLoading && pendingRewards.length > 0" class="py-4 text-center">
      <UIcon name="i-lucide-loader-2" class="size-6 animate-spin" />
    </div>
  </main>
</template>
