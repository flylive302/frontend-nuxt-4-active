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

  // ── GIF Animation for the Music Player ──
  MUSIC_PLAYER: `${IK}/placeholders/music-player.gif`,
  // ── Logos (self-hosted, critical path) ──
  LOGO_MAIN: '/logos/flylive-logo-wide.png',
  LOGO_XL: '/logos/logo-full.png',

  // ── R2 CDN — Binary / Animations ──
  MICE_WAVE_SVGA: `${R2}/vip/1/mice-wave.svga`,
  DEFAULT_WEALTH_BADGE: `${IK}/badges/wealth/1.webp`,
  DEFAULT_CHARM_BADGE: `${IK}/badges/charm/1.webp`,
  DEFAULT_TRANSACTION_THUMB: `${IK}/badges/charm/1.webp`,

  // ── ImageKit CDN — UI Images ──
  GIFT_DRAWER_ICON: `${IK}/placeholders/gift-icon.webp`,
  DEFAULT_SEAT_IMG: `${IK}/placeholders/seat.webp`,
  LOCK_SEAT_IMG: `${IK}/placeholders/seat-locked.webp`,
  ROOM_CARD_TOP: `${IK}/placeholders/coin-icon.webp`,
  DIAMOND_ICON: `${IK}/placeholders/diamond-icon.webp`,
  COIN_ICON: `${IK}/placeholders/coin-icon.webp`,
  HERO_SECONDARY: `${IK}/placeholders/secondary.webp`,
  HERO_TERTIARY: `${IK}/placeholders/tertiary.webp`,
  HERO_CHARM: `${IK}/placeholders/charm.webp`,
  HERO_WEALTH: `${IK}/placeholders/wealth.webp`,
  DEFAULT_ROOM_BADGE: `${IK}/badges/room/1.webp`,
  /** Thumbnail params keep home/bootstrap badge decode small vs. full ~1MB source */
  DEFAULT_PROFILE_BADGE: `${IK}/profile-1.webp?tr=w-64,q-75,f-webp`,
  DEFAULT_HISTORY_BADGE: `${IK}/profile-1.webp?tr=w-64,q-75,f-webp`,
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

  // ── Gender (self-hosted) ──
  GENDER_FEMALE: `${IK}/gender/female.webp`,
  GENDER_MALE: `${IK}/gender/male.webp`,

  // ── Placeholders & Fallbacks (precached by SW) ──
  AVATAR_PLACEHOLDER: `${IK}/placeholders/avatar.webp?tr=w-128,q-75,c-maintain_ratio,f-auto`,
  /** Base URL only — callers use `withImageKitTransform` so card width matches layout (no stuck w-520). */
  ROOM_BG_PLACEHOLDER: `${IK}/placeholders/room-background.webp`,
  PROFILE_COVER_PLACEHOLDER: `${IK}/placeholders/profile-bg.jpeg`,

  // ── Videos (self-hosted for now, candidate for R2 migration) ──
  MALL_BG_VIDEO: `${IK}/mall/mall-bg.mp4`,

  // VIP UI ASSETS
  VIP_BACKGROUND: `${IK}/vip/background.png`,
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

// ========================================
// Event Banners (ImageKit)
// ========================================

/** ~360px max card width on mobile; avoids overserving w-400 vs painted box */
export const BANNER_BG_TR = 'tr=w-360,q-95,c-maintain_ratio,f-auto'

// ========================================
// Missions Assets (ImageKit)
// ========================================

/** Recharge Activity */

export const RECHARGE_ACTIVITY = {
  banner: `${IK}/missions/recharge-activity/banner.png`,
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
  top1Fame_monthly: `${IK}/missions/recharge-activity/top1_bg_month.png`,
  top1Frame_weekly: `${IK}/missions/recharge-activity/top1_bg.png`,
  rankingListBg: `${IK}/missions/recharge-activity/rank_bg.png`,
  selfRankBottomBorder: `${IK}/missions/recharge-activity/rank_self.png`,
  rulesModelBg: `${IK}/missions/recharge-activity/rule_bg.png`,
  winnersRankRewardsModelBg: `${IK}/missions/recharge-activity/rule_bg.png`,
  honarWallModelBg: `${IK}/missions/recharge-activity/dialog_honor.png`,
  honarWallUserDisplayBgTop1: `${IK}/missions/recharge-activity/honor_top1.png`,
  honarWallUserDisplayBgTop2: `${IK}/missions/recharge-activity/honor_top2.png`,
  honarWallUserDisplayBgTop3: `${IK}/missions/recharge-activity/honor_top3.png`,
}