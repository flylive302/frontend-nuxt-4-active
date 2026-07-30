import type { AssetScope, AssetType, AssetPriority } from '~/types/asset/asset'
import { ASSETS } from '~/constants/assets'
import { roomBackgroundImageSrc } from '~/utils/imagekit'

/**
 * Precached room-background variant.
 *
 * `ASSETS.ROOM_BG_PLACEHOLDER` is intentionally base-only (callers size it per layout), so
 * precaching the bare constant downloaded the **full-size original** for every user at
 * bootstrap — bytes no call site ever requests, because a precache entry only serves a render
 * when the two URLs match byte-for-byte.
 *
 * This reproduces the carousel + high-fetch-priority variant, i.e. the same URL the LCP
 * room card requests. Keep it in sync with `roomBackgroundImageSrc`; if that helper's widths
 * change, this follows automatically.
 */
const ROOM_BG_PLACEHOLDER_PRECACHE = roomBackgroundImageSrc(ASSETS.ROOM_BG_PLACEHOLDER, 'carousel', true)

export interface AssetManifestItem {
    url: string
    assetType: AssetType
    scope: AssetScope
    priority: AssetPriority
    groupKey?: string
    giftId?: number
    badgeId?: number
    sortOrder?: number
}

export const MANUAL_ASSET_MANIFEST: AssetManifestItem[] = [
    {
        url: ROOM_BG_PLACEHOLDER_PRECACHE,
        assetType: 'image',
        scope: 'global',
        priority: 'critical',
        groupKey: 'app-shell',
        sortOrder: 0,
    },
    {
        url: ASSETS.PROFILE_COVER_PLACEHOLDER,
        assetType: 'image',
        scope: 'global',
        priority: 'critical',
        groupKey: 'app-shell',
        sortOrder: 1,
    },
    {
        url: ASSETS.HERO_SECONDARY,
        assetType: 'image',
        scope: 'global',
        priority: 'low',
        groupKey: 'app-shell',
        sortOrder: 2,
    },
    {
        url: ASSETS.DIAMOND_ICON,
        assetType: 'image',
        scope: 'global',
        priority: 'low',
        groupKey: 'app-shell',
        sortOrder: 3,
    },
    {
        url: ASSETS.HERO_TERTIARY,
        assetType: 'image',
        scope: 'global',
        priority: 'low',
        groupKey: 'app-shell',
        sortOrder: 4,
    },
    {
        url: ASSETS.AVATAR_PLACEHOLDER,
        assetType: 'image',
        scope: 'global',
        priority: 'critical',
        groupKey: 'app-shell',
        sortOrder: 5,
    },
    {
        url: ASSETS.DEFAULT_SEAT_IMG,
        assetType: 'image',
        scope: 'global',
        priority: 'critical',
        groupKey: 'app-shell',
        sortOrder: 6,
    },
    {
        url: ASSETS.LOCK_SEAT_IMG,
        assetType: 'image',
        scope: 'global',
        priority: 'critical',
        groupKey: 'app-shell',
        sortOrder: 7,
    },
    {
        url: ASSETS.COIN_ICON,
        assetType: 'image',
        scope: 'global',
        priority: 'critical',
        groupKey: 'app-shell',
        sortOrder: 8,
    },
]


export const PAGE_ASSET_MANIFESTS: Record<string, AssetManifestItem[]> = {
    mall: [
        {
            url: ASSETS.MALL_BG_VIDEO,
            assetType: 'video',
            scope: 'mall',
            priority: 'high',
            groupKey: 'page-mall',
        },
        {
            url: ASSETS.GIFT_DRAWER_ICON,
            assetType: 'image',
            scope: 'mall',
            priority: 'normal',
            groupKey: 'page-mall',
        },
    ],
    wallet: [
        {
            url: ASSETS.DEFAULT_TRANSACTION_THUMB,
            assetType: 'image',
            scope: 'wallet',
            priority: 'high',
            groupKey: 'page-wallet',
        },
    ],
    badges: [
        {
            url: ASSETS.DEFAULT_CHARM_BADGE,
            assetType: 'image',
            scope: 'badge',
            priority: 'high',
            groupKey: 'page-badges',
        },
        {
            url: ASSETS.DEFAULT_WEALTH_BADGE,
            assetType: 'image',
            scope: 'badge',
            priority: 'high',
            groupKey: 'page-badges',
        },
        {
            url: ASSETS.DEFAULT_ROOM_BADGE,
            assetType: 'image',
            scope: 'badge',
            priority: 'normal',
            groupKey: 'page-badges',
        },
        {
            url: ASSETS.DEFAULT_PROFILE_BADGE,
            assetType: 'image',
            scope: 'badge',
            priority: 'normal',
            groupKey: 'page-badges',
        },
    ],
}