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

/** Payload for `lucky:no-draw` — the draw was skipped for a visible reason */
export interface LuckyNoDrawPayload {
  /** Why no draw happened */
  reason: 'capped' | 'disabled' | 'no_eligible_tier';
  gift_id: number;
  batch_id: string;
}

// Big-win announcements (room/app SVGA) are no longer lucky-specific: they now
// flow through the unified slide overlay (`slide:play`). See ADR 0009 and
// docs/issues/unified-slide-overlay/03-lucky-migration.md.

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
