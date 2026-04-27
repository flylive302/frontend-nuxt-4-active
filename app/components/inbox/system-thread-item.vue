<script setup lang="ts">
import type { Notification } from '~/types/notification/notification'
import { formatRelativeTime } from '~/utils/date'

defineProps<{
  unreadCount: number
  lastNotification: Notification | null
}>()
</script>

<template>
  <div class="flex items-center gap-3 px-4 py-3 hover:bg-elevated transition-colors cursor-pointer active:bg-elevated/80">
    <!-- Icon -->
    <div class="relative shrink-0">
      <div class="size-12 rounded-full bg-primary/15 flex items-center justify-center">
        <icon name="i-lucide-shield-check" class="size-6 text-primary" />
      </div>
      <span
        v-if="unreadCount > 0"
        class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center"
      >
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </div>

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-semibold truncate">Official</span>
        <span
          v-if="lastNotification"
          class="text-xs shrink-0"
          :class="unreadCount > 0 ? 'text-primary font-semibold' : 'text-muted'"
        >
          {{ formatRelativeTime(lastNotification.created_at) }}
        </span>
      </div>
      <p class="text-sm truncate mt-0.5" :class="unreadCount > 0 ? 'text-default font-medium' : 'text-muted'">
        {{ lastNotification?.body ?? 'System notifications & announcements' }}
      </p>
    </div>
  </div>
</template>
