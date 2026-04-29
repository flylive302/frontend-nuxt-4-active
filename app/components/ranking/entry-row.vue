<script setup lang="ts">
/**
 * Single row on the global ranking list.
 * Polymorphic: renders user / room / agency with the correct link target.
 */
import type { RankingEntry } from '~/types/ranking'
import type { RankingCategory } from '~/constants/ranking'
import { formatCurrency } from '~/utils/currency'

const props = defineProps<{
  entry: RankingEntry
  /** Outer category context — used to fall back to numeric subject_id when subject is missing. */
  category: RankingCategory
  /** When true, applies a subtle highlight (used inside the podium). */
  emphasized?: boolean
}>()

// ========================================
// Computed
// ========================================

const displayName = computed<string>(() => {
  const e = props.entry
  if (e.user) return e.user.name
  if (e.room) return e.room.name
  if (e.agency) return e.agency.name
  return 'Unknown'
})

const subtitle = computed<string | null>(() => {
  const e = props.entry
  if (e.user) return e.user.signature ? `@${e.user.signature}` : null
  if (e.room) return e.room.owner ? e.room.owner.name : null
  if (e.agency) return e.agency.owner ? e.agency.owner.name : null
  return null
})

const avatarSrc = computed<string>(() => {
  const e = props.entry
  if (e.user) return e.user.avatar ?? ''
  if (e.room) return e.room.logo ?? ''
  if (e.agency) return e.agency.logo ?? ''
  return ''
})

const linkTo = computed<string | null>(() => {
  const e = props.entry
  if (e.user && e.user.signature) return `/profile/${e.user.signature}`
  if (e.room) return `/room/${e.room.id}`
  if (e.agency) return `/agency/${e.agency.id}`
  return null
})

const formattedScore = computed<string>(() => formatCurrency(props.entry.score))

const rankBadgeClass = computed<string>(() => {
  switch (props.entry.rank) {
    case 1: return 'bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-400/40'
    case 2: return 'bg-zinc-300/20 text-zinc-100 ring-1 ring-zinc-300/40'
    case 3: return 'bg-amber-700/30 text-amber-200 ring-1 ring-amber-600/50'
    default: return 'bg-white/5 text-muted ring-1 ring-white/10'
  }
})
</script>

<template>
  <NuxtLink
    :to="linkTo ?? ''"
    class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors"
  >
    <span
      class="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold text-white shadow-md border border-white/20"
      :class="rankBadgeClass"
    >
      {{ entry.rank }}
    </span>

    <UserAvatar
        :animated="true"
        :frame-asset-url="entry.user?.frame ?? 'https://assets.flyliveapp.com/frames/10.svga'"
        :img="avatarSrc ?? 'AppImages/dummy-card/avatar.png'"
        frameName="top-120-16-0-0"
        class="w-12"
    />
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium text-white">{{ displayName }}</p>
      <profile-badge v-if="entry.user?.signature" :txt="entry.user.signature" :show-badge="false" />
    </div>

    <div class="shrink-0 text-right">
      <p class="text-sm font-semibold text-primary text-shadow-2xs">{{ formattedScore }}</p>
      <p class="text-[10px] uppercase tracking-wide text-white">
        {{ entry.subject_type === 'user' ? (category === 'wealth' ? 'sent' : 'received') : 'income' }}
      </p>
    </div>
  </NuxtLink>
</template>
