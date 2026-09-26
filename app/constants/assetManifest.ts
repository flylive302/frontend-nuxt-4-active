import type { AssetScope, AssetType, AssetPriority } from '~/types/asset/asset'
import { ASSETS } from '~/constants/assets'

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

/**
 * Empty since boot-and-asset-delivery ticket 02: every entry that used to live here
 * (room-bg placeholder, profile cover, heroes, avatar/seat placeholders, coin icon) is now
 * bundled static UI (`app/constants/assets.ts` → `/images/ui/*.webp`), shipped inside the app
 * itself instead of precached from the CDN. Precaching a bundled file was also never correct:
 * `<img>` never reads Cache Storage, and the precache URL didn't match the render URL anyway.
 */
export const MANUAL_ASSET_MANIFEST: AssetManifestItem[] = []


export const PAGE_ASSET_MANIFESTS: Record<string, AssetManifestItem[]> = {
    mall: [
        {
            url: ASSETS.MALL_BG_VIDEO,
            assetType: 'video',
            scope: 'mall',
            priority: 'high',
            groupKey: 'page-mall',
        },
        // GIFT_DRAWER_ICON moved to bundled static UI (boot-and-asset-delivery ticket 02).
    ],
    // DEFAULT_TRANSACTION_THUMB moved to bundled static UI (boot-and-asset-delivery ticket 02).
    wallet: [],
    // DEFAULT_CHARM_BADGE / DEFAULT_WEALTH_BADGE / DEFAULT_ROOM_BADGE / DEFAULT_PROFILE_BADGE
    // all moved to bundled static UI (boot-and-asset-delivery ticket 02).
    badges: [],
}
