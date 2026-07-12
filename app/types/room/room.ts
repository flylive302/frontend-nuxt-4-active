import type { User } from '../user/auth';
import type {BootstrapRoom, MinimalUser} from '../user/bootstrap';

/**
 * Room type alias for BootstrapRoom.
 * Use BootstrapRoom directly for new code.
 */
export type Room = BootstrapRoom;

export interface CreateRoomPayload {
  name: string;
  country: string;
  type: 'public' | 'private';
  password?: string;
  /**
   * @deprecated Use logo_url and logo_file_id instead (ImageKit CDN upload)
   */
  logo?: File;
  /** ImageKit CDN URL for the room logo */
  logo_url?: string;
  /** ImageKit file ID for cleanup */
  logo_file_id?: string;
}

export interface RoomResponse {
    status: string;
    message: string;
    data: BootstrapRoom;
}

export interface RoomsResponse {
  status: string;
  message: string;
  data: BootstrapRoom[];
  meta: {
    pagination: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    };
    active_countries: string[];
  }
}

// ========================================
// Room Membership Types
// ========================================

/**
 * Room member role.
 */
export type RoomMemberRole = 'owner' | 'admin' | 'moderator' | 'member'

/**
 * Room member status.
 */
export type RoomMemberStatus = 'active' | 'muted' | 'banned'

/**
 * Room membership record.
 */
export interface RoomMember {
  id: number
  room_id: number
  user_id: number
  user: User
  role: RoomMemberRole
  status: RoomMemberStatus
  joined_at: string // ISO 8601
  contribution?: string // Total coins contributed
}

/**
 * Room join request status.
 */
export type RoomJoinRequestStatus = 'pending' | 'approved' | 'rejected'

/**
 * Room join request.
 */
export interface RoomJoinRequest {
  id: number
  room_id: number
  room?: BootstrapRoom
  user_id: number
  user: MinimalUser
  status: RoomJoinRequestStatus
  message?: string
  created_at: string
  reviewed_at?: string
  reviewed_by?: User
}

/**
 * Room invitation status.
 */
export type RoomInvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired'

/**
 * Room invitation.
 */
export interface RoomInvitation {
  id: number
  room_id: number
  room?: BootstrapRoom
  inviter_id: number
  inviter: User
  invitee_id: number
  invitee: User
  status: RoomInvitationStatus
  message?: string
  expires_at?: string
  created_at: string
}

/**
 * Room level information.
 */
export interface RoomLevel {
  level: number
  name: string
  required_coins: string
  rewards: string[]
}

/**
 * Room level progress.
 */
export interface RoomLevelProgress {
  current_level: number
  current_coins: string
  next_level: RoomLevel | null
  coins_to_next_level: string
  progress_percentage: number
}

// ========================================
// API Request Types
// ========================================

/**
 * Parameters for fetching room members.
 */
export interface GetRoomMembersParams {
  role?: RoomMemberRole
  per_page?: number
  cursor?: string
}

/**
 * Request to join a room.
 */
export interface JoinRoomRequest {
  message?: string
}

/**
 * Request to invite user to room.
 */
export interface InviteToRoomRequest {
  user_id: number
  message?: string
}

// ========================================
// API Response Types
// ========================================

/**
 * Pagination for room lists.
 */
export interface RoomMemberPagination {
  has_more: boolean
  next_cursor?: string
}

/**
 * Response for room members list.
 */
export interface RoomMembersResponse {
  success: true
  data: {
    members: RoomMember[]
    pagination: RoomMemberPagination
  }
}

/**
 * Response for room join requests.
 */
export interface RoomJoinRequestsResponse {
  success: true
  data: {
    requests: RoomJoinRequest[]
    pagination: RoomMemberPagination
  }
}

/**
 * Response for room invitations.
 */
export interface RoomInvitationsResponse {
  success: true
  data: {
    invitations: RoomInvitation[]
    pagination: RoomMemberPagination
  }
}

/**
 * Response for room level progress.
 */
export interface RoomLevelProgressResponse {
  success: true
  data: RoomLevelProgress
}

// ========================================
// Room Blocking Types
// ========================================

/**
 * Room block record.
 */
export interface RoomBlock {
  id: number
  /** Blocked user's minimal profile (backend MinimalUserResource shape). */
  user: MinimalUser
  reason: string | null
  banned_until: string | null // ISO 8601 or null for permanent
  is_permanent: boolean
  blocked_at: string
}

/**
 * Request to block a user from room.
 */
export interface BlockUserRequest {
  user_id: number
  reason?: string
  duration: '15m' | '30m' | '1h' | '8h' | '24h' | 'permanent'
}

/**
 * Request to update member role.
 */
export interface UpdateMemberRoleRequest {
  role: 'admin' | 'member'
}

// ========================================
// User Membership State (for smart button)
// ========================================

/**
 * Current user's membership state for a room.
 */
export type RoomMembershipState = 
  | 'none'           // Not a member, no requests
  | 'pending_request' // Has submitted join request
  | 'has_invitation' // Has received invitation
  | 'member'         // Is a member
  | 'blocked'        // Is blocked from room
