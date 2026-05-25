<script setup lang="ts">
import type { Component } from 'vue';
import { defineAsyncComponent } from 'vue';
import { useRoomAudio } from '~/composables/room/useRoomAudio';

// Async-load vue-virtual-scroller + its CSS so the feature-scroller chunk
// doesn't get linked as render-blocking CSS on routes that don't reach this
// component (e.g., auth routes).
const DynamicScroller = defineAsyncComponent(async () => {
  if (import.meta.client) await import('vue-virtual-scroller/dist/vue-virtual-scroller.css');
  return (await import('vue-virtual-scroller')).DynamicScroller as unknown as Component;
});
const DynamicScrollerItem = defineAsyncComponent(async () =>
  (await import('vue-virtual-scroller')).DynamicScrollerItem as unknown as Component
);

const audioStore = useRoomAudioStore();
const { sendChatMessage } = useRoomAudio();

// Input state
const messageInput = ref('');
const inputRef = ref<{ $el: HTMLElement } | null>(null);

// Auto-scroll to bottom when new messages arrive
const scrollerRef = ref<{ scrollToBottom?: () => void } | null>(null);

watch(
  () => audioStore.messages.length,
  () => {
    nextTick(() => {
      scrollerRef.value?.scrollToBottom?.();
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
  <div class="grow overflow-hidden flex flex-col h-full">
    <!-- Messages Container -->
    <DynamicScroller
      ref="scrollerRef"
      :items="audioStore.messages"
      :min-item-size="48"
      key-field="id"
      class="flex-1 overflow-y-auto py-10"
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
    <p v-if="audioStore.messages.length === 0" class="font-semibold text-sm text-center pt-12 h-full">
      No messages yet.
      <br> Be the first to say hello! 👋
    </p>

    <!-- Input -->
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
</template>
