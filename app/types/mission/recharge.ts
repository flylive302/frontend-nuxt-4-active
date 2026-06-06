// Mirrors GET /api/v1/missions/recharge/{timeframe}
// Backend: app/Http/Controllers/Api/V1/Mission/MissionProgressController.php

export type MilestoneState = 'locked' | 'claimable' | 'claimed'

export type RewardType = 'prop' | 'badge' | 'vip' | 'coins'

export type CoinRewardMode = 'fixed' | 'percentage'

export interface MilestoneReward {
  readonly id: number
  readonly reward_type: RewardType
  readonly reward_id: number | null
  readonly duration_days: number | null
  readonly coin_mode: CoinRewardMode | null
  readonly coin_value: number | null
  readonly sort_order: number
}

export interface MilestoneProgress {
  readonly id: number
  readonly threshold: number
  readonly sort_order: number
  state: MilestoneState
  readonly rewards: readonly MilestoneReward[]
}

export interface MissionConfig {
  timeframes: string[]
  ranking_timeframes: string[]
  ranking_depth: number
  finale_warning_seconds: number
  ranking_poll_seconds: number
  finale_poll_seconds: number
  announcement_sounds: Record<string, string | null>
  rules: string
}

export interface MissionProgressResponse {
  mission_type: string
  timeframe: string
  server_time: string
  net_volume: number
  resets_at: string
  config: MissionConfig | null
  milestones: MilestoneProgress[]
}
