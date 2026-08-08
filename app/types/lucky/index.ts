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
  /**
   * End-to-end join key: the burst's primary `transaction_id`, echoed back from
   * the API. Matches `GiftSendAck.transaction_id` from the `gift:send` ack, so a
   * sender can attribute this result to the exact gift that produced it.
   *
   * ⛔ Not `LuckyNoDrawPayload.batch_id` — that is the API's own internal
   * `gift_<uuid>`, a value this client has never seen. Only `reference_id`
   * joins.
   *
   * Optional: absent until the audio server ships the ack half (built,
   * awaiting AWS cutover), and null for draws with no reference.
   */
  reference_id?: string | null;
}

/** Reasons the backend skips a draw (mirrors App\Enums\Lucky\LuckyEmptyReason) */
export type LuckyNoDrawReason = 'capped' | 'user_capped' | 'disabled' | 'no_eligible_tier';

/** Payload for `lucky:no-draw` — the draw was skipped for a visible reason */
export interface LuckyNoDrawPayload {
  /** Why no draw happened. `user_capped` = the sender's own daily-win cap. */
  reason: LuckyNoDrawReason;
  gift_id: number;
  batch_id: string;
}

// Big-win announcements (room/app SVGA) are no longer lucky-specific: they now
// flow through the unified slide overlay (`slide:play`). See ADR 0009 and
// docs/issues/unified-slide-overlay/03-lucky-migration.md.

/**
 * Payload for `lucky:room-result` — room-scoped win broadcast (every winning
 * draw, all tiers). Feeds the sender activity bands and the in-room win chat
 * bubble on every client in the room, including the sender.
 */
export interface LuckyRoomResultPayload {
  sender_id: number;
  gift_id: number;
  gift_name: string;
  multiplier: number;
  coins_won: number;
  tier_name: string;
  room_id: number;
  /**
   * True when this win's tier binds a Slide (`slide:play` will follow). The
   * slide path owns the chat announcement then — the in-room small-win bubble
   * must not double-announce.
   */
  has_slide: boolean;
}

// ============================================
// Animation State
// ============================================

/** Shared fields for any floater rendered through the lucky floater pipeline */
interface FloatingFloaterBase {
  id: number;
  /** Discriminates a numeric win floater from a text notice floater */
  kind: 'multiplier' | 'notice';
  /** Tier-based (win) or notice color class */
  colorClass: string;
}

/**
 * A win floater — rendered as a per-tier SVGA animation. Only created for
 * multiplier > 0; ×0 (bust) draws produce no floater at all.
 */
export interface MultiplierFloater extends FloatingFloaterBase {
  kind: 'multiplier';
  multiplier: number;
  /** Coins awarded — drawn into the SVGA's coins placeholder. */
  coinsWon: number;
}

/** A text notice floater — a no-draw hint ("pool capped for today", …) */
export interface NoticeFloater extends FloatingFloaterBase {
  kind: 'notice';
  /** Sender-facing hint text */
  text: string;
}

/** A single floater entry in the queue — win multiplier or no-draw notice */
export type FloatingMultiplier = MultiplierFloater | NoticeFloater;

// ============================================
// Center Cashback State (single persistent animation)
// ============================================

/**
 * The ONE center cashback visual. Events overwrite this state — there is never
 * a queue of these. `null` = nothing on screen.
 */
export interface CenterCashbackState {
  /** SVGA tier currently showing (resolved via resolveCashbackTier) */
  tier: number;
  /** Multiplier of the latest win shown (display only, per-win, NOT a sum) */
  multiplier: number;
  /** Coins of the latest win shown (per-win, NOT a sum — sums live on the band) */
  coinsWon: number;
  /** 'visible' → bouncing at full opacity; 'fading' → fade-out in progress */
  phase: 'visible' | 'fading';
  /** Bumped on every state overwrite so the component can restart cleanly */
  revision: number;
}

// ============================================
// Sender Activity Band State
// ============================================

/**
 * One sender's live Lucky Gift activity, room-scoped. Reused and updated in
 * place per sender — never one entry per tap/win.
 */
export interface LuckySenderBand {
  senderId: number;
  senderName: string;
  /** Avatar image URL only — the band never renders the avatar frame */
  senderAvatar: string | null;
  giftName: string;
  /** Recipient display: one name, or null when sent to multiple users */
  recipientName: string | null;
  recipientCount: number;
  /** Total lucky gifts sent this activity streak (the gold xN) */
  quantity: number;
  /** Accumulated coins WON this streak (wins only — losses never shown) */
  coinsWon: number;
  /** Visible slot index (0-based, top first), or null while waiting for a slot */
  slot: number | null;
  /** 'visible' → active; 'fading' → inactivity fade (revived by new activity) */
  phase: 'visible' | 'fading';
  /** Epoch ms of last activity — drives the inactivity timeout */
  lastActivityAt: number;
}
