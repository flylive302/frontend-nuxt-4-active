import type { AssetScope, AssetType, AssetPriority } from '~/types/asset/asset'
import {returns} from "valibot";

type VipAssetName = 'card' | 'badge' | 'emblem' | 'border';
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
        url: '/AppImages/dummy-card/room-bg.png',
        assetType: 'image',
        scope: 'global',
        priority: 'critical',
        groupKey: 'app-shell',
        sortOrder: 0,
    },
    {
        url: '/AppImages/dummy-card/profile-cover.png',
        assetType: 'image',
        scope: 'global',
        priority: 'critical',
        groupKey: 'app-shell',
        sortOrder: 1,
    },
    {
        url: 'https://ik.imagekit.io/flylive/siteAssets/alt-hero/secondary.webp',
        assetType: 'image',
        scope: 'global',
        priority: 'low',
        groupKey: 'app-shell',
        sortOrder: 2,
    },
    {
        url: 'https://ik.imagekit.io/flylive/siteAssets/props/flylive-diamond.webp',
        assetType: 'image',
        scope: 'global',
        priority: 'low',
        groupKey: 'app-shell',
        sortOrder: 3,
    },
    {
        url: 'https://ik.imagekit.io/flylive/siteAssets/alt-hero/tertiary.webp',
        assetType: 'image',
        scope: 'global',
        priority: 'low',
        groupKey: 'app-shell',
        sortOrder: 4,
    },
    {
        url: '/AppImages/dummy-card/avatar.png',
        assetType: 'image',
        scope: 'global',
        priority: 'critical',
        groupKey: 'app-shell',
        sortOrder: 5,
    },
]

const VipAssets = [
    ['card', 'svga', 'svga'],
    ['badge', 'image', 'webp'],
    ['emblem', 'svga', 'svga'],
    ['border', 'image', 'webp']
];
for (let i = 1; i < 9; i++) {
    for (const asset of VipAssets) {
        MANUAL_ASSET_MANIFEST.push({
            url: `https://assets.flyliveapp.com/vip/${i}/${asset[0]}.${asset[2]}`,
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