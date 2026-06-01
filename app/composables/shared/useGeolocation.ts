/**
 * Composable for handling geolocation-related functionality.
 * Provides methods to detect the user's country.
 */
import { createLogger } from '~/utils/logger';

const log = createLogger('[Geolocation]');

export function useGeolocation() {
  // ========================================
  // Business Logic / Core Logic
  // ========================================

  /**
   * Detects the user's country based on their IP address.
   * Calls the internal API endpoint `/api/detect-country`.
   * @returns The ISO-2 country code if successful, or null if detection fails.
   */
  async function detectCountry(): Promise<string | null> {
    try {
      const { country_code } = await $fetch<{ country_code: string | null }>('/api/detect-country')
      return country_code
    } catch (error) {
      log.warn('Failed to detect country', error)
      return null
    }
  }

  return {
    detectCountry,
  }
}