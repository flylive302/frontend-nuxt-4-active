import type { BootstrapProp } from '~/types/user/bootstrap'
import type { Gift } from '~/types/gift/gift'
import { inferAssetType } from '~/utils/asset'

/**
 * Converts a BootstrapProp into a synthetic Gift so the gift playback
 * pipeline can render entry animations without a separate code path.
 * Uses a negative ID to guarantee no collision with real gift IDs.
 */
export function propToEntryAnimationGift(prop: BootstrapProp): Gift {
  return {
    id: -prop.id,
    name: prop.name,
    label: null,
    description: null,
    price: 0,
    thumbnail_url: prop.thumbnail_url,
    animation_url: prop.asset_url,
    asset_type: inferAssetType(prop.asset_url),
    category: 'normal',
    rarity: 'common',
    sort_order: 0,
    is_critical: false,
  }
}
