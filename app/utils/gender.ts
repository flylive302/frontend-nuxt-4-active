// ========================================
// Gender Utilities
// ========================================

/**
 * Map of backend gender IDs to display labels.
 * 1: Male
 * 2: Female
 * 3: Non-Binary
 * 4: Not Specified
 */
export const GenderMap: Record<number, { label: string, icon: string }> = {
  1: { label: 'Male', icon: 'i-lucide-mars-stroke' },
  2: { label: 'Female', icon: 'i-lucide-venus' },
  3: { label: 'Non-Binary', icon: 'i-lucide-gender-non-binary' },
  4: { label: 'Not Specified', icon: 'i-lucide-gender-neutral' },
}

/**
 * Get the display label for a gender value.
 * Handles both numeric IDs (1, 2) and numeric strings ("1", "2").
 * 
 * @param gender - The gender ID or string
 * @returns The formatted label (e.g., "Male") or "Not Specified"
 */
export function getGenderInfo(gender: number | string | null | undefined): { label: string, icon: string } {
  if (gender === null || gender === undefined || gender === '') {
    return GenderMap[4] ?? { label: 'Not Specified', icon: 'i-lucide-gender-neutral' } // Default to Not Specified
  }

  const id = typeof gender === 'string' ? parseInt(gender, 10) : gender

  if (isNaN(id)) {
    return GenderMap[4] ?? { label: 'Not Specified', icon: 'i-lucide-gender-neutral' }
  }

  return GenderMap[id] ?? { label: 'Not Specified', icon: 'i-lucide-gender-neutral' }
}
