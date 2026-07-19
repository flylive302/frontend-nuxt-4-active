// ========================================
// Inbox / Messaging Type Definitions
// ========================================

export type ThreadKind = 'dm' | 'request'

export interface ThreadParticipant {
  id: string
  name: string
  avatar: string | null
  frame_id: number | null
  signature: string | null
  gender: number | null
  /** ISO 8601 timestamp of the participant's last activity; null if never active. */
  lastSeenAt: string | null
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
  /** Newest message id (as string) the peer has seen in this thread, or null if never opened. */
  peerSeenUpToMessageId: string | number | null
}

// ── Typed message content envelope (dm-realtime-platform/09) ─────────────
// `kind` is a coarse payload-shape discriminator derived on the backend from
// the persisted `type` (text/emoji/sticker/system → text; media; voice).
// `media` and `voice` are reserved at the type level only — no send path,
// upload pipeline, or UI exists for them yet.

export type MessageKind = 'text' | 'media' | 'voice'

export interface MediaContentPayload {
  url: string
  mimeType: string
  width?: number
  height?: number
}

export interface VoiceContentPayload {
  url: string
  durationMs: number
}

/** Optimistic media-bubble lifecycle (dm-messenger-v2/02); absent on confirmed server messages. */
export type MediaUploadStatus = 'uploading' | 'failed' | 'sent'

interface ThreadMessageBase {
  id: string
  threadId: string
  senderId: string | null
  /** Fine-grained content-format discriminator (text/emoji/sticker/system/media/voice). */
  type: string
  sentAt: string
  readAt: string | null
  unsent: boolean
  isOwn: boolean
  /** Optimistic media bubble only: uploading/failed/sent. Undefined for text + confirmed messages. */
  uploadStatus?: MediaUploadStatus
  /** Optimistic media bubble only: 0-100 upload progress. */
  uploadProgress?: number
  /** Optimistic media bubble only: local object URL preview shown before the remote URL exists. Revoke on settle. */
  localPreviewUrl?: string
}

export interface TextThreadMessage extends ThreadMessageBase {
  kind: 'text'
  content: string
}

export interface MediaThreadMessage extends ThreadMessageBase {
  kind: 'media'
  content: string
  media: MediaContentPayload
}

export interface VoiceThreadMessage extends ThreadMessageBase {
  kind: 'voice'
  content: string
  voice: VoiceContentPayload
}

export type ThreadMessage = TextThreadMessage | MediaThreadMessage | VoiceThreadMessage

export interface OfficialMessage {
  id: number
  content: string
  isTargeted: boolean
  isFiltered: boolean
  sentAt: string
}

// ── API response shapes ───────────────────────────────

export interface ThreadsResponse {
  data: {
    official_unread: number
    dm: {
      data: Thread[]
      next_cursor: string | null
    }
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

// ── Attachment upload lifecycle (dm-messenger-v2/01) ──────────────────

/** Scoped ImageKit signed-upload auth for a thread-namespaced folder. */
export interface DmAttachmentUploadAuth {
  token: string
  signature: string
  expire: number
  publicKey: string
  folder: string
  urlEndpoint: string
  /** Server-generated random asset name — non-guessable URL. */
  fileName: string
}

export interface DmAttachmentUploadAuthResponse {
  data: DmAttachmentUploadAuth
}

export interface DmAttachmentFinalizeResponse {
  data: MediaContentPayload
}

// ── Voice note upload lifecycle (dm-messenger-v2/04) ──────────────────

export interface DmVoiceFinalizeResponse {
  data: VoiceContentPayload
}
