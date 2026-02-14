// ========================================
// Notification System Type Definitions
// ========================================

// ========================================
// Notification Types
// ========================================

/**
 * All possible notification types in the system.
 * Each type has specific data requirements and UI treatment.
 */
export type NotificationType =
  // Agency invitations
  | 'agency_invitation'
  | 'invitation_accepted'
  | 'invitation_declined'
  | 'invitation_expired'
  | 'invitation_cancelled'
  // Join requests
  | 'join_request_received'
  | 'join_request_approved'
  | 'join_request_rejected'
  | 'join_request_cancelled'
  // Membership events
  | 'member_joined'
  | 'member_left'
  | 'member_kicked'
  | 'member_promoted'
  | 'member_demoted'
  // Agency events
  | 'agency_approved'
  | 'agency_rejected'
  | 'agency_dissolved'
  // Generic
  | 'system'

// ========================================
// Notification Resource
// ========================================

export interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  data: NotificationData
  read_at: string | null
  created_at: string
  action_url?: string
}

/**
 * Contextual data attached to notifications.
 * Contains IDs and references needed for deep linking and display.
 */
export interface NotificationData {
  // Agency-related
  agency_id?: number
  agency_name?: string
  agency_logo?: string | null
  
  // User-related
  user_id?: number
  user_name?: string
  user_avatar?: string | null
  
  // Invitation-related
  invitation_id?: number
  
  // Join request-related
  join_request_id?: number
  
  // Member-related
  member_id?: number
  
  // Generic metadata
  [key: string]: unknown
}

// ========================================
// API Response Types
// ========================================

export interface NotificationListResponse {
  data: Notification[]
  links: {
    first: string | null
    last: string | null
    prev: string | null
    next: string | null
  }
  meta: {
    path: string
    per_page: number
    next_cursor: string | null
    prev_cursor: string | null
    unread_count: number
  }
}

export interface UnreadCountResponse {
  data: {
    count: number
  }
}

// ========================================
// Store State Types
// ========================================

export interface NotificationState {
  items: Notification[]
  unreadCount: number
  loading: boolean
  hasMore: boolean
  cursor: string | null
  lastFetched: number | null
}

// ========================================
// UI Helper Types
// ========================================

export interface NotificationTypeConfig {
  icon: string
  color: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'
}

export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, NotificationTypeConfig> = {
  // Invitations
  agency_invitation: { icon: 'i-lucide-mail', color: 'primary' },
  invitation_accepted: { icon: 'i-lucide-user-check', color: 'success' },
  invitation_declined: { icon: 'i-lucide-user-x', color: 'warning' },
  invitation_expired: { icon: 'i-lucide-clock', color: 'neutral' },
  invitation_cancelled: { icon: 'i-lucide-x', color: 'neutral' },
  
  // Join requests
  join_request_received: { icon: 'i-lucide-user-plus', color: 'info' },
  join_request_approved: { icon: 'i-lucide-check', color: 'success' },
  join_request_rejected: { icon: 'i-lucide-x', color: 'error' },
  join_request_cancelled: { icon: 'i-lucide-x', color: 'neutral' },
  
  // Membership
  member_joined: { icon: 'i-lucide-users', color: 'success' },
  member_left: { icon: 'i-lucide-user-minus', color: 'warning' },
  member_kicked: { icon: 'i-lucide-ban', color: 'error' },
  member_promoted: { icon: 'i-lucide-arrow-up', color: 'success' },
  member_demoted: { icon: 'i-lucide-arrow-down', color: 'warning' },
  
  // Agency
  agency_approved: { icon: 'i-lucide-check-circle', color: 'success' },
  agency_rejected: { icon: 'i-lucide-x-circle', color: 'error' },
  agency_dissolved: { icon: 'i-lucide-archive', color: 'error' },
  
  // System
  system: { icon: 'i-lucide-bell', color: 'neutral' },
}

// ========================================
// Polling Configuration
// ========================================

/**
 * Polling intervals for notification system.
 * Will be replaced with WebSocket when backend is ready.
 */
export const NOTIFICATION_POLLING_CONFIG = {
  /** Interval for fetching new notifications (ms) */
  FETCH_INTERVAL: 30_000, // 30 seconds
  
  /** Interval for updating unread count (ms) */
  COUNT_INTERVAL: 15_000, // 15 seconds
  
  /** Maximum items to fetch per request */
  PAGE_SIZE: 20,
  
  /** Cache duration before refetch (ms) */
  CACHE_DURATION: 60_000, // 1 minute
} as const
