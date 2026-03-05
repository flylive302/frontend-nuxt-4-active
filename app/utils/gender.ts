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
export const GenderMap: Record<number, { label: string, icon: string, color: string }> = {
  1: { label: 'Male', icon: 'i-lucide-mars-stroke', color: 'secondary' },
  2: { label: 'Female', icon: 'i-lucide-venus', color: 'primary' },
  3: { label: 'Non-Binary', icon: 'i-lucide-gender-non-binary', color: 'tertiary' },
  4: { label: 'Not Specified', icon: 'i-lucide-transgender', color: 'neutral' },
}

/**
 * Get the display label for a gender value.
 * Handles both numeric IDs (1, 2) and numeric strings ("1", "2").
 * 
 * @param gender - The gender ID or string
 * @returns The formatted label (e.g., "Male") or "Not Specified"
 */
export function getGenderInfo(gender: number | string | null | undefined): { label: string, icon: string, color: string } {
  if (gender === null || gender === undefined || gender === '') {
    return GenderMap[4] ?? { label: 'Not Specified', icon: 'i-lucide-transgender', color: 'neutral' } // Default to Not Specified
  }

  const id = typeof gender === 'string' ? parseInt(gender, 10) : gender

  if (isNaN(id)) {
    return GenderMap[4] ?? { label: 'Not Specified', icon: 'i-lucide-transgender', color: 'neutral' }
  }

  return GenderMap[id] ?? { label: 'Not Specified', icon: 'i-lucide-transgender', color: 'neutral' }
}