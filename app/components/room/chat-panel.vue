<script setup lang="ts">
/**
 * ChatPanel - Room chat interface component
 * Displays ephemeral messages and provides input for sending new messages
 */
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import { useRoomAudio } from '~/composables/room/useRoomAudio';

const roomStore = useRoomStore();
const { sendChatMessage } = useRoomAudio();

// Input state
const messageInput = ref('');
const inputRef = ref<{ $el: HTMLElement } | null>(null);

// Auto-scroll to bottom when new messages arrive
const scrollerRef = ref<InstanceType<typeof DynamicScroller> | null>(null);

watch(
  () => roomStore.messages.length,
  () => {
    nextTick(() => {
      // Use type assertion for DynamicScroller which has scrollToBottom
      const scroller = scrollerRef.value as { scrollToBottom?: () => void } | null;
      scroller?.scrollToBottom?.();
    });
  }
);

// Send message handler
function handleSend() {
  const content = messageInput.value.trim();
  if (!content) return;

  sendChatMessage(content);
  messageInput.value = '';
  // UInput is a Vue component - access the input element via $el
  const inputEl = inputRef.value?.$el?.querySelector('input') as HTMLInputElement | null;
  inputEl?.focus();
}

// Handle enter key
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
}
</script>

<template>
  <div class="bg-primary/20 rounded-lg grow overflow-hidden flex flex-col h-full">
    <!-- Messages Container -->
    <DynamicScroller
      ref="scrollerRef"
      :items="roomStore.messages"
      :min-item-size="48"
      key-field="id"
      class="flex-1 overflow-y-auto"
    >
      <template #default="{ item, index, active }">
        <DynamicScrollerItem
          :item="item"
          :active="active"
          :data-index="index"
        >
          <RoomChatMessage :message="item" />
        </DynamicScrollerItem>
      </template>
    </DynamicScroller>

    <!-- Empty State -->
    <p v-if="roomStore.messages.length === 0" class="font-semibold text-sm text-center pt-12 h-full">
      No messages yet.
      <br> Be the first to say hello! 👋
    </p>

    <!-- Input -->
    <div class="p-2 border-t border-primary">
      <div class="flex items-center gap-2">
        <UInput ref="inputRef" v-model="messageInput" class="w-full" size="lg" icon="i-lucide-user" placeholder="Type a message..." @keydown="handleKeydown" />
        <UButton
          icon="i-lucide-send"
          size="sm"
          class="size-8"
          :disabled="!messageInput.trim()"
          @click="handleSend"
        />
      </div>
    </div>

  </div>
</template>
