// ========================================
// Exchange Types
// ========================================

/**
 * Exchange rate information response.
 * GET /api/v1/user/exchange
 */
export interface ExchangeInfo {
  /** Exchange rate: 1 diamond = X coins */
  coins_per_diamond: number
  /** Whether exchange feature is enabled */
  is_enabled: boolean
  /** User's current coin balance */
  user_coins_balance: string
  /** User's current diamond balance */
  user_diamonds_balance: number
}

/**
 * Exchange request payload.
 * POST /api/v1/user/exchange
 */
export interface ExchangeRequest {
  /** Number of diamonds to exchange (positive integer ≥1) */
  diamond_amount: number
}

/**
 * Exchange result response.
 * POST /api/v1/user/exchange success response
 */
export interface ExchangeResult {
  /** Number of diamonds deducted from user */
  diamonds_deducted: number
  /** Number of coins received by user */
  coins_received: number
  /** User's new coin balance after exchange */
  new_coin_balance: string
  /** User's new diamond balance after exchange */
  new_diamond_balance: number
  /** Exchange rate used for this transaction */
  exchange_rate: number
}
