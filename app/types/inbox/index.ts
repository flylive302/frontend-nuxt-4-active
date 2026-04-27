// ========================================
// Inbox / Messaging Type Definitions
// ========================================

export type ThreadKind = 'system' | 'dm'

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
  lastMessage: string
  lastMessageAt: string
  unreadCount: number
}

export interface ThreadMessage {
  id: string
  threadId: string
  senderId: string | null
  content: string
  sentAt: string
  isOwn: boolean
}
