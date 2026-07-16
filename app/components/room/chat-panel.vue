<script setup lang="ts">
import type { Component } from 'vue';
import { defineAsyncComponent } from 'vue';
import { useRoomAudio } from '~/composables/room/useRoomAudio';
import type { StickyScrollTarget } from '~/composables/room/useChatStickyScroll';

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

// Sticky-bottom scroll: pinned = auto-follow new messages; unpinned = show pill instead.
const scrollerRef = ref<{ scrollToBottom?: () => void; $el?: HTMLElement & StickyScrollTarget } | null>(null);

const { hasNewMessages, unseenCount, onScroll, onNewMessages, scrollToBottomAndPin, onPillClick } =
  useChatStickyScroll({
    getScrollElement: () => scrollerRef.value?.$el ?? null,
    scrollToBottom: () => scrollerRef.value?.scrollToBottom?.(),
  });

// DynamicScroller is an async component — the template ref fills only once its
// chunk resolves and it mounts, so attach the scroll listener from a one-shot
// watcher on the ref rather than onMounted (where it is still null).
const stopScrollerWatch = watch(scrollerRef, (scroller) => {
  if (!scroller?.$el) return;
  scroller.$el.addEventListener('scroll', onScroll);
  scrollToBottomAndPin();
  stopScrollerWatch();
});

onBeforeUnmount(() => {
  scrollerRef.value?.$el?.removeEventListener('scroll', onScroll);
});

watch(
  () => audioStore.messages.length,
  (newLength, oldLength) => {
    const added = newLength - oldLength;
    if (added <= 0) return;
    nextTick(() => {
      onNewMessages(added);
    });
  }
);

function handleClearChat() {
  audioStore.clearMessages();
  // Empty view has no history to hold position in — reset pin + pill so a
  // stale "new messages" pill can't linger over the cleared list.
  scrollToBottomAndPin();
}

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
  <div class="grow overflow-hidden flex flex-col h-full bg-linear-to-b from-primary/10 to-primary/20 p-2 rounded-xl shadow-md relative">
    <!-- Clear chat (local view only) -->
    <UButton
        icon="i-lucide-eraser"
        size="xs"
        color="neutral"
        variant="ghost"
        class="absolute top-1 right-1 z-10 size-6"
        :disabled="audioStore.messages.length === 0"
        aria-label="Clear chat"
        @click="handleClearChat"
    />

    <!-- Messages Container -->
    <div class="relative flex-1 overflow-hidden">
      <DynamicScroller
        ref="scrollerRef"
        :items="audioStore.messages"
        :min-item-size="48"
        key-field="id"
        class="h-full overflow-y-auto py-10 scrollbar-hide"
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

      <!-- New messages pill -->
      <UButton
          v-if="hasNewMessages"
          icon="i-lucide-arrow-down"
          size="xs"
          class="absolute bottom-1 left-1/2 -translate-x-1/2 z-10 rounded-full shadow-md"
          @click="onPillClick"
      >
        New messages{{ unseenCount > 0 ? ` (${unseenCount})` : '' }}
      </UButton>
    </div>

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
