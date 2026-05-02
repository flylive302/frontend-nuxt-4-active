import type { AssetScope, AssetType, AssetPriority } from '~/types/asset/asset'
import { ASSETS, vipAssetBase } from '~/constants/assets'

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
        url: ASSETS.ROOM_BG_PLACEHOLDER,
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
]

const VipAssets: [string, string, string][] = [
    ['card', 'svga', 'svga'],
    ['badge', 'image', 'webp'],
    ['emblem', 'svga', 'svga'],
    ['border', 'image', 'webp']
];
for (let i = 1; i < 9; i++) {
    for (const asset of VipAssets) {
        MANUAL_ASSET_MANIFEST.push({
            url: `${vipAssetBase(i)}/${asset[0]}.${asset[2]}`,
            assetType: '' + asset[1],
            scope: 'global',
            priority: 'low',
            groupKey: 'app-shell',
            sortOrder: 6 + i,
        });
    }
}


export const PAGE_ASSET_MANIFESTS: Record<string, AssetManifestItem[]> = {
    mall: [],
    wallet: [],
    badges: [],
}