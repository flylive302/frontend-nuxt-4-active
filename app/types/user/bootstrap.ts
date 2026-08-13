// ========================================
// Bootstrap Response Types
// ========================================

import type { Gift } from '../gift/gift'
import type { EntrySlideConfig } from '~/types/slide'
import type {Badge, EquippedBadge} from "~/types/progression/badge";

// ========================================
// User Types
// ========================================

/**
 * Minimal user for nested references (room owner, members, etc.)
 * Used in: Room.owner, RoomMember.user, AgencyMember.user, etc.
 */
export interface MinimalUser {
  id: number
  name: string
  signature: string
  country: string
  wealth_xp: string
  charm_xp: string
  frame_id: number | null
  chat_bubble_id: number | null
  entry_animation_id: number | null
  data_card_id: number | null
  mice_wave_id: number | null
  slides_id: number | null
  avatar: string | null
  cover_image: string | null
  gender: string | null
  date_of_birth: string | null
  vip_level: number
  equipped_badges?: EquippedBadge[]
}

/**
 * Visitor of a user's profile — a MinimalUser plus visit metadata.
 * Returned by: GET /users/me/visitors
 */
export interface VisitorUser extends MinimalUser {
  /** ISO 8601 timestamp of the most recent visit. */
  last_visited_at: string
  /** Distinct days visited (deduped daily), not raw view count. */
  visit_count: number
}

/**
 * A MinimalUser plus viewer-relative follow flags.
 * Returned by: GET /users/{id}/followers, GET /users/{id}/following
 * (`FollowListUserResource` — carries the flags `MinimalUser`/`MinimalUserResource`
 * must NOT, since that shape is also embedded in Room.owner, RoomMember.user, etc.)
 */
export interface FollowListUser extends MinimalUser {
  /** Whether the authenticated viewer follows this user. */
  is_following: boolean
  /** Whether this user follows the authenticated viewer. */
  is_followed_by: boolean
}

/**
 * Bootstrap user - authenticated user from bootstrap.
 * Returned by: GET /bootstrap, POST /auth/login, POST /auth/register, GET /auth/user
 */
export interface BootstrapUser {
  // Identity
  id: number
  name: string
  signature: string
  avatar: string | null
  cover_image: string | null
  frame_id: number | null
  chat_bubble_id: number | null
  entry_animation_id: number | null
  data_card_id: number | null
  mice_wave_id: number | null
  slides_id: number | null

  // Contact & Location
  phone: string | null          // E.164 format
  country: string | null        // ISO 2-letter code
  email: string | null

  // Demographics
  gender: number | string | null   // backend casts to integer (1–4); legacy payloads may send 'male'|'female'
  date_of_birth: string | null  // YYYY-MM-DD

  // Economy
  coins: string                 // Integer as string
  diamonds: string              // Integer as string
  wealth_xp: string             // Integer as string
  charm_xp: string              // Integer as string

  // VIP
  vip_level_id: number | null   // FK to vip_levels table
  vip_level: number             // 0 = no VIP, 1-8 = VIP level // No need
  vip_expires_at: string | null // ISO 8601 // NO need

  // Consent
  terms_accepted_at: string | null          // ISO 8601
  privacy_policy_accepted_at: string | null // ISO 8601

  // Profile
  is_profile_complete: boolean
  is_follow_list_public: boolean
  followers_count: number
  following_count: number
  /** Distinct-day visitor count to this user's own profile (self-only). */
  profile_visits?: number

  // Block status (auth-time checks)
  is_blocked: boolean
  blocked_at: string | null     // ISO 8601
  blocked_reason: string | null
  locked_until: string | null   // ISO 8601

  // Equipped badges (self-only — present on login, /auth/user, /profile)
  equipped_badges: EquippedBadge[] // slot-ordered
  badge_slot_limit: number         // 6 / 9 / 12, expiry-aware
}

// ========================================
// Level Types
// ========================================

/**
 * Level status for a user (wealth or charm).
 */
export interface LevelStatus {
  current_level: number
  level_name: string
  current_xp: number
  xp_for_next_level: number
  xp_remaining: number
  progress_percentage: number
  badge: {
    image_url: string
  } | null
  next_level: {
    level: number
    name: string
    required_xp: number
  } | null
}

/**
 * Level configuration item (wealth, charm, or room levels).
 */
export interface LevelConfig {
  level: number
  name: string
  required_xp: number
  image_url: string | null
}


// ========================================
// Income Target Types
// ========================================

/**
 * Income target from bootstrap.
 */
export interface BootstrapIncomeTarget {
  id: number
  tier: string // e.g., 'T1', 'T2'
  name: string
  required_coins: string
  earned_coins: string
  coins_to_complete: string // not required
  start_date: string // ISO 8601
  end_date: string // ISO 8601
  member_diamond_reward: string
  owner_diamond_reward: string
  is_completed: boolean
}

// ========================================
// Room Types
// ========================================

/**
 * Room from bootstrap (with MinimalUser owner).
 */
export interface BootstrapRoom {
  id: number
  name: string
  description: string | null
  logo: string | null
  background: string | null
  primary_color: string | null
  topic: string | null
  type: 'public' | 'private'
  type_label: string
  is_private: boolean
  is_password_protected: boolean
  country: string
  room_xp: string
  /** Live daily room XP (resets at midnight; see prd-daily-room-xp.md). */
  daily_xp: string
  current_level: number
  sort_order: number
  is_live: boolean
  /**
   * Audio-delivery tier (realtime-08). MSAB flips it interactive↔broadcast at
   * the Listener threshold; at this slice it is telemetry only (no behaviour
   * change — both tiers still use WebRTC).
   */
  mode: 'interactive' | 'broadcast'
  /**
   * Broadcast-tier HLS playback URL (realtime-09). Non-null only in broadcast
   * mode (deterministic `<base>/<roomId>/master.m3u8`); passive Listeners play
   * this instead of WebRTC. Null in interactive mode / when not provisioned.
   */
  hls_playback_url?: string | null
  /** AWS region hosting this room's MSAB instance (null when not live) */
  hosting_region: string | null
  /** Laravel-authoritative MSAB WebSocket endpoint the client connects to (realtime-05) */
  hosting_url: string
  participant_count: number
  max_seats: number
  /**
   * Resolved seat cap for this room's current level (room-seat-caps PRD).
   * The Seat picker in the settings drawer may only PATCH `max_seats` up to
   * this value; the server 422s any attempt above it regardless.
   */
  seat_cap: number
  /**
   * Seat Unlock Ladder — level→cap steps used to label locked picker tiers
   * ("Unlocks at room level N"). Ascending by level; may be empty.
   */
  seat_ladder: SeatLadderLevel[]
  owner_id: number
  /**
   * ⚠️ Only the room DETAIL endpoint sends the full `MinimalUser` here. The
   * paginated room LIST (`GET /rooms`, backend `RoomOwnerSnippetResource`)
   * deliberately sends a trimmed subset — currently `{ id, signature, avatar }`
   * — to keep ~12 fields x N rooms off the home-grid payload.
   *
   * So on a room that came from a LIST, every other field on this object is
   * `undefined` at runtime despite type-checking. Read list-sourced owner
   * fields defensively (see `components/room/card.vue`); the rich consumers
   * (`room/info.vue`, `room/header.vue`, `room/seat.vue`) are safe because they
   * all read `roomStore.currentRoom`, which is detail-sourced.
   */
  owner: MinimalUser
}

/** One step of the Seat Unlock Ladder (room-seat-caps PRD). */
export interface SeatLadderLevel {
  level: number
  cap: number
}


// ========================================
// Agency Types
// ========================================

/**
 * User's agency membership context.
 */
export interface BootstrapAgency {
  agency_id: number
  agency_name: string
  agency_logo: string | null
  member_count: number
  role: 'owner' | 'admin' | 'member'
  is_owner: boolean
  joined_at: string // ISO 8601
}

// ========================================
// Bootstrap Config
// ========================================

/**
 * Full config from bootstrap.
 */
export interface BootstrapConfig {
  api_version: string
  room_owner_percentage: number
  receiver_percentage: number
  wealth_levels: LevelConfig[]
  charm_levels: LevelConfig[]
  room_levels: LevelConfig[]
  badges: Badge[]
  gifts: Gift[]
  vapid_public_key: string | null
  props: BootstrapProp[]
  vip_levels: VipLevel[]
  featured_rooms: FeaturedRoom[]
  /** JoyPlay games kill switch. Sent uncached so a flip reaches clients immediately. */
  games_enabled?: boolean
}

/**
 * SVGA frame overlay geometry, authored in the admin panel and stored on
 * `props.metadata.frame`. Offsets are CSS lengths (e.g. `0%`, `-2%`);
 * `scale` and `padding` are percentages.
 */
export interface FrameDisplayConfig {
  scale: number
  padding: number
  top: string
  left: string
  /**
   * Dynamic text slots baked into the frame's SVGA. Absent on the vast
   * majority of frames — only artwork designed with text placeholders has it.
   */
  texts?: FrameTextSpec[]
}

/**
 * One text slot inside a frame's SVGA. `key` is the image key the designer
 * baked into the file; the resolved string is drawn to a canvas and injected
 * there via SvgaPlayer's `dynamicElements`.
 *
 * `username` substitutes the wearer's display name client-side — a frame has no
 * other runtime context, so unlike slides it needs no server-side resolver.
 */
export interface FrameTextSpec {
  key: string
  source: 'username' | 'static'
  /** Present only when `source` is `static`. */
  value?: string
  /** Hex colour; defaults to white. */
  color?: string
  /** Canvas size matching the SVGA placeholder layer; defaults when absent. */
  width?: number
  height?: number
}

/**
 * Lightweight prop manifest for O(1) lookups.
 * Seeded into mallStore.propIndex at bootstrap time.
 */
export interface BootstrapProp {
  id: number
  name: string
  type: string
  thumbnail_url: string
  asset_url: string
  /**
   * SVGA overlay geometry for `frame`-type props, resolved server-side.
   * Null for every other prop type. Positions the frame around the avatar —
   * see `UserAvatar`. Replaces the legacy scheme where these numbers were
   * appended to `name` and parsed on the client.
   */
  frame?: FrameDisplayConfig | null
  /**
   * Entry Slide config for `slides`-type props — present only when the prop is
   * bound to an entry Slide. Lets the client resolve the room-entry banner
   * locally on join (unified-slide-overlay). Null/absent for every other prop.
   */
  slide?: EntrySlideConfig | null
}

/**
 * VIP level animated asset URLs from bootstrap config.
 */
export interface VipLevel {
  id: number
  level: number
  card_animated_url: string | null
  emblem_animated_url: string | null
}

/**
 * Minimal room shape for background pre-warming.
 * Seeded from bootstrap; null background is included (frontend skips null URLs).
 */
export interface FeaturedRoom {
  id: number
  background: string | null
}

