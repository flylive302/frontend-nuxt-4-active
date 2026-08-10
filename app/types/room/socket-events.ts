// ========================================
// Socket Event Payload Types
// ========================================
// Real-time events from MSAB - 21 total

import type { MediaContentPayload, VoiceContentPayload } from '~/types/inbox'

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

/**
 * coin_request.status_changed - Fired when a coin request is approved/rejected.
 */
export interface CoinRequestStatusChangedPayload {
  coin_request_id: number
  status: 'approved' | 'rejected' | 'cancelled'
  approved_amount: number | null
  asset_type: string | null
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

/**
 * user.progression - Single event combining all level-ups from one gift transaction.
 * Replaces separate level.up events from the gift side-effects job.
 * Level-ups no longer award badges (badge system refactor).
 */
export interface UserProgressionPayload {
  level_ups: UserLevelUpPayload[]
}

// ========================================
// Room Events
// ========================================

/**
 * room.seat_cap_unlocked - Fired to the room owner only when a room level-up
 * crosses one or more Seat Unlock Ladder entries (highest cap only).
 */
export interface RoomSeatCapUnlockedPayload {
  room_id: number
  room_name: string
  new_level: number
  seat_cap: number
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
// Income Events (agency-XP per-run milestones)
// ========================================

/**
 * agency_xp.progress - Per-gift XP increment on the member's active run.
 */
export interface AgencyXpProgressPayload {
  run_id: number
  accumulated_xp: string
  current_tier: number
  progress_percentage: number | null
}

/**
 * A single milestone crossed by a gift.
 */
export interface CrossedMilestone {
  tier: number
  member_diamond_reward: number
  owner_diamond_reward: number
}

/**
 * agency_milestone.crossed - One or more tiers crossed (member's own view).
 */
export interface AgencyMilestoneCrossedPayload {
  run_id: number
  current_tier: number
  accumulated_xp: string
  milestones: CrossedMilestone[]
}

/**
 * agency_milestone.member_crossed - A managed member crossed a tier (owner view).
 */
export interface AgencyMilestoneMemberCrossedPayload {
  run_id: number
  member_id: number
  current_tier: number
  milestones: Array<{ tier: number; owner_reward: number }>
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

/**
 * agency.leave_request - Fired to agency owner when a member requests to leave.
 */
export interface AgencyLeaveRequestPayload {
  request_id: number
  user: {
    id: number
    name: string
    avatar: string | null
  }
  message?: string
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
// Mission Events (Recharge Activity)
// ========================================

/**
 * mission.progress.updated - Fired after a successful milestone claim.
 */
export interface MissionProgressUpdatedPayload {
  milestone_id: number
  timeframe: string
  instance_key: string
}

/**
 * mission.finale.ready - Fired once a closed weekly/monthly instance's
 * ranking snapshot is finalized for a Top-N viewer.
 */
export interface MissionFinaleReadyPayload {
  timeframe: string
  instance_key: string
}

// ========================================
// Inbox Events (DM / thread / official — dm-realtime-platform/02)
// ========================================
// Realtime Hints only (ADR 0021) — mirror backend broadcastWith() shapes
// exactly (backend/app/Events/Inbox/*.php). MSAB is pure pass-through.

/**
 * dm.message.received - New DM delivered to the recipient's private channel.
 * Mirrors App\Events\Inbox\DmMessageSent::broadcastWith().
 */
export interface DmMessageReceivedPayload {
  threadId: number
  message: {
    id: number
    threadId: number
    senderId: number | null
    content: string
    type: string
    /** Coarse payload-shape discriminator (dm-realtime-platform/09) — text|media|voice. */
    kind: string
    /** Structured image payload; null unless `kind` is media. Never inlined in `content`. */
    media?: MediaContentPayload | null
    /** Structured voice payload; null unless `kind` is voice. Never inlined in `content`. */
    voice?: VoiceContentPayload | null
    sentAt: string
    readAt: string | null
    unsent: boolean
    isOwn: boolean
  }
}

/**
 * dm.message.unsent - A message was unsent by its sender.
 * Mirrors App\Events\Inbox\DmMessageUnsent::broadcastWith().
 */
export interface DmMessageUnsentPayload {
  threadId: number
  messageId: number
}

/**
 * dm.thread.request - A stranger request was created targeting the recipient.
 * Mirrors App\Events\Inbox\DmThreadRequested::broadcastWith().
 */
export interface DmThreadRequestPayload {
  threadId: number
  thread: {
    id: number
    kind: string
    participant: {
      id: number
      name: string
      avatar: string | null
      frame_id: number | null
      signature: string | null
      gender: number | null
    }
    lastMessage: string | null
    lastMessageAt: string | null
    unreadCount: number
    requestMessageCount: number
    acceptedAt: string | null
    isInitiator: boolean
  }
}

/**
 * dm.thread.accepted - The recipient's stranger request was accepted.
 * Mirrors App\Events\Inbox\DmThreadAccepted::broadcastWith().
 */
export interface DmThreadAcceptedPayload {
  threadId: number
}

/**
 * dm.thread.seen - The peer's thread-level seen watermark advanced (read receipt).
 * Mirrors App\Services\Realtime\Emitters\InboxEventEmitter::emitDmThreadSeen().
 */
export interface DmThreadSeenPayload {
  threadId: number
  seenUpToMessageId: number
}

/**
 * official.message.received - Official/system broadcast message. Laravel
 * fans this out per-user today (targeted/filtered/all loop); MSAB routes
 * user_id-targeted like the DM events, or broadcasts (io.emit) when Laravel
 * publishes with both user_id and room_id null.
 * Mirrors App\Events\Inbox\OfficialMessageBroadcast::broadcastWith().
 */
export interface OfficialMessageReceivedPayload {
  id: number
  content: string
  isTargeted: boolean
  isFiltered: boolean
  sentAt: string
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
  'coin_request.status_changed': (payload: CoinRequestStatusChangedPayload) => void

  // Achievement
  'badge.earned': (payload: BadgeEarnedPayload) => void
  'user.progression': (payload: UserProgressionPayload) => void

  // Room
  'room.seat_cap_unlocked': (payload: RoomSeatCapUnlockedPayload) => void
  'room.participant_count': (payload: RoomParticipantCountPayload) => void
  'room.updated': (payload: RoomUpdatedPayload) => void
  'room.invitation_cancelled': (payload: RoomInvitationCancelledPayload) => void
  'room.join_request_cancelled': (payload: RoomJoinRequestCancelledPayload) => void
  'room.user_unblocked': (payload: RoomUserUnblockedPayload) => void

  // Income (agency-XP per-run milestones)
  'agency_xp.progress': (payload: AgencyXpProgressPayload) => void
  'agency_milestone.crossed': (payload: AgencyMilestoneCrossedPayload) => void
  'agency_milestone.member_crossed': (payload: AgencyMilestoneMemberCrossedPayload) => void

  // Agency
  'agency.invitation': (payload: AgencyInvitationPayload) => void
  'agency.join_request': (payload: AgencyJoinRequestPayload) => void
  'agency.join_request_approved': (payload: AgencyStatusPayload) => void
  'agency.join_request_rejected': (payload: AgencyStatusPayload) => void
  'agency.member_kicked': (payload: AgencyStatusPayload) => void
  'agency.dissolved': (payload: AgencyStatusPayload) => void
  'agency.member_joined': (payload: AgencyMemberJoinedPayload) => void
  'agency.member_left': (payload: AgencyMemberLeftPayload) => void
  'agency.leave_request': (payload: AgencyLeaveRequestPayload) => void
  'agency.leave_request_approved': (payload: AgencyStatusPayload) => void
  'agency.leave_request_rejected': (payload: AgencyStatusPayload) => void

  // System
  'config:invalidate': (payload: ConfigInvalidatePayload) => void

  // Mission (Recharge Activity)
  'mission.progress.updated': (payload: MissionProgressUpdatedPayload) => void
  'mission.finale.ready': (payload: MissionFinaleReadyPayload) => void

  // Inbox (DM / thread / official)
  'dm.message.received': (payload: DmMessageReceivedPayload) => void
  'dm.message.unsent': (payload: DmMessageUnsentPayload) => void
  'dm.thread.request': (payload: DmThreadRequestPayload) => void
  'dm.thread.accepted': (payload: DmThreadAcceptedPayload) => void
  'dm.thread.seen': (payload: DmThreadSeenPayload) => void
  'official.message.received': (payload: OfficialMessageReceivedPayload) => void
}
