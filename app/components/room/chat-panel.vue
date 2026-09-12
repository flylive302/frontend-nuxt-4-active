<script setup lang="ts">
import type { Component } from 'vue';
import { defineAsyncComponent } from 'vue';
import type { StickyScrollTarget } from '~/composables/room/useChatStickyScroll';
import { filterChatMessages, filterUnblockedMessages, countVisibleAppends } from '~/utils/chat';
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
const userBlocksStore = useUserBlocksStore();

// One shared context menu + report modal for every message row (ticket 01 step 4).
// The menu anchors to a fixed-position 0-size trigger placed at the gesture point.
const {
  target: actionTarget,
  anchor: menuAnchor,
  menuOpen,
  reportOpen,
  reportDescription,
  menuItems,
} = useChatMessageActions();
const menuAnchorStyle = computed(() => ({ left: `${menuAnchor.value.x}px`, top: `${menuAnchor.value.y}px` }));

// Filter tabs (All / Chat / Gifts) — local UI-only state, trivial predicate
// filtering via the pure `filterChatMessages` util (no business logic here).
const chatTabs: { id: ChatTab; label: string }[] = [
  { id: CHAT_TAB_ALL, label: 'All' },
  { id: CHAT_TAB_CHAT, label: 'Chat' },
  { id: CHAT_TAB_GIFTS, label: 'Gifts' },
];
const activeChatTab = ref<ChatTab>(CHAT_TAB_ALL);
// GATE (Apple 1.2): hide already-buffered lines from a user blocked mid-room —
// the socket handler only stops FUTURE messages, so blocking someone whose
// earlier messages are already in the store needs this second filter.
// Reads `blockedUserIds` (not `isBlocked`) so the computed tracks the Set and
// re-runs when someone is blocked mid-room. Empty set → same array reference,
// so DynamicScroller is not re-diffed on every inbound message.
const unblockedMessages = computed(() =>
  filterUnblockedMessages(audioStore.messages, userBlocksStore.blockedUserIds)
);
const filteredMessages = computed(() => filterChatMessages(unblockedMessages.value, activeChatTab.value));

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

// Watch the store's append counter, NOT `messages.length`: at the 500 cap the
// length is pinned (splice+push in one sync call) and a length watcher never
// fires again (room-page-runtime-audit 02). Count only the appends the active
// tab + block list will render, so a gift on the Chat tab can't raise the pill.
watch(
  () => audioStore.appendSeq,
  (newSeq, oldSeq) => {
    const visible = countVisibleAppends(
      audioStore.messages,
      newSeq - oldSeq,
      activeChatTab.value,
      userBlocksStore.blockedUserIds
    );
    if (visible === 0) return;
    nextTick(() => {
      onNewMessages(visible);
    });
  }
);

function handleClearChat() {
  audioStore.clearMessages();
  // Empty view has no history to hold position in — reset pin + pill so a
  // stale "new messages" pill can't linger over the cleared list.
  scrollToBottomAndPin();
}
</script>

<template>
  <div class="grow overflow-hidden flex flex-col h-full relative">
    <!-- Clear chat (local view only) -->
    <UButton
        variant="ghost"
        class="absolute top-0 right-0 z-10 justify-center p-0"
        :disabled="audioStore.messages.length === 0"
        aria-label="Clear chat"
        @click="handleClearChat"
    >
      <UIcon name="i-lucide-eraser" class="size-4" />
      Clear
    </UButton>

    <!-- Filter tabs: All / Chat / Gifts -->
    <div class="flex items-center gap-1 pl-2" role="tablist" aria-label="Chat filter">
      <button
          v-for="tab in chatTabs"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-selected="activeChatTab === tab.id"
          class="text-xs font-medium px-2.5 py-1 rounded-full transition-colors"
          :class="activeChatTab === tab.id
            ? 'bg-primary text-white scale-110'
            : 'bg-primary text-muted hover:bg-primary/20'"
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

      <!-- Shared message context menu: invisible fixed trigger at the long-press /
           right-click point, so reka positions the menu at the touched message. -->
      <UDropdownMenu
        v-model:open="menuOpen"
        :items="menuItems"
        :content="{ side: 'bottom', align: 'start' }"
      >
        <span class="fixed size-0 pointer-events-none" :style="menuAnchorStyle" aria-hidden="true" />
      </UDropdownMenu>

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

    <!-- Shared report modal — mounts on first use, one instance for the panel. -->
    <ReportModal
      v-if="actionTarget"
      v-model:open="reportOpen"
      reportable-type="user"
      :reportable-id="actionTarget.userId"
      :initial-description="reportDescription"
    />

  </div>
</template>
