<script setup lang="ts">
/**
 * Top-3 podium on the /rank page. Highlights ranks 1-3 with larger
 * avatars and gold/silver/bronze accents. The center column (rank 1)
 * is taller; ranks 2 and 3 flank it.
 */
import type { RankingEntry } from '~/types/ranking'
import { ASSETS, rankingPodiumFrame } from '~/constants/assets'
import type { RankingCategory } from '~/constants/ranking'
import { formatCurrency } from '~/utils/currency'

const props = defineProps<{
  /** Ordered top-3 entries (rank 1 first). */
  top3: RankingEntry[]
  category: RankingCategory
}>()

// ========================================
// Computed: visual order (2 — 1 — 3)
// ========================================

const visualOrder = computed<RankingEntry[]>(() => {
  const [first, second, third] = props.top3
  // Filter undefined to stay defensive against partial input,
  // even though the parent only renders this when length >= 3.
  return [second, first, third].filter((e): e is RankingEntry => e !== undefined)
})

// ========================================
// Helpers
// ========================================

function nameFor(entry: RankingEntry): string {
  if (entry.user) return entry.user.name
  if (entry.room) return entry.room.name
  if (entry.agency) return entry.agency.name
  return 'Unknown'
}

function avatarFor(entry: RankingEntry): string | undefined {
  if (entry.user) return entry.user.avatar ?? undefined
  if (entry.room) return entry.room.logo ?? undefined
  if (entry.agency) return entry.agency.logo ?? undefined
  return undefined
}

function linkFor(entry: RankingEntry): string | null {
  if (entry.user && entry.user.signature) return `/profile/${entry.user.signature}`
  if (entry.room) return `/room/${entry.room.id}`
  if (entry.agency) return `/agency/${entry.agency.id}`
  return null
}

function rankAccent(rank: number): { ring: string; text: string; medal: string; height: string } {
  switch (rank) {
    case 1: return { ring: 'ring-yellow-400', text: 'text-yellow-300', medal: 'bg-yellow-500', height: 'h-32' }
    case 2: return { ring: 'ring-zinc-300', text: 'text-zinc-100', medal: 'bg-zinc-300', height: 'h-12' }
    case 3: return { ring: 'ring-amber-600', text: 'text-amber-200', medal: 'bg-amber-700', height: 'h-12' }
    default: return { ring: 'ring-white/10', text: 'text-muted', medal: 'bg-white/10', height: 'h-16' }
  }
}
</script>

<template>
  <section class="grid grid-cols-3 items-end gap-2 px-3 relative z-10">
    <template v-for="entry in visualOrder" :key="`${entry.subject_type}-${entry.rank}`">
      <component
        :is="linkFor(entry) ? 'NuxtLink' : 'div'"
        v-bind="linkFor(entry) ? { to: linkFor(entry) } : {}"
        class="flex flex-col items-center text-center"
      >
        <NuxtLink :to="entry.user?.signature ? `/profile/${entry.user.signature}` : ''" class="relative">
          <UserAvatar
              :animated="true"
              :frame-asset-url="rankingPodiumFrame(entry.rank)"
              :img="avatarFor(entry) ?? ASSETS.AVATAR_PLACEHOLDER"
              :frame-display="{ scale: 100, padding: 22, top: '0%', left: '0%' }"
              :user-name="nameFor(entry)"
              class="w-28"
          />
        </NuxtLink>

        <p class="text-sm font-medium text-white truncate max-w-full px-1">{{ nameFor(entry) }}</p>
        <UBadge icon="i-lucide-coins" variant="outline" class="backdrop-blur-lg font-bold text-md text-white">{{formatCurrency(entry.score)}}</UBadge>
        <profile-badge :txt="entry.user?.signature" />

        <div
            :class="[
            'w-full mt-2 rounded-t-lg flex items-start justify-center pt-2 text-xs font-bold text-black/70',
            rankAccent(entry.rank).height,
          ]"
        >
          {{ entry.rank }}
        </div>
      </component>
    </template>
  </section>
</template>
