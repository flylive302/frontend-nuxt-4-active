// ========================================
// Agency System Type Definitions
// ========================================

// ========================================
// Enums & Constants
// ========================================

/**
 * Agency operational status.
 * Only 'approved' agencies can accept members and send invitations.
 */
export type AgencyStatus = 'pending' | 'approved' | 'rejected' | 'blocked' | 'dissolved'

/**
 * Member role within an agency.
 * Determines permissions and capabilities.
 */
export type AgencyMemberRole = 'owner' | 'admin' | 'member'

/**
 * Member status within an agency.
 * Terminal statuses (kicked, left) indicate former members.
 */
export type AgencyMemberStatus = 'active' | 'suspended' | 'kicked' | 'left'

/**
 * Invitation status.
 * Only 'pending' invitations can be responded to.
 */
export type AgencyInvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled'

/**
 * Join request status.
 * Only 'pending' requests can be processed.
 */
export type AgencyJoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

/**
 * Block direction type.
 */
export type AgencyBlockerType = 'agency' | 'user'

// ========================================
// Base User Reference (Lightweight)
// ========================================

export interface UserReference {
  id: number
  name: string
  avatar?: string | null
  signature?: string | null
}

// ========================================
// Agency Resource
// ========================================

export interface Agency {
  id: number
  name: string
  country: string // ISO 3166-1 alpha-2
  logo: string | null
  status: AgencyStatus
  status_label: string
  created_at: string
  
  // Optional relations
  owner?: UserReference
  member_count?: number
  
  // Sensitive fields (visible to owner, members, admins)
  address?: string
  coin_reseller?: UserReference | null
  rejection_note?: string // Only if status is 'rejected'
}

// ========================================
// Agency Member Resource
// ========================================

export interface AgencyMember {
  id: number
  role: AgencyMemberRole
  role_label: string
  status: AgencyMemberStatus
  status_label: string
  joined_at: string
  
  user: UserReference
  
  // Admin/Owner visible fields
  invited_by?: UserReference | null
  left_at?: string | null
  leave_reason?: string | null
  removed_by?: UserReference | null
}

// ========================================
// Agency Invitation Resource
// ========================================

export interface AgencyInvitation {
  id: number
  status: AgencyInvitationStatus
  status_label: string
  expires_at: string
  created_at: string
  is_expired: boolean
  can_respond: boolean
  
  // For invitee view
  agency?: Pick<Agency, 'id' | 'name' | 'country' | 'logo'>
  
  // For agency owner view (sent invitations)
  user?: UserReference
  
  invited_by: UserReference
}

// ========================================
// Agency Join Request Resource
// ========================================

export interface AgencyJoinRequest {
  id: number
  status: AgencyJoinRequestStatus
  status_label: string
  message: string | null
  created_at: string
  can_be_processed: boolean
  can_be_cancelled?: boolean // For user's own requests
  
  // For requester view
  agency?: Pick<Agency, 'id' | 'name' | 'country' | 'logo'>
  
  // For agency owner view
  user?: UserReference
  
  // For processed requests
  processed_at?: string
  processed_by?: UserReference
}

// ========================================
// User Agency Response (GET /user/agency)
// ========================================

export interface UserAgencyResponse {
  agency: Agency | null
  membership: AgencyMember | null
  is_owner: boolean
}

// ========================================
// API Request Types
// ========================================

export interface CreateAgencyRequest {
  name: string
  country: string
  address: string
  logo?: File
  national_id_images?: File[]
  coin_reseller_id?: number
}

export interface JoinAgencyRequest {
  message?: string
}

export interface LeaveAgencyRequest {
  reason?: string
}

export interface KickMemberRequest {
  reason?: string
}

export interface ChangeCoinResellerRequest {
  coin_reseller_id: number | null
}

export interface SendInvitationRequest {
  user_id: number
}

// ========================================
// API Filter/Query Types
// ========================================

export interface AgencyListFilters {
  search?: string
  country?: string
  per_page?: number
  cursor?: string
}

// ========================================
// UI Helper Types
// ========================================

export interface AgencyStatusConfig {
  label: string
  color: 'warning' | 'success' | 'error' | 'neutral'
  icon: string
}

export interface AgencyRoleConfig {
  label: string
  color: 'primary' | 'info' | 'neutral'
  icon: string
}

export const AGENCY_STATUS_CONFIG: Record<AgencyStatus, AgencyStatusConfig> = {
  pending: { label: 'Pending', color: 'warning', icon: 'i-lucide-clock' },
  approved: { label: 'Active', color: 'success', icon: 'i-lucide-check-circle' },
  rejected: { label: 'Rejected', color: 'error', icon: 'i-lucide-x-circle' },
  blocked: { label: 'Suspended', color: 'error', icon: 'i-lucide-ban' },
  dissolved: { label: 'Dissolved', color: 'neutral', icon: 'i-lucide-archive' },
}

export const AGENCY_ROLE_CONFIG: Record<AgencyMemberRole, AgencyRoleConfig> = {
  owner: { label: 'Owner', color: 'primary', icon: 'i-lucide-crown' },
  admin: { label: 'Admin', color: 'info', icon: 'i-lucide-shield' },
  member: { label: 'Member', color: 'neutral', icon: 'i-lucide-user' },
}
