// ========================================
// Date Utilities
// ========================================

/**
 * Calculate age in years from a date of birth string.
 * 
 * @param dateOfBirth - Date string in 'YYYY-MM-DD' format (standard API format)
 * @returns Age in years, or null if invalid
 * 
 * @example
 * getAge('1998-06-24') // Returns 27 (as of 2026)
 * getAge(null) // Returns null
 */
export function getAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null

  try {
    const [yearStr, monthStr, dayStr] = dateOfBirth.split('-')
    if (!yearStr || !monthStr || !dayStr) return null

    const birthYear = parseInt(yearStr, 10)
    const birthMonth = parseInt(monthStr, 10)
    const birthDay = parseInt(dayStr, 10)

    if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return null

    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1 // 0-indexed
    const currentDay = today.getDate()

    let age = currentYear - birthYear

    // Adjust if birthday hasn't occurred yet this year
    if (
      currentMonth < birthMonth ||
      (currentMonth === birthMonth && currentDay < birthDay)
    ) {
      age--
    }

    return age >= 0 ? age : null
  } catch {
    return null
  }
}

/**
 * Get age with suffix (e.g., "28 years" or "28y").
 * 
 * @param dateOfBirth - Date string in 'YYYY-MM-DD' format
 * @param short - Use short format ("28y" vs "28 years")
 * @returns Formatted age string, or empty string if invalid
 * 
 * @example
 * getAgeFormatted('1998-06-24') // "27 years"
 * getAgeFormatted('1998-06-24', true) // "27y"
 */
export function getAgeFormatted(
  dateOfBirth: string | null | undefined,
  short = false
): string {
  const age = getAge(dateOfBirth)
  if (age === null) return ''
  return short ? `${age}y` : `${age} years`
}

/**
 * Compact "ago" relative time for profile visitor rows.
 * - Same day  → "Just now", "5m ago", "3h ago"
 * - Yesterday → "Yesterday"
 * - Older     → "Jul 10" or "Jul 10, 2025"
 */
export function formatVisitTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  const isSameCalendarDay = date.getDate() === now.getDate()
    && date.getMonth() === now.getMonth()
    && date.getFullYear() === now.getFullYear()

  if (isSameCalendarDay) {
    const diffMinutes = Math.floor(diffMs / 60_000)
    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    return `${Math.floor(diffMs / 3_600_000)}h ago`
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = date.getDate() === yesterday.getDate()
    && date.getMonth() === yesterday.getMonth()
    && date.getFullYear() === yesterday.getFullYear()

  if (isYesterday) return 'Yesterday'

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

/**
 * WhatsApp-style relative time for chat threads and messages.
 * - Same day  → "14:23"
 * - Yesterday → "Yesterday"
 * - 2-6 days  → "Monday", "Tue", …
 * - Older     → "Dec 25" or "Dec 25, 2024"
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffDays === 0 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  if (diffDays === 1 || (diffDays === 0 && date.getDate() !== now.getDate())) {
    return 'Yesterday'
  }

  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

/**
 * Format the remaining time of a room block as human-readable text.
 *
 * @param bannedUntil - ISO 8601 expiry, or null for a permanent block
 * @returns "Permanent", "Expired", or e.g. "2h 15m left" / "3d 4h left" / "5m left"
 */
export function formatBlockRemaining(bannedUntil: string | null): string {
  if (!bannedUntil) return 'Permanent'

  const diffMs = new Date(bannedUntil).getTime() - Date.now()
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 'Expired'

  const totalMinutes = Math.ceil(diffMs / 60_000)
  const days = Math.floor(totalMinutes / 1_440)
  const hours = Math.floor((totalMinutes % 1_440) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}d ${hours}h left`
  if (hours > 0) return `${hours}h ${minutes}m left`
  return `${minutes}m left`
}
