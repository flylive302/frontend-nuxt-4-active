/**
 * Chat message filtering — pure predicate, no Vue/store dependencies.
 * Used by the room chat panel's All/Chat/Gifts filter tabs
 * (lucky-burst-draw ticket 10 follow-up).
 */
import type { ChatMessageEvent } from '~/types/room/audio';
import {
  CHAT_TAB_ALL,
  CHAT_TAB_CHAT,
  CHAT_MESSAGE_TYPE_TEXT,
  CHAT_TIME_MINUTE_S,
  CHAT_TIME_HOUR_S,
  CHAT_TIME_DAY_S,
  type ChatTab,
} from '~/constants/room';

/**
 * Filter a message list down to the given tab:
 * - `all`: every message, unfiltered.
 * - `chat`: only real user-typed messages (`CHAT_MESSAGE_TYPE_TEXT`).
 * - `gifts`: every non-text type — system/join, gift-sent, lucky-win, and any
 *   future announcement type (matches type !== text rather than an allowlist,
 *   so a stale bundle's unknown future type still lands under "Gifts", not
 *   silently dropped from every tab).
 */
export function filterChatMessages(messages: ChatMessageEvent[], tab: ChatTab): ChatMessageEvent[] {
  if (tab === CHAT_TAB_ALL) return messages;
  if (tab === CHAT_TAB_CHAT) return messages.filter((m) => m.type === CHAT_MESSAGE_TYPE_TEXT);
  return messages.filter((m) => m.type !== CHAT_MESSAGE_TYPE_TEXT);
}

/**
 * Pure decision: should this message render inside a chat bubble frame?
 *
 * Two independent grants, either of which is sufficient:
 * - An **equipped** bubble (`chatBubbleId` set). Ownership is already proven by the id being
 *   set on the user, so VIP is NOT required — a bubble awarded by an admin to a non-VIP user
 *   renders exactly like a purchased one.
 * - **VIP membership**, which grants the default bubble skin even with nothing equipped.
 *
 * Returning false means the plain (frameless) message box is used instead.
 */
export function shouldRenderChatBubble(
  chatBubbleId?: number | null,
  vipLevel?: number | null
): boolean {
  return Boolean(chatBubbleId) || Boolean(vipLevel);
}

/**
 * Pure relative-time label for a chat timestamp: `now` / `Nm` / `Nh` / `Nd`.
 *
 * `now` is a parameter on purpose — reading `Date.now()` inside a Vue computed
 * gives it no reactive dependency, so the label freezes at first render
 * (room-child-render-cost ticket 01 step 3). Callers pass a ticking clock.
 */
export function formatChatAge(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));

  if (seconds < CHAT_TIME_MINUTE_S) return 'now';
  if (seconds < CHAT_TIME_HOUR_S) return `${Math.floor(seconds / CHAT_TIME_MINUTE_S)}m`;
  if (seconds < CHAT_TIME_DAY_S) return `${Math.floor(seconds / CHAT_TIME_HOUR_S)}h`;
  return `${Math.floor(seconds / CHAT_TIME_DAY_S)}d`;
}
