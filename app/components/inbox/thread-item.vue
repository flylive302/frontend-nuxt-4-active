<script setup lang="ts">
import type { Thread } from '~/types/inbox'
import { formatRelativeTime } from '~/utils/date'

defineProps<{ thread: Thread }>()
const { resolvePropAsset } = usePropLookup()
</script>

<template>
  <div
    class="flex items-center gap-3 px-4 py-3 hover:bg-elevated transition-colors cursor-pointer active:bg-elevated/80">
    <!-- Avatar -->
    <div class="relative shrink-0">
      <UserAvatar
          :img="thread.participant.avatar"
          :frame-asset-url="resolvePropAsset(thread.participant.frame_id) ?? undefined"
          animated
          class="size-12"
      />
      <span
          v-if="thread.unreadCount > 0"
          class="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 px-1 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center"
      >
        {{ thread.unreadCount > 99 ? '99+' : thread.unreadCount }}
      </span>
    </div>

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-semibold truncate">{{ thread.participant.name }}</span>
        <span class="text-xs shrink-0" :class="thread.unreadCount > 0 ? 'text-primary font-semibold' : 'text-muted'">
          {{ thread.lastMessageAt ? formatRelativeTime(thread.lastMessageAt) : '' }}
        </span>
      </div>
      <p class="text-sm truncate mt-0.5" :class="thread.unreadCount > 0 ? 'text-default font-medium' : 'text-muted'">
        {{ thread.lastMessage }}
      </p>
    </div>
  </div>
</template>
