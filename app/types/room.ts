import type { User } from './auth';

export interface Logo {
    large: string
    medium: string
    original: string
    thumbnail: string
}

export interface Room {
  id: number;
  name: string;
  logo: Logo;
  type: 'public' | 'private';
  country: string;
  is_live: boolean;
  participant_count: number;
  last_activity_at: string | null;
  user: User;
  created_at: string;
}

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
    data: Room;
}

export interface RoomsResponse {
  status: string;
  message: string;
  data: Room[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
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
  room?: Room
  user_id: number
  user: User
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
  room?: Room
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

