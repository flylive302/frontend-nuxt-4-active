// Pure function — no Vue reactivity, no store imports.
// Resolves display metadata for a milestone reward from already-loaded bootstrap data.

import type { MilestoneReward } from '~/types/mission/recharge'
import type { BootstrapProp, VipLevel } from '~/types/user/bootstrap'
import type { Badge } from '~/types/progression/badge'

export interface ResolvedRewardAsset {
  name: string
  /** Static image shown inline inside the milestone card. May be an animated URL (VIP emblem). */
  thumbnailUrl: string | null
  /** Animated/playable asset URL. Non-null = clicking the thumbnail opens the preview modal. */
  assetUrl: string | null
  /** Prop type string (from BootstrapProp.type). Only set when reward_type === 'prop'. */
  propType: string | null
  /** Catalog prop id. Only set when reward_type === 'prop'. */
  propId: number | null
  /** Free-form prop metadata (e.g. `mice_wave` ring color). Only set when reward_type === 'prop'. */
  metadata: Record<string, unknown> | null
}

export function resolveRewardAsset(
  reward: MilestoneReward,
  propIndex: Record<number, BootstrapProp>,
  vipLevels: VipLevel[],
  badgeMap: Map<number, Badge>,
): ResolvedRewardAsset | null {
  if (reward.reward_type === 'coins' || reward.reward_id === null) return null

  if (reward.reward_type === 'prop') {
    const prop = propIndex[reward.reward_id]
    if (!prop) return null
    return {
      name: prop.name,
      thumbnailUrl: prop.thumbnail_url,
      assetUrl: prop.asset_url,
      propType: prop.type,
      propId: reward.reward_id,
      metadata: prop.metadata ?? null,
    }
  }

  if (reward.reward_type === 'vip') {
    const vip = vipLevels.find(v => v.id === reward.reward_id)
    if (!vip) return null
    return {
      name: `VIP Level ${vip.level}`,
      thumbnailUrl: vip.emblem_animated_url,
      assetUrl: vip.card_animated_url,
      propType: null,
      propId: null,
      metadata: null,
    }
  }

  if (reward.reward_type === 'badge') {
    const badge = badgeMap.get(reward.reward_id)
    if (!badge) return null
    return {
      name: badge.name,
      thumbnailUrl: badge.image_url,
      assetUrl: null,
      propType: null,
      propId: null,
      metadata: null,
    }
  }

  return null
}
