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

// ========================================
// Static Assets
// ========================================

export const ASSETS = {
  // ── Placeholders & Fallbacks (self-hosted, precached by SW) ──
  AVATAR_PLACEHOLDER: '/AppImages/dummy-card/avatar.png',
  ROOM_BG_PLACEHOLDER: '/AppImages/dummy-card/room-bg.png',
  COVER_PLACEHOLDER: '/AppImages/dummy-card/bg-fl.png',
  PROFILE_COVER_PLACEHOLDER: '/AppImages/dummy-card/profile-cover.png',

  // ── Gender (self-hosted) ──
  GENDER_FEMALE: '/AppImages/gender/female.webp',
  GENDER_MALE: '/AppImages/gender/male.webp',

  // ── Logos (self-hosted, critical path) ──
  LOGO_MAIN: '/logos/flylive-logo.png',
  LOGO_TEXT: '/logos/flylive-text.png',
  LOGO_ICON: '/logos/flylive-logo-icon.webp',
  LOGO_SM: '/logos/flylive-logo-sm.webp',
  LOGO_XL: '/logos/flylive-logo-xl.webp',

  // ── Auth page cards (self-hosted) ──
  AUTH_CARD_1: '/AppImages/dummy-card/1.jpg',
  AUTH_CARD_2: '/AppImages/dummy-card/2.jpg',
  AUTH_CARD_3: '/AppImages/dummy-card/3.jpg',
  AUTH_CARD_4: '/AppImages/dummy-card/4.jpg',
  AUTH_CARD_5: '/AppImages/dummy-card/5.jpg',
  AUTH_CARD_6: '/AppImages/dummy-card/6.jpg',

  // ── Videos (self-hosted for now, candidate for R2 migration) ──
  MALL_BG_VIDEO: '/background-decorations/mall-bg.mp4',

  // ── R2 CDN — Binary / Animations ──
  DEFAULT_FRAME: `${R2}/frames/10.svga`,
  MICE_WAVE_SVGA: `${R2}/vip/1/mice-wave.svga`,
  GIFT_DRAWER_ICON: `${R2}/shared/room/gift.webp`,
  DEFAULT_WEALTH_BADGE: `${R2}/badges/wealth/level_0.webp`,
  DEFAULT_CHARM_BADGE: `${R2}/badges/charm/level_0.webp`,
  DEFAULT_TRANSACTION_THUMB: `${R2}/badges/charm/level_0.webp`,

  // ── ImageKit CDN — UI Images ──
  DEFAULT_SEAT_IMG: `${IK}/siteAssets/seats/default-seat.webp`,
  LOCK_SEAT_IMG: `${IK}/siteAssets/seats/lock-seat.webp`,
  ROOM_CARD_TOP: `${IK}/siteAssets/room/room-card-top.webp`,
  DIAMOND_ICON: `${IK}/siteAssets/props/flylive-diamond.webp`,
  COIN_ICON: `${IK}/siteAssets/props/flylive_coin.webp`,
  HERO_SECONDARY: `${IK}/siteAssets/alt-hero/secondary.webp`,
  HERO_TERTIARY: `${IK}/siteAssets/alt-hero/tertiary.webp`,
  HERO_CHARM: `${IK}/siteAssets/alt-hero/charm.jpeg`,
  HERO_WEALTH: `${IK}/siteAssets/alt-hero/wealth.jpeg`,
  DEFAULT_ROOM_BADGE: `${IK}/badges/room/level_1.webp`,
  DEFAULT_PROFILE_BADGE: `${IK}/badges/profile-1.webp`,
  DEFAULT_HISTORY_BADGE: `${IK}/siteAssets/badges/badge-profile-1.webp`,
  DEFAULT_CHARM_LEVEL_BADGE: `${IK}/badges/charm/level_1.webp`,
  DEFAULT_WEALTH_LEVEL_BADGE: `${IK}/badges/wealth/level_1.webp`,
} as const

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

/** VIP card SVGA animation */
export const vipCardSvga = (level: number) =>
  `${R2}/vip/${level}/card.svga`

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

// ========================================
// Event Banners (ImageKit)
// ========================================

export const EVENT_BANNERS = {
  cp: {
    banner: `${IK}/siteAssets/banners/cp.webp`,
    header: `${IK}/siteAssets/banners/cp-header.webp`,
    decor: `${IK}/siteAssets/banners/decor-main-content.webp`,
  },
  country: {
    banner: `${IK}/siteAssets/banners/country.webp`,
    header: `${IK}/siteAssets/banners/country-header.svg`,
    decor: `${IK}/siteAssets/banners/decor-recharge-tycoon.webp`,
  },
  pretty_id: {
    banner: `${IK}/siteAssets/banners/pretty-id.webp`,
    header: `${IK}/siteAssets/banners/country-header.svg`,
    decor: `${IK}/siteAssets/banners/decor-recharge-tycoon.webp`,
  },
  recharge_tycoon: {
    banner: `${IK}/siteAssets/banners/recharge-tycoon.webp`,
    header: `${IK}/siteAssets/banners/country-header.svg`,
    decor: `${IK}/siteAssets/banners/decor-recharge-tycoon.webp`,
  },
  supreme_recharge: {
    banner: `${IK}/siteAssets/banners/supreme-recharge.webp`,
    header: `${IK}/siteAssets/banners/country-header.svg`,
    decor: `${IK}/siteAssets/banners/decor-recharge-tycoon.webp`,
  },
} as const satisfies Record<
  string,
  { banner: string; header: string; decor: string }
>
