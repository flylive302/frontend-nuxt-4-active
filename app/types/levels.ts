// ========================================
// User Level Types
// ========================================

/**
 * Badge information for a level.
 */
export interface LevelBadge {
  id: number
  name: string
  image_url: string
}

/**
 * Next level info.
 */
export interface NextLevelInfo {
  level: number
  name: string
  required_xp: number
}

/**
 * Level status for a user (wealth or charm).
 */
export interface LevelStatus {
  current_level: number
  level_name: string
  current_xp: number
  xp_for_next_level: number
  xp_remaining: number
  progress_percentage: number
  badge: LevelBadge | null
  next_level: NextLevelInfo | null
}

/**
 * User levels response from /profile/levels.
 */
export interface UserLevelsResponse {
  wealth: LevelStatus
  charm: LevelStatus
}

/**
 * Level configuration item.
 */
export interface LevelConfigItem {
  level: number
  name: string
  required_xp: number
  badge: {
    id: number
    name: string
    description?: string
    image_url: string
    category: 'wealth' | 'charm'
  }
}

/**
 * Level configuration response from /levels/config.
 */
export interface LevelConfigResponse {
  wealth_levels: LevelConfigItem[]
  charm_levels: LevelConfigItem[]
}
