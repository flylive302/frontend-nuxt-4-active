/**
 * Asset Preload Configuration
 *
 * Define assets to be preloaded in the background during idle time.
 * Assets are loaded in priority order (lower number = higher priority).
 *
 * Supported asset types:
 * - 'video': WebM, MP4, MOV video files
 * - 'svga': SVGA animation JSON files (uses /parsedAnimations/ prefix)
 * - 'image': PNG, JPG, WebP images
 * - 'audio': MP3, WAV, OGG audio files
 * - 'json': JSON data files (fetched and cached)
 */

export type PreloadAssetType = 'video' | 'svga' | 'image' | 'audio' | 'json';

export interface PreloadAsset {
  /** Unique identifier for this asset */
  id: string;
  /** Type of asset */
  type: PreloadAssetType;
  /** URL or path to the asset */
  url: string;
  /** Priority (lower = higher priority, default: 10) */
  priority?: number;
  /** Optional description for logging */
  label?: string;
}

/**
 * Assets to preload on room entry.
 * These will be loaded during user idle time after joining a room.
 */
export const ROOM_PRELOAD_ASSETS: PreloadAsset[] = [
  // ========================================
  // High-Priority VIP Gifts (priority 1-5)
  // ========================================
  {
    id: 'gift-crimson-reverie',
    type: 'video',
    url: '/room/gifts/vip-gifts/crimson_reverie/playable.webm',
    priority: 1,
    label: 'Crimson Reverie Gift',
  },
  {
    id: 'gift-dragon-thrown-prince',
    type: 'video',
    url: '/room/gifts/vip-gifts/dragon_thrown_prince/playable.webm',
    priority: 2,
    label: 'Dragon Throne Prince Gift',
  },
  {
    id: 'gift-festive-kinship',
    type: 'video',
    url: '/room/gifts/vip-gifts/festive_kinship/playable.webm',
    priority: 3,
    label: 'Festive Kinship Gift',
  },
  {
    id: 'gift-emerald-gala',
    type: 'video',
    url: '/room/gifts/vip-gifts/emerald_gala/playable.webm',
    priority: 4,
    label: 'Emerald Gala Gift',
  },
  {
    id: 'gift-royal-outlaw',
    type: 'video',
    url: '/room/gifts/vip-gifts/royal_outlaw/playable.webm',
    priority: 5,
    label: 'Royal Outlaw Gift',
  },

  // ========================================
  // Normal Gifts (priority 6-10)
  // ========================================
  {
    id: 'gift-treasure-burst',
    type: 'video',
    url: '/room/gifts/normal/treasure_burst/playable.webm',
    priority: 6,
    label: 'Treasure Burst Gift',
  },
  {
    id: 'gift-castle',
    type: 'svga',
    url: 'gifts/normal/castle/playable',
    priority: 7,
    label: 'Castle Gift (SVGA)',
  },

  // ========================================
  // Room UI Assets (priority 20+) 
  // ========================================
  // Add any room UI assets here...
  

  // ========================================
  // Audio Assets (priority 30+)
  // ========================================
  // Add notification sounds, etc. here...
];

/**
 * Assets to preload on app startup (home page, login, etc.)
 * These are loaded with lower priority to not impact initial page load.
 */
export const STARTUP_PRELOAD_ASSETS: PreloadAsset[] = [
  // Add critical startup assets here if any...
  
  {
    id: 'frame-5',
    type: 'svga',
    url: 'frames/5',
    priority: 1,
    label: 'Frame 5 (SVGA)',
  },
  {
    id: 'alt-hero-primary',
    type: 'image',
    url: 'https://ik.imagekit.io/flylive/siteAssets/alt-hero/primary.webp?tr=e-sharpen-1',
    priority: 2,
    label: 'Alt Hero Primary',
  },

  {
    id: 'alt-hero-secondary',
    type: 'image',
    url: 'https://ik.imagekit.io/flylive/siteAssets/alt-hero/secondary.webp?tr=e-sharpen-1',
    priority: 3,
    label: 'Alt Hero secondary',
  },

  {
    id: 'alt-hero-tertiary',
    type: 'image',
    url: 'https://ik.imagekit.io/flylive/siteAssets/alt-hero/tertiary.webp?tr=e-sharpen-1',
    priority: 4,
    label: 'Alt Hero tertiary',
  },
];
