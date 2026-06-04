/**
 * Gift Types
 *
 * Type definitions for gift-related features.
 * Backend API: GET /api/v1/gifts
 */

// ============================================
// CORE TYPES
// ============================================

export type GiftAssetType = 'video' | 'svga' | 'image' | 'vap';
export type GiftRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type GiftCategory = 'normal' | 'lucky' | 'vip-gifts' | 'cp-gift' | 'premium' | 'celebrity';

/**
 * Gift item as returned from Laravel backend API
 */
export interface Gift {
  id: number;
  name: string;
  label: string | null;
  description: string | null;
  price: number;
  thumbnail_url: string;
  animation_url: string | null;
  asset_type: GiftAssetType;
  category: GiftCategory;
  rarity: GiftRarity;
  sort_order: number;
  is_critical: boolean;
}

/**
 * Gift category with items for UI grouping
 */
export interface GiftCategoryGroup {
  category: GiftCategory;
  label: string;
  icon: string;
  gifts: Gift[];
}

// ============================================
// COMBO TYPES
// ============================================

/** Context for lucky gift combo resending */
export interface LuckyComboContext {
  readonly gift: Gift;
  readonly senderId: number;
  readonly recipientIds: readonly number[];
  readonly quantity: number;
}

// ============================================
// PLAYBACK TYPES
// ============================================

/**
 * Item in the gift playback queue
 */
export interface GiftPlaybackItem {
  /** Unique ID for this playback instance */
  id: string;
  /** The gift being played */
  gift: Gift;
  /** User who sent the gift */
  senderId: number;
  senderName: string;
  senderAvatar?: string;
  /** Recipients of the gift */
  recipientIds: number[];
  /** Quantity sent */
  quantity: number;
  /** Timestamp when queued */
  timestamp: number;
}

// ============================================
// SOCKET PAYLOADS
// ============================================

/**
 * Payload sent to server via socket.io
 * Event: 'gift:send'
 */
export interface GiftSendPayload {
  roomId: string;
  giftId: number;
  recipientId: number;
  quantity: number;
}

/**
 * Event received when a gift is sent in the room.
 * Re-exported from audio.ts (single source of truth for socket event types).
 */
export type { GiftReceivedEvent } from '../room/audio';


// ============================================
// CATEGORY CONFIGURATION
// ============================================

/** Category metadata for UI tabs */
export const GIFT_CATEGORY_CONFIG: Record<GiftCategory, { label: string; icon: string }> = {
  normal: { label: 'Normal', icon: 'i-lucide-gift' },
  lucky: { label: 'Lucky', icon: 'i-lucide-sparkles' },
  'vip-gifts': { label: 'VIP', icon: 'i-lucide-crown' },
  'cp-gift': { label: 'CP Gift', icon: 'i-lucide-heart' },
  premium:  { label: 'Premium', icon: 'i-lucide-dollar-sign' },
  celebrity:  { label: 'Celebrity', icon: 'i-lucide-star' },
};

