import type { GiftAssetType } from '~/types/gift/gift'

/**
 * Single source of truth for inferring an asset's render type from its URL.
 * Props/VipProps carry no `asset_type` discriminator, so the extension decides.
 */
export function inferAssetType(url: string | null | undefined): GiftAssetType {
  const l = (url ?? '').toLowerCase()
  if (l.endsWith('.svga')) return 'svga'
  if (l.endsWith('.mp4')) return 'vap'
  if (l.endsWith('.webm')) return 'video'
  return 'image'
}
