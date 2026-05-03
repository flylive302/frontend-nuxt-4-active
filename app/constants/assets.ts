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

  // ── Logos (self-hosted, critical path) ──
  LOGO_MAIN: '/logos/flylive-logo.webp',
  LOGO_TEXT: '/logos/flylive-text.png',
  LOGO_ICON: '/logos/flylive-logo-icon.webp',
  LOGO_SM: '/logos/flylive-logo-sm.webp',
  LOGO_XL: '/logos/flylive-logo-xl.webp',

  // ── R2 CDN — Binary / Animations ──
  DEFAULT_FRAME: `${R2}/frames/10.svga`,
  MICE_WAVE_SVGA: `${R2}/vip/1/mice-wave.svga`,
  DEFAULT_WEALTH_BADGE: `${R2}/badges/wealth/level_0.webp`,
  DEFAULT_CHARM_BADGE: `${R2}/badges/charm/level_0.webp`,
  DEFAULT_TRANSACTION_THUMB: `${R2}/badges/charm/level_0.webp`,

  // ── ImageKit CDN — UI Images ──
  GIFT_DRAWER_ICON: `${IK}/placeholders/gift-icon.png`,
  DEFAULT_SEAT_IMG: `${IK}/placeholders/seat.webp`,
  LOCK_SEAT_IMG: `${IK}/placeholders/seat-locked.webp`,
  ROOM_CARD_TOP: `${IK}/siteAssets/room/room-card-top.webp`,
  DIAMOND_ICON: `${IK}/placeholders/diamond-icon.webp`,
  COIN_ICON: `${IK}/placeholders/coin-icon.webp`,
  HERO_SECONDARY: `${IK}/placeholders/secondary.webp`,
  HERO_TERTIARY: `${IK}/placeholders/tertiary.webp`,
  HERO_CHARM: `${IK}/placeholders/charm.webp`,
  HERO_WEALTH: `${IK}/placeholders/wealth.webp`,
  DEFAULT_ROOM_BADGE: `${IK}/badges/room/level_1.webp`,
  DEFAULT_PROFILE_BADGE: `${IK}/badges/profile-1.webp`,
  DEFAULT_HISTORY_BADGE: `${IK}/badges/profile-1.webp`,
  DEFAULT_CHARM_LEVEL_BADGE: `${IK}/badges/charm/level_1.webp`,
  DEFAULT_WEALTH_LEVEL_BADGE: `${IK}/badges/wealth/level_1.webp`,

  // ── Auth page cards ──
  AUTH_CARD_1: `${IK}/placeholders/1.webp`,
  AUTH_CARD_2: `${IK}/placeholders/2.webp`,
  AUTH_CARD_3: `${IK}/placeholders/3.webp`,
  AUTH_CARD_4: `${IK}/placeholders/4.webp`,
  AUTH_CARD_5: `${IK}/placeholders/5.webp`,
  AUTH_CARD_6: `${IK}/placeholders/6.webp`,

  COVER_PLACEHOLDER: `${IK}/placeholders/profile-bg.jpeg`,

  // ── Gender (self-hosted) ──
  GENDER_FEMALE: `${IK}/gender/female.webp`,
  GENDER_MALE: `${IK}/gender/male.webp`,

  // ── Placeholders & Fallbacks (precached by SW) ──
  AVATAR_PLACEHOLDER: `${IK}/placeholders/avatar.webp`,
  ROOM_BG_PLACEHOLDER: `${IK}/placeholders/room-background.webp`,
  PROFILE_COVER_PLACEHOLDER: `${IK}/placeholders/profile-cover.webp`,

  // ── Videos (self-hosted for now, candidate for R2 migration) ──
  MALL_BG_VIDEO: `${IK}/mall/mall-bg.mp4`,

  // VIP UI ASSETS
  VIP_BACKGROUND: `${IK}/vip/background.png`,

  VIP: {
    1: {
      flag: `${IK}/vip/1/flag.png`,
      badge: `${IK}/vip/1/badge.webp`,
      card: `${IK}/vip/1/card.webp`,
      cardAnimated: `${R2}/vip/1/card.svga`,
      emblem: `${IK}/vip/1/emblem.webp`,
      emblemAnimated: `${R2}/vip/1/emblem.svga`,
      miceWave: `${IK}/vip/1/mice-wave.png`,
      miceWaveAnimated: `${R2}/vip/1/mice-wave.svga`,
      chatBubble: `${IK}/vip/1/chat-bubble.webp`,
      frame: `${IK}/vip/1/frame.webp`,
      frameAnimated: `${R2}/vip/1/frame.svga`,
    },
    2: {
      flag: `${IK}/vip/2/flag.png`,
      badge: `${IK}/vip/2/badge.webp`,
      card: `${IK}/vip/2/card.webp`,
      cardAnimated: `${R2}/vip/2/card.svga`,
      emblem: `${IK}/vip/2/emblem.webp`,
      emblemAnimated: `${R2}/vip/2/emblem.svga`,
      miceWave: `${IK}/vip/2/mice-wave.png`,
      miceWaveAnimated: `${R2}/vip/2/mice-wave.svga`,
      chatBubble: `${IK}/vip/2/chat-bubble.webp`,
      frame: `${IK}/vip/2/frame.webp`,
      frameAnimated: `${R2}/vip/2/frame.svga`,
    },
    3: {
      flag: `${IK}/vip/3/flag.png`,
      badge: `${IK}/vip/3/badge.png`,
      card: `${IK}/vip/3/card.webp`,
      cardAnimated: `${R2}/vip/3/card.mp4`,
      emblem: `${IK}/vip/3/emblem.webp`,
      emblemAnimated: `${R2}/vip/3/emblem.svga`,
      miceWave: `${IK}/vip/3/mice-wave.png`,
      miceWaveAnimated: `${R2}/vip/3/mice-wave.svga`,
      chatBubble: `${IK}/vip/3/chat-bubble.webp`,
      frame: `${IK}/vip/3/frame.webp`,
      frameAnimated: `${R2}/vip/3/frame.svga`,
    },
    4: {
      flag: `${IK}/vip/4/flag.png`,
      badge: `${IK}/vip/4/badge.png`,
      card: `${IK}/vip/4/card.webp`,
      cardAnimated: `${R2}/vip/4/card.mp4`,
      emblem: `${IK}/vip/4/emblem.webp`,
      emblemAnimated: `${R2}/vip/4/emblem.svga`,
      miceWave: `${IK}/vip/4/mice-wave.png`,
      miceWaveAnimated: `${R2}/vip/4/mice-wave.svga`,
      chatBubble: `${IK}/vip/4/chat-bubble.webp`,
      frame: `${IK}/vip/4/frame.webp`,
      frameAnimated: `${R2}/vip/4/frame.svga`,
    },
    5: {
      flag: `${IK}/vip/5/flag.png`,
      badge: `${IK}/vip/5/badge.png`,
      card: `${IK}/vip/5/card.webp`,
      cardAnimated: `${R2}/vip/5/card.mp4`,
      emblem: `${IK}/vip/5/emblem.webp`,
      emblemAnimated: `${R2}/vip/5/emblem.svga`,
      miceWave: `${IK}/vip/5/mice-wave.png`,
      miceWaveAnimated: `${R2}/vip/5/mice-wave.svga`,
      chatBubble: `${IK}/vip/5/chat-bubble.webp`,
      frame: `${IK}/vip/5/frame.webp`,
      frameAnimated: `${R2}/vip/5/frame.svga`,
    },
    6: {
      flag: `${IK}/vip/6/flag.png`,
      badge: `${IK}/vip/6/badge.png`,
      card: `${IK}/vip/6/card.webp`,
      cardAnimated: `${R2}/vip/6/card.mp4`,
      emblem: `${IK}/vip/6/emblem.webp`,
      emblemAnimated: `${R2}/vip/6/emblem.svga`,
      miceWave: `${IK}/vip/6/mice-wave.png`,
      miceWaveAnimated: `${R2}/vip/6/mice-wave.svga`,
      chatBubble: `${IK}/vip/6/chat-bubble.webp`,
      frame: `${IK}/vip/6/frame.webp`,
      frameAnimated: `${R2}/vip/6/frame.svga`,
    },
    7: {
      flag: `${IK}/vip/7/flag.png`,
      badge: `${IK}/vip/7/badge.png`,
      card: `${IK}/vip/7/card.webp`,
      cardAnimated: `${R2}/vip/7/card.mp4`,
      emblem: `${IK}/vip/7/emblem.webp`,
      emblemAnimated: `${R2}/vip/7/emblem.svga`,
      miceWave: `${IK}/vip/7/mice-wave.png`,
      miceWaveAnimated: `${R2}/vip/7/mice-wave.svga`,
      chatBubble: `${IK}/vip/7/chat-bubble.webp`,
      frame: `${IK}/vip/7/frame.webp`,
      frameAnimated: `${R2}/vip/7/frame.svga`,
    },
    8: {
      flag: `${IK}/vip/8/flag.png`,
      badge: `${IK}/vip/8/badge.png`,
      card: `${IK}/vip/8/card.webp`,
      cardAnimated: `${R2}/vip/8/card.mp4`,
      emblem: `${IK}/vip/8/emblem.webp`,
      emblemAnimated: `${R2}/vip/8/emblem.svga`,
      miceWave: `${IK}/vip/8/mice-wave.png`,
      miceWaveAnimated: `${R2}/vip/8/mice-wave.svga`,
      chatBubble: `${IK}/vip/8/chat-bubble.webp`,
      frame: `${IK}/vip/8/frame.webp`,
      frameAnimated: `${R2}/vip/8/frame.svga`,
    },
    9: {
      flag: `${IK}/vip/9/flag.png`,
      badge: `${IK}/vip/9/badge.png`,
      card: `${IK}/vip/9/card.webp`,
      cardAnimated: `${R2}/vip/9/card.mp4`,
      emblem: `${IK}/vip/9/emblem.webp`,
      emblemAnimated: `${R2}/vip/9/emblem.svga`,
      miceWave: `${IK}/vip/9/mice-wave.png`,
      miceWaveAnimated: `${R2}/vip/9/mice-wave.svga`,
      chatBubble: `${IK}/vip/9/chat-bubble.webp`,
      frame: `${IK}/vip/9/frame.webp`,
      frameAnimated: `${R2}/vip/9/frame.svga`,
    },
    10: {
      flag: `${IK}/vip/10/flag.png`,
      badge: `${IK}/vip/10/badge.png`,
      card: `${IK}/vip/10/card.webp`,
      cardAnimated: `${R2}/vip/10/card.mp4`,
      emblem: `${IK}/vip/10/emblem.webp`,
      emblemAnimated: `${R2}/vip/10/emblem.svga`,
      miceWave: `${IK}/vip/10/mice-wave.png`,
      miceWaveAnimated: `${R2}/vip/10/mice-wave.svga`,
      chatBubble: `${IK}/vip/10/chat-bubble.webp`,
      frame: `${IK}/vip/10/frame.webp`,
      frameAnimated: `${R2}/vip/10/frame.svga`,
    },
    11: {
      flag: `${IK}/vip/11/flag.png`,
      badge: `${IK}/vip/11/badge.png`,
      card: `${IK}/vip/11/card.webp`,
      cardAnimated: `${R2}/vip/11/card.mp4`,
      emblem: `${IK}/vip/11/emblem.webp`,
      emblemAnimated: `${R2}/vip/11/emblem.svga`,
      miceWave: `${IK}/vip/11/mice-wave.png`,
      miceWaveAnimated: `${R2}/vip/11/mice-wave.svga`,
      chatBubble: `${IK}/vip/11/chat-bubble.webp`,
      frame: `${IK}/vip/11/frame.webp`,
      frameAnimated: `${R2}/vip/11/frame.svga`,
    },
    12: {
      flag: `${IK}/vip/12/flag.png`,
      badge: `${IK}/vip/12/badge.png`,
      card: `${IK}/vip/12/card.webp`,
      cardAnimated: `${R2}/vip/12/card.mp4`,
      emblem: `${IK}/vip/12/emblem.webp`,
      emblemAnimated: `${R2}/vip/12/emblem.svga`,
      miceWave: `${IK}/vip/12/mice-wave.png`,
      miceWaveAnimated: `${R2}/vip/12/mice-wave.svga`,
      chatBubble: `${IK}/vip/12/chat-bubble.webp`,
      frame: `${IK}/vip/12/frame.webp`,
      frameAnimated: `${R2}/vip/12/frame.svga`,
    },
    13: {
      flag: `${IK}/vip/13/flag.png`,
      badge: `${IK}/vip/13/badge.png`,
      card: `${IK}/vip/13/card.webp`,
      cardAnimated: `${R2}/vip/13/card.mp4`,
      emblem: `${IK}/vip/13/emblem.webp`,
      emblemAnimated: `${R2}/vip/13/emblem.svga`,
      miceWave: `${IK}/vip/13/mice-wave.png`,
      miceWaveAnimated: `${R2}/vip/13/mice-wave.svga`,
      chatBubble: `${IK}/vip/13/chat-bubble.webp`,
      frame: `${IK}/vip/13/frame.webp`,
      frameAnimated: `${R2}/vip/13/frame.svga`,
    },
    14: {
      flag: `${IK}/vip/14/flag.png`,
      badge: `${IK}/vip/14/badge.png`,
      card: `${IK}/vip/14/card.webp`,
      cardAnimated: `${R2}/vip/14/card.mp4`,
      emblem: `${IK}/vip/14/emblem.webp`,
      emblemAnimated: `${R2}/vip/14/emblem.svga`,
      miceWave: `${IK}/vip/14/mice-wave.png`,
      miceWaveAnimated: `${R2}/vip/14/mice-wave.svga`,
      chatBubble: `${IK}/vip/14/chat-bubble.webp`,
      frame: `${IK}/vip/14/frame.webp`,
      frameAnimated: `${R2}/vip/14/frame.svga`,
    },
    15: {
      flag: `${IK}/vip/15/flag.png`,
      badge: `${IK}/vip/15/badge.png`,
      card: `${IK}/vip/15/card.webp`,
      cardAnimated: `${R2}/vip/15/card.mp4`,
      emblem: `${IK}/vip/15/emblem.webp`,
      emblemAnimated: `${R2}/vip/15/emblem.svga`,
      miceWave: `${IK}/vip/15/mice-wave.png`,
      miceWaveAnimated: `${R2}/vip/15/mice-wave.svga`,
      chatBubble: `${IK}/vip/15/chat-bubble.webp`,
      frame: `${IK}/vip/15/frame.webp`,
      frameAnimated: `${R2}/vip/15/frame.svga`,
    }
  },
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

export const EVENT_BANNERS = {
  cp: {
    banner: `${IK}/banners/cp.webp`,
    header: `${IK}/banners/cp-header.webp`,
    decor: `${IK}/banners/decor-main-content.webp`,
  },
  country: {
    banner: `${IK}/banners/country.webp`,
    header: `${IK}/banners/country-header.svg`,
    decor: `${IK}/banners/decor-recharge-tycoon.webp`,
  },
  pretty_id: {
    banner: `${IK}/banners/pretty-id.webp`,
    header: `${IK}/banners/country-header.svg`,
    decor: `${IK}/banners/decor-recharge-tycoon.webp`,
  },
  recharge_tycoon: {
    banner: `${IK}/banners/recharge-tycoon.webp`,
    header: `${IK}/banners/country-header.svg`,
    decor: `${IK}/banners/decor-recharge-tycoon.webp`,
  },
  supreme_recharge: {
    banner: `${IK}/banners/supreme-recharge.webp`,
    header: `${IK}/banners/country-header.svg`,
    decor: `${IK}/banners/decor-recharge-tycoon.webp`,
  },
} as const satisfies Record<
  string,
  { banner: string; header: string; decor: string }
>
