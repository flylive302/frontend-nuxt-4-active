// ========================================
// Audio Server Configuration Constants
// ========================================

/**
 * Regional MSAB WebSocket endpoints.
 *
 * Maps AWS region identifiers (from Laravel's `hosting_region` field)
 * to the corresponding regional MSAB WebSocket URL.
 * Used by `joinRoom()` to connect to the correct regional instance.
 *
 * Only LIVE, DNS-resolving regions belong here. An unmapped `hosting_region`
 * intentionally falls back to the Global Accelerator apex
 * (`NUXT_PUBLIC_AUDIO_SERVER_URL`, e.g. `wss://audio.flyliveapp.com`) rather
 * than a non-resolving host — never re-introduce a region whose CNAME is not
 * yet created (that was finding M1: silent no-audio).
 *
 * 3rd region: Singapore (`ap-southeast-1`) is the planned next SFU region
 * (UAE/`me-south-1` was dropped — the AWS account cannot enable the Middle East
 * regions). Add `'ap-southeast-1': 'wss://singapore.audio.flyliveapp.com'` here
 * ONLY once that region is stood up and its CNAME resolves (issue realtime-07).
 */
export const REGION_ENDPOINTS: Record<string, string> = {
  'ap-south-1': 'wss://mumbai.audio.flyliveapp.com',
  'eu-central-1': 'wss://frankfurt.audio.flyliveapp.com',
} as const;
