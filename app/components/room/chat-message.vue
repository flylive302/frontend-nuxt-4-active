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
const { resolvePropAsset } = usePropLookup();

// Resolve live participant data first, then fall back to the message author
// snapshot. Cross-region/rejoin races can deliver chat before participant sync.
const participant = computed(() => audioStore.participants.get(props.message.userId));
const displayName = computed(() => participant.value?.name ?? props.message.userName ?? 'Unknown');
const displayAvatar = computed(() => participant.value?.avatar ?? props.message.userAvatar ?? undefined);
const displayFrame = computed(() => resolvePropAsset(participant.value?.frame_id ?? props.message.userFrameId) ?? undefined);

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
  <div class="flex">
    <!-- Avatar -->
    <UserAvatar :img="displayAvatar" :frame-asset-url="displayFrame" :animated="true" class="shrink-0 size-12" />
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-1.5 backdrop-blur-xl pl-2 rounded-xl">
        <span class="text-md font-bold truncate">{{ displayName }}</span>
        <span class="text-xs text-gray-white shrink-0">{{ formattedTime }}</span>
      </div>
      <div class="bubble">
        <p class="text-sm wrap-break-word">{{ message.content }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bubble {
  display: block;
  border: 36px solid transparent;
  border-image: url("https://ik.imagekit.io/flylive/vip/15/chat_bubble.png") 40 fill / 40px / 0 stretch;
}
</style>
