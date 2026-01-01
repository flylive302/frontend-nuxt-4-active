<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { h, onMounted, ref, computed, resolveComponent } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import type { LevelStatus, LevelConfigItem } from '~/types/levels'

// ========================================
// Page Configuration
// ========================================

definePageMeta({ layout: 'alt' })

// ========================================
// Composables / Injected Dependencies
// ========================================

const authStore = useAuthStore()
const { api } = useApi()

// ========================================
// State
// ========================================

const levelStatus = ref<LevelStatus | null>(null)
const levelConfig = ref<LevelConfigItem[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

// ========================================
// Table Setup
// ========================================

interface WealthLevelRow {
  level: string
  requiredXP: string
  badge: {
    badgeSrc: string
    color: string
    txt: string
    class?: string
  }
}

const profileBadge = resolveComponent('ProfileBadge')

const columns: ColumnDef<WealthLevelRow>[] = [
  {
    accessorKey: 'level',
    header: 'Level',
  },
  {
    accessorKey: 'requiredXP',
    header: 'Required XP',
  },
  {
    accessorKey: 'badge',
    header: 'Badge',
    cell: ({ getValue }) => {
      const badge = getValue() as WealthLevelRow['badge'] | undefined
      if (!badge) return null

      return h(profileBadge, {
        class: badge.class,
        badgeSrc: badge.badgeSrc,
        color: badge.color,
        txt: badge.txt,
      })
    },
  },
]

// ========================================
// Computed
// ========================================

const user = computed(() => authStore.user)

const progressValue = computed(() => 
  levelStatus.value?.progress_percentage ?? 0
)

const currentXP = computed(() => 
  levelStatus.value?.current_xp?.toLocaleString() ?? '0'
)

const xpRemaining = computed(() => 
  levelStatus.value?.xp_remaining?.toLocaleString() ?? '0'
)

const currentLevel = computed(() => 
  levelStatus.value?.current_level ?? 0
)

const nextLevel = computed(() => 
  levelStatus.value?.next_level?.level ?? currentLevel.value + 1
)

const currentBadge = computed(() => 
  levelStatus.value?.badge
)

const tableData = computed<WealthLevelRow[]>(() => 
  levelConfig.value.map((item) => ({
    level: item.name,
    requiredXP: item.required_xp.toLocaleString() + ' XP',
    badge: {
      badgeSrc: item.badge.image_url || '/siteAssets/badges/badge-wealth-level-1.webp',
      color: 'tertiary',
      txt: String(item.level),
      class: item.level === currentLevel.value ? 'ring-2 ring-tertiary' : '',
    },
  }))
)

// ========================================
// Actions
// ========================================

async function fetchLevelData(): Promise<void> {
  loading.value = true
  error.value = null

  try {
    // Fetch user's level status and level config in parallel
    const [statusResponse, configResponse] = await Promise.all([
      api<{ status: string; data: { wealth: LevelStatus; charm: LevelStatus } }>('/profile/levels'),
      api<{ status: string; data: { wealth_levels: LevelConfigItem[] } }>('/levels/config'),
    ])

    levelStatus.value = statusResponse.data.wealth
    levelConfig.value = configResponse.data.wealth_levels
  } catch (err) {
    error.value = 'Failed to load level data'
    console.error('[WealthLevel] fetchLevelData failed:', err)
  } finally {
    loading.value = false
  }
}

// ========================================
// Lifecycle
// ========================================

onMounted(() => {
  fetchLevelData()
})
</script>

<template>
  <main>
    <NavAlt color="tertiary" back-to="/profile" :linked="true" first-link="/levels/wealth/" second-link="/levels/charm/">
      <template #first-link-text>Wealth Level</template>
      <template #second-link-text>Charm Level</template>
    </NavAlt>

    <AltHero class="z-10" image-src="/siteAssets/alt-hero/tertiary.webp">
      <div class="p-2 w-full h-full bg-gradient-to-br to-tertiary/30">
        <!-- User Info Grid -->
        <div class="grid grid-cols-9 gap-1">
          <UserAvatar :animated="true" class="col-span-2" />
          <div class="col-span-5 flex flex-col justify-center">
            <p v-if="loading" class="text-base font-semibold animate-pulse">Loading...</p>
            <template v-else-if="user">
              <p class="text-base font-semibold">@{{ user.signature }}</p>
              <p class="text-lg font-bold">{{ user.name }}</p>
            </template>
          </div>
          <div class="col-span-2 flex flex-col justify-center">
            <ProfileBadge 
              v-if="currentBadge"
              :badge-src="currentBadge.image_url" 
              class="ml-auto" 
              color="tertiary" 
              :txt="String(currentLevel)"
            />
            <div v-else-if="loading" class="w-10 h-10 bg-muted rounded-full ml-auto animate-pulse" />
          </div>
        </div>

        <!-- Progress Bar -->
        <UProgress :model-value="progressValue" color="tertiary" class="mt-2" />
        <div class="flex justify-between items-center">
          <p class="text-md font-bold">LvL: {{ currentLevel }}</p>
          <p class="text-md font-bold">LvL: {{ nextLevel }}</p>
        </div>

        <!-- XP Info Box -->
        <p 
          v-if="!loading && levelStatus" 
          class="text-base font-bold bg-elevated rounded-md border-2 border-tertiary px-2 py-1 leading-tight text-shadow-md"
        >
          You have <span class="text-tertiary">{{ currentXP }} (XP)</span> 
          You Need <span class="text-tertiary">{{ xpRemaining }} (XP)</span> 
          Experience Points more to reach Level {{ nextLevel }}
        </p>
        <div v-else-if="loading" class="h-12 bg-muted rounded-md animate-pulse" />
      </div>
    </AltHero>

    <div class="px-3 my-14">
      <!-- Error State -->
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        :title="error"
        class="mb-4"
      />

      <!-- Level Description -->
      <div class="flex gap-2 items-center">
        <NuxtImg
          v-if="currentBadge"
          provider="imagekit"
          :src="currentBadge.image_url"
          class="w-8 relative z-10 shrink-0"
          width="18"
          height="18"
          format="webp"
          densities="x1 x2"
          sizes="64px"
          loading="lazy"
        />
        <NuxtImg
          v-else
          provider="imagekit"
          src="/siteAssets/badges/badge-wealth-level-1.webp"
          class="w-8 relative z-10 shrink-0"
          width="18"
          height="18"
          format="webp"
          densities="x1 x2"
          sizes="64px"
          loading="lazy"
        />
        <h2 class="text-lg font-bold">Level Description</h2>
      </div>
      <p class="text-sm font-semibold text-muted mt-1">
        1 Coin spent is equal to 1 Experience Point. As your level increases, you'll unlock new badges.
      </p>

      <!-- Loading Table Skeleton -->
      <div v-if="loading" class="mt-4 space-y-2">
        <div v-for="i in 5" :key="i" class="h-12 bg-muted rounded animate-pulse" />
      </div>

      <!-- Level Table -->
      <UTable 
        v-else-if="tableData.length > 0"
        :columns="columns" 
        :data="tableData" 
        sticky 
        class="border border-tertiary rounded-lg shadow-lg shadow-tertiary/30 mt-2 w-full" 
      />
    </div>
  </main>
</template>