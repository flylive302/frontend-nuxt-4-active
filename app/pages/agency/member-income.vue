<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { onMounted, ref, computed } from 'vue'
import type { MemberIncome, MemberIncomePagination } from '~/types/memberIncome'

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

const agencyStore = useAgencyStore()
const { api, normalizeError } = useApi()

// ========================================
// State
// ========================================

const members = ref<MemberIncome[]>([])
const agencyName = ref<string>('')
const loading = ref(true)
const loadingMore = ref(false)
const error = ref<string | null>(null)
const cursor = ref<string | null>(null)
const hasMore = ref(true)

// ========================================
// Computed
// ========================================

const isOwnerOrAdmin = computed(() => 
  agencyStore.isAgencyOwner || agencyStore.isAgencyAdmin
)

const totalDiamonds = computed(() => 
  members.value.reduce((sum, m) => sum + m.total_diamonds_earned, 0)
)

const totalCoinsContributed = computed(() => 
  members.value.reduce((sum, m) => sum + m.total_coins_contributed, 0)
)

// ========================================
// Actions
// ========================================

async function fetchMembersIncome(reset = false): Promise<void> {
  if (reset) {
    members.value = []
    cursor.value = null
    hasMore.value = true
  }

  if (!hasMore.value || loadingMore.value) return

  if (members.value.length === 0) {
    loading.value = true
  } else {
    loadingMore.value = true
  }
  error.value = null

  try {
    const params: Record<string, unknown> = { per_page: 20 }
    if (cursor.value) {
      params.cursor = cursor.value
    }

    const response = await api<{
      status: string
      data: {
        agency_id: number
        agency_name: string
        members: MemberIncome[]
      }
      meta: {
        pagination: MemberIncomePagination
      }
    }>('/user/agency/members/income', { params })

    agencyName.value = response.data.agency_name
    members.value.push(...response.data.members)
    cursor.value = response.meta.pagination.next_cursor
    hasMore.value = response.meta.pagination.has_more
  } catch (err) {
    const normalized = normalizeError(err)
    error.value = normalized.message
    console.error('[MemberIncome] fetchMembersIncome failed:', err)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ========================================
// Lifecycle
// ========================================

onMounted(async () => {
  // Ensure agency data is loaded
  if (!agencyStore.userAgency.agency) {
    await agencyStore.fetchUserAgency()
  }

  if (isOwnerOrAdmin.value) {
    await fetchMembersIncome(true)
  }
})
</script>

<template>
  <main>
    <NavAlt color="primary" back-to="/agency/my-agency">Member Income</NavAlt>

    <!-- Not Authorized -->
    <div v-if="!isOwnerOrAdmin" class="px-3 py-14 text-center">
      <icon name="i-lucide-lock" class="size-16 text-muted mb-4" />
      <h2 class="text-lg font-semibold mb-2">Access Denied</h2>
      <p class="text-sm text-muted mb-4">
        Only agency owners and admins can view member income.
      </p>
      <UButton to="/agency/my-agency" color="primary">
        Go to My Agency
      </UButton>
    </div>

    <!-- Content for Owners/Admins -->
    <div v-else class="px-3 py-14 space-y-4">
      <!-- Agency Header -->
      <div class="text-center">
        <h1 class="text-xl font-bold">{{ agencyName || 'Agency' }}</h1>
        <p class="text-sm text-muted">Member income overview</p>
      </div>

      <!-- Summary Stats -->
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-linear-to-bl to-neutral-950 border border-neutral-700 rounded-lg p-3 text-center">
          <div class="flex items-center justify-center gap-2 mb-1">
            <NuxtImg 
              provider="imagekit" 
              src="/siteAssets/props/flylive-diamond.webp" 
              class="w-6" 
              alt="Diamonds"
            />
            <p class="text-2xl font-bold text-secondary-400">
              {{ totalDiamonds.toLocaleString() }}
            </p>
          </div>
          <p class="text-xs text-white">Total Diamonds Earned</p>
        </div>

        <div class="bg-linear-to-bl to-neutral-950 border border-neutral-700 rounded-lg p-3 text-center">
          <div class="flex items-center justify-center gap-2 mb-1">
            <NuxtImg 
              provider="imagekit" 
              src="/siteAssets/props/flylive_coin.webp" 
              class="w-6" 
              alt="Coins"
            />
            <p class="text-2xl font-bold text-tertiary">
              {{ Math.floor(totalCoinsContributed).toLocaleString() }}
            </p>
          </div>
          <p class="text-xs text-white">Total Coins Contributed</p>
        </div>
      </div>

      <!-- Error State -->
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        :title="error"
      />

      <!-- Loading State -->
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 5" :key="i" class="animate-pulse flex gap-3 p-3 bg-elevated rounded-lg">
          <div class="w-12 h-12 bg-muted rounded-full" />
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-muted rounded w-3/4" />
            <div class="h-3 bg-muted rounded w-1/2" />
          </div>
        </div>
      </div>

      <!-- Members List -->
      <div v-else-if="members.length > 0" class="space-y-3">
        <SectionTitle>Members ({{ members.length }})</SectionTitle>
        
        <div 
          v-for="member in members" 
          :key="member.user_id" 
          class="bg-linear-to-bl to-neutral-950 border border-neutral-700 rounded-lg p-2 relative overflow-hidden"
        >
        <!-- Diamonds Earned -->
          <div class="flex items-center gap-1 justify-center absolute top-0 right-0 bg-secondary/20 px-2 rounded">
            <UIcon name="i-lucide-gem" class="size-4 text-secondary-400" />
            <p class="font-semibold">{{ member.total_diamonds_earned }}</p>
          </div>

          <div class="flex gap-2">
            <!-- Avatar -->
            <UserAvatar
                :img="member.avatar_url || undefined"
                class="w-12 shrink-0"
                animated
            />

            <!-- Info -->
            <div>
              <p class="font-semibold truncate">{{ member.name }}</p>
              <p class="text-xs text-muted">Joined {{ formatDate(member.joined_at) }}</p>
            </div>

            <!-- Stats -->
            <p class="text-sm text-info font-semibold">
              {{ member.completed_targets_count }} targets achieved
            </p>

          </div>

          <!-- Target Progress -->
          <div v-if="member.current_target" class="mt-1">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-white">Target: {{ member.current_target.tier }}</span>
              <span class="font-semibold">
                    {{ member.current_target.progress_percentage.toFixed(0) }}%
                  </span>
            </div>
            <UProgress
                :model-value="member.current_target.progress_percentage"
                color="primary"
                size="sm"
            />
            <p class="text-xs text-white mt-1">
              {{ member.current_target.earned_coins.toLocaleString() }} /
              {{ member.current_target.required_coins.toLocaleString() }} coins
            </p>

            <p class="text-sm text-info bg-info/10 px-2 py-1 absolute bottom-0 right-0">
              {{ member.current_target.days_remaining }} days left
            </p>
          </div>
          <p v-else class="text-xs text-white mt-2">No active target</p>

        </div>

        <!-- Load More -->
        <div v-if="hasMore" class="flex justify-center pt-4">
          <UButton
            variant="soft"
            color="primary"
            :loading="loadingMore"
            @click="fetchMembersIncome()"
          >
            Load More
          </UButton>
        </div>
      </div>

      <!-- Empty State -->
      <div 
        v-else-if="!loading && members.length === 0" 
        class="text-center py-8 bg-elevated rounded-lg"
      >
        <icon name="i-lucide-users" class="size-12 text-muted mb-2" />
        <p class="text-muted">No members in your agency yet</p>
      </div>
    </div>
  </main>
</template>
