<script setup lang="ts">
// ========================================
// Shared Level Page Component
// ========================================
// UI + event binding for wealth/charm level pages.
// Both pages are visually identical — only color, XP source, and description differ.

import { h, computed, resolveComponent } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import type { LevelConfig } from '~/types/user/bootstrap'
import { computeLevelStatus } from '~/utils/levels'
import type { LevelComputedStatus } from '~/utils/levels'
import { withImageKitTransform } from '~/utils/imagekit'

// ========================================
// Props
// ========================================

const props = defineProps<{
  color: 'secondary' | 'info'
  category: 'wealth' | 'charm'
  heroImage: string
  defaultBadgeUrl: string
  description: string
}>()

// ========================================
// Store Dependencies (read-only)
// ========================================

const authStore = useAuthStore()
const bootstrapStore = useBootstrapStore()
const { resolvePropAsset } = usePropLookup()

// ========================================
// Table Setup
// ========================================

interface LevelRow {
  level: string
  requiredXP: string
  badge: {
    badgeSrc: string
    txt: string
    class?: string
  }
}

const profileBadge = resolveComponent('ProfileBadge')

const columns: ColumnDef<LevelRow>[] = [
  {
    accessorKey: 'badge',
    header: 'Badge',
    cell: ({ getValue }) => {
      const badge = getValue() as LevelRow['badge'] | undefined
      if (!badge) return null

      return h(profileBadge, {
        class: badge.class + 'mx-auto',
        badgeSrc: badge.badgeSrc,
        txt: badge.txt,
      })
    },
  },
  {
    accessorKey: 'level',
    header: 'Level',
  },
  {
    accessorKey: 'requiredXP',
    header: 'Required XP',
  },

]

// ========================================
// Computed — Reactive Level Calculation
// ========================================

const loading = computed(() => !bootstrapStore.isReady)

const user = computed(() => authStore.user)

const userXp = computed(() =>
  props.category === 'wealth'
    ? authStore.user?.wealth_xp
    : authStore.user?.charm_xp
)

const sortedConfigs = computed(() =>
  props.category === 'wealth'
    ? bootstrapStore.sortedWealthLevels
    : bootstrapStore.sortedCharmLevels
)

const levelStatus = computed<LevelComputedStatus>(() =>
  computeLevelStatus(userXp.value, sortedConfigs.value)
)

const currentLevel = computed(() => levelStatus.value.current_level)

const nextLevel = computed(() =>
  levelStatus.value.next_level?.level ?? currentLevel.value + 1
)

const progressValue = computed(() => levelStatus.value.progress_percentage)

const currentXP = computed(() =>
  levelStatus.value.current_xp.toLocaleString()
)

const xpRemaining = computed(() =>
  levelStatus.value.xp_remaining.toLocaleString()
)

const currentBadge = computed(() => {
  const badgeId = levelStatus.value.badge_id
  if (!badgeId) return null
  const badge = bootstrapStore.badgeMap.get(badgeId)
  return badge?.image_url
    ? { id: badge.id, name: badge.name, image_url: badge.image_url }
    : null
})

const heroBadgeIconSrc = computed(() =>
  withImageKitTransform(currentBadge.value?.image_url ?? props.defaultBadgeUrl, { w: 128, q: 75 }),
)

const levelConfig = computed<LevelConfig[]>(() =>
  sortedConfigs.value
)

const tableData = computed<LevelRow[]>(() =>
  levelConfig.value.map((item) => {
    const badge = item.badge_id ? bootstrapStore.badgeMap.get(item.badge_id) : null
    return {
      level: item.name,
      requiredXP: item.required_xp.toLocaleString() + ' XP',
      badge: {
        badgeSrc: badge?.image_url || props.defaultBadgeUrl,
        txt: '',
        class: item.level === currentLevel.value ? `border border-${props.color} bg-${props.color}/10 rounded-md px-2 py-1 inset-shadow-sm` : '',
      },
    }
  })
)
</script>

<template>
  <div>
    <NuxtImg
        :src="heroImage"
        format="webp"
        densities="x1 x2"
        sizes="320px"
        width="100%"
        class="min-w-full aspect-rectangle object-cover animate-[zoom_50s_ease-in-out_infinite]"
    />

    <div class="p-2 mx-3 backdrop-blur-xs -mt-26 rounded-xl border" :class="`border-${color}`">
      <!-- User Info Grid -->
      <div class="grid grid-cols-9 gap-1">
        <UserAvatar
            :animated="true"
            :frame-asset-url="resolvePropAsset(authStore.user?.frame_id) ?? undefined"
            :img="authStore.user?.avatar ?? undefined"
            class="col-span-2"
        />
        <div class="col-span-5 flex flex-col justify-center">
          <p v-if="loading" class="text-base font-semibold animate-pulse">Loading...</p>
          <template v-else-if="user">
            <div class="flex items-center gap-2">
              <ProfileBadge :txt="user.signature" />
              <UBadge color="secondary" icon="i-lucide-mars-stroke" size="sm" class="w-fit text-white p-1">
                {{ getAge(user.date_of_birth) }}
              </UBadge>
            </div>
            <p class="text-lg font-bold">{{ user.name }}</p>
          </template>
        </div>
        <div class="col-span-2 flex flex-col justify-center">
          <NuxtImg
              :src="heroBadgeIconSrc"
              class="max-w-20 w-full relative z-10 shrink-0"
              width="auto"
              height="auto"
              format="webp"
              densities="x1 x2"
              sizes="64px"
              loading="lazy"
          />
        </div>
      </div>

      <!-- Progress Bar -->
      <UProgress :model-value="progressValue" :color="color" class="mt-2" />
      <div class="flex justify-between items-center">
        <p class="text-md font-bold">LvL: {{ currentLevel }}</p>
        <p class="text-md font-bold">LvL: {{ nextLevel }}</p>
      </div>

      <!-- XP Info Box -->
      <p
          v-if="!loading && userXp != null"
          class="text-base font-bold bg-elevated rounded-md px-2 py-1 leading-tight glow-primary"
      >
        You have <span :class="`text-${color}`">{{ currentXP }} (XP)</span>
        You Need <span :class="`text-${color}`">{{ xpRemaining }} (XP)</span>
        Experience Points more to reach Level {{ nextLevel }}
      </p>
      <div v-else-if="loading" class="h-12 bg-muted rounded-md animate-pulse" />
    </div>

    <div class="px-3 my-8">
      <!-- Level Description -->
      <h2 class="text-lg font-bold">Level Description</h2>
      <p class="text-sm font-semibold text-muted mt-1">
        {{ description }}
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
        class="rounded-lg mt-2 w-full border"
        :class="`border-${color}`"
      />
    </div>
  </div>
</template>
