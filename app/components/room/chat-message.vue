<script setup lang="ts">
/**
 * ChatMessage - Individual chat message component
 * Displays a single ephemeral chat message with user info.
 *
 * Resolves avatar/frame/name from the live participants Map (same pattern as seat.vue)
 * so profile updates are reflected immediately across all messages.
 * Falls back to snapshot fields for users who have left the room.
 */
import type { ChatMessageEvent } from '~/types/room/audio';

const props = defineProps<{
  message: ChatMessageEvent;
}>();

const audioStore = useRoomAudioStore();

// Resolve live participant data. The chat payload is ID-only; if the user
// has left the room their participant entry is gone and we render a generic
// fallback (acceptable for ephemeral chat).
const participant = computed(() => audioStore.participants.get(props.message.userId));
const displayName = computed(() => participant.value?.name ?? 'Unknown');
const displayAvatar = computed(() => participant.value?.avatar ?? undefined);
const displayFrame = computed(() => participant.value?.frame ?? undefined);

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
    <UserAvatar :img="displayAvatar" :frame-asset-url="displayFrame" :animated="true" size="xs" class="shrink-0 size-10" />

    <!-- Content -->
    <div class="flex-1 min-w-0 bg-neutral-800 rounded-md p-2">
      <!-- Header -->
      <div class="flex items-center gap-1.5">
        <span class="text-xs font-medium text-primary-400 truncate">
          {{ displayName }}
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
