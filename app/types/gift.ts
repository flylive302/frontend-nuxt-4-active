/**
 * Gift Types
 *
 * Type definitions for gift-related features.
 * Backend API: GET /api/gifts
 */

// ============================================
// CORE TYPES
// ============================================

export type GiftCategory = 'normal' | 'lucky' | 'cp-gifts' | 'vip-gifts' | 'country' | 'celebrity' | 'bag';
export type GiftRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type AssetType = 'video' | 'svga' | 'static';

/**
 * Gift item as returned from Laravel backend API
 */
export interface Gift {
  id: number;
  name: string;
  label: string;
  asset_url: string;
  description?: string;
  image_url: string;
  animation_url?: string;
  price_coins: number;
  price_diamonds?: number;
  category: GiftCategory;
  rarity: GiftRarity;
  asset_type: AssetType;
  charm_xp_increment: number;
  wealth_xp_increment: number;
  is_animated: boolean;
  sort_order: number;
  is_available: boolean;
  created_at?: string;
  updated_at?: string;
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
 * Event received when a gift is sent in the room
 * Event: 'gift:received'
 */
export interface GiftReceivedEvent {
  senderId: number;
  senderName: string;
  senderAvatar?: string;
  roomId: string;
  giftId: number;
  recipientId: number;
  quantity: number;
  gift?: Gift;
  totalValue?: number;
}

// ============================================
// CATEGORY CONFIGURATION
// ============================================

/** Category metadata for UI tabs */
export const GIFT_CATEGORY_CONFIG: Record<GiftCategory, { label: string; icon: string }> = {
  normal: { label: 'Normal', icon: 'i-lucide-gift' },
  lucky: { label: 'Lucky', icon: 'i-lucide-sparkles' },
  'cp-gifts': { label: 'CP Gift', icon: 'i-lucide-heart' },
  'vip-gifts': { label: 'VIP', icon: 'i-lucide-crown' },
  country: { label: 'Country', icon: 'i-lucide-flag' },
  celebrity: { label: 'Celebrity', icon: 'i-lucide-star' },
  bag: { label: 'Bag', icon: 'i-lucide-shopping-bag' },
};
