// ========================================
// User Level Types
// ========================================
// Re-export from bootstrap for consistency

export type {
  LevelStatus,
  LevelConfig,
  LevelBadge,
} from '../user/bootstrap'

// ========================================
// Legacy Types (for components still using old names)
// ========================================

/**
 * Next level info.
 * @deprecated Use LevelStatus.next_level directly
 */
export interface NextLevelInfo {
  level: number
  name: string
  required_xp: number
}

/**
 * User levels response.
 * @deprecated Use bootstrap user_data.levels
 */
export interface UserLevelsResponse {
  wealth: import('../user/bootstrap').LevelStatus
  charm: import('../user/bootstrap').LevelStatus
}

/**
 * Level configuration item.
 * @deprecated Use bootstrap config.*_levels
 */
export type LevelConfigItem = import('../user/bootstrap').LevelConfig

/**
 * Level configuration response.
 * @deprecated Endpoint removed - use bootstrap config
 */
export interface LevelConfigResponse {
  wealth_levels: import('../user/bootstrap').LevelConfig[]
  charm_levels: import('../user/bootstrap').LevelConfig[]
}
