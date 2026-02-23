// ========================================
// Socket Event Payload Types
// ========================================
// Real-time events from MSAB - 21 total

// ========================================
// Economy Events
// ========================================

/**
 * balance.updated - Fired when user's coins/diamonds/XP changes.
 */
export interface BalanceUpdatedPayload {
  coins: string
  diamonds: string
  wealth_xp: string
  charm_xp: string
}

/**
 * reward.earned - Fired when user claims a reward.
 */
export interface RewardEarnedPayload {
  user_reward_id: number
  reward: {
    id: number
    name: string
    type: 'coins' | 'diamonds' | 'badge' | 'gift'
    amount: string
    description: string | null
  }
}

// ========================================
// Achievement Events
// ========================================

/**
 * badge.earned - Fired when user earns a new badge.
 */
export interface BadgeEarnedPayload {
  badge_id: number
  badge_name: string
  badge_image: string
  category: 'wealth' | 'charm' | 'room' | 'special'
  context: string // e.g., 'level_up', 'gift_received'
}

/**
 * level.up - Fired when user levels up (wealth or charm).
 */
export interface UserLevelUpPayload {
  type: 'wealth' | 'charm'
  previous_level: number
  new_level: number
  current_xp: string
}

// ========================================
// Room Events
// ========================================

/**
 * room.level_up - Fired when a room levels up.
 */
export interface RoomLevelUpPayload {
  room_id: number
  room_name: string
  previous_level: number
  new_level: number
  current_xp: string
}

/**
 * room.participant_count - Fired when room participant count changes.
 */
export interface RoomParticipantCountPayload {
  count: number
}

/**
 * room.updated - Fired when room settings are changed.
 */
export interface RoomUpdatedPayload {
  room_id: number
  updated_fields: string[]
  room: {
    id: number
    name: string
    background: string | null
    primary_color: string | null
    type: string
    is_password_protected: boolean
    max_seats: number
  }
  updated_by: number
}

/**
 * room.invitation_cancelled - Fired when an invitation is cancelled.
 */
export interface RoomInvitationCancelledPayload {
  room_id: number
  room_name: string
  invitation_id: number
}

/**
 * room.join_request_cancelled - Fired when a join request is cancelled.
 */
export interface RoomJoinRequestCancelledPayload {
  room_id: number
  request_id: number
  user_id: number
}

/**
 * room.user_unblocked - Fired when a user is unblocked from a room.
 */
export interface RoomUserUnblockedPayload {
  room_id: number
  room_name: string
}

// ========================================
// Income Events
// ========================================

/**
 * income_target.completed - Fired when member completes income target.
 */
export interface IncomeTargetCompletedPayload {
  target_id: number
  tier: string
  name: string
  earned_coins: string
  member_reward: number
  owner_reward: number
}

// ========================================
// Agency Events
// ========================================

/**
 * agency.invitation - Fired when user receives agency invitation.
 */
export interface AgencyInvitationPayload {
  invitation_id: number
  agency: {
    id: number
    name: string
    logo: string | null
  }
  invited_by: {
    id: number
    name: string
  }
}

/**
 * agency.join_request - Fired to owner when someone wants to join.
 */
export interface AgencyJoinRequestPayload {
  request_id: number
  user: {
    id: number
    name: string
    avatar: string | null
  }
  message?: string
}

/**
 * agency.join_request_approved / rejected / member_kicked / dissolved
 */
export interface AgencyStatusPayload {
  agency_id: number
  agency_name: string
  reason?: string
}

/**
 * agency.member_joined - Fired to agency owner when a member joins.
 */
export interface AgencyMemberJoinedPayload {
  agency_id: number
  member_id: number
}

/**
 * agency.member_left - Fired to agency owner when a member leaves.
 */
export interface AgencyMemberLeftPayload {
  agency_id: number
  member_id: number
  reason: string
}

// ========================================
// System Events
// ========================================

/**
 * config:invalidate - Fired when admin updates config.
 */
export interface ConfigInvalidatePayload {
  type: 'levels' | 'badges' | 'gifts' | 'all'
  version?: string
}

// ========================================
// Socket Event Map
// ========================================

/**
 * Type-safe server-to-client event map.
 */
export interface ServerToClientEvents {
  // Economy
  'balance.updated': (payload: BalanceUpdatedPayload) => void
  'reward.earned': (payload: RewardEarnedPayload) => void

  // Achievement
  'badge.earned': (payload: BadgeEarnedPayload) => void
  'level.up': (payload: UserLevelUpPayload) => void

  // Room
  'room.level_up': (payload: RoomLevelUpPayload) => void
  'room.participant_count': (payload: RoomParticipantCountPayload) => void
  'room.updated': (payload: RoomUpdatedPayload) => void
  'room.invitation_cancelled': (payload: RoomInvitationCancelledPayload) => void
  'room.join_request_cancelled': (payload: RoomJoinRequestCancelledPayload) => void
  'room.user_unblocked': (payload: RoomUserUnblockedPayload) => void

  // Income
  'income_target.completed': (payload: IncomeTargetCompletedPayload) => void
  'income_target.member_completed': (payload: IncomeTargetCompletedPayload) => void

  // Agency
  'agency.invitation': (payload: AgencyInvitationPayload) => void
  'agency.join_request': (payload: AgencyJoinRequestPayload) => void
  'agency.join_request_approved': (payload: AgencyStatusPayload) => void
  'agency.join_request_rejected': (payload: AgencyStatusPayload) => void
  'agency.member_kicked': (payload: AgencyStatusPayload) => void
  'agency.dissolved': (payload: AgencyStatusPayload) => void
  'agency.member_joined': (payload: AgencyMemberJoinedPayload) => void
  'agency.member_left': (payload: AgencyMemberLeftPayload) => void

  // System
  'config:invalidate': (payload: ConfigInvalidatePayload) => void
}
