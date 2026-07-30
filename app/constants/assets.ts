// ========================================
// Centralized Asset Constants
// ========================================
// Single source of truth for all static asset URLs.
// To switch CDN, change the base URL constants below.

// ========================================
// CDN Base URLs
// ========================================

/** Cloudflare R2 — binary assets (SVGA, video, large images) */
const R2 = 'https://assets.flyliveapp.com'

/** ImageKit — UI images with auto-transform (WebP/AVIF, resize) */
const IK = 'https://ik.imagekit.io/flylive'

/**
 * Seat reaction assets (ADR 0015): `${REACTION_ASSET_BASE}/${code}/lottie.json`
 * and `.../emoji.svg`, mirrored by `scripts/reactions-mirror.mjs`.
 * Fallback: swap to Google's CDN → 'https://fonts.gstatic.com/s/e/notoemoji/latest'
 */
export const REACTION_ASSET_BASE = `${IK}/emojis`

/** Google's Noto CDN — origin of the mirror, and the drawer thumbnail's retry target. */
export const REACTION_ASSET_FALLBACK_BASE = 'https://fonts.gstatic.com/s/e/notoemoji/latest'

// ========================================
// Static Assets
// ========================================

export const ASSETS = {

  // ── Music player disc (animated GIF → animated WebP via `tr`) ──
  /**
   * Source is a 1300x1300 / 12-frame animated GIF: **6.55 MB** raw, 943 KB even to a
   * WebP-capable client. `f-auto` converts it to an animated WebP and `w-` resizes it,
   * preserving all 12 frames + alpha: **943 KB → 27 KB (-97%)**, the single largest
   * per-file saving in the CDN audit.
   * `w-112` = the largest render (`player.vue` DISC_SIZE 56 CSS px) at 2x DPR; the
   * `size-7` queue row in `uploader.vue` downscales from the same cached copy.
   * ⚠️ Do NOT drop `f-auto` — without it this stays a multi-megabyte GIF.
   */
  MUSIC_PLAYER: `${IK}/placeholders/music-player.gif?tr=w-112,q-75,f-auto`,
  // ── Logos (self-hosted, critical path) ──
  LOGO_MAIN: '/logos/flylive-logo-wide.png',
  LOGO_XL: '/logos/logo-full.png',

  // ── R2 CDN — Binary / Animations ──
  MICE_WAVE_SVGA: `${R2}/vip/1/mice-wave.svga`,

  // ── ImageKit CDN — level badge fallbacks ──
  /**
   * ⚠️ BASE URL ONLY — do not bake a width in here. Callers size it themselves.
   *
   * These render across an enormous range: ~16 CSS px tall in a chat row, but `w-7/12` of the
   * viewport (~240 CSS px) on the profile page (`pages/profile/[UserSignature].vue:406-407`).
   * A baked `w-48` was shipped and reviewed as visibly blurry on profile — a 5x upscale.
   *
   * Consumers: `levelBadgeSrc()` for height-constrained rows, `withImageKitTransform()`
   * elsewhere. The source is 512x158, so profile-sized renders legitimately need close to the
   * native file; there is no width that serves both ends. Fix the byte cost by re-authoring the
   * art (these are 20-frame ANIMATED WebP — frame count, not resolution, dominates), not by
   * under-sizing the request.
   */
  DEFAULT_WEALTH_BADGE: `${IK}/badges/wealth/1.webp`,
  DEFAULT_CHARM_BADGE: `${IK}/badges/charm/1.webp`,
  DEFAULT_TRANSACTION_THUMB: `${IK}/badges/charm/1.webp?tr=w-128,q-75,c-maintain_ratio,f-auto`,

  // ── ImageKit CDN — UI Images ──
  GIFT_DRAWER_ICON: `${IK}/placeholders/gift-icon.webp?tr=w-64,q-75,c-maintain_ratio,f-auto`,
  DEFAULT_SEAT_IMG: `${IK}/placeholders/seat.webp?tr=w-96,q-75,c-maintain_ratio,f-auto`,
  LOCK_SEAT_IMG: `${IK}/placeholders/seat-locked.webp?tr=w-96,q-75,c-maintain_ratio,f-auto`,
  /**
   * Same source file as `COIN_ICON` — the `tr` params MUST stay identical so one cached
   * variant serves both. Divergence is what produced the 508-requests-at-81 KB vs
   * 314-requests-at-1.4 KB split measured on this exact file.
   */
  ROOM_CARD_TOP: `${IK}/placeholders/coin-icon.webp?tr=w-96,q-80,c-maintain_ratio,f-auto`,
  DIAMOND_ICON: `${IK}/placeholders/diamond-icon.webp?tr=w-64,q-80,c-maintain_ratio,f-auto`,
  /**
   * Small/default coin icon — covers every `size-4`/`size-5`/`w-8` render (16-32 CSS px)
   * at 2x DPR. 41.1 KB raw → 4.4 KB.
   *
   * ⚠️ This icon is genuinely multi-size, so it ships TWO variants rather than one. Anything
   * rendered larger than ~48 CSS px must use `COIN_ICON_LARGE` or it will visibly upscale.
   */
  COIN_ICON: `${IK}/placeholders/coin-icon.webp?tr=w-96,q-80,c-maintain_ratio,f-auto`,
  /** Reward-hero coin icon for `w-14`/`w-20`/`w-24` renders (56-96 CSS px) at 2x DPR. 13.4 KB. */
  COIN_ICON_LARGE: `${IK}/placeholders/coin-icon.webp?tr=w-192,q-80,c-maintain_ratio,f-auto`,
  HERO_SECONDARY: `${IK}/placeholders/secondary.webp?tr=w-400,q-75,c-maintain_ratio,f-auto`,
  HERO_TERTIARY: `${IK}/placeholders/tertiary.webp?tr=w-400,q-75,c-maintain_ratio,f-auto`,
  /**
   * Full-bleed hero on the wealth/charm level pages (`components/levels/LevelPage.vue:154`,
   * `min-w-full`). NuxtImg's `width`/`sizes` props are no-ops for absolute CDN URLs, so this
   * `tr` is the only thing that sets the fetched resolution.
   *
   * w-1024 covers a 412 CSS px viewport up to ~2.5x DPR. w-400 was shipped first and reviewed
   * as visibly blurry — it only covered ~1x. Still ~50% under the native file.
   */
  HERO_CHARM: `${IK}/placeholders/charm.webp?tr=w-1024,q-75,c-maintain_ratio,f-auto`,
  HERO_WEALTH: `${IK}/placeholders/wealth.webp?tr=w-1024,q-75,c-maintain_ratio,f-auto`,
  DEFAULT_ROOM_BADGE: `${IK}/badges/room/1.webp?tr=w-48,q-75,c-maintain_ratio,f-auto`,
  /** Thumbnail params keep home/bootstrap badge decode small vs. full ~1MB source */
  DEFAULT_PROFILE_BADGE: `${IK}/profile-1.webp?tr=w-64,q-75,f-webp`,
  DEFAULT_HISTORY_BADGE: `${IK}/profile-1.webp?tr=w-64,q-75,f-webp`,
  /** ⚠️ Base URL only — same reasoning as `DEFAULT_WEALTH_BADGE`; `LevelPage.vue` sizes these. */
  DEFAULT_CHARM_LEVEL_BADGE: `${IK}/badges/charm/1.webp`,
  DEFAULT_WEALTH_LEVEL_BADGE: `${IK}/badges/wealth/1.webp`,

  // ── Auth page cards (mobile-optimized: 250px wide, q70, WebP) ──
  AUTH_CARD_1: `${IK}/placeholders/1.webp?tr=w-250,q-70,f-webp`,
  AUTH_CARD_2: `${IK}/placeholders/2.webp?tr=w-250,q-70,f-webp`,
  AUTH_CARD_3: `${IK}/placeholders/3.webp?tr=w-250,q-70,f-webp`,
  AUTH_CARD_4: `${IK}/placeholders/4.webp?tr=w-250,q-70,f-webp`,
  AUTH_CARD_5: `${IK}/placeholders/5.webp?tr=w-250,q-70,f-webp`,
  AUTH_CARD_6: `${IK}/placeholders/6.webp?tr=w-250,q-70,f-webp`,

  COVER_PLACEHOLDER: `${IK}/placeholders/auth-bg.webp?tr=w-420,q-60,f-webp`,

  // ── Gender (onboarding cards, ~200 CSS px wide → w-400 at 2x DPR) ──
  GENDER_FEMALE: `${IK}/gender/female.webp?tr=w-400,q-75,c-maintain_ratio,f-auto`,
  GENDER_MALE: `${IK}/gender/male.webp?tr=w-400,q-75,c-maintain_ratio,f-auto`,

  // ── Placeholders & Fallbacks (precached by SW) ──
  /**
   * Width is baked in deliberately, and `w-256` deliberately matches
   * `AVATAR_DEFAULT_WIDTH` in `~/utils/imagekit` so the constant and the helper agree.
   *
   * `withImageKitTransform` returns early when a `tr` is already present, so every
   * `avatarImageSrc(user.avatar ?? ASSETS.AVATAR_PLACEHOLDER)` call site resolves this to
   * exactly one cached variant — including the profile hero that passes `w: 512` for real
   * avatars (this is a flat silhouette; 256 is ample).
   *
   * ⚠️ Do NOT make this base-only. It is a fallback path and it is SW-precached, so a
   * call site that forgot to transform would silently serve the 1024x1024 / 41 KB original.
   */
  AVATAR_PLACEHOLDER: `${IK}/placeholders/avatar.webp?tr=w-256,q-75,c-maintain_ratio,f-auto`,
  /** Base URL only — callers use `withImageKitTransform` so card width matches layout (no stuck w-520). */
  ROOM_BG_PLACEHOLDER: `${IK}/placeholders/room-background.webp`,
  /** Full-bleed profile cover. w-1200 covers a 412 CSS px viewport to ~2.9x DPR. */
  PROFILE_COVER_PLACEHOLDER: `${IK}/placeholders/profile-bg.jpeg?tr=w-1200,q-70,c-maintain_ratio,f-auto`,

  // ── Videos (on ImageKit; migration to R2 tracked in docs/issues/cdn-bandwidth ticket 03) ──
  /** 1.65 MB x 241 requests = ~397 MB/mo. `tr` does not apply to video delivery. */
  MALL_BG_VIDEO: `${IK}/mall/mall-bg.mp4`,

  // VIP UI ASSETS
  VIP_BACKGROUND: `${IK}/vip/background.png?tr=w-800,q-70,c-maintain_ratio,f-auto`,
} as const

// ========================================
// Avatar Frame Visibility (capacitor-performance issue 02)
// ========================================

/** IntersectionObserver rootMargin for deferred avatar-frame animation (pre-warm before entering viewport). */
export const DEFERRED_VISIBILITY_ROOT_MARGIN = '100px'

/** IntersectionObserver threshold for deferred avatar-frame animation. */
export const DEFERRED_VISIBILITY_THRESHOLD = 0.01

// ========================================
// Dynamic URL Builders
// ========================================

/** R2 base for VIP level assets */
export const vipAssetUrl = (level: number, file: string) =>
  `${R2}/vip/${level}/${file}`

/** Ranking page background image */
export const rankingBgUrl = (category: string) =>
  `${R2}/ranking/${category}.webp`

/** Ranking podium SVGA frame for top 3 */
export const rankingPodiumFrame = (rank: number) =>
  `${R2}/frames/events/top_${rank}.svga`

/** VIP emblem SVGA animation */
export const vipEmblemSvga = (level: number) =>
  `${R2}/vip/${level}/emblem.svga`

/** VIP badge static image */
export const vipBadgeImg = (level: number) =>
  `${R2}/vip/${level}/badge.webp`

/** VIP border decoration image */
export const vipBorderImg = (level: number) =>
  `${R2}/vip/${level}/border.webp`

/** VIP asset base path (used by asset manifest loop) */
export const vipAssetBase = (level: number) =>
  `${R2}/vip/${level}`

export const vipUIAssetBase = (level: number) =>
    `${IK}/vip/${level}`

/**
 * VIP level badge served from ImageKit (distinct from `vipBadgeImg`, which is the R2 path).
 *
 * ⚠️ The extension is NOT cosmetic and NOT interchangeable. Verified against the CDN
 * 2026-07-30 — every level publishes exactly one of the two, and the other 404s:
 *
 * | level | badge.png | badge.webp |
 * |-------|-----------|------------|
 * | 1, 2  | 404       | 200        |
 * | 3+    | 200       | 404        |
 *
 * `pages/profile/index.vue` had this conditional right; `room/chat-message.vue`,
 * `common/minimal-user-list.vue` and `room/seat-drawer.vue` hardcoded `.png` and were
 * therefore serving a broken image to every VIP 1-2 user on every chat message — a
 * contributor to the 4.16% CDN error rate (24.4 K failed requests in July).
 *
 * Route ALL ImageKit VIP-badge reads through here so the split lives in one place.
 */
export const vipBadgeUIImg = (level: number | null | undefined): string =>
    level ? `${IK}/vip/${level}/badge.${level > 2 ? 'png' : 'webp'}` : ''

// ========================================
// Event Banners (ImageKit)
// ========================================

/**
 * ~360px max card width on mobile; avoids overserving w-400 vs painted box.
 *
 * Quality lowered 95 -> 85 (2026-07-30, CDN bandwidth audit): q-95 was an unexplained
 * outlier — every comparable surface in this file uses 70-85, and q-95 costs
 * disproportionately more bytes for a difference that is not visible at this size.
 * 85 still protects any text baked into admin-uploaded promo art.
 */
export const BANNER_BG_TR = 'tr=w-360,q-85,c-maintain_ratio,f-auto'

// ========================================
// Missions Assets (ImageKit)
// ========================================

/** Recharge Activity */

/**
 * Transform for the large recharge-activity background art only.
 *
 * These are PNG UI panels containing baked-in text, so quality is held at `q-85` (higher
 * than the 75 used for photographic art) to protect glyph edges, and `w-800` covers a
 * full-bleed panel on a ~400 CSS px mobile viewport at 2x DPR.
 *
 * Deliberately NOT applied to the small chrome in this set (tabs, arrows, buttons,
 * dividers — all 0.5-15 KB raw). Transforming those would risk visible artifacts on
 * sharp edges for a saving too small to matter. Measured raw totals: the 5 pieces below
 * are 291 KB of the set's 410 KB.
 */
const MISSION_PANEL_TR = 'tr=w-800,q-85,c-maintain_ratio,f-auto'

export const RECHARGE_ACTIVITY = {
  banner: `${IK}/missions/recharge-activity/banner.png?${MISSION_PANEL_TR}`,
  honerBtn: `${IK}/missions/recharge-activity/honor_btn.png`,
  btnRules: `${IK}/missions/recharge-activity/btn-rules.png`,
  pattern: `${IK}/missions/recharge-activity/head_bg.png`,
  tab: `${IK}/missions/recharge-activity/tab0.png`,
  tabActive: `${IK}/missions/recharge-activity/tab1.png`,
  arrowLeft: `${IK}/missions/recharge-activity/time_line1.png`,
  arrowRight: `${IK}/missions/recharge-activity/time_line0.png`,
  timeBg: `${IK}/missions/recharge-activity/time_bg.png`,
  taskBg: `${IK}/missions/recharge-activity/task_bg.png`,
  taskBgLarge: `${IK}/missions/recharge-activity/reward_bg.png`,
  topHeader: `${IK}/missions/recharge-activity/top1_header.png`,
  top1Fame_monthly: `${IK}/missions/recharge-activity/top1_bg_month.png?${MISSION_PANEL_TR}`,
  top1Frame_weekly: `${IK}/missions/recharge-activity/top1_bg.png?${MISSION_PANEL_TR}`,
  rankingListBg: `${IK}/missions/recharge-activity/rank_bg.png`,
  selfRankBottomBorder: `${IK}/missions/recharge-activity/rank_self.png`,
  rulesModelBg: `${IK}/missions/recharge-activity/rule_bg.png`,
  winnersRankRewardsModelBg: `${IK}/missions/recharge-activity/rule_bg.png`,
  honarWallModelBg: `${IK}/missions/recharge-activity/dialog_honor.png?${MISSION_PANEL_TR}`,
  honarWallUserDisplayBgTop1: `${IK}/missions/recharge-activity/honor_top1.png?${MISSION_PANEL_TR}`,
  honarWallUserDisplayBgTop2: `${IK}/missions/recharge-activity/honor_top2.png`,
  honarWallUserDisplayBgTop3: `${IK}/missions/recharge-activity/honor_top3.png`,
}