<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { h, ref, computed, resolveComponent } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import type { LevelConfig, LevelStatus } from '~/types/user/bootstrap'

// ========================================
// Page Configuration
// ========================================

definePageMeta({ layout: 'alt', middleware: 'auth' })

// ========================================
// Composables / Injected Dependencies
// ========================================

const authStore = useAuthStore()
const bootstrapStore = useBootstrapStore()
const levelsStore = useLevelsStore()

// ========================================
// State
// ========================================

const loading = ref(!bootstrapStore.isReady)
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
        class: badge.class + 'mx-auto',
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

const xpRemaining = computed(() => {
  const status = levelStatus.value
  if (!status) return '0'

  // If the API says 0 or we want to be sure, check the config for the next level
  const nextLv = currentLevel.value + 1
  const config = levelConfig.value.find(l => l.level === nextLv)
  
  if (config) {
    const remaining = config.required_xp - (status.current_xp ?? 0)
    return Math.max(0, remaining).toLocaleString()
  }

  // Fallback to API value if config not found
  return status.xp_remaining?.toLocaleString() ?? '0'
})

const currentLevel = computed(() => 
  levelStatus.value?.current_level ?? 0
)

const nextLevel = computed(() => 
  levelStatus.value?.next_level?.level ?? currentLevel.value + 1
)

// Wealth level config from bootstrap store
const levelConfig = computed<LevelConfig[]>(() => 
  bootstrapStore.config?.wealth_levels ?? []
)

// Current level status from levels store
const levelStatus = computed<LevelStatus | null>(() => 
  levelsStore.wealthLevel
)

const currentBadge = computed(() => 
  levelStatus.value?.badge
)

const tableData = computed<WealthLevelRow[]>(() => 
  levelConfig.value.map((item) => {
    // Look up badge by badge_id using bootstrapStore.badgeMap
    const badge = item.badge_id ? bootstrapStore.badgeMap.get(item.badge_id) : null
    return {
      level: item.name,
      requiredXP: item.required_xp.toLocaleString() + ' XP',
      badge: {
        badgeSrc: badge?.image_url || 'https://ik.imagekit.io/flylive/badges/wealth/level_1.webp',
        color: 'tertiary',
        txt: String(item.level),
        class: item.level === currentLevel.value ? 'border border-tertiary bg-tertiary/10 rounded-md px-2 py-1 inset-shadow-sm ' : '',
      },
    }
  })
)

// Data comes from bootstrap store - no need to fetch
watchEffect(() => {
  loading.value = !bootstrapStore.isReady
})
</script>

<template>
  <main>
    <NavAlt color="tertiary" back-to="/profile" :linked="true" first-link="/levels/wealth/" second-link="/levels/charm/">
      <template #first-link-text>Wealth Level</template>
      <template #second-link-text>Charm Level</template>
    </NavAlt>

    <AltHero class="bg-linear-to-br to-tertiary/10" image-src="https://ik.imagekit.io/flylive/siteAssets/alt-hero/tertiary.webp">
      <div class="p-2">
        <!-- User Info Grid -->
        <div class="grid grid-cols-9 gap-1">
          <UserAvatar :animated="true" :frame-asset-url="authStore?.user?.frame ?? undefined" :img="authStore.user?.avatar ?? undefined" class="col-span-2" />
          <div class="col-span-5 flex flex-col justify-center">
            <p v-if="loading" class="text-base font-semibold animate-pulse">Loading...</p>
            <template v-else-if="user">
              <div class="flex items-center gap-2">
                <ProfileBadge :txt="user.signature"/>
                <UBadge color="secondary" icon="i-lucide-mars-stroke" size="sm" class="w-fit text-white p-1">
                  {{ getAge(user.date_of_birth) }}
                </UBadge>
              </div>
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

    <div class="px-3 my-8">
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
          :src="currentBadge?.image_url == null ? 'https://ik.imagekit.io/flylive/badges/wealth/level_1.webp' : currentBadge?.image_url"
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