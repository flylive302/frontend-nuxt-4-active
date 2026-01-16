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
