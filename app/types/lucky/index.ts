/**
 * Lucky Gift Types
 *
 * Type definitions for lucky draw socket events and animation state.
 */

// ============================================
// Socket Event Payloads
// ============================================

/** Payload for `lucky:result` — sender's personal draw result */
export interface LuckyDrawResult {
  /** Cashback multiplier (0.1 – 1000) */
  multiplier: number;
  /** Coins awarded from pool */
  coins_won: number;
  /** Prize tier name (e.g., "Epic", "Jackpot") */
  tier_name: string;
  /** Gift name */
  gift_name: string;
}

/** Payload for `lucky:room_announcement` — room-scoped big win */
export interface LuckyRoomAnnouncement {
  user_id: number;
  user_name: string;
  user_avatar: string;
  multiplier: number;
  coins_won: number;
  tier_name: string;
  room_name: string;
  svga_url: string;
}

/** Payload for `lucky:app_announcement` — app-wide mega win */
export interface LuckyAppAnnouncement {
  user_id: number;
  user_name: string;
  user_avatar: string;
  multiplier: number;
  coins_won: number;
  tier_name: string;
  room_id: number;
  room_name: string;
  svga_url: string;
}

// ============================================
// Animation State
// ============================================

/** A single floating multiplier entry in the queue */
export interface FloatingMultiplier {
  id: number;
  multiplier: number;
  /** Tier-based color class */
  colorClass: string;
}
