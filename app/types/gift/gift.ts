/**
 * Gift Types
 *
 * Type definitions for gift-related features.
 * Backend API: GET /api/v1/gifts
 */

// ============================================
// CORE TYPES
// ============================================

export type GiftAssetType = 'video' | 'svga' | 'image';
export type GiftRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type GiftCategory = 'normal' | 'vip-gifts' | 'lucky' | 'cp-gift';

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
  is_animated: boolean;
  category: GiftCategory;
  rarity: GiftRarity;
  sort_order: number;
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
 * Event received when a gift is sent in the room.
 * Re-exported from audio.ts (single source of truth for socket event types).
 */
export type { GiftReceivedEvent } from '../room/audio';

// ============================================
// GIFT TRANSACTION RESPONSE TYPES
// ============================================

/**
 * Distribution breakdown for gift coins
 */
export interface GiftDistribution {
  room_owner: string;
  receiver: string;
  agency_income: boolean;
}

/**
 * XP earned from gift transaction
 */
export interface GiftXpEarned {
  sender_wealth_xp?: string;
  receiver_charm_xp?: string;
}

/**
 * Gift transaction details returned by API
 */
export interface GiftTransaction {
  id: string;
  batch_id: string;
  sender_id: number;
  receiver_id: number;
  gift_id: number;
  quantity: number;
  total_coins: string;
  distributions: GiftDistribution;
  xp_earned: GiftXpEarned;
  new_balance: string;
  gift: Gift;
  created_at: string;
}

/**
 * Response from POST /api/v1/gifts/send
 */
export interface GiftSendResponse {
  success: true;
  data: {
    transaction: GiftTransaction;
  };
  message: string;
}

/**
 * Request body for POST /api/v1/gifts/send
 */
export interface GiftSendRequest {
  gift_id: number;
  receiver_id: number;
  room_id: number;
  quantity?: number; // 1-1000, default 1
}

// ============================================
// CATEGORY CONFIGURATION
// ============================================

/** Category metadata for UI tabs */
export const GIFT_CATEGORY_CONFIG: Record<GiftCategory, { label: string; icon: string }> = {
  normal: { label: 'Normal', icon: 'i-lucide-gift' },
  'vip-gifts': { label: 'VIP', icon: 'i-lucide-crown' },
  lucky: { label: 'Lucky', icon: 'i-lucide-sparkles' },
  'cp-gift': { label: 'CP Gift', icon: 'i-lucide-heart' },
};

