// ========================================
// Exchange Types
// ========================================

/**
 * Exchange rate information response.
 */
export interface ExchangeInfo {
  coins_per_diamond: number
  min_exchange_amount: number
  max_per_transaction: number
  daily_limit: number
  is_enabled: boolean
  user_coins_balance: number
  user_diamonds_balance: number
  today_exchanged: number
  daily_remaining: number
}

/**
 * Exchange preview response.
 */
export interface ExchangePreview {
  coins_to_deduct: number
  diamonds_to_receive: number
  leftover_coins: number
  exchange_rate: number
}

/**
 * Exchange result response.
 */
export interface ExchangeResult {
  coins_deducted: string
  diamonds_received: number
  new_coin_balance: string
  new_diamond_balance: number
  exchange_rate: number
}

/**
 * Exchange request payload.
 */
export interface ExchangeRequest {
  coin_amount: number
}
