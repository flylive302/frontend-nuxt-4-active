<script setup lang="ts">
/**
 * ChatMessage - Individual chat message component
 * Displays a single ephemeral chat message with user info
 */
import type { ChatMessageEvent } from '~/types/room/audio';

const props = defineProps<{
  message: ChatMessageEvent;
}>();

// Format timestamp to relative time
const formattedTime = computed(() => {
  const now = Date.now();
  const diff = now - props.message.timestamp;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
});
</script>

<template>
  <div class="flex gap-2 py-1.5 px-2 hover:bg-white/5 rounded transition-colors">
    <!-- Avatar -->
    <UserAvatar :img="message.avatar" :frame-asset-url="message.frame" :animated="true" size="xs" class="shrink-0 size-10" />

    <!-- Content -->
    <div class="flex-1 min-w-0 bg-neutral-800 rounded-md p-2">
      <!-- Header -->
      <div class="flex items-center gap-1.5">
        <span class="text-xs font-medium text-primary-400 truncate">
          {{ message.userName }}
        </span>
        <span class="text-[10px] text-gray-500">
          {{ formattedTime }}
        </span>
      </div>

      <!-- Message -->
      <p class="text-xs text-gray-200 wrap-break-word">
        {{ message.content }}
      </p>
    </div>
  </div>
</template>
