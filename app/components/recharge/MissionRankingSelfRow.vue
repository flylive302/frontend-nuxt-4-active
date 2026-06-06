<script setup lang="ts">
import type { LeaderboardEntry } from '~/types/mission/recharge'
import { RECHARGE_ACTIVITY } from '~/constants/assets'
import { formatCurrency } from '~/utils/currency'

defineProps<{
  self: LeaderboardEntry
}>()
</script>

<template>
  <div class="relative">
    <img
      :src="RECHARGE_ACTIVITY.selfRankBottomBorder"
      alt=""
      class="w-full absolute inset-0 h-full object-fill"
      aria-hidden="true"
    >
    <div class="relative z-10 flex items-center gap-3 px-3 py-2">
      <span class="text-xs font-bold text-amber-300 shrink-0 w-6 text-center">
        #{{ self.rank }}
      </span>
      <NuxtLink
        :to="self.user.signature ? `/profile/${self.user.signature}` : ''"
        class="flex items-center gap-2 flex-1 min-w-0"
      >
        <UserAvatar
          :img="self.user.avatar"
          animated
          class="w-10 shrink-0"
        />
        <p class="text-white text-sm font-semibold truncate">{{ self.user.name }}</p>
      </NuxtLink>
      <span class="text-sm font-bold text-primary shrink-0">
        {{ formatCurrency(self.volume) }}
      </span>
    </div>
  </div>
</template>
