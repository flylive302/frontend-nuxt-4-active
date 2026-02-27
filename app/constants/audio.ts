// ========================================
// Audio Server Configuration Constants
// ========================================

/**
 * Regional MSAB WebSocket endpoints.
 *
 * Maps AWS region identifiers (from Laravel's `hosting_region` field)
 * to the corresponding regional MSAB WebSocket URL.
 * Used by `joinRoom()` to connect to the correct regional instance.
 */
export const REGION_ENDPOINTS: Record<string, string> = {
  'ap-south-1': 'wss://mumbai.audio.flyliveapp.com',
  'me-south-1': 'wss://uae.audio.flyliveapp.com',
  'eu-central-1': 'wss://frankfurt.audio.flyliveapp.com',
} as const;
