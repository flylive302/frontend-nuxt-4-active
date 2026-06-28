<script setup lang="ts">
import type { LeaderboardEntry } from '~/types/mission/recharge'
import { ASSETS } from '~/constants/assets'
import { formatCurrency } from '~/utils/currency'

const props = defineProps<{
  entries: LeaderboardEntry[]
  timeframe: 'weekly' | 'monthly'
}>()

const { resolvePropAsset } = usePropLookup()

// Visual order: 2 — 1 — 3 (left-to-right)
const visualOrder = computed<Array<LeaderboardEntry | null>>(() => {
  const [first, second, third] = props.entries
  return [second ?? null, first ?? null, third ?? null]
})

function rankAccent(rank: number): { ring: string; text: string } {
  switch (rank) {
    case 1: return { ring: 'ring-yellow-400', text: 'text-yellow-300' }
    case 2: return { ring: 'ring-zinc-300', text: 'text-zinc-100' }
    default: return { ring: 'ring-amber-600', text: 'text-amber-300' }
  }
}

function avatarSize(rank: number): string {
  return rank === 1 ? 'w-20' : 'w-14'
}
</script>

<template>
  <div class="grid grid-cols-3 items-end gap-1 px-2 py-2">
    <template v-for="(entry, idx) in visualOrder" :key="idx">
      <!-- Empty slot (fewer than 3 entries) -->
      <div v-if="entry === null" />

      <NuxtLink
        v-else
        :to="entry.user.signature ? `/profile/${entry.user.signature}` : ''"
        class="flex flex-col items-center text-center gap-1"
      >
        <!-- Avatar with ring accent -->
        <div class="relative mb-2">
          <UserAvatar
            :img="entry.user.avatar ?? ASSETS.AVATAR_PLACEHOLDER"
            :frame-asset-url="resolvePropAsset(entry.user.frame_id) ?? undefined"
            animated
            :class="[avatarSize(entry.rank), 'ring-2', rankAccent(entry.rank).ring]"
            class="rounded-full"
          />
          <span
            class="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs font-bold px-1.5 py-0.5 rounded-full bg-black/60 ring-1"
            :class="rankAccent(entry.rank).ring + ' ' + rankAccent(entry.rank).text"
          >
            {{ entry.rank }}
          </span>
        </div>

        <p class="text-white text-xs font-semibold truncate max-w-full px-1 leading-tight">
          {{ entry.user.name }}
        </p>
        <UBadge
          icon="i-lucide-coins"
          variant="outline"
          size="xs"
          class="backdrop-blur font-bold text-white"
          :class="rankAccent(entry.rank).text"
        >
          {{ formatCurrency(entry.volume) }}
        </UBadge>

        <!-- Podium base -->
        <div
          class="w-full mt-1 rounded-t-lg flex items-start justify-center pt-1 text-xs font-bold text-black/60"
          :class="entry.rank === 1 ? 'h-12 bg-yellow-500/30' : 'h-6 bg-white/10'"
        >
          {{ entry.rank }}
        </div>
      </NuxtLink>
    </template>
  </div>
</template>
