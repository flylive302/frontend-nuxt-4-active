<script setup lang="ts">
import type { LeaderboardEntry } from '~/types/mission/recharge'
import { formatCurrency } from '~/utils/currency'

defineProps<{
  entry: LeaderboardEntry
}>()
</script>

<template>
  <MinimalUserList :user="entry.user">
    <div class="flex flex-col items-end pr-1 gap-0.5">
      <span class="text-xs font-semibold text-primary">
        {{ formatCurrency(entry.volume) }}
      </span>
      <span class="text-[10px] text-white/50">#{{ entry.rank }}</span>
    </div>
  </MinimalUserList>
</template>
