<script setup lang="ts">
import type { Component } from 'vue';
import { defineAsyncComponent } from 'vue';
import { useRoomAudio } from '~/composables/room/useRoomAudio';
import type { StickyScrollTarget } from '~/composables/room/useChatStickyScroll';
import { filterChatMessages } from '~/utils/chat';
import { CHAT_TAB_ALL, CHAT_TAB_CHAT, CHAT_TAB_GIFTS, type ChatTab } from '~/constants/room';

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

// Filter tabs (All / Chat / Gifts) — local UI-only state, trivial predicate
// filtering via the pure `filterChatMessages` util (no business logic here).
const chatTabs: { id: ChatTab; label: string }[] = [
  { id: CHAT_TAB_ALL, label: 'All' },
  { id: CHAT_TAB_CHAT, label: 'Chat' },
  { id: CHAT_TAB_GIFTS, label: 'Gifts' },
];
const activeChatTab = ref<ChatTab>(CHAT_TAB_ALL);
const filteredMessages = computed(() => filterChatMessages(audioStore.messages, activeChatTab.value));

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

    <!-- Filter tabs: All / Chat / Gifts -->
    <div class="flex items-center gap-1 mb-1 pr-7" role="tablist" aria-label="Chat filter">
      <button
          v-for="tab in chatTabs"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-selected="activeChatTab === tab.id"
          class="text-xs font-medium px-2.5 py-1 rounded-full transition-colors"
          :class="activeChatTab === tab.id
            ? 'bg-primary text-white'
            : 'bg-primary/10 text-muted hover:bg-primary/20'"
          @click="activeChatTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Messages Container -->
    <div class="relative flex-1 overflow-hidden">
      <DynamicScroller
        ref="scrollerRef"
        :items="filteredMessages"
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
    <p v-if="filteredMessages.length === 0 && audioStore.messages.length === 0" class="font-semibold text-sm text-center pt-12 h-full">
      No messages yet.
      <br> Be the first to say hello! 👋
    </p>
    <p v-else-if="filteredMessages.length === 0" class="font-semibold text-sm text-center pt-12 h-full">
      No messages in this view.
    </p>

    <!-- Input -->
    <div class="flex items-center">
      <UInput
          ref="inputRef"
          v-model="messageInput"
          :ui="{
            base: 'rounded-r-none rounded-l-full ring-0'
          }"
          class="w-full"
          size="lg"
          icon="i-lucide-user"
          placeholder="Type a message..."
          @keydown="handleKeydown" />
      <UButton
          size="sm"
          variant="solid"
          color="neutral"
          class="size-9 p-2 rounded-l-none rounded-r-full bg-neutral-900!"
          :disabled="!messageInput.trim()"
          @click="handleSend"
      >
        <UIcon class="size-8 text-primary" name="i-lucide-send" />
      </UButton>
    </div>

  </div>
</template>
