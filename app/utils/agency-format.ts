// ========================================
// Agency Formatting Utilities
// ========================================

import type { AgencyInvitationStatus, AgencyJoinRequestStatus } from '~/types/agency'

// ========================================
// Types
// ========================================

type StatusColor = 'error' | 'info' | 'primary' | 'secondary' | 'success' | 'warning' | 'tertiary' | 'neutral'

// ========================================
// Date Formatting
// ========================================

/**
 * Formats a date string for agency displays.
 * @param dateString - ISO date string
 * @param options - Formatting options
 * @returns Formatted date string (e.g., "Dec 28" or "Dec 28, 2025 at 3:30 PM")
 */
export function formatAgencyDate(
  dateString: string,
  options?: Partial<{ includeTime: boolean; includeYear: boolean }>
): string {
  const config: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  }
  
  if (options?.includeYear) {
    config.year = 'numeric'
  }
  
  if (options?.includeTime) {
    config.hour = 'numeric'
    config.minute = '2-digit'
  }
  
  return new Date(dateString).toLocaleDateString('en-US', config)
}

/**
 * Formats time remaining until expiry.
 * @param expiresAt - ISO date string of expiry time
 * @returns Human-readable expiry string (e.g., "2d 5h left" or "Expired")
 */
export function formatExpiryTime(expiresAt: string): string {
  const now = new Date()
  const expiry = new Date(expiresAt)
  const diffMs = expiry.getTime() - now.getTime()
  
  if (diffMs <= 0) return 'Expired'
  
  const diffDays = Math.floor(diffMs / 86400000)
  const diffHours = Math.floor((diffMs % 86400000) / 3600000)
  
  if (diffDays > 0) return `${diffDays}d ${diffHours}h left`
  if (diffHours > 0) return `${diffHours}h left`
  return 'Expiring soon'
}

// ========================================
// Status Color Mapping
// ========================================

/**
 * Maps invitation status to UI color.
 * @param status - Invitation status
 * @param isExpired - Whether the invitation has expired
 * @returns Color name for UBadge component
 */
export function getInvitationStatusColor(status: AgencyInvitationStatus, isExpired: boolean): StatusColor {
  if (isExpired) return 'neutral'
  switch (status) {
    case 'pending': return 'warning'
    case 'accepted': return 'success'
    case 'declined': return 'error'
    case 'cancelled': return 'neutral'
    default: return 'neutral'
  }
}

/**
 * Maps join request status to UI color.
 * @param status - Join request status
 * @returns Color name for UBadge component
 */
export function getJoinRequestStatusColor(status: AgencyJoinRequestStatus): StatusColor {
  switch (status) {
    case 'approved': return 'success'
    case 'rejected': return 'error'
    case 'cancelled': return 'neutral'
    default: return 'warning'
  }
}
