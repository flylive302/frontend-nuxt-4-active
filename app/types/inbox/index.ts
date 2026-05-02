// ========================================
// Inbox / Messaging Type Definitions
// ========================================

export type ThreadKind = 'system' | 'dm' | 'request'

export interface ThreadParticipant {
  id: string
  name: string
  avatar: string | null
  frame: string | null
}

export interface Thread {
  id: string
  kind: ThreadKind
  participant: ThreadParticipant
  lastMessage: string | null
  lastMessageAt: string | null
  unreadCount: number
  requestMessageCount: number
  acceptedAt: string | null
  isInitiator: boolean
}

export interface ThreadMessage {
  id: string
  threadId: string
  senderId: string | null
  content: string
  type: string
  sentAt: string
  readAt: string | null
  unsent: boolean
  isOwn: boolean
}

export interface OfficialMessage {
  id: number
  content: string
  isTargeted: boolean
  sentAt: string
}

// ── API response shapes ───────────────────────────────

export interface ThreadsResponse {
  data: {
    official_unread: number
    dm: Thread[]
    requests: Thread[]
  }
}

export interface MessagesResponse {
  data: {
    messages: ThreadMessage[]
    nextCursor: string | null
    prevCursor: string | null
  }
}

export interface SendMessageResponse {
  data: ThreadMessage
}
