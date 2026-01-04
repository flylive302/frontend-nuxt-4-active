<!-- ~/components/room/leaderboard-item.vue -->
<!-- Single leaderboard item for room activity rankings -->
<script setup lang="ts">
defineOptions({ name: 'LeaderboardItem' })

// ========================================
// Types
// ========================================
interface RoomUser {
  id: number
  name: string
  rank: number
  wealthLevel: number
  charmLevel: number
  coins: string
  avatar: string
}

// ========================================
// Props
// ========================================
defineProps<{
  user: RoomUser
}>()

// ========================================
// Helpers
// ========================================
function getRankColor(rank: number): 'primary' | 'secondary' | 'tertiary' | 'neutral' {
  const colors = ['primary', 'secondary', 'tertiary'] as const
  if (rank >= 1 && rank <= 3) {
    return colors[rank - 1]!
  }
  return 'neutral'
}
</script>

<template>
  <div class="flex items-center justify-between w-full">
    <UBadge :color="getRankColor(user.rank)" class="text-white font-bold" :label="user.rank" />
    <div
      class="flex gap-1 bg-linear-to-br from-gray-800 to-black border-2 border-gray-700 rounded-lg shadow-md overflow-hidden grow ml-2"
    >
      <UserAvatar animated class="w-14" />
      <div class="flex flex-col justify-center min-h-full px-2">
        <h3 class="text-sm font-bold leading-tight">
          {{ user.name }}
          <Icon name="i-lucide-mars" />
        </h3>
        <div class="flex items-center gap-1 mt-1">
          <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" :txt="String(user.wealthLevel)" />
          <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" :txt="String(user.charmLevel)" />
        </div>
      </div>

      <div class="flex flex-col justify-center min-h-full ml-auto pr-2">
        <UButton size="xs" variant="soft" icon="i-lucide-coins">{{ user.coins }}</UButton>
      </div>
    </div>
  </div>
</template>
