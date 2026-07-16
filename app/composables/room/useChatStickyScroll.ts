/**
 * Chat Sticky-Bottom Scroll Composable
 *
 * Owns the pin/unpin state machine for the room chat panel's virtual
 * scroller: while "pinned" (user at/near bottom) new messages keep the view
 * pinned to bottom; once the user scrolls away, no scroll work happens per
 * message and a "new messages" pill is surfaced instead until the user
 * either scrolls back within the threshold or taps the pill.
 */
import { CHAT_STICKY_BOTTOM_THRESHOLD_PX } from '~/constants/room';
import { createLogger } from '~/utils/logger';

const logger = createLogger('[ChatStickyScroll]');

/** Minimal shape of the scroller this composable needs — kept small so a fake object satisfies it in tests. */
export interface StickyScrollTarget {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export interface UseChatStickyScrollParams {
  /** Returns the scroller's root DOM element (or the fake test double), or null before mount. */
  getScrollElement: () => StickyScrollTarget | null;
  /** Scroll primitive — e.g. DynamicScroller's `scrollToBottom()`. */
  scrollToBottom: () => void;
}

export function useChatStickyScroll({ getScrollElement, scrollToBottom }: UseChatStickyScrollParams) {
  const isPinned = ref(true);
  const unseenCount = ref(0);
  const hasNewMessages = computed(() => unseenCount.value > 0);

  function distanceFromBottom(el: StickyScrollTarget): number {
    return el.scrollHeight - el.scrollTop - el.clientHeight;
  }

  // GATE — pure read of current scroll position vs. threshold.
  function isNearBottom(): boolean {
    const el = getScrollElement();
    if (!el) return true;
    return distanceFromBottom(el) <= CHAT_STICKY_BOTTOM_THRESHOLD_PX;
  }

  // REACT — user-driven scroll: re-pin/unpin + clear pill when back near bottom.
  function onScroll(): void {
    const nearBottom = isNearBottom();
    if (nearBottom) {
      isPinned.value = true;
      unseenCount.value = 0;
    } else {
      isPinned.value = false;
    }
  }

  // EXECUTE — called when a new message lands; keeps view pinned or tracks unseen count.
  function onNewMessages(count = 1): void {
    if (isPinned.value) {
      scrollToBottom();
      return;
    }
    unseenCount.value += count;
  }

  // EXECUTE — initial mount / room-enter: snap to bottom, stay pinned.
  function scrollToBottomAndPin(): void {
    isPinned.value = true;
    unseenCount.value = 0;
    scrollToBottom();
  }

  // INTENT — pill tap handler.
  function onPillClick(): void {
    logger.debug('pill tapped, re-pinning');
    scrollToBottomAndPin();
  }

  return {
    isPinned,
    unseenCount,
    hasNewMessages,
    onScroll,
    onNewMessages,
    scrollToBottomAndPin,
    onPillClick,
  };
}
