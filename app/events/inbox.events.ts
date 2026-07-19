// ========================================
// Inbox Events (DM / thread / official)
// ========================================
// Handles dm.message.received, dm.message.unsent, dm.thread.request,
// dm.thread.accepted, official.message.received socket events — the MSAB
// pass-through relay of the former Reverb-only Inbox events
// (dm-realtime-platform/02). REACT-only: store mutation + toast, no
// business logic, no API calls. Realtime Hints per ADR 0021 — the store
// stays best-effort/at-most-once; truth is still reconciled via REST
// (see useInboxReconcile). Do NOT call reconcileInbox from here.

import type { Socket } from 'socket.io-client'
import { dmMessagePreview } from '~/utils/dm-message-preview'
import type { Thread, ThreadMessage } from '~/types/inbox'
import type {
  DmMessageReceivedPayload,
  DmMessageUnsentPayload,
  DmThreadRequestPayload,
  DmThreadAcceptedPayload,
  DmThreadSeenPayload,
  OfficialMessageReceivedPayload,
} from '~/types/room/socket-events'

/**
 * Composable to register inbox-related socket event handlers.
 * Captures store/toast dependencies during setup() phase.
 */
export function useInboxEvents() {
  const store = useInboxStore()
  const toast = useToast()

  return function registerInboxEvents(socket: Socket): void {
    socket.on('dm.message.received', (payload: DmMessageReceivedPayload) => {
      const tid = String(payload.threadId)
      // Normalize IDs to strings (backend sends integers, FE routes use strings).
      // `kind` passes through as-is (dm-messenger-v2): media/voice must keep
      // their kind so bubbles render payloads instead of raw JSON; an unknown
      // future kind flows to the bubble's stale-OTA placeholder.
      const msg: ThreadMessage = {
        id: String(payload.message.id),
        threadId: tid,
        senderId: payload.message.senderId !== null ? String(payload.message.senderId) : null,
        content: payload.message.content,
        type: payload.message.type,
        kind: payload.message.kind as ThreadMessage['kind'],
        sentAt: payload.message.sentAt,
        readAt: payload.message.readAt,
        unsent: payload.message.unsent,
        isOwn: payload.message.isOwn,
      }

      if (store.activeThreadId === tid) {
        store.appendMessage(msg)
      }
      else if (store.threadById(tid)) {
        store.bumpThreadUnread(tid, dmMessagePreview(msg.kind, msg.content), msg.sentAt)
      }
      // Thread not present locally (e.g. very first message on a brand new
      // thread) — no API call here (REACT-only); the next reconcileInbox
      // pass (foreground/reconnect/thread-open) picks it up.
    })

    socket.on('dm.message.unsent', (payload: DmMessageUnsentPayload) => {
      store.markMessageUnsent(String(payload.messageId))
    })

    socket.on('dm.thread.request', (payload: DmThreadRequestPayload) => {
      const raw = payload.thread
      const thread: Thread = {
        id: String(raw.id),
        kind: raw.kind as Thread['kind'],
        participant: {
          id: String(raw.participant.id),
          name: raw.participant.name,
          avatar: raw.participant.avatar,
          frame_id: raw.participant.frame_id,
          signature: raw.participant.signature,
          gender: raw.participant.gender,
          lastSeenAt: null,
        },
        lastMessage: raw.lastMessage,
        lastMessageAt: raw.lastMessageAt,
        unreadCount: raw.unreadCount,
        requestMessageCount: raw.requestMessageCount,
        acceptedAt: raw.acceptedAt,
        isInitiator: raw.isInitiator,
        peerSeenUpToMessageId: null,
      }
      store.upsertThread(thread)

      toast.add({
        title: 'New message request',
        description: `${thread.participant.name} wants to send you a message`,
        icon: 'i-lucide-mail-plus',
        color: 'info',
      })
    })

    socket.on('dm.thread.accepted', (payload: DmThreadAcceptedPayload) => {
      const tid = String(payload.threadId)
      const thread = store.threadById(tid)
      if (thread) store.upsertThread({ ...thread, kind: 'dm' })

      toast.add({
        title: 'Request accepted',
        description: thread ? `${thread.participant.name} accepted your message request` : 'Your message request was accepted',
        icon: 'i-lucide-check-check',
        color: 'success',
      })
    })

    socket.on('dm.thread.seen', (payload: DmThreadSeenPayload) => {
      store.setPeerSeenUpTo(String(payload.threadId), String(payload.seenUpToMessageId))
    })

    socket.on('official.message.received', (payload: OfficialMessageReceivedPayload) => {
      store.bumpOfficialUnread()

      toast.add({
        title: 'FlyLive',
        description: payload.content?.substring(0, 80) || 'New official message',
        icon: 'i-lucide-megaphone',
        color: 'primary',
      })
    })
  }
}
